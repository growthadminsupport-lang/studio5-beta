import { Module } from '@nestjs/common';
import { PubertyController } from './puberty.controller';
import { PubertyService } from './puberty.service';
import { ChildrenModule } from '../children/children.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ChildrenModule, NotificationsModule],
  controllers: [PubertyController],
  providers: [PubertyService],
})
export class PubertyModule {}
