export function money(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function nonNegativeMoney(value, field = 'amount') {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    const error = new Error(`${field} must be a non-negative number`);
    error.status = 400;
    throw error;
  }
  return Math.round(n);
}

export function calcBill({ subtotal, discountType = 'amount', discountValue = 0, serviceRate = 0, vatRate = 7, paidAmount = undefined }) {
  const gross = nonNegativeMoney(subtotal, 'subtotal');
  const discountInput = nonNegativeMoney(discountValue, 'discountValue');
  const serviceRateNumber = Number(serviceRate ?? 0);
  const vatRateNumber = Number(vatRate ?? 0);
  if (!Number.isFinite(serviceRateNumber) || serviceRateNumber < 0 || serviceRateNumber > 100) {
    const error = new Error('serviceRate must be between 0 and 100');
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(vatRateNumber) || vatRateNumber < 0 || vatRateNumber > 100) {
    const error = new Error('vatRate must be between 0 and 100');
    error.status = 400;
    throw error;
  }
  if (!['amount', 'percent'].includes(discountType)) {
    const error = new Error('discountType must be amount or percent');
    error.status = 400;
    throw error;
  }

  const rawDiscount = discountType === 'percent' ? gross * discountInput / 100 : discountInput;
  const discount = Math.min(gross, Math.max(0, money(rawDiscount)));
  const base = Math.max(0, gross - discount);
  const service = money(base * serviceRateNumber / 100);
  const vat = money((base + service) * vatRateNumber / 100);
  const total = base + service + vat;
  const normalizedPaid = paidAmount === undefined || paidAmount === null || paidAmount === ''
    ? total
    : nonNegativeMoney(paidAmount, 'paidAmount');
  return {
    subtotal: gross,
    discount,
    service,
    vat,
    total,
    paidAmount: normalizedPaid,
    change: Math.max(0, normalizedPaid - total),
  };
}

export function calcShiftClose({ openingCash = 0, cashSales = 0, closingCash = 0 }) {
  const opening = nonNegativeMoney(openingCash, 'openingCash');
  const sales = nonNegativeMoney(cashSales, 'cashSales');
  const closing = nonNegativeMoney(closingCash, 'closingCash');
  const expectedCash = opening + sales;
  return {
    cashSales: sales,
    expectedCash,
    difference: closing - expectedCash,
  };
}

export function guessStation(name = '', category = '') {
  const s = `${name} ${category}`.toLowerCase();
  if (s.includes('ຊາ') || s.includes('ນ້ຳ') || s.includes('drink') || s.includes('bar')) return 'BAR';
  if (s.includes('ເຄັກ') || s.includes('ຂອງຫວານ') || s.includes('dessert')) return 'DESSERT';
  return 'HOT';
}
export function nextOrderStatus(status) {
  if (status === 'NEW') return 'ACCEPTED';
  if (status === 'ACCEPTED') return 'COOKING';
  if (status === 'COOKING') return 'READY';
  return status;
}
export function makeOrderNo(count) { return String(Number(count || 0) + 1).padStart(3, '0'); }
