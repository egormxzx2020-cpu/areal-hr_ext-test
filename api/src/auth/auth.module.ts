import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthSecurityService } from './auth-security.service';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { SessionSerializer } from './session.serializer';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthenticatedGuard } from './authenticated.guard';
import { AuthController } from './auth.controller';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController],
  providers: [
    AuthSecurityService,
    AuthService,
    LocalStrategy,
    SessionSerializer,
    LocalAuthGuard,
    AuthenticatedGuard,
  ],
  exports: [AuthSecurityService, AuthService, AuthenticatedGuard],
})
export class AuthModule {}