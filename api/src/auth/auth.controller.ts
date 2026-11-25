import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthenticatedGuard } from './authenticated.guard';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.service';

@Controller('auth')
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginRateLimitGuard, LocalAuthGuard)
  login(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await new Promise<void>((resolve, reject) => {
      if (!req.session) {
        return resolve();
      }
      req.session.destroy((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    res.clearCookie('areal_hr.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });

    return { message: 'Выход из системы выполнен' };
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}