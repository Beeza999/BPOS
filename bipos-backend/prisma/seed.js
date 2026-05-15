import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPin } from "../src/lib/auth.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refuse to run seed in production");
}

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.sequenceCounter.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.table.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.restaurant.deleteMany();

  const restaurant = await prisma.restaurant.create({
    data: { name: "BIPOS Restaurant", currency: "LAK", taxRate: 7, serviceRate: 0, status: "ACTIVE" },
  });
  const branch = await prisma.branch.create({
    data: { restaurantId: restaurant.id, name: "Main Branch", address: "Vientiane", phone: "02000000000", status: "ACTIVE" },
  });

  const cats = {};
  const categoryNames = ["ເຂົ້າ", "ເສັ້ນ", "ເຄື່ອງດື່ມ", "ຂອງຫວານ"];
  for (const [i, name] of categoryNames.entries()) {
    cats[name] = await prisma.category.create({ data: { restaurantId: restaurant.id, branchId: branch.id, name, sortOrder: i + 1, status: "ACTIVE" } });
  }

  const menu = [
    ["ເຂົ້າກະເພົາໄກ່ໄຂ່ດາວ", "ເຂົ້າ", 35000, "HOT", true, "ເຜັດຫອມ ໃບກະເພົາສົດ ພ້ອມໄຂ່ດາວ"],
    ["ເຂົ້າຜັດກຸ້ງ", "ເຂົ້າ", 45000, "HOT", true, "ເຂົ້າຜັດຫອມກະທະ ກຸ້ງສົດ"],
    ["ເຝີເນື້ອ", "ເສັ້ນ", 40000, "HOT", true, "ນ້ຳຊຸບຮ້ອນໆ ເນື້ອນຸ່ມ"],
    ["ຊາເຢັນ", "ເຄື່ອງດື່ມ", 18000, "BAR", true, "ຊາໄທເຂັ້ມຂົ້ນ ຫວານມັນ"],
    ["ນ້ຳໝາກນາວ", "ເຄື່ອງດື່ມ", 16000, "BAR", false, "ສົດຊື່ນ ຫວານອົມສົ້ມ"],
    ["ເຄັກຊັອກໂກແລັດ", "ຂອງຫວານ", 28000, "DESSERT", false, "ເນື້ອເຄັກນຸ່ມ ຊັອກໂກແລັດ"],
  ];
  for (const [name, cat, price, station, isRecommended, description] of menu) {
    await prisma.menuItem.create({
      data: { restaurantId: restaurant.id, branchId: branch.id, categoryId: cats[cat].id, name, description, price, imageUrl: "", station, isRecommended, isAvailable: true, status: "ACTIVE" },
    });
  }

  for (const name of ["A1", "A2", "A3", "A4", "B1", "B2", "VIP1", "VIP2"]) {
    await prisma.table.create({ data: { branchId: branch.id, name, qrCode: `qr-${name.toLowerCase()}`, seats: name.startsWith("VIP") ? 8 : 4, status: "AVAILABLE" } });
  }

  for (const u of [
    ["Admin", "admin", "OWNER", "1111"],
    ["Cashier 1", "cashier1", "CASHIER", "2222"],
    ["Waiter 1", "waiter1", "WAITER", "3333"],
    ["Kitchen 1", "kitchen1", "KITCHEN", "4444"],
  ]) {
    await prisma.user.create({ data: { restaurantId: restaurant.id, branchId: branch.id, name: u[0], username: u[1], role: u[2], pinHash: await hashPin(u[3]), status: "ACTIVE" } });
  }

  console.log({ restaurantId: restaurant.id, branchId: branch.id, adminLogin: "admin / 1111", customerQrExample: "Open Admin > Tables to copy the signed QR URL" });
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
