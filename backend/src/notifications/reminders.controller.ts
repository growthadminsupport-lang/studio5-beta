import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Public } from '../common/decorators/public.decorator';
import { RemindersService } from './reminders.service';

/**
 * Called once a day by .github/workflows/checkup-reminders.yml to email due check-up
 * reminders. Not a user route: it needs the shared secret REMINDERS_SECRET, and without one
 * configured it refuses everything.
 */
@Controller('reminders')
export class RemindersController {
  constructor(
    private reminders: RemindersService,
    private config: ConfigService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('run')
  run(@Headers('x-reminders-secret') given?: string) {
    const secret = this.config.get<string>('REMINDERS_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Reminders are not configured');
    }
    // Hashed first so the comparison is constant-time whatever the lengths.
    const digest = (v: string) => createHash('sha256').update(v).digest();
    if (!given || !timingSafeEqual(digest(given), digest(secret))) {
      throw new UnauthorizedException();
    }
    return this.reminders.runAll();
  }
}
