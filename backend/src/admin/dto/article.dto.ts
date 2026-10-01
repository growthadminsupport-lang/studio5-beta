import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  categoryId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  /** URL part. Generated from the title when omitted. */
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug may only contain lowercase letters, digits and hyphens',
  })
  @MaxLength(120)
  slug?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(400)
  summary: string;

  /** Markdown. Sources go at the end, as every seeded article does (FR-20). */
  @IsString()
  @MinLength(20)
  contentMd: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  coverImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
