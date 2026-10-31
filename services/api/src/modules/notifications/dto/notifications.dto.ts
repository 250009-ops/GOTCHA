export class NotificationItemDto {
  id!: string;
  kind!: string;
  title!: string;
  body!: string;
  href?: string | null;
  refId?: string | null;
  unread!: boolean;
  createdAt!: Date;
}
