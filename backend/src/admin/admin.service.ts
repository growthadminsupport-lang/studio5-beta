import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { ageInMonths } from '../common/age';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { compilePubertyResult } from '../puberty/puberty-screening.util';
import { ReviewDoctorDto } from './dto/review-doctor.dto';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';

export type ExportDataset = 'growth' | 'puberty' | 'bone-age';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function csvCell(v: unknown) {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]) {
  return (
    [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
  );
}

/** Year and month only. A full date next to an age narrows a child down more than it needs to. */
function yearMonth(d: Date) {
  return d.toISOString().slice(0, 7);
}

/**
 * The admin portal: doctors, articles, the inbox, usage, and an anonymised export.
 *
 * An admin runs the service, not the children. Nothing here returns a child's name, date of
 * birth, hospital number or a parent's contact details, and there is no route that opens one
 * child's record (docs/user-flows.md §6).
 */
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {}

  // --- Doctors ---------------------------------------------------------------------------

  listDoctors(status?: string) {
    const valid = ['PENDING', 'APPROVED', 'REJECTED'];
    return this.prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        deletedAt: null,
        ...(status && valid.includes(status)
          ? { doctorStatus: status as 'PENDING' }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        licenseNumber: true,
        hospital: true,
        doctorStatus: true,
        doctorReviewNote: true,
        createdAt: true,
      },
    });
  }

  async reviewDoctor(doctorId: string, dto: ReviewDoctorDto) {
    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
    });
    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new NotFoundException('Doctor account not found');
    }
    if (dto.decision === 'REJECTED' && !dto.note?.trim()) {
      throw new BadRequestException(
        'Give the doctor a reason for the rejection',
      );
    }
    await this.prisma.user.update({
      where: { id: doctorId },
      data: {
        doctorStatus: dto.decision,
        doctorReviewNote: dto.note?.trim() || null,
      },
    });
    await this.notifications.notify([doctorId], {
      type: 'DOCTOR_REVIEWED',
      title:
        dto.decision === 'APPROVED'
          ? 'Your doctor account is approved'
          : 'Your doctor account was not approved',
      body:
        dto.decision === 'APPROVED'
          ? 'You can now accept invitations from parents and add bone-age records.'
          : `Reason: ${dto.note?.trim()}. Contact support if you think this is a mistake.`,
      path: '/dashboard',
      email: true,
    });
    return { success: true };
  }

  // --- Articles --------------------------------------------------------------------------

  listArticles() {
    return this.prisma.article.findMany({
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createArticle(dto: CreateArticleDto) {
    const { published, ...fields } = dto;
    try {
      return await this.prisma.article.create({
        data: {
          ...fields,
          slug: dto.slug || slugify(dto.title),
          publishedAt: published ? new Date() : null,
        },
        include: { category: true },
      });
    } catch (err) {
      throw this.articleError(err);
    }
  }

  async updateArticle(id: string, dto: UpdateArticleDto) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Article not found');
    const { published, ...fields } = dto;
    try {
      return await this.prisma.article.update({
        where: { id },
        data: {
          ...fields,
          ...(published === undefined
            ? {}
            : {
                publishedAt: published
                  ? (existing.publishedAt ?? new Date())
                  : null,
              }),
        },
        include: { category: true },
      });
    } catch (err) {
      throw this.articleError(err);
    }
  }

  async deleteArticle(id: string) {
    await this.prisma.bookmark.deleteMany({ where: { articleId: id } });
    await this.prisma.article.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Article not found');
    });
    return { success: true };
  }

  private articleError(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002')
        return new ConflictException('Another article already uses that slug');
      if (err.code === 'P2003')
        return new BadRequestException('That category does not exist');
    }
    return err;
  }

  // --- Inbox -----------------------------------------------------------------------------

  inbox(kind?: string, status?: string) {
    return this.prisma.supportMessage.findMany({
      where: {
        ...(kind === 'CONTACT' || kind === 'PROBLEM' ? { kind } : {}),
        ...(status === 'NEW' || status === 'READ' || status === 'RESOLVED'
          ? { status }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { fullName: true, role: true } } },
    });
  }

  async updateInbox(id: string, status: 'NEW' | 'READ' | 'RESOLVED') {
    return this.prisma.supportMessage
      .update({ where: { id }, data: { status } })
      .catch(() => {
        throw new NotFoundException('Message not found');
      });
  }

  // --- Usage -----------------------------------------------------------------------------

  async stats() {
    const since = new Date(Date.now() - 8 * WEEK_MS);
    const [
      usersByRole,
      pendingDoctors,
      children,
      growth,
      screenings,
      xrays,
      openInbox,
      recent,
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.user.count({
        where: { role: 'DOCTOR', doctorStatus: 'PENDING', deletedAt: null },
      }),
      this.prisma.child.count({ where: { deletedAt: null } }),
      this.prisma.growthRecord.count({ where: { deletedAt: null } }),
      this.prisma.pubertyScreening.count(),
      this.prisma.boneAgePrediction.count(),
      this.prisma.supportMessage.count({
        where: { status: { not: 'RESOLVED' } },
      }),
      Promise.all([
        this.prisma.growthRecord.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.pubertyScreening.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.boneAgePrediction.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.user.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
      ]),
    ]);

    // Eight weekly buckets, oldest first, ending now.
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = Date.now() - (7 - i) * WEEK_MS;
      return { start: new Date(end - WEEK_MS), end: new Date(end) };
    });
    const bucket = (rows: { createdAt: Date }[]) =>
      weeks.map(
        (w) =>
          rows.filter((r) => r.createdAt >= w.start && r.createdAt < w.end)
            .length,
      );
    const [g, p, b, u] = recent;

    const roleCounts = Object.fromEntries(
      usersByRole.map((r) => [r.role, r._count._all]),
    );
    const linkCounts = await this.prisma.childGuardian.groupBy({
      by: ['role'],
      _count: { _all: true },
    });

    return {
      totals: {
        users: usersByRole.reduce((n, r) => n + r._count._all, 0),
        usersByRole: roleCounts,
        pendingDoctors,
        childLinksByRole: Object.fromEntries(
          linkCounts.map((r) => [r.role, r._count._all]),
        ),
        children,
        growthEntries: growth,
        pubertyScreenings: screenings,
        xrays,
        openInbox,
      },
      weekly: {
        weekStarts: weeks.map((w) => w.start.toISOString().slice(0, 10)),
        signups: bucket(u),
        growthEntries: bucket(g),
        pubertyScreenings: bucket(p),
        xrays: bucket(b),
      },
    };
  }

  // --- Anonymised export -----------------------------------------------------------------

  /**
   * A stable pseudonym per child: the same child gets the same key across exports, so rows can
   * be joined, but the key cannot be turned back into the id without the server's secret.
   */
  private childKey(childId: string) {
    const secret =
      this.config.get<string>('EXPORT_SALT') ??
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', secret)
      .update(childId)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * CSV with no names, emails, phone numbers, hospital numbers, dates of birth or free text.
   * Each row carries a child pseudonym, sex, age in months and the measurement.
   */
  async exportCsv(dataset: ExportDataset): Promise<string> {
    if (dataset === 'growth') {
      const rows = await this.prisma.growthRecord.findMany({
        where: { deletedAt: null, child: { deletedAt: null } },
        include: { child: { select: { sex: true, dateOfBirth: true } } },
        orderBy: { measuredAt: 'asc' },
      });
      return toCsv(
        [
          'child_key',
          'sex',
          'month',
          'age_months',
          'height_cm',
          'weight_kg',
          'bmi',
          'height_percentile',
          'weight_percentile',
          'bmi_percentile',
          'height_sds',
          'weight_sds',
          'bmi_sds',
          'head_circumference_cm',
          'head_circumference_percentile',
        ],
        rows.map((r) => [
          this.childKey(r.childId),
          r.child.sex,
          yearMonth(r.measuredAt),
          ageInMonths(r.child.dateOfBirth, r.measuredAt).toFixed(1),
          r.heightCm,
          r.weightKg,
          r.bmi,
          r.heightPercentile,
          r.weightPercentile,
          r.bmiPercentile,
          r.heightSds,
          r.weightSds,
          r.bmiSds,
          r.headCircumferenceCm,
          r.headCircumferencePercentile,
        ]),
      );
    }

    if (dataset === 'puberty') {
      const rows = await this.prisma.pubertyScreening.findMany({
        where: { child: { deletedAt: null } },
        include: { child: { select: { sex: true, dateOfBirth: true } } },
        orderBy: { assessedAt: 'asc' },
      });
      return toCsv(
        ['child_key', 'sex', 'month', 'age_months', 'outcome'],
        rows.map((r) => {
          const age = ageInMonths(r.child.dateOfBirth, r.assessedAt);
          const result = compilePubertyResult(
            r.child.sex,
            age / 12,
            r.answers as any,
          );
          return [
            this.childKey(r.childId),
            r.child.sex,
            yearMonth(r.assessedAt),
            age.toFixed(1),
            result.outcome,
          ];
        }),
      );
    }

    const rows = await this.prisma.boneAgePrediction.findMany({
      where: { child: { deletedAt: null } },
      include: { child: { select: { sex: true } } },
      orderBy: { examDate: 'asc' },
    });
    return toCsv(
      [
        'child_key',
        'sex',
        'month',
        'chronological_age_months',
        'predicted_bone_age_months',
        'gap_months',
        'doctor_review',
        'status',
        'model_version',
      ],
      rows.map((r) => [
        this.childKey(r.childId),
        r.child.sex,
        yearMonth(r.examDate),
        r.chronologicalAgeMonths,
        r.predictedAgeMonths,
        r.predictedAgeMonths != null && r.chronologicalAgeMonths != null
          ? r.predictedAgeMonths - r.chronologicalAgeMonths
          : null,
        r.review,
        r.status,
        r.modelVersion,
      ]),
    );
  }
}
