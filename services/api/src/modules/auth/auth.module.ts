import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from '../../common/guards';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), TelegramModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
