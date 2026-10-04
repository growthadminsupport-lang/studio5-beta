import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { Public } from '../common/decorators/public.decorator';
import { sendPublicUpload } from '../common/uploads';
import { AdminGuard } from '../admin/admin.guard';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SiteService } from './site.service';

/** Allowed uploads, by MIME type. The stored extension comes from here, never the file name. */
const MEDIA_TYPES: Record<string, { ext: string; type: 'image' | 'video' }> = {
  'image/jpeg': { ext: '.jpg', type: 'image' },
  'image/png': { ext: '.png', type: 'image' },
  'image/webp': { ext: '.webp', type: 'image' },
  'video/mp4': { ext: '.mp4', type: 'video' },
  'video/webm': { ext: '.webm', type: 'video' },
};
// Videos are served from this API (Render) for every Home page visit, so keep them short.
const MAX_MEDIA_BYTES = 30 * 1024 * 1024;

/** The Home page sections, as the public page reads them. */
@Public()
@Controller('site')
export class SiteController {
  constructor(private site: SiteService) {}

  @Get('sections')
  sections() {
    return this.site.list();
  }

  // A video is fetched as many range requests; the global per-IP limit would cut playback off.
  @SkipThrottle()
  @Get('media/:name')
  async media(
    @Param('name') name: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await sendPublicUpload('site', await this.site.mediaPath(name), req, res);
  }
}

/** The admin portal's Home page tab. */
@UseGuards(AdminGuard)
@Controller('admin/site')
export class AdminSiteController {
  constructor(private site: SiteService) {}

  @Put('sections/:key')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/site',
        filename: (_req, file, cb) =>
          cb(null, `${randomUUID()}${MEDIA_TYPES[file.mimetype].ext}`),
      }),
      limits: { fileSize: MAX_MEDIA_BYTES },
      fileFilter: (_req, file, cb) => {
        if (MEDIA_TYPES[file.mimetype]) return cb(null, true);
        cb(
          new BadRequestException(
            `Unsupported file type "${file.mimetype}". Use a JPEG, PNG or WebP picture, or an MP4 or WebM video.`,
          ),
          false,
        );
      },
    }),
  )
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSectionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.site.update(
      key,
      dto,
      file && {
        path: `/uploads/site/${file.filename}`,
        type: MEDIA_TYPES[file.mimetype].type,
      },
    );
  }
}
