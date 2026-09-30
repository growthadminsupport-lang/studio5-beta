import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDoctorDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  /** Shown to the doctor. Required in practice for a rejection, so they know what to fix. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
