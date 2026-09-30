import { IsIn } from 'class-validator';

export class UpdateInboxDto {
  @IsIn(['NEW', 'READ', 'RESOLVED'])
  status: 'NEW' | 'READ' | 'RESOLVED';
}
