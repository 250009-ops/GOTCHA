import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUserPayload, CurrentUser } from '../../common/decorators';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.notifications.list(user.sub);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUserPayload) {
    return this.notifications.unreadCount(user.sub);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUserPayload) {
    return this.notifications.markAllRead(user.sub);
  }

  @Post(':id/read')
  markRead(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.sub, id);
  }
}
