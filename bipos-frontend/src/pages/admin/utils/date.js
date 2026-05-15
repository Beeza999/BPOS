const BUSINESS_TIMEZONE =
  import.meta.env.VITE_BUSINESS_TIMEZONE || "Asia/Vientiane";

export function getDateValue(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateParts(value, timeZone = BUSINESS_TIMEZONE) {
  const date = getDateValue(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((map, part) => {
      if (part.type !== "literal") {
        map[part.type] = part.value;
      }
      return map;
    }, {});

  if (!parts.year || !parts.month || !parts.day) return null;

  return parts;
}

export function businessDateKey(value, timeZone = BUSINESS_TIMEZONE) {
  const parts = dateParts(value, timeZone);
  if (!parts) return "";

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function businessMonthKey(value, timeZone = BUSINESS_TIMEZONE) {
  const parts = dateParts(value, timeZone);
  if (!parts) return "";

  return `${parts.year}-${parts.month}`;
}

// ใช้ชื่อเดิมไว้ เพื่อไม่ต้องแก้ไฟล์หน้า admin จุดอื่น
// แต่เปลี่ยน logic ให้เทียบวันที่ตาม timezone ร้าน ไม่ใช่ timezone ของ browser/Windows
export function sameLocalDay(value, baseDate = new Date()) {
  const dateKey = businessDateKey(value);
  const baseKey = businessDateKey(baseDate);

  return Boolean(dateKey && baseKey && dateKey === baseKey);
}

export function sameLocalMonth(value, baseDate = new Date()) {
  const monthKey = businessMonthKey(value);
  const baseKey = businessMonthKey(baseDate);

  return Boolean(monthKey && baseKey && monthKey === baseKey);
}

export function paymentDate(payment) {
  return payment?.paidAt || payment?.createdAt || payment?.updatedAt;
}

export function orderDate(order) {
  return order?.createdAt || order?.updatedAt || order?.paidAt;
}

export function summarizePayments(payments = [], baseDate = new Date()) {
  const paidPayments = payments.filter((payment) => {
    return (payment.status || "PAID") === "PAID";
  });

  const todayPayments = paidPayments.filter((payment) => {
    return sameLocalDay(paymentDate(payment), baseDate);
  });

  const monthPayments = paidPayments.filter((payment) => {
    return sameLocalMonth(paymentDate(payment), baseDate);
  });

  const byPayment = todayPayments.reduce((map, payment) => {
    const method = payment.method || "ບໍ່ຮູ້ວິທີ";
    map[method] = (map[method] || 0) + Number(payment.total || 0);
    return map;
  }, {});

  return {
    todayPayments,
    monthPayments,
    todaySales: todayPayments.reduce((sum, payment) => {
      return sum + Number(payment.total || 0);
    }, 0),
    monthSales: monthPayments.reduce((sum, payment) => {
      return sum + Number(payment.total || 0);
    }, 0),
    byPayment,
  };
}