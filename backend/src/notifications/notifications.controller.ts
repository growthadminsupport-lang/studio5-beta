import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private notificationsService: NotificationsService,
    private reminders: RemindersService,
  ) {}

  /** Due check-up reminders are created here, as the list loads (RemindersService). */
  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    await this.reminders.refresh(user.userId).catch((err: Error) => {
      // A reminder that could not be created must not hide the user's notifications.
      this.logger.warn(`Check-up reminders failed: ${err.message}`);
    });
    return this.notificationsService.findAll(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Patch(':id')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.userId, id);
  }

  @Delete()
  clearAll(@CurrentUser() user: AuthUser) {
    return this.notificationsService.clearAll(user.userId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.remove(user.userId, id);
  }
}
