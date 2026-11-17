import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService, AuthenticatedUser } from './auth.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  serializeUser(
    user: AuthenticatedUser,
    done: (err: Error | null, userId?: string) => void,
  ): void {
    done(null, user.id);
  }

  async deserializeUser(
    userId: string,
    done: (err: Error | null, user?: AuthenticatedUser | null) => void,
  ): Promise<void> {
    try {
      const user = await this.authService.findById(userId);
      done(null, user ?? null);
    } catch (error) {
      done(error as Error, null);
    }
  }
}