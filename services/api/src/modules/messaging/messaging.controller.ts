import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthUserPayload, CurrentUser } from '../../common/decorators';
import {
  EditMessageDto,
  MarkReadDto,
  ReportUserDto,
  SendMessageDto,
  StartConversationDto,
  TypingDto,
} from './dto/messaging.dto';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@Controller('messaging')
export class MessagingController {
  constructor(private messaging: MessagingService) {}

  @SkipThrottle()
  @Post('presence')
  heartbeat(@CurrentUser() user: AuthUserPayload) {
    return this.messaging.heartbeat(user.sub);
  }

  @SkipThrottle()
  @Get('unread-count')
  unread(@CurrentUser() user: AuthUserPayload) {
    return this.messaging.unreadTotal(user.sub);
  }

  @SkipThrottle()
  @Get('conversations')
  list(@CurrentUser() user: AuthUserPayload, @Query('q') q?: string, @Query('before') before?: string) {
    return this.messaging.listConversations(user.sub, q, before);
  }

  @SkipThrottle()
  @Get('conversations/:id')
  getOne(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
    @Query('after') after?: string,
  ) {
    return this.messaging.getConversation(user.sub, id, { before, after });
  }

  @Post('conversations')
  start(@CurrentUser() user: AuthUserPayload, @Body() dto: StartConversationDto) {
    return this.messaging.startConversation(user.sub, dto);
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendMessage(user.sub, id, dto);
  }

  @Patch('conversations/:id/messages/:messageId')
  edit(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messaging.editMessage(user.sub, id, messageId, dto);
  }

  @Delete('conversations/:id/messages/:messageId')
  remove(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messaging.deleteMessage(user.sub, id, messageId);
  }

  @Post('conversations/:id/typing')
  typing(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TypingDto,
  ) {
    return this.messaging.setTyping(user.sub, id, dto.typing !== false);
  }

  @SkipThrottle()
  @Get('conversations/:id/status')
  status(@CurrentUser() user: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.messaging.conversationStatus(user.sub, id);
  }

  @SkipThrottle()
  @Post('conversations/:id/read')
  markRead(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.messaging.markRead(user.sub, id, dto.messageId);
  }

  @SkipThrottle()
  @Get('suggestions')
  suggestions(@CurrentUser() user: AuthUserPayload) {
    return this.messaging.suggestions(user.sub);
  }

  @SkipThrottle()
  @Get('learners')
  learners(
    @CurrentUser() user: AuthUserPayload,
    @Query('q') q?: string,
    @Query('lang') lang?: string,
    @Query('sameReadings') sameReadings?: string,
  ) {
    return this.messaging.findLearners(
      user.sub,
      q,
      lang,
      sameReadings === '1' || sameReadings === 'true',
    );
  }

  // P3b report & block (Play UGC policy).
  @SkipThrottle()
  @Get('blocks')
  blocks(@CurrentUser() user: AuthUserPayload) {
    return this.messaging.listBlocks(user.sub);
  }

  @Post('blocks/:userId')
  block(@CurrentUser() user: AuthUserPayload, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.messaging.block(user.sub, userId);
  }

  @Delete('blocks/:userId')
  unblock(@CurrentUser() user: AuthUserPayload, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.messaging.unblock(user.sub, userId);
  }

  @Post('reports')
  report(@CurrentUser() user: AuthUserPayload, @Body() dto: ReportUserDto) {
    return this.messaging.report(user.sub, dto);
  }

  @SkipThrottle()
  @Get('peers/:id')
  peer(@CurrentUser() user: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.messaging.peerProfile(user.sub, id);
  }
}
