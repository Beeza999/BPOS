import test from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, paymentSchema, shiftCloseSchema, callStaffSchema, menuItemUpdateSchema } from '../src/lib/schemas.js';

test('login schema accepts only sane username and pin', () => {
  assert.equal(loginSchema.safeParse({ username: 'admin', pin: '1111' }).success, true);
  assert.equal(loginSchema.safeParse({ username: '', pin: '1' }).success, false);
});

test('payment schema rejects invalid method and negative amount', () => {
  const valid = paymentSchema.safeParse({ tableId: '123456789012', orderIds: ['123456789013'], method: 'CASH', paidAmount: 1000 });
  assert.equal(valid.success, true);
  assert.equal(paymentSchema.safeParse({ tableId: '123456789012', orderIds: ['123456789013'], method: 'HACK' }).success, false);
  assert.equal(paymentSchema.safeParse({ tableId: '123456789012', orderIds: ['123456789013'], paidAmount: -1 }).success, false);
});

test('shift close schema requires non-negative closingCash', () => {
  assert.equal(shiftCloseSchema.safeParse({ closingCash: 0 }).success, true);
  assert.equal(shiftCloseSchema.safeParse({ closingCash: -1 }).success, false);
});

test('call staff schema requires a signed table token', () => {
  assert.equal(callStaffSchema.safeParse({ tableToken: 'x'.repeat(20) }).success, true);
  assert.equal(callStaffSchema.safeParse({ branchId: '123456789012', tableId: '123456789013' }).success, false);
});

test('menu item update schema accepts only safe update fields', () => {
  const parsed = menuItemUpdateSchema.parse({ name: 'Noodle', price: '15000', restaurantId: 'should-be-stripped' });
  assert.deepEqual(parsed, { name: 'Noodle', price: 15000 });
  assert.equal(menuItemUpdateSchema.safeParse({ price: -1 }).success, false);
});
