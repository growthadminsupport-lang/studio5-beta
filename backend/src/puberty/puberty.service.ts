import { Injectable, NotFoundException } from '@nestjs/common';
import { PubertyScreening } from '@prisma/client';
import { ageInYears } from '../common/age';
import { PrismaService } from '../prisma/prisma.service';
import { ChildrenService } from '../children/children.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitPubertyScreeningDto } from './dto/submit-puberty-screening.dto';
import {
  buildMonitoringPlan,
  compilePubertyResult,
  MonitoringPlan,
  PubertyScreeningResult,
} from './puberty-screening.util';

/**
 * Anyone linked to a child can fill in the questionnaire, but only the parent and the doctor
 * read what it found (docs/user-flows.md §2). For a caretaker the server returns that a
 * screening was submitted and when, and nothing else: not the result, and not the answers,
 * which carry the same information.
 */
@Injectable()
export class PubertyService {
  constructor(
    private prisma: PrismaService,
    private childrenService: ChildrenService,
    private notifications: NotificationsService,
  ) {}

  /** What a caretaker sees of a screening. */
  private submittedOnly(s: PubertyScreening, userId: string) {
    return {
      id: s.id,
      childId: s.childId,
      assessedAt: s.assessedAt,
      submittedByMe: s.submittedById === userId,
      resultShared: false as const,
    };
  }

  async submit(userId: string, dto: SubmitPubertyScreeningDto) {
    const access = await this.childrenService.access(
      dto.childId,
      userId,
      'puberty.submit',
    );
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: dto.childId },
    });
    const assessedAt = new Date();
    const result = compilePubertyResult(
      child.sex,
      ageInYears(child.dateOfBirth, assessedAt),
      dto.answers,
    );

    const screening = await this.prisma.pubertyScreening.create({
      data: {
        childId: dto.childId,
        answers: dto.answers as any,
        notes: dto.notes,
        submittedById: userId,
        assessedAt,
      },
    });

    // Whoever did not fill it in and is allowed to read it gets told there is something to read.
    // Only a caretaker's submission emails: a parent or doctor who submits has just seen the
    // result, and the other one still gets the in-app notice.
    const submitter = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true },
    });
    await this.notifications.notifyChildMembers(
      dto.childId,
      ['PARENT', 'DOCTOR'],
      userId,
      {
        type: 'PUBERTY_SUBMITTED',
        title: `New puberty screening for ${child.nickname || child.fullName.split(' ')[0]}`,
        body: `${submitter.fullName} completed a puberty screening. Open GrowTH to read the result.`,
        path: `/children/${dto.childId}/puberty`,
        email: access.role === 'CARETAKER',
      },
    );

    if (!access.can('puberty.result')) {
      return this.submittedOnly(screening, userId);
    }
    return { ...screening, result };
  }

  async history(userId: string, childId: string) {
    const access = await this.childrenService.access(
      childId,
      userId,
      'puberty.submit',
    );
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
    });
    const screenings = await this.prisma.pubertyScreening.findMany({
      where: { childId },
      orderBy: { assessedAt: 'desc' },
    });
    if (!access.can('puberty.result')) {
      return screenings.map((s) => this.submittedOnly(s, userId));
    }
    return screenings.map((s) => ({
      ...s,
      result: compilePubertyResult(
        child.sex,
        ageInYears(child.dateOfBirth, s.assessedAt),
        s.answers as any,
      ),
    }));
  }

  /**
   * The follow-up schedule that a flagged screening starts. Derived from screening
   * history rather than stored, so there's no separate state to keep in sync with the
   * screenings themselves.
   */
  async plan(userId: string, childId: string): Promise<MonitoringPlan> {
    await this.childrenService.access(childId, userId, 'puberty.result');
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
    });
    const screenings = await this.prisma.pubertyScreening.findMany({
      where: { childId },
      orderBy: { assessedAt: 'desc' },
    });
    return buildMonitoringPlan(
      screenings.map((s) => ({
        assessedAt: s.assessedAt,
        result: compilePubertyResult(
          child.sex,
          ageInYears(child.dateOfBirth, s.assessedAt),
          s.answers as any,
        ),
      })),
    );
  }

  async findOne(
    userId: string,
    id: string,
  ): Promise<{ result: PubertyScreeningResult } & Record<string, unknown>> {
    const screening = await this.prisma.pubertyScreening.findUnique({
      where: { id },
    });
    if (!screening) {
      throw new NotFoundException('Puberty screening not found');
    }
    await this.childrenService.access(
      screening.childId,
      userId,
      'puberty.result',
    );
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: screening.childId },
    });
    const result = compilePubertyResult(
      child.sex,
      ageInYears(child.dateOfBirth, screening.assessedAt),
      screening.answers as any,
    );
    return { ...screening, result };
  }
}
