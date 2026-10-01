import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ChildSex, GuardianRelation } from '@prisma/client';

export class CreateChildDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsEnum(ChildSex)
  sex: ChildSex;

  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsEnum(GuardianRelation)
  relation?: GuardianRelation;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  /** Hospital number. Optional; the child's doctor can add it later. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  hn?: string;
}
