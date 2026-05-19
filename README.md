# BIPOS Full Stack Final

สร้างตามลำดับงานที่กำหนด: Database -> Backend API -> Admin -> Customer QR -> Kitchen KDS -> Cashier POS -> Reports.

## โครงสร้าง

```text
bipos-backend/   Express + Prisma + MongoDB + Socket.IO
bipos-frontend/  React + Vite + TailwindCSS + Socket.IO Client
docs/            database/API/deploy/test docs
references/      HTML prototype เดิม 4 ไฟล์
```

## Run backend

```bash
cd bipos-backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

## Run frontend

```bash
cd bipos-frontend
cp .env.example .env
npm install
npm run dev
```

## URLs

- Admin: `/admin`
- Customer: `/customer?table=A1` หรือ `/customer?qr=qr-a1`
- Kitchen: `/kitchen`
- Cashier: `/cashier`

## Demo Login

- admin / 1111
- cashier1 / 2222
- waiter1 / 3333
- kitchen1 / 4444



ເມື່ອລູກຄ້າກົດ ເກັບເງິນ ໃຫ້ແຈ້ງເຕືອນໄປຫາ cashier ວ່າໂຕະ......ເອີ້ນເກັບເງິນ
admin แก้ไข ลบ ຜູ້ໃຊ້ ได้