# BIPOS Pre-Deploy Security Audit

Date: 2026-05-13

## Status

This package contains a security hardening pass and additional tests. It is safer than the uploaded version, but still requires real-environment testing before production.

## Critical issues fixed in this zip

- Removed the real MongoDB password from `.env` and replaced it with placeholders.
- Added `.gitignore` rules so `.env` files and `node_modules` are not committed.
- Strengthened JWT handling: production rejects missing, weak, or default `JWT_SECRET` values.
- Added request body validation with `zod` for login, order creation, payment, shift open/close, table create, menu create, and user create.
- Added basic in-memory rate limits for login, public order creation, and call-staff spam.
- Reduced JSON body limit from `10mb` to `1mb` by default.
- Production error responses no longer expose internal error messages for 500 errors.
- Cashier and payment endpoints now require an open shift before accepting payment.
- Payment totals are recalculated by the backend from real orders instead of trusting frontend totals.
- Shift closing calculates expected cash and difference from actual CASH payments.
- Protected order status updates with auth and roles.
- Added branch checks for cashier/kitchen/waiter style roles.
- Fixed frontend env mismatch by supporting `VITE_API_BASE` consistently.
- Added unit tests for money calculation, shift close calculation, and validation schemas.

## Still required before real production

1. Rotate the MongoDB credential that appeared in the original zip. Treat it as leaked.
2. Create a strong production `JWT_SECRET` with at least 32 random characters.
3. Move secrets into your hosting provider's environment variables. Do not deploy `.env` files.
4. Run a real database migration/push and full manual test flow:
   - login
   - open shift
   - customer order
   - kitchen update
   - cashier payment
   - close shift
   - report summary
5. Add persistent audit logs for login, menu edits, payment, void/refund, shift open/close.
6. Add void/refund/cancel flows before using in a real shop.
7. Replace `BILL-${Date.now()}` with a real branch/day sequence before production receipts.
8. Add authenticated Socket.IO rooms per branch/table/role before multi-branch rollout.
9. Replace in-memory rate limiting with Redis or provider-level rate limits when deployed to multiple server instances.
10. Run `npm audit --omit=dev` and update dependencies regularly.

## Test commands

Backend:

```bash
cd bipos-backend
npm install
npm run check
npm test
```

Frontend:

```bash
cd bipos-frontend
npm install
npm run check
npm run build
```

## Notes

The app still allows public customer ordering by branch/table payload. For a real QR ordering system, add signed QR/table session tokens so a customer cannot forge `branchId` or `tableId`.
