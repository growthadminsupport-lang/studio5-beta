import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateProblemReportDto } from './dto/create-problem-report.dto';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSupportMessageDto, userId?: string) {
    await this.prisma.supportMessage.create({
      data: {
        kind: 'CONTACT',
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
        userId,
      },
    });
    return { success: true };
  }

  /** In-app "Report a problem". Signed in only, so it always links to an account. */
  async report(userId: string, dto: CreateProblemReportDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const context = dto.context
      ? {
          page:
            typeof dto.context.page === 'string'
              ? dto.context.page.slice(0, 200)
              : undefined,
          childId:
            typeof dto.context.childId === 'string'
              ? dto.context.childId.slice(0, 64)
              : undefined,
        }
      : undefined;
    await this.prisma.supportMessage.create({
      data: {
        kind: 'PROBLEM',
        userId,
        email: user.email,
        subject: 'Problem report',
        message: dto.message,
        context,
      },
    });
    return { success: true };
  }
}
