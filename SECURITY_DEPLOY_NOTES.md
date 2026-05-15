# BIPOS Security Deploy Notes

This copy has been hardened for deployment.

## Fixed security items

1. Reports are now scoped by the logged-in user's restaurant/branch. OWNER/ADMIN cannot read another restaurant by passing an arbitrary `branchId`.
2. Payments and open bills are now scoped by restaurant/branch, and payment responses no longer expose `pinHash`.
3. Shifts are now scoped by restaurant/branch. CASHIER sees only their own shifts.
4. Public menu/category APIs now require a `branchId` when not logged in, and global menu items are filtered by the branch restaurant.
5. Socket.IO `table:join` now requires a signed `tableToken` and verifies the token against the table before joining the room.
6. `POST /api/orders/call-staff` now requires a signed `tableToken`; legacy `branchId/tableId` calls are rejected.
7. ADMIN users can create/edit only CASHIER, WAITER, and KITCHEN roles. OWNER is protected, and the system prevents disabling/demoting the last active OWNER.
8. `PUT /api/menu/items/:id` now uses `menuItemUpdateSchema` and accepts only allowed fields.
9. Backend npm audit lockfile was updated; production audit now reports 0 vulnerabilities.

## Files changed most importantly

- `bipos-backend/src/lib/http.js`
- `bipos-backend/src/lib/schemas.js`
- `bipos-backend/src/routes/reports.js`
- `bipos-backend/src/routes/payments.js`
- `bipos-backend/src/routes/shifts.js`
- `bipos-backend/src/routes/menu.js`
- `bipos-backend/src/routes/orders.js`
- `bipos-backend/src/routes/users.js`
- `bipos-backend/src/routes/tables.js`
- `bipos-backend/src/routes/kitchen.js`
- `bipos-backend/src/routes/cashier.js`
- `bipos-backend/src/services/paymentService.js`
- `bipos-backend/src/server.js`
- `bipos-frontend/src/lib/socket.js`
- `bipos-frontend/src/pages/customer/index.jsx`
- `bipos-frontend/src/lib/api.js`

## Commands verified

Backend:

```bash
cd bipos-backend
npm ci --ignore-scripts
npm run check
npm audit --omit=dev
```

Frontend:

```bash
cd bipos-frontend
npm ci --ignore-scripts
npm run build
npm audit --omit=dev
```

## Production env checklist

Backend `.env` must use strong values:

```env
NODE_ENV=production
PORT=8080
APP_ORIGIN=https://your-frontend-domain.com
PUBLIC_BASE_URL=https://your-frontend-domain.com
JWT_SECRET=replace-with-random-secret-at-least-32-characters
TABLE_TOKEN_SECRET=replace-with-another-random-secret-at-least-32-characters
TABLE_TOKEN_TTL_DAYS=3650
BUSINESS_TIMEZONE=Asia/Vientiane
DATABASE_URL="mongodb+srv://USER:PASSWORD@cluster.mongodb.net/bipos?retryWrites=true&w=majority"
ALLOW_LEGACY_PUBLIC_ORDER=false
```

Frontend `.env`:

```env
VITE_API_BASE=https://your-backend-domain.com
```

## Important migration note

After deployment, regenerate/print table QR codes from the Admin table page so customers use `/customer?t=<signed table token>`. Old `/customer?qr=...` links can still open a table session, but new orders and staff calls are protected by signed tokens.
