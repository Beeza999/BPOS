import test from 'node:test';
import assert from 'node:assert/strict';
import { calcBill, calcShiftClose, guessStation, nextOrderStatus, makeOrderNo, nonNegativeMoney } from '../src/lib/domain.js';

test('bill calculation supports discount service vat change', () => {
  const c = calcBill({ subtotal: 100000, discountType: 'percent', discountValue: 10, serviceRate: 10, vatRate: 7, paidAmount: 120000 });
  assert.equal(c.discount, 10000);
  assert.equal(c.service, 9000);
  assert.equal(c.vat, 6930);
  assert.equal(c.total, 105930);
  assert.equal(c.change, 14070);
});

test('bill calculation caps discount and rejects invalid rates', () => {
  const c = calcBill({ subtotal: 1000, discountType: 'amount', discountValue: 9999, serviceRate: 0, vatRate: 0 });
  assert.equal(c.total, 0);
  assert.throws(() => calcBill({ subtotal: 1000, serviceRate: 101 }), /serviceRate/);
  assert.throws(() => calcBill({ subtotal: 1000, vatRate: -1 }), /vatRate/);
});

test('nonNegativeMoney rejects NaN and negative values', () => {
  assert.equal(nonNegativeMoney('10'), 10);
  assert.throws(() => nonNegativeMoney('abc', 'x'), /x/);
  assert.throws(() => nonNegativeMoney(-1, 'x'), /x/);
});

test('shift close calculates expected cash and difference', () => {
  assert.deepEqual(calcShiftClose({ openingCash: 1000, cashSales: 2500, closingCash: 3400 }), {
    cashSales: 2500,
    expectedCash: 3500,
    difference: -100,
  });
});

test('station routing from original menu examples', () => {
  assert.equal(guessStation('ຊາເຢັນ'), 'BAR');
  assert.equal(guessStation('ເຄັກຊັອກໂກແລັດ'), 'DESSERT');
  assert.equal(guessStation('ເຂົ້າຜັດກຸ້ງ'), 'HOT');
});

test('kds status flow', () => {
  assert.equal(nextOrderStatus('NEW'), 'ACCEPTED');
  assert.equal(nextOrderStatus('ACCEPTED'), 'COOKING');
  assert.equal(nextOrderStatus('COOKING'), 'READY');
});

test('order no', () => {
  assert.equal(makeOrderNo(0), '001');
  assert.equal(makeOrderNo(9), '010');
});
