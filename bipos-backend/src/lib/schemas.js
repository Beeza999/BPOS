import { z } from 'zod';

const objectId = z.string().min(12).max(64);
const money = z.coerce.number().int().min(0);
const optionalMoney = z.coerce.number().int().min(0).optional();
const emptyToUndefined = (value) => value === '' ? undefined : value;
const emptyToNull = (value) => value === '' ? null : value;
const optionalObjectId = z.preprocess(emptyToUndefined, objectId.optional());
const nullishObjectId = z.preprocess(emptyToNull, objectId.nullish());
const imageUrl = z.string().max(900000);

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  pin: z.string().trim().min(4).max(12),
});

export const shiftOpenSchema = z.object({
  branchId: optionalObjectId,
  openingCash: optionalMoney.default(0),
});

export const shiftCloseSchema = z.object({
  closingCash: money,
});

export const paymentSchema = z.object({
  tableId: objectId,
  orderIds: z.array(objectId).min(1).max(50),
  method: z.enum(['CASH', 'PROMPTPAY', 'CARD']).default('CASH'),
  discountType: z.enum(['amount', 'percent']).default('amount'),
  discountValue: z.coerce.number().min(0).default(0),
  serviceRate: z.coerce.number().min(0).max(100).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(7),
  paidAmount: optionalMoney,
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const paymentActionSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const billingSettingsSchema = z.object({
  discountType: z.enum(['amount', 'percent']).default('amount'),
  discountValue: z.coerce.number().min(0).default(0),
  serviceRate: z.coerce.number().min(0).max(100).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(7),
}).refine((data) => data.discountType !== 'percent' || Number(data.discountValue || 0) <= 100, {
  message: 'percent discount must be between 0 and 100',
  path: ['discountValue'],
});

export const orderItemSchema = z.object({
  menuItemId: objectId,
  quantity: z.coerce.number().int().min(1).max(99).optional(),
  qty: z.coerce.number().int().min(1).max(99).optional(),
  note: z.string().max(300).optional().default(''),
});

export const orderCreateSchema = z.object({
  tableToken: z.string().trim().min(20).optional(),
  branchId: objectId.optional(),
  tableId: objectId.optional(),
  items: z.array(orderItemSchema).min(1).max(100),
  note: z.string().max(500).optional().default(''),
}).refine((data) => data.tableToken || (data.branchId && data.tableId), {
  message: 'tableToken or branchId/tableId is required',
});

export const takeawayOrderCreateSchema = z.object({
  branchId: optionalObjectId,
  items: z.array(orderItemSchema).min(1).max(100),
  note: z.string().max(500).optional().default(''),
});

export const orderStatusSchema = z.object({
  status: z.enum(['NEW', 'ACCEPTED', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
});

export const orderCancelSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const callStaffSchema = z.object({
  tableToken: z.string().trim().min(20),
  tableName: z.string().max(80).optional(),
  message: z.string().max(300).optional(),
});

export const categoryCreateSchema = z.object({
  restaurantId: optionalObjectId,
  branchId: nullishObjectId,
  name: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
});

export const menuItemCreateSchema = z.object({
  restaurantId: optionalObjectId,
  branchId: nullishObjectId,
  categoryId: objectId,
  name: z.string().trim().min(1).max(160),
  description: z.string().max(1000).optional().default(''),
  price: money,
  imageUrl: imageUrl.optional().default(''),
  station: z.enum(['HOT', 'BAR', 'DESSERT', 'OTHER']).optional(),
  categoryName: z.string().optional(),
  isRecommended: z.coerce.boolean().optional().default(false),
  isAvailable: z.coerce.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const menuItemUpdateSchema = z.object({
  branchId: nullishObjectId.optional(),
  categoryId: objectId.optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(1000).optional(),
  price: money.optional(),
  imageUrl: imageUrl.optional(),
  station: z.enum(['HOT', 'BAR', 'DESSERT', 'OTHER']).optional(),
  isRecommended: z.coerce.boolean().optional(),
  isAvailable: z.coerce.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const tableCreateSchema = z.object({
  branchId: objectId,
  name: z.string().trim().min(1).max(50),
  seats: z.coerce.number().int().min(1).max(100).optional().default(4),
  qrCode: z.string().trim().min(6).max(80).optional(),
});

export const tableUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  seats: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['AVAILABLE', 'OPEN', 'BILLING', 'CLOSED']).optional(),
});

export const userCreateSchema = z.object({
  restaurantId: optionalObjectId,
  branchId: nullishObjectId,
  name: z.string().trim().min(1).max(120),
  username: z.string().trim().min(3).max(80),
  pin: z.string().trim().min(4).max(12),
  role: z.enum(['OWNER', 'ADMIN', 'CASHIER', 'WAITER', 'KITCHEN']),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
});

export const userUpdateSchema = z.object({
  branchId: nullishObjectId.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  username: z.string().trim().min(3).max(80).optional(),
  pin: z.string().trim().min(4).max(12).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'CASHIER', 'WAITER', 'KITCHEN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
