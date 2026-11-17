import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthenticatedGuard } from './authenticated.guard';

@Controller('auth')
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  login(@Req() req: Request) {
    return req.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await new Promise<void>((resolve, reject) => {
      req.logout((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    }).catch(() => {
      throw new InternalServerErrorException('Не удалось завершить сессию');
    });

    await new Promise<void>((resolve) => {
      if (!req.session) {
        resolve();
        return;
      }
      req.session.destroy(() => resolve());
    });

    res.clearCookie('areal_hr.sid');
    return { message: 'Выход из системы выполнен успешно' };
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  getMe(@Req() req: Request) {
    return req.user;
  }
}