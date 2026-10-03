import { ageInMonths } from '../common/age';
import { checkupWindow, measuredFor } from '../common/well-child';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildrenService } from '../children/children.service';
import { GrowthReferenceService } from '../growth/growth-reference.service';
import { nutritionalStatusKey } from '../growth/growth.service';
import {
  compilePubertyResult,
  FOLLOW_UP_INTERVAL_MONTHS,
} from '../puberty/puberty-screening.util';
import type { PubertyAnswersDto } from '../puberty/dto/submit-puberty-screening.dto';

/**
 * The connective tissue between Growth, Puberty and Bone Age.
 *
 * The client's review said the three menus "aren't related", and they were right — each was a
 * parallel screen that never referenced the others. That is a clinical problem as much as a
 * product one: a bone age two years ahead means very little without knowing whether the child
 * is growing fast and showing pubertal signs, and reading the three together is exactly what a
 * paediatric endocrinologist does. TOR FR-19 says the same.
 *
 * Everything here is a **suggestion**, never a block. The client asked for a "required"
 * screening when growth crosses a threshold; a medical questionnaire a parent cannot skip is a
 * reason to close the app, and we would lose the growth tracking that was working. It is also
 * inconsistent with every other output in this product being a screening aid rather than a
 * diagnosis. Whether these are dismissible is client question Q8.
 */

/**
 * Youngest age at which the puberty questionnaire is offered.
 *
 * ⚠️ **Provisional — this is client question Q7a.** The client asked that the screening only
 * be offered "once the child is old enough" but the specific age was not captured, and getting
 * it wrong costs something in both directions: gate too late and a genuinely early case is
 * never prompted before the threshold that would have caught it; gate too early and parents of
 * toddlers are asked clinically loaded questions with no relevance yet.
 *
 * Six is the defensible default rather than the precocious thresholds themselves (8 girls,
 * 9 boys). Gating at those ages would mean never prompting before the age that defines "early"
 * — which is precisely the case the feature exists to catch. Central precocious puberty is
 * rarely seen below about six.
 */
const PUBERTY_SCREENING_MIN_AGE_YEARS = 6;

/** Do not re-prompt a screening that was completed recently. */
const RESCREEN_AFTER_MONTHS = FOLLOW_UP_INTERVAL_MONTHS;

export type SuggestionKind =
  | 'CHECKUP_DUE'
  | 'PUBERTY_SCREENING'
  | 'BONE_AGE_UPLOAD'
  | 'BONE_AGE_REFERRAL'
  | 'PUBERTY_FOLLOW_UP';

export interface Suggestion {
  kind: SuggestionKind;
  /** `info` is a nudge; `warning` means something was flagged and needs a person. */
  severity: 'info' | 'warning';
  title: string;
  /** Why this is being suggested, in the parent's terms. Never a diagnosis. */
  body: string;
  actionLabel: string;
  /** Frontend route. Kept here so the reason and the destination cannot drift apart. */
  actionHref: string;
}

const monthsBetween = ageInMonths;

@Injectable()
export class SuggestionsService {
  constructor(
    private prisma: PrismaService,
    private childrenService: ChildrenService,
    private reference: GrowthReferenceService,
  ) {}

  async forChild(userId: string, childId: string): Promise<Suggestion[]> {
    // Suggestions are read by everyone linked to the child, so each one is only produced for a
    // role that may see what it is based on. A caretaker must not learn a screening flagged
    // early signs from a suggestion when the result itself is withheld (docs/user-flows.md §2).
    const access = await this.childrenService.access(
      childId,
      userId,
      'child.read',
    );
    const seesPubertyResult = access.can('puberty.result');
    const isDoctor = access.can('boneAge.write');

    const child = await this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
    });
    const now = new Date();
    const ageYears = monthsBetween(child.dateOfBirth, now) / 12;

    const [latestGrowth, screenings, latestBoneAge] = await Promise.all([
      this.prisma.growthRecord.findFirst({
        where: { childId, deletedAt: null },
        orderBy: { measuredAt: 'desc' },
      }),
      this.prisma.pubertyScreening.findMany({
        where: { childId },
        orderBy: { assessedAt: 'desc' },
      }),
      // The doctor's latest reading, not the model's raw number: that is what every role may see.
      this.prisma.boneAgePrediction.findFirst({
        where: { childId, review: { not: null } },
        orderBy: { examDate: 'desc' },
      }),
    ]);

    const latestScreening = screenings[0];
    const latestResult =
      latestScreening && seesPubertyResult
        ? compilePubertyResult(
            child.sex,
            monthsBetween(child.dateOfBirth, latestScreening.assessedAt) / 12,
            latestScreening.answers as PubertyAnswersDto,
          )
        : null;

    const out: Suggestion[] = [];

    // T1 — BMI out of range prompts a screening. The client's flow starts here: the growth
    // menu checks whether BMI is out of range, and that is what leads into puberty.
    //
    // Body composition and pubertal timing are associated in both directions — higher adiposity
    // with earlier onset, particularly in girls, and low weight with later onset. ⚠️ That link
    // is not yet cited in this repo; it is a team item on research-checklist.md D2, and the
    // wording below deliberately claims only that the two are worth looking at together.
    const bmiPercentile = latestGrowth?.bmiPercentile
      ? Number(latestGrowth.bmiPercentile)
      : null;
    const statusKey =
      bmiPercentile !== null
        ? nutritionalStatusKey(
            bmiPercentile,
            latestGrowth?.bmi ? Number(latestGrowth.bmi) : null,
            latestGrowth?.bmiPctOfP95 ? Number(latestGrowth.bmiPctOfP95) : null,
          )
        : null;

    const bmiOutOfRange = statusKey !== null && statusKey !== 'HEALTHY';
    const oldEnoughToScreen = ageYears >= PUBERTY_SCREENING_MIN_AGE_YEARS;
    const screenedRecently =
      latestScreening !== undefined &&
      monthsBetween(latestScreening.assessedAt, now) < RESCREEN_AFTER_MONTHS;

    if (bmiOutOfRange && oldEnoughToScreen && !screenedRecently) {
      const label =
        statusKey === 'UNDERWEIGHT'
          ? 'below the healthy range'
          : 'above the healthy range';
      out.push({
        kind: 'PUBERTY_SCREENING',
        severity: 'info',
        title: 'Worth checking puberty signs too',
        body:
          `${child.fullName}'s latest BMI is ${label}. Weight and the timing of puberty tend to ` +
          'move together, so this is a good moment to run the puberty screening — it takes ' +
          'about two minutes, and "not sure" is a valid answer to any of it.',
        actionLabel: 'Start puberty screening',
        actionHref: `/children/${childId}/puberty`,
      });
    }

    // T2 — early signs prompt a bone age. Bone age is what distinguishes rapidly-progressive
    // puberty from the slowly-progressive kind that needs no treatment, so it is the natural
    // next question once a screening has flagged something.
    const boneAgeSinceScreening =
      latestBoneAge &&
      latestScreening &&
      latestBoneAge.examDate > latestScreening.assessedAt;

    if (latestResult?.outcome === 'EARLY_SIGNS' && !boneAgeSinceScreening) {
      out.push(
        isDoctor
          ? {
              kind: 'BONE_AGE_UPLOAD',
              severity: 'warning',
              title: 'Early signs reported: consider a bone age',
              body:
                'The latest screening reported early signs. A bone age reading helps tell ' +
                'rapidly progressive puberty from the slowly progressive kind that needs no treatment.',
              actionLabel: 'Upload X-ray',
              actionHref: `/children/${childId}/bone-age`,
            }
          : {
              kind: 'BONE_AGE_UPLOAD',
              severity: 'warning',
              title: 'Ask the doctor about a bone age reading',
              body:
                'The screening reported early signs. A bone age reading is what tells a doctor ' +
                'whether puberty is actually progressing quickly or just starting early — many ' +
                "children with early signs need no treatment at all. In GrowTH the child's " +
                'doctor adds the X-ray; invite them if they are not here yet.',
              actionLabel: 'Invite the doctor',
              actionHref: `/children/${childId}/people`,
            },
      );
    }

    // T3 — the doctor read the latest bone age as outside the range for the child's age. Worded
    // without numbers: parents and caretakers see the doctor's reading, never the model's estimate.
    if (
      latestBoneAge?.review === 'ADVANCED' ||
      latestBoneAge?.review === 'DELAYED'
    ) {
      const direction =
        latestBoneAge.review === 'ADVANCED' ? 'ahead of' : 'behind';
      out.push({
        kind: 'BONE_AGE_REFERRAL',
        severity: 'warning',
        title: `Bone age is ${direction} actual age`,
        body:
          `The doctor read ${child.fullName}'s latest hand X-ray as ${direction} their age. ` +
          'Keep measuring growth regularly: the growth chart and screening history are what the ' +
          'doctor reads alongside it.',
        actionLabel: 'View growth chart',
        actionHref: `/children/${childId}/growth`,
      });
    }

    // T4 — the follow-up plan already computes a due date and nothing ever surfaced it.
    if (latestResult?.outcome === 'EARLY_SIGNS' && latestScreening) {
      const since = monthsBetween(latestScreening.assessedAt, now);
      if (since >= FOLLOW_UP_INTERVAL_MONTHS) {
        out.push({
          kind: 'PUBERTY_FOLLOW_UP',
          severity: 'info',
          title: 'Follow-up screening is due',
          body:
            `It has been about ${Math.floor(since)} months since the screening that flagged ` +
            'early signs. Repeating it now means you arrive at the next appointment with dated ' +
            'observations rather than recollections.',
          actionLabel: 'Repeat screening',
          actionHref: `/children/${childId}/puberty`,
        });
      }
    }

    // A well-child check-up age has been reached and nothing measured since
    // (common/well-child.ts). Shown to everyone who can add a measurement; the matching
    // notification and email go to parents only (RemindersService).
    const { current: checkup } = checkupWindow(child.dateOfBirth, now);
    if (
      checkup &&
      !(latestGrowth && measuredFor(checkup.date, latestGrowth.measuredAt))
    ) {
      out.unshift({
        kind: 'CHECKUP_DUE',
        severity: 'info',
        title: `${checkup.label[0].toUpperCase()}${checkup.label.slice(1)} check-up due`,
        body: 'After the visit, add the height and weight.',
        actionLabel: 'Add measurement',
        actionHref: `/children/${childId}/growth`,
      });
    }

    return out;
  }
}
