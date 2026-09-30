import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupportService } from './support.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateProblemReportDto } from './dto/create-problem-report.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('support')
export class SupportController {
  constructor(private supportService: SupportService) {}

  // Unauthenticated and it writes a row per call, so without a limit this is a way to fill
  // the database from outside. Linked to the sender when they are signed in.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('contact')
  create(@Body() dto: CreateSupportMessageDto, @CurrentUser() user?: AuthUser) {
    return this.supportService.create(dto, user?.userId);
  }

  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('report')
  report(@CurrentUser() user: AuthUser, @Body() dto: CreateProblemReportDto) {
    return this.supportService.report(user.userId, dto);
  }
}
