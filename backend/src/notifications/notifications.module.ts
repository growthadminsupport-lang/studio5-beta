import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [NotificationsController, RemindersController],
  providers: [NotificationsService, RemindersService],
  exports: [NotificationsService, RemindersService],
})
export class NotificationsModule {}
