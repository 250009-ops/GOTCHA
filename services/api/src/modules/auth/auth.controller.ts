import { Body, Controller, Get, Headers, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUserPayload, CurrentUser, Public } from '../../common/decorators';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendEmailVerificationDto,
  ResetPasswordDto,
  TelegramCodeDto,
  TelegramInitDto,
  TelegramLinkDto,
  TelegramRegisterDto,
  TelegramResendDto,
  TelegramResetDto,
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
    @Ip() ip?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    return this.auth.register(dto, clientHeader, ip, origin || referer);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.auth.login(dto, { userAgent, ip });
  }

  @Public()
  @Post('login/telegram-code')
  telegramCode(@Body() dto: TelegramCodeDto) {
    return this.auth.verifyTelegramCode(dto.challengeId, dto.code);
  }

  @Public()
  @Post('login/telegram-code/resend')
  telegramCodeResend(@Body() dto: TelegramResendDto) {
    return this.auth.resendTelegramCode(dto.challengeId);
  }

  @Public()
  @Post('telegram/session')
  telegramSession(@Body() dto: TelegramInitDto) {
    return this.auth.telegramSession(dto.initData);
  }

  @Public()
  @Get('telegram/contact')
  telegramContact(@Query('initData') initData: string) {
    return this.auth.telegramContact(initData);
  }

  @Public()
  @Post('telegram/register')
  telegramRegister(@Body() dto: TelegramRegisterDto, @Ip() ip?: string) {
    return this.auth.registerTelegram(dto, ip);
  }

  @Public()
  @Post('telegram/link')
  telegramLink(@Body() dto: TelegramLinkDto) {
    return this.auth.linkTelegram(dto);
  }

  @Public()
  @Post('telegram/login-link')
  loginLink(@Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.auth.createLoginLink({ userAgent, ip });
  }

  @Public()
  @Get('telegram/login-link/:token')
  loginLinkPoll(@Param('token') token: string) {
    return this.auth.pollLoginLink(token);
  }

  @Public()
  @Post('telegram/login-link/:token/exchange')
  loginLinkExchange(@Param('token') token: string) {
    return this.auth.exchangeLoginLink(token);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** Revokes the refresh token in the body. Public so an expired access token can still end the session. */
  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  /** Revokes every refresh token for the signed-in user. */
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthUserPayload) {
    return this.auth.logoutAll(user.sub);
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
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.auth.forgotPassword(dto.email, dto.clientPlatform ?? clientHeader, dto.identifier, { userAgent, ip });
  }

  @Public()
  @Post('reset-password/telegram')
  resetPasswordTelegram(@Body() dto: TelegramResetDto) {
    return this.auth.resetWithTelegramCode(dto.challengeId, dto.code, dto.password);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
