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

  /** The retired young-child drawing's hairstyle (1-9). Still accepted, no longer shown. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  youngHair?: number;

  // The young child (3+), layered: hairstyle, eye set and outfit (design/avatars/build.py).

  /** 1 long curls, 2 bob with a clip, 3 pigtails, 4 short. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  kidHair?: number;

  /** 1 green, 2 blue, 3 red, 4 green (rounder, drawn for boys). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  kidEyes?: number;

  /** 1 suit and tie, 2 overalls, 3 flower top. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  kidOutfit?: number;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  hairColor?: string;

  /** One of the 6 baby outfits. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  babyOutfit?: number;

  // Baby drawing only: the face and shoe sets in the artist's file (design/avatars/build.py).

  /** Mouth: 1 open, 2 smile, 3 wide open, 4 big grin. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  babyMouth?: number;

  /** Eye colour: 1 brown, 2 green, 3 amber, 4 blue. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  babyEyes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  babyLashes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  babyBrows?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  babyShoes?: number;
}
