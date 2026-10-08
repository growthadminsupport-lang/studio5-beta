import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  /** "Remember me": the long session limits (session-limits.ts). Off unless sent. */
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
