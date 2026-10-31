/* PAY2-23: which needsAttention flags a definitive Atmos answer may clear. */
import assert from 'node:assert/strict';
import { reviewFlagOnly } from './import-commerce.service';
assert.equal(reviewFlagOnly({ status: 'pending', cancelReason: null }), true, 'payment_under_review (pending, no reason)');
assert.equal(reviewFlagOnly({ status: 'expired', cancelReason: 'expired_unverified: Atmos status unknown after 24 h' }), true);
assert.equal(reviewFlagOnly({ status: 'pending', cancelReason: null, refundDue: true }), false, 'refund due stays flagged');
assert.equal(reviewFlagOnly({ status: 'paid', cancelReason: 'paid_late_no_import' }), false, 'late unattached stays flagged');
assert.equal(reviewFlagOnly({ status: 'expired', cancelReason: null }), false);
assert.equal(reviewFlagOnly({ status: 'reversing', cancelReason: null }), false, 'failed reverse stays flagged');
console.log('review-flag (PAY2-23): OK');
