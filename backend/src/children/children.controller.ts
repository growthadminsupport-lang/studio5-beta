import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChildrenService } from './children.service';
import { InvitesService } from './invites.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('children')
export class ChildrenController {
  constructor(
    private childrenService: ChildrenService,
    private invitesService: InvitesService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChildDto) {
    return this.childrenService.create(user.userId, dto);
  }

  /** `?hn=` searches the caller's own patients by hospital number (doctors). */
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('hn') hn?: string) {
    return this.childrenService.findAllForUser(user.userId, hn);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.childrenService.findOne(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.childrenService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.childrenService.remove(user.userId, id);
  }

  @Get(':id/members')
  members(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.childrenService.members(user.userId, id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') memberId: string,
  ) {
    return this.childrenService.removeMember(user.userId, id, memberId);
  }

  // Each call can send an email, so it is capped like the other mail-sending routes.
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @Post(':id/invites')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.create(user.userId, id, dto);
  }

  @Delete(':id/invites/:inviteId')
  revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.invitesService.revoke(user.userId, id, inviteId);
  }
}

@Controller('invites')
export class InvitesController {
  constructor(private invitesService: InvitesService) {}

  /** Invitations sent to my (confirmed) email address, to accept without the link. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.invitesService.mine(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mine/:id/accept')
  acceptMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitesService.acceptMine(user.userId, id);
  }

  /** Public: the invitation page shows who invited you before you sign in. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitesService.preview(token);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':token/accept')
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invitesService.accept(user.userId, token);
  }
}
