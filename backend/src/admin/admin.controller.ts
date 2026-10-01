import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService, ExportDataset } from './admin.service';
import { ReviewDoctorDto } from './dto/review-doctor.dto';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import { UpdateInboxDto } from './dto/inbox.dto';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('doctors')
  doctors(@Query('status') status?: string) {
    return this.admin.listDoctors(status);
  }

  @Patch('doctors/:id')
  reviewDoctor(@Param('id') id: string, @Body() dto: ReviewDoctorDto) {
    return this.admin.reviewDoctor(id, dto);
  }

  @Get('articles')
  articles() {
    return this.admin.listArticles();
  }

  @Post('articles')
  createArticle(@Body() dto: CreateArticleDto) {
    return this.admin.createArticle(dto);
  }

  @Patch('articles/:id')
  updateArticle(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.admin.updateArticle(id, dto);
  }

  @Delete('articles/:id')
  deleteArticle(@Param('id') id: string) {
    return this.admin.deleteArticle(id);
  }

  @Get('inbox')
  inbox(@Query('kind') kind?: string, @Query('status') status?: string) {
    return this.admin.inbox(kind, status);
  }

  @Patch('inbox/:id')
  updateInbox(@Param('id') id: string, @Body() dto: UpdateInboxDto) {
    return this.admin.updateInbox(id, dto.status);
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  exportCsv(@Query('dataset') dataset: string) {
    if (!['growth', 'puberty', 'bone-age'].includes(dataset)) {
      throw new BadRequestException(
        'dataset must be growth, puberty or bone-age',
      );
    }
    return this.admin.exportCsv(dataset as ExportDataset);
  }
}
