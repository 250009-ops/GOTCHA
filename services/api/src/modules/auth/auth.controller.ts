import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendEmailVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

const AUTH_THROTTLE = { default: { limit: 8, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Headers('x-gotcha-client-platform') clientHeader?: string,
  ) {
    return this.auth.register(dto, clientHeader);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Get('verify-email')
  verifyEmailGet(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Public()
  @Post('verify-email')
  verifyEmailPost(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  resendEmailVerification(
    @Body() dto: ResendEmailVerificationDto,
    @Headers('x-gotcha-client-platform') clientHeader?: string,
  ) {
    return this.auth.resendEmailVerification(dto.email, dto.clientPlatform ?? clientHeader);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Headers('x-gotcha-client-platform') clientHeader?: string,
  ) {
    return this.auth.forgotPassword(dto.email, dto.clientPlatform ?? clientHeader);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
