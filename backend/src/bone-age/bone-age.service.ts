import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BoneAgePrediction } from '@prisma/client';
import { basename, join } from 'path';
import { ageInMonths } from '../common/age';
import { PrismaService } from '../prisma/prisma.service';
import { ChildrenService } from '../children/children.service';
import { NotificationsService } from '../notifications/notifications.service';
import { removeUpload, streamUpload, UPLOADS_ROOT } from '../common/uploads';
import { BoneAgeInferenceService } from './bone-age.inference';
import { isImplausibleGap, suggestReview } from './bone-age.rules';
import { UpdateBoneAgeDto } from './dto/update-bone-age.dto';

/**
 * Bone age is the doctor's tool (docs/user-flows.md §2, §5). Only an approved doctor linked to
 * the child uploads, runs the model, reviews and edits. Parents and caretakers see the doctor's
 * reading of each reviewed record (exam date, Normal / Advanced / Delayed, note) and nothing
 * else: not the model's number in months, and not the X-ray.
 */
@Injectable()
export class BoneAgeService {
  private readonly logger = new Logger(BoneAgeService.name);

  constructor(
    private prisma: PrismaService,
    private childrenService: ChildrenService,
    private inference: BoneAgeInferenceService,
    private notifications: NotificationsService,
  ) {}

  /** The full record, for the doctor: the estimate next to the child's real age on the exam day. */
  private forDoctor(p: BoneAgePrediction) {
    const gapMonths =
      p.predictedAgeMonths != null && p.chronologicalAgeMonths != null
        ? p.predictedAgeMonths - p.chronologicalAgeMonths
        : null;
    return {
      ...p,
      gapMonths,
      suggestedReview: gapMonths != null ? suggestReview(gapMonths) : null,
      implausibleGap: gapMonths != null && isImplausibleGap(gapMonths),
      maeMonths: this.inference.maeMonths,
    };
  }

  /** The doctor's reading only, for parents and caretakers. */
  private forFamily(p: BoneAgePrediction) {
    return {
      id: p.id,
      childId: p.childId,
      examDate: p.examDate,
      review: p.review,
      doctorNote: p.doctorNote,
      reviewedAt: p.reviewedAt,
    };
  }

  private async chronologicalAgeMonths(childId: string, examDate: Date) {
    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
      select: { dateOfBirth: true },
    });
    if (examDate < child.dateOfBirth) {
      throw new BadRequestException(
        'The exam date is before the child was born',
      );
    }
    if (examDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      throw new BadRequestException('The exam date cannot be in the future');
    }
    return Math.round(ageInMonths(child.dateOfBirth, examDate));
  }

  async upload(
    userId: string,
    childId: string,
    imageUrl: string,
    examDate?: string,
  ) {
    let prediction: BoneAgePrediction;
    try {
      await this.childrenService.access(childId, userId, 'boneAge.write');
      // Keep only what the model reads, smaller and lossless (see normaliseUpload).
      const stored = await this.inference
        .normaliseUpload(join(UPLOADS_ROOT, 'bone-age', basename(imageUrl)))
        .catch((err: Error) => {
          throw new BadRequestException(err.message);
        });
      imageUrl = `/uploads/bone-age/${basename(stored)}`;
      const exam = examDate ? new Date(examDate) : new Date();
      if (Number.isNaN(exam.getTime())) {
        throw new BadRequestException('Exam date is not a valid date');
      }
      prediction = await this.prisma.boneAgePrediction.create({
        data: {
          childId,
          imageUrl,
          uploadedById: userId,
          examDate: exam,
          chronologicalAgeMonths: await this.chronologicalAgeMonths(
            childId,
            exam,
          ),
        },
      });
    } catch (err) {
      await removeUpload('bone-age', imageUrl);
      throw err;
    }

    // Deliberately not awaited. The client gets its PENDING row immediately and polls, so a
    // slow first inference cannot time out the upload request. runInference swallows its own
    // failures, so this can never surface as an unhandled rejection.
    void this.runInference(prediction.id);
    return this.forDoctor(prediction);
  }

  /** Resolves a PENDING row to COMPLETED or FAILED. Never throws — nothing awaits it. */
  private async runInference(id: string) {
    if (!this.inference.isReady) {
      this.logger.warn(`Bone-age model unavailable; ${id} stays PENDING.`);
      return;
    }

    try {
      const prediction = await this.prisma.boneAgePrediction.findUniqueOrThrow({
        where: { id },
        include: { child: true },
      });

      const file = join(
        UPLOADS_ROOT,
        'bone-age',
        basename(prediction.imageUrl),
      );
      const result = await this.inference.predict(file, prediction.child.sex);

      await this.prisma.boneAgePrediction.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          predictedAgeMonths: result.boneAgeMonths,
          modelVersion: result.modelVersion,
          completedAt: new Date(),
          failureReason: null,
        },
      });
    } catch (err) {
      const reason = (err as Error).message ?? 'inference failed';
      this.logger.error(`Bone-age inference failed for ${id}: ${reason}`);
      await this.prisma.boneAgePrediction
        .update({
          where: { id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            failureReason: reason,
          },
        })
        .catch(() => undefined);
    }
  }

  /** Model availability and measured accuracy, for the UI to show alongside a result. */
  modelStatus() {
    return this.inference.status;
  }

  async history(userId: string, childId: string) {
    const access = await this.childrenService.access(
      childId,
      userId,
      'boneAge.status',
    );
    if (access.can('boneAge.full')) {
      const rows = await this.prisma.boneAgePrediction.findMany({
        where: { childId },
        orderBy: [{ examDate: 'desc' }, { createdAt: 'desc' }],
      });
      return rows.map((p) => this.forDoctor(p));
    }
    const rows = await this.prisma.boneAgePrediction.findMany({
      where: { childId, review: { not: null } },
      orderBy: [{ examDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((p) => this.forFamily(p));
  }

  private async load(id: string) {
    const prediction = await this.prisma.boneAgePrediction.findUnique({
      where: { id },
    });
    if (!prediction) {
      throw new NotFoundException('Bone age record not found');
    }
    return prediction;
  }

  async findOne(userId: string, id: string) {
    const prediction = await this.load(id);
    const access = await this.childrenService.access(
      prediction.childId,
      userId,
      'boneAge.status',
    );
    if (access.can('boneAge.full')) return this.forDoctor(prediction);
    // An unreviewed record does not exist as far as the family is concerned.
    if (!prediction.review)
      throw new NotFoundException('Bone age record not found');
    return this.forFamily(prediction);
  }

  /**
   * The doctor's review: exam date, Normal / Advanced / Delayed, note. Setting or changing the
   * reading tells the parents and caretakers there is a result, by app notification and email;
   * the email itself carries no result.
   */
  async update(userId: string, id: string, dto: UpdateBoneAgeDto) {
    const prediction = await this.load(id);
    await this.childrenService.access(
      prediction.childId,
      userId,
      'boneAge.write',
    );

    const examDate = dto.examDate ? new Date(dto.examDate) : undefined;
    const reviewChanged =
      dto.review !== undefined && dto.review !== prediction.review;
    const updated = await this.prisma.boneAgePrediction.update({
      where: { id },
      data: {
        ...(examDate
          ? {
              examDate,
              chronologicalAgeMonths: await this.chronologicalAgeMonths(
                prediction.childId,
                examDate,
              ),
            }
          : {}),
        ...(dto.doctorNote !== undefined
          ? { doctorNote: dto.doctorNote.trim() || null }
          : {}),
        ...(dto.review !== undefined
          ? { review: dto.review, reviewedAt: new Date() }
          : {}),
      },
    });

    if (reviewChanged) {
      await this.notifications.notifyChildMembers(
        prediction.childId,
        ['PARENT', 'CARETAKER'],
        userId,
        {
          type: 'BONE_AGE_RESULT',
          title: 'A bone-age result is ready',
          body: "The child's doctor has reviewed a hand X-ray. Open GrowTH to read it.",
          path: `/children/${prediction.childId}/bone-age`,
          email: true,
        },
      );
    }
    return this.forDoctor(updated);
  }

  /**
   * The image bytes for a prediction. These are radiographs of a child, so they are read
   * through this checked route rather than served as static files, and only by the doctor.
   */
  async image(userId: string, id: string) {
    const prediction = await this.load(id);
    await this.childrenService.access(
      prediction.childId,
      userId,
      'boneAge.full',
    );
    return streamUpload('bone-age', prediction.imageUrl);
  }

  async remove(userId: string, id: string) {
    const prediction = await this.load(id);
    await this.childrenService.access(
      prediction.childId,
      userId,
      'boneAge.write',
    );
    await this.prisma.boneAgePrediction.delete({
      where: { id: prediction.id },
    });
    await removeUpload('bone-age', prediction.imageUrl);
    return { success: true };
  }
}
