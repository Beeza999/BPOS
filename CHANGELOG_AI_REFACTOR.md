# BIPOS AI Refactor Summary

ການແກ້ໄຂຊຸດນີ້ເນັ້ນໃຫ້ໂຄງສ້າງແຍກຊັດເຈນ, ແກ້ຈຸດສ່ຽງກ່ອນນຳໄປໃຊ້ງານຈິງ, ແລະປ່ຽນ UI ໃຫ້ເປັນພາສາລາວເປັນຫຼັກ.

## Backend

- ແຍກ logic ຮັບເງິນໄປຢູ່ `src/services/paymentService.js`
- ເພີ່ມ `src/lib/sequences.js` ສຳລັບເລກບິນ/ເລກອໍເດີແບບ running number
- ເພີ່ມ `src/lib/audit.js` ແລະ model `AuditLog` ເພື່ອບັນທຶກ action ສຳຄັນ
- ເພີ່ມ `src/lib/tableToken.js` ສຳລັບ signed QR/table token
- ເພີ່ມ `src/lib/socketEvents.js` ເພື່ອ emit ຕາມ branch/table room
- ແກ້ `/api/cashier/pay` ແລະ `/api/payments/pay` ໃຫ້ໃຊ້ service ດຽວກັນ
- ເພີ່ມ idempotency key ສຳລັບກັນການກົດຈ່າຍຊ້ຳ
- ເພີ່ມ endpoint cancel/void/refund:
  - `POST /api/orders/:id/cancel`
  - `POST /api/payments/:id/void`
  - `POST /api/payments/:id/refund`
- ແກ້ permission scope ຂອງ menu/table/user/kitchen/shift ໃຫ້ກວດ branch/restaurant ຊັດຂຶ້ນ
- ປ້ອງກັນ kitchen/waiter override `branchId` ໃນ query
- ເພີ່ມ guard ໃນ seed script ຫ້າມ seed ໃນ production

## Frontend

- ແກ້ payload ຕອນ cashier ຮັບເງິນ ໃຫ້ສົ່ງ `discountType`, `discountValue`, `serviceRate`, `vatRate`, `paidAmount` ຕົງກັບ backend
- ແຍກໜ້າ cashier ຈາກໄຟລ໌ໃຫຍ່ເປັນ component/utils:
  - `components/LoginCard.jsx`
  - `components/Header.jsx`
  - `components/ShiftPanel.jsx`
  - `components/TableGrid.jsx`
  - `components/BillList.jsx`
  - `components/BillDetails.jsx`
  - `components/PaymentModal.jsx`
  - `utils/storage.js`
  - `utils/receipt.js`
  - `constants.js`
- ແກ້ QR customer flow ໃຫ້ໃຊ້ signed token `?t=...`
- ໜ້າ Admin Tables ໃຊ້ QR URL ແບບ signed token
- ປ່ຽນ label/UI ຫຼັກເປັນພາສາລາວ
- ເອົາ default demo credential ອອກຈາກ login ຫຼັກ

## ການກວດທີ່ເຮັດແລ້ວ

- ກວດ syntax backend JS ດ້ວຍ `node --check`
- ກວດ parse frontend JSX/JS ດ້ວຍ TypeScript transpile parser

## ຍັງຄວນທົດສອບຕໍ່

- ຕໍ່ MongoDB ຈິງ ແລ້ວ run `prisma db push`
- run `npm ci` ແລະ `npm run build` ຂອງ frontend
- ທົດສອບ flow ຈິງ: ເປີດກະ → ສັ່ງຜ່ານ QR → ຄົວຮັບອໍເດີ → ຮັບເງິນ → ປິດກະ
- ທົດສອບ cancel/void/refund ກັບຂໍ້ມູນຈິງ
