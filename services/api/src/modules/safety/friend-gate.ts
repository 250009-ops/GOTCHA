import { assertNotDeletedUser } from '../../common/deleted-user';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ageBand, AgeBand, canMessage } from '../../common/safety/age-policy';

/**
 * Owner decision (W-12 / S6, 31 Oct): under-13 → messaging off; 13-17 → only with accepted friends;
 * adults → open. Unknown age = AGE_UNKNOWN_BAND (default teen). Kept DI-free for unit tests.
 */
export const MESSAGING_NOT_ALLOWED = 'MESSAGING_NOT_ALLOWED';
export const BIRTH_YEAR_REQUIRED = 'BIRTH_YEAR_REQUIRED';

type Row = { id: string; birthYear: number | null; deletedAt?: Date | null };
export type GatePrisma = {
  user: { findMany(args: unknown): Promise<Row[]>; findFirst(args: unknown): Promise<Row | null> };
  friendRequest: {
    findFirst(args: unknown): Promise<{ id: string; requesterId: string; addresseeId: string; status: string } | null>;
    findMany(args: unknown): Promise<Array<{ id: string; requesterId: string; addresseeId: string; status: string; createdAt: Date }>>;
    create(args: unknown): Promise<{ id: string; status: string }>;
    update(args: unknown): Promise<{ id: string; status: string }>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  userBlock: { findFirst(args: unknown): Promise<unknown | null> };
};

export async function areFriends(p: GatePrisma, a: string, b: string): Promise<boolean> {
  const row = await p.friendRequest.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  return !!row;
}

export async function bandsOf(p: GatePrisma, ids: string[]): Promise<Map<string, AgeBand>> {
  const rows = await p.user.findMany({ where: { id: { in: ids } }, select: { id: true, birthYear: true } });
  return new Map(rows.map((r) => [r.id, ageBand(r.birthYear)]));
}

export async function assertCanMessage(p: GatePrisma, sender: string, recipient: string): Promise<void> {
  const rows = await p.user.findMany({ where: { id: { in: [sender, recipient] } }, select: { id: true, birthYear: true } });
  const senderRow = rows.find((row) => row.id === sender);
  const recipientRow = rows.find((row) => row.id === recipient);
  if (!senderRow || senderRow.birthYear == null) {
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: BIRTH_YEAR_REQUIRED,
      message: 'Add your birth year before you can message.',
    });
  }
  if (!recipientRow || recipientRow.birthYear == null) {
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: MESSAGING_NOT_ALLOWED,
      message: 'Messaging is not available for this account.',
    });
  }
  const s = ageBand(senderRow.birthYear);
  const r = ageBand(recipientRow.birthYear);
  const friends = s === 'adult' && r === 'adult' ? true : await areFriends(p, sender, recipient);
  if (!canMessage(s, r, friends)) {
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: MESSAGING_NOT_ALLOWED,
      message:
        s === 'under13' || r === 'under13'
          ? 'Messaging is not available for this account.'
          : s === 'adult' || r === 'adult'
            ? 'Adults and under-18 learners cannot message each other.'
            : 'You can message this learner once you are friends. Send a friend request first.',
    });
  }
}

/**
 * WL4-12 (Kai 31 Oct): teens and no-age users are hidden from adults who are not already their friends —
 * profile by id → 404 and adult friend requests → 404 (same answer as a missing user, so nothing leaks).
 */
export function hiddenFromViewer(viewer: AgeBand, target: AgeBand, friends: boolean): boolean {
  return viewer === 'adult' && target !== 'adult' && !friends;
}

export async function assertPeerVisible(p: GatePrisma, viewerId: string, targetId: string): Promise<void> {
  if (viewerId === targetId) return;
  const bands = await bandsOf(p, [viewerId, targetId]);
  const v = bands.get(viewerId) ?? ageBand(null);
  const t = bands.get(targetId) ?? ageBand(null);
  if (v !== 'adult' || t === 'adult') return;
  if (!(await areFriends(p, viewerId, targetId))) throw new NotFoundException('User not found');
}

/** Under-13 accounts cannot send or receive friend requests (messaging is off for them). */
export async function sendFriendRequest(p: GatePrisma, from: string, to: string) {
  if (from === to) throw new BadRequestException('Cannot add yourself');
  const fromRow = await p.user.findFirst({ where: { id: from }, select: { id: true, birthYear: true } });
  if (!fromRow || fromRow.birthYear == null) {
    throw new ForbiddenException({
      statusCode: 403,
      code: BIRTH_YEAR_REQUIRED,
      message: 'Add your birth year before you can send a friend request.',
    });
  }
  await assertNotDeletedUser(p as never, to);
  const target = await p.user.findFirst({ where: { id: to, deletedAt: null }, select: { id: true, birthYear: true } });
  if (!target) throw new NotFoundException('User not found');
  if (target.birthYear == null) {
    if (ageBand(fromRow.birthYear) === 'adult') throw new NotFoundException('User not found');
    throw new ForbiddenException({
      statusCode: 403,
      code: MESSAGING_NOT_ALLOWED,
      message: 'Friends are not available for this account.',
    });
  }
  const blocked = await p.userBlock.findFirst({
    where: { OR: [{ blockerId: from, blockedId: to }, { blockerId: to, blockedId: from }] },
  });
  if (blocked) throw new ForbiddenException('You can’t add this user.');
  const bands = await bandsOf(p, [from, to]);
  if (bands.get(from) === 'under13' || bands.get(to) === 'under13') {
    throw new ForbiddenException({ statusCode: 403, code: MESSAGING_NOT_ALLOWED, message: 'Friends are not available for this account.' });
  }
  const existing = await p.friendRequest.findFirst({
    where: { OR: [{ requesterId: from, addresseeId: to }, { requesterId: to, addresseeId: from }] },
  });
  const fromBand = bands.get(from) ?? ageBand(null);
  const toBand = bands.get(to) ?? ageBand(null);
  const theyAskedMe = existing?.requesterId === to && existing.status === 'pending';
  const alreadyFriends = existing?.status === 'accepted';
  if (hiddenFromViewer(fromBand, toBand, alreadyFriends) && !theyAskedMe) throw new NotFoundException('User not found');
  if (existing) {
    // They already asked me → accept. Mine pending/accepted → idempotent. Declined → re-open mine.
    if (existing.requesterId === to && existing.status === 'pending') {
      return p.friendRequest.update({ where: { id: existing.id }, data: { status: 'accepted', respondedAt: new Date() } });
    }
    if (existing.status === 'declined' && existing.requesterId === from) {
      return p.friendRequest.update({ where: { id: existing.id }, data: { status: 'pending', respondedAt: null, createdAt: new Date() } });
    }
    if (existing.status === 'declined') throw new ForbiddenException('This learner declined your request.');
    return existing;
  }
  return p.friendRequest.create({ data: { requesterId: from, addresseeId: to } });
}

export async function respondFriendRequest(p: GatePrisma, userId: string, requestId: string, accept: boolean) {
  const row = await p.friendRequest.findFirst({ where: { id: requestId, addresseeId: userId, status: 'pending' } });
  if (!row) throw new NotFoundException('Friend request not found');
  return p.friendRequest.update({
    where: { id: requestId },
    data: { status: accept ? 'accepted' : 'declined', respondedAt: new Date() },
  });
}

export async function removeFriend(p: GatePrisma, userId: string, peerId: string) {
  return p.friendRequest.deleteMany({
    where: { OR: [{ requesterId: userId, addresseeId: peerId }, { requesterId: peerId, addresseeId: userId }] },
  });
}
