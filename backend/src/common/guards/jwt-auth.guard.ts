import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) {
      return super.canActivate(context) as Promise<boolean>;
    }

    // A public route still learns who is calling when a valid token comes with the request.
    // The Contact form uses this to link a message to the signed-in sender; before, it told
    // the user "we'll follow up at this address" and then stored the message anonymously.
    // A missing, expired or bad token on a public route is not an error.
    const request = context.switchToHttp().getRequest();
    if (request.headers?.authorization?.startsWith('Bearer ')) {
      try {
        await super.canActivate(context);
      } catch {
        request.user = undefined;
      }
    }
    return true;
  }
}
