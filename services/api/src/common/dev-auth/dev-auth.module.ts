import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { jwtSecretOrThrow } from '../runtime-security';
import { DevAuthService } from './dev-auth.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: jwtSecretOrThrow(),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '15m') as `${number}m`,
        },
      }),
    }),
  ],
  providers: [DevAuthService],
  exports: [DevAuthService, JwtModule],
})
export class DevAuthModule {}
