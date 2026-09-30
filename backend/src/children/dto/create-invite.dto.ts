import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class CreateInviteDto {
  /** Only caretakers and doctors are invited (docs/user-flows.md). The parent creates the child. */
  @IsIn(['CARETAKER', 'DOCTOR'])
  role: 'CARETAKER' | 'DOCTOR';

  /** Send the link to this address as well. Leave empty to share it by QR code or copy. */
  @IsOptional()
  @IsEmail()
  email?: string;
}
