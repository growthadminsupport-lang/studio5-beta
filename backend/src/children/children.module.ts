import { Module } from '@nestjs/common';
import { ChildrenController, InvitesController } from './children.controller';
import { ChildrenService } from './children.service';
import { InvitesService } from './invites.service';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MailModule, NotificationsModule],
  controllers: [ChildrenController, InvitesController],
  providers: [ChildrenService, InvitesService],
  exports: [ChildrenService],
})
export class ChildrenModule {}
