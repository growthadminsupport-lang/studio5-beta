import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, SiteSection } from '@prisma/client';
import { basename } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { persistUpload, removeUpload } from '../common/uploads';
import { UpdateSectionDto } from './dto/update-section.dto';

/** The sections an admin can edit. `eyebrow` is the small line above the title. */
export const SECTIONS: Record<string, { eyebrow: boolean }> = {
  'home-dashboard': { eyebrow: false },
  'home-about': { eyebrow: true },
};

export type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface UploadedMedia {
  path: string;
  type: 'image' | 'video';
}

/** A crop from the editor, or null when absent. Anything malformed is a 400, not a 500. */
function parseCrop(raw: string | undefined): Crop | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new BadRequestException('crop must be JSON');
  }
  const c = value as Record<string, unknown>;
  const keys = ['x', 'y', 'width', 'height'] as const;
  const ok =
    c !== null &&
    typeof c === 'object' &&
    keys.every((k) => typeof c[k] === 'number' && Number.isFinite(c[k])) &&
    (c.width as number) > 0 &&
    (c.height as number) > 0 &&
    (c.x as number) >= -0.5 &&
    (c.y as number) >= -0.5 &&
    (c.x as number) + (c.width as number) <= 100.5 &&
    (c.y as number) + (c.height as number) <= 100.5;
  if (!ok) {
    throw new BadRequestException(
      'crop must be { x, y, width, height } within 0-100',
    );
  }
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    x: round(c.x as number),
    y: round(c.y as number),
    width: round(c.width as number),
    height: round(c.height as number),
  };
}

@Injectable()
export class SiteService {
  constructor(private prisma: PrismaService) {}

  /** What the public page needs. The media URL names the file, so it can be cached for good. */
  private toPublic(s: SiteSection) {
    return {
      key: s.key,
      eyebrow: s.eyebrow,
      title: s.title,
      body: s.body,
      mediaType: s.mediaPath ? s.mediaType : null,
      mediaUrl: s.mediaPath ? `/site/media/${basename(s.mediaPath)}` : null,
      crop: s.mediaPath ? s.crop : null,
      updatedAt: s.updatedAt,
    };
  }

  async list() {
    const rows = await this.prisma.siteSection.findMany({
      where: { key: { in: Object.keys(SECTIONS) } },
    });
    return rows.map((s) => this.toPublic(s));
  }

  /** The stored path for a public file name, or a 404 if no section uses that file. */
  async mediaPath(name: string) {
    const path = `/uploads/site/${basename(name)}`;
    const row = await this.prisma.siteSection.findFirst({
      where: { mediaPath: path },
      select: { mediaPath: true },
    });
    if (!row?.mediaPath) throw new NotFoundException('No such file');
    return row.mediaPath;
  }

  async update(key: string, dto: UpdateSectionDto, media?: UploadedMedia) {
    const section = SECTIONS[key];
    if (!section) {
      await removeUpload('site', media?.path);
      throw new NotFoundException('No such section');
    }
    let crop: Crop | null;
    try {
      crop = parseCrop(dto.crop);
    } catch (err) {
      await removeUpload('site', media?.path);
      throw err;
    }
    if (media) {
      try {
        await persistUpload('site', media.path);
      } catch (err) {
        await removeUpload('site', media.path);
        throw new ServiceUnavailableException(
          `Could not store the file (${(err as Error).message}). Please try again.`,
        );
      }
    }

    const previous = await this.prisma.siteSection.findUnique({
      where: { key },
    });
    const text = {
      eyebrow: section.eyebrow ? dto.eyebrow?.trim() || null : null,
      title: dto.title.trim(),
      body: dto.body.trim(),
    };
    // A new file replaces the old one; removeMedia drops it; otherwise the file stays and
    // only its crop can change.
    const mediaFields: Pick<
      Prisma.SiteSectionUncheckedCreateInput,
      'mediaPath' | 'mediaType' | 'crop'
    > = media
      ? {
          mediaPath: media.path,
          mediaType: media.type,
          crop: crop ?? Prisma.DbNull,
        }
      : dto.removeMedia
        ? { mediaPath: null, mediaType: null, crop: Prisma.DbNull }
        : previous?.mediaPath
          ? { crop: crop ?? Prisma.DbNull }
          : {};

    const saved = await this.prisma.siteSection.upsert({
      where: { key },
      create: {
        key,
        ...text,
        ...mediaFields,
      },
      update: { ...text, ...mediaFields },
    });
    if (previous?.mediaPath && previous.mediaPath !== saved.mediaPath) {
      await removeUpload('site', previous.mediaPath);
    }
    return this.toPublic(saved);
  }
}
