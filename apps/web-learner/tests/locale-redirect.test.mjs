import assert from 'node:assert/strict';
import { withLocaleParams, authSwitchSearch, authFlowSearch } from '../src/lib/authRoutes.ts';
assert.equal(withLocaleParams('/app', '?lang=ru&ui=uz&token=x'), '/app?lang=ru&ui=uz');
assert.equal(withLocaleParams('/login', ''), '/login');
assert.equal(withLocaleParams('/login?returnUrl=%2Fapp', '?ui=ru'), '/login?returnUrl=%2Fapp&ui=ru');
assert.equal(new URLSearchParams(authSwitchSearch(new URLSearchParams('lang=ru&ui=ru'), 'login')).get('ui'), 'ru');
assert.equal(new URLSearchParams(authSwitchSearch(new URLSearchParams('lang=uz'), 'register')).get('lang'), 'uz');
assert.equal(new URLSearchParams(authFlowSearch(new URLSearchParams('ui=en&x=1'))).toString(), 'ui=en');
console.log('locale-redirect: OK');
