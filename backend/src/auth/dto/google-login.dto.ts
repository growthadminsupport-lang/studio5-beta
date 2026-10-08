import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PHONE_MESSAGE, PHONE_REGEX } from '../../common/validators/phone';

/**
 * Google sign-in. The first call carries only `credential`. What happens next depends on the
 * address:
 * - an account already linked to this Google identity: signed in;
 * - a password account with the same address: `linkRequired`, and the client asks before
 *   calling again with `linkAccount: true`;
 * - no account: `signupRequired`, and the client shows the welcome form (terms, account
 *   type, phone, and for doctors licence and hospital) and calls again with `signup: true`.
 *
 * Google ID tokens stay valid for about an hour, so the same credential is reused across the
 * steps.
 */
export class GoogleLoginDto {
  /** The ID token (JWT) that Google Identity Services hands the browser. */
  @IsString()
  @MinLength(1)
  credential: string;

  /** "Remember me": the long session limits (session-limits.ts). Off unless sent. */
  @IsOptional()
  @IsBoolean()
  remember?: boolean;

  /** The person confirmed linking Google to their existing password account. */
  @IsOptional()
  @IsBoolean()
  linkAccount?: boolean;

  /** The welcome form was completed; create the account. */
  @IsOptional()
  @IsBoolean()
  signup?: boolean;

  /** FR-2: required with `signup`. */
  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;

  @IsOptional()
  @IsIn(['USER', 'DOCTOR'])
  accountType?: 'USER' | 'DOCTOR';

  /** Defaults to the name on the Google account. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  hospital?: string;
}
