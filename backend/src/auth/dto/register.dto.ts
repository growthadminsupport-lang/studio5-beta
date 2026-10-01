import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_MESSAGE,
} from '../../common/validators/password';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  /**
   * FR-1 lists the phone number among the minimum registration fields, and the team's
   * registration form collects it. Optional here so a Google sign-up, which never sees the
   * form, can still create an account; Profile can add it later.
   */
  phoneNumber?: string;

  /**
   * `DOCTOR` creates an account that is pending until an admin approves it. Until then it
   * works like any other account, but cannot accept a doctor invitation or touch bone age.
   */
  @IsOptional()
  @IsIn(['USER', 'DOCTOR'])
  accountType?: 'USER' | 'DOCTOR';

  @ValidateIf((o: RegisterDto) => o.accountType === 'DOCTOR')
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  licenseNumber?: string;

  @ValidateIf((o: RegisterDto) => o.accountType === 'DOCTOR')
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  hospital?: string;

  /** FR-2: terms of use and privacy notice must be accepted before account creation. */
  @Equals(true, {
    message: 'You must accept the terms of use and privacy notice',
  })
  acceptedTerms: boolean;
}
