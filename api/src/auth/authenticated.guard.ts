import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.isAuthenticated && request.isAuthenticated() && request.user) {
      return true;
    }
    throw new UnauthorizedException('Требуется авторизация в системе');
  }
}