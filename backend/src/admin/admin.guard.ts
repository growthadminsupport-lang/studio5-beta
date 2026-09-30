import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin routes check the role in the database on every request, not the role inside the
 * access token. A token lives for 15 minutes; an admin whose role is withdrawn should lose the
 * portal on their next click, not a quarter of an hour later.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const userId: string | undefined = context.switchToHttp().getRequest()
      .user?.userId;
    if (!userId) throw new ForbiddenException();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.role !== 'ADMIN') {
      throw new ForbiddenException('Admins only');
    }
    return true;
  }
}
