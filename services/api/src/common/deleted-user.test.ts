import * as assert from 'node:assert/strict';
import { assertNotDeletedUser, deletedUserName, isDeletedAccount } from './deleted-user';

async function main() {
  assert.equal(isDeletedAccount({ email: 'deleted-abc@deleted.gotcha.app' }), true);
  assert.equal(isDeletedAccount({ email: 'deleted-abc@gmail.com' }), false);
  assert.equal(isDeletedAccount({ email: 'a@b.c' }), false);
  assert.equal(isDeletedAccount(null), false);
  assert.equal(deletedUserName('uz'), 'Oʻchirilgan foydalanuvchi');
  assert.equal(deletedUserName('ru'), 'Удалённый пользователь');
  assert.equal(deletedUserName('en'), 'Deleted user');
  assert.equal(deletedUserName(null), 'Deleted user');
  const p = (email: string | null) => ({ user: { findFirst: async () => (email ? { email } : null) } });
  await assertNotDeletedUser(p('a@b.c'), 'x');
  await assertNotDeletedUser(p(null), 'x');
  await assert.rejects(assertNotDeletedUser(p('deleted-x@deleted.gotcha.app'), 'x'), (e: { getStatus(): number; getResponse(): { code: string } }) => e.getStatus() === 403 && e.getResponse().code === 'USER_DELETED');
  console.log('deleted-user: OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
