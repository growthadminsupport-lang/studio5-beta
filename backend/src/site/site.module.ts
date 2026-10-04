import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { AdminSiteController, SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({
  controllers: [SiteController, AdminSiteController],
  providers: [SiteService, AdminGuard],
})
export class SiteModule {}
