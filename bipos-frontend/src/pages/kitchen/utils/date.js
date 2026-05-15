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

export function ticketDate(ticket) {
  return ticket?.createdAt || ticket?.order?.createdAt || ticket?.updatedAt;
}

