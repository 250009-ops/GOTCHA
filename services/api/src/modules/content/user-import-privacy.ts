import { ContentSource, ContentType, Prisma } from '@prisma/client';

/** final-5 (Kai, privacy): a learner's import is readable only by its owner, whatever its publish state. */
export const isUserImport = (item: { contentSource?: string | null; contentType?: string | null }) =>
  item.contentSource === ContentSource.user_import || item.contentType === ContentType.user_import;

export const canReadUserImport = (item: { contentSource?: string | null; contentType?: string | null; createdById?: string | null }, userId?: string | null, isAdmin?: boolean) =>
  !isUserImport(item) || Boolean(isAdmin) || (Boolean(userId) && item.createdById === userId);

/** Prisma filter: not a user import, or (if signed in) the caller's own. */
export function userImportOwnerWhere(userId?: string, isAdmin?: boolean): Prisma.ContentItemWhereInput {
  if (isAdmin) return {};
  return {
    OR: [
      { contentSource: { not: ContentSource.user_import }, contentType: { not: ContentType.user_import } },
      ...(userId ? [{ createdById: userId }] : []),
    ],
  };
}
