import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BoneAgeReview } from '@prisma/client';

export class UpdateBoneAgeDto {
  /** The day the X-ray was taken. The child's age is recomputed for this date. */
  @IsOptional()
  @IsDateString()
  examDate?: string;

  /** The doctor's reading. This, not the model's number, is what parents and caretakers see. */
  @IsOptional()
  @IsEnum(BoneAgeReview)
  review?: BoneAgeReview;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  doctorNote?: string;
}
