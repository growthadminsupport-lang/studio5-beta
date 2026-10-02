import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChildAvatarDto } from './child-avatar.dto';
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

  @IsOptional()
  @ValidateNested()
  @Type(() => ChildAvatarDto)
  avatar?: ChildAvatarDto;

  /** Hospital number. Optional; the child's doctor can add it later. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  hn?: string;
}
