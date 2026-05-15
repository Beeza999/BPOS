export function getDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sameLocalDay(value, baseDate = new Date()) {
  const date = getDateValue(value);
  if (!date) return false;
  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth() &&
    date.getDate() === baseDate.getDate()
  );
}

export function paymentDate(payment) {
  return payment?.paidAt || payment?.createdAt || payment?.updatedAt;
}

const tableStatusText = {
  AVAILABLE: "ວ່າງ",
  OPEN: "ກຳລັງໃຊ້",
  BILLING: "ລໍຖ້າຈ່າຍ",
  CLOSED: "ປິດ",
};

