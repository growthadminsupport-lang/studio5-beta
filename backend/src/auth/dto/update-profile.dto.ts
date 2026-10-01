import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PHONE_MESSAGE, PHONE_REGEX } from '../../common/validators/phone';

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
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phoneNumber?: string;
}
