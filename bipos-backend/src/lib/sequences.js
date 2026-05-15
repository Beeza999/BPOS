import { prisma } from './prisma.js';

export function businessDate(value = new Date()) {
  const timezone = process.env.BUSINESS_TIMEZONE || 'Asia/Vientiane';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value).reduce((map, part) => {
    map[part.type] = part.value;
    return map;
  }, {});
  return `${parts.year}${parts.month}${parts.day}`;
}

export async function nextSequenceNumber({ client = prisma, scope, type, date = businessDate(), width = 4 }) {
  const row = await client.sequenceCounter.upsert({
    where: { scope_type_date: { scope, type, date } },
    update: { value: { increment: 1 } },
    create: { scope, type, date, value: 1 },
  });
  return String(row.value).padStart(width, '0');
}

export async function nextBusinessNumber({ client = prisma, scope, type, prefix, date = businessDate(), width = 4 }) {
  const next = await nextSequenceNumber({ client, scope, type, date, width });
  return `${prefix}-${date}-${next}`;
}
