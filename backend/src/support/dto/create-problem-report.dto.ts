import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProblemReportDto {
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  message: string;

  /** Where it happened: the page path and, if one was open, the child. No medical data. */
  @IsOptional()
  @IsObject()
  context?: { page?: string; childId?: string };
}
