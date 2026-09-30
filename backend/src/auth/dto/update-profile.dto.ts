import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  /** Same format as registration. Empty string clears it. */
  @IsOptional()
  @IsString()
  @Matches(/^$|^[0-9+\-\s()]{9,15}$/, { message: 'Enter a valid phone number' })
  phoneNumber?: string;
}
