import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const SKIN_TONES = ['fair', 'rosy', 'tan', 'deep'] as const;

/**
 * The illustrated avatar. The drawing changes with age (a baby until 3, then a young child),
 * and each has its own set of hairstyles, so both choices are kept: the right one shows as
 * the child grows. Hair colour applies to both.
 */
export class ChildAvatarDto {
  @IsIn(SKIN_TONES)
  skin: (typeof SKIN_TONES)[number];

  /** One of the 10 baby hairstyles. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  babyHair?: number;

  /** One of the 9 young-child hairstyles. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  youngHair?: number;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  hairColor?: string;

  /** One of the 6 baby outfits (the young-child drawing is a bust). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  babyOutfit?: number;
}
