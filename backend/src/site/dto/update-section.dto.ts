import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * The admin's edit of one Home page section. Sent as multipart/form-data, so every field
 * arrives as a string: `crop` is JSON and `removeMedia` is "true" or "false".
 */
export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  eyebrow?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title: string;

  @IsString()
  @MinLength(2)
  @MaxLength(400)
  body: string;

  /** { x, y, width, height } in percent of the media, from the crop editor. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  crop?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  removeMedia?: boolean;
}
