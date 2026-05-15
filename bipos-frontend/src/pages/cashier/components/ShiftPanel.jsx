import React from "react";
import { money } from "../../../lib/api.js";

export default function ShiftPanel({
  activeShift,
  openingCash,
  setOpeningCash,
  closingCash,
  setClosingCash,
  shiftCashSales = 0,
  shiftTotalSales = 0,
  shiftExpectedCash = 0,
  onOpen,
  onClose,
}) {
  const countedCash = Number(closingCash || 0);
  const difference = activeShift ? countedCash - Number(shiftExpectedCash || 0) : 0;

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold">ເປີດກະ / ປິດກະ</h2>
      {activeShift ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            ກະເປີດຢູ່ · ເງິນເລີ່ມຕົ້ນ {money(activeShift.openingCash)}
          </p>

          <div className="grid gap-2 text-sm font-bold text-slate-700">
            <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
              <span>ຍອດຂາຍລວມໃນກະ</span>
              <span className="text-emerald-600">{money(shiftTotalSales)}</span>
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
              <span>ຂາຍເງິນສົດໃນກະ</span>
              <span>{money(shiftCashSales)}</span>
            </div>
            <div className="flex justify-between rounded-2xl bg-orange-50 p-3 text-orange-700">
              <span>ເງິນທີ່ຄວນມີໃນລິ້ນຊັກ</span>
              <span>{money(shiftExpectedCash)}</span>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              ເງິນທີ່ນັບໄດ້ຈິງກ່ອນປິດກະ
            </span>
            <input
              className="input w-full"
              type="number"
              placeholder="ໃສ່ເງິນທັງໝົດໃນລິ້ນຊັກ"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
            />
          </label>

          <div className={`rounded-2xl p-3 text-sm font-bold ${difference === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            ຜົນຕ່າງຈາກຍອດທີ່ຄວນມີ: {money(difference)}
          </div>

          <button className="btn w-full bg-red-500 text-white" onClick={onClose}>
            ຢືນຢັນເງິນ ແລະ ປິດກະ
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
            ຫຼັງປິດກະ ຍອດຂາຍໃນໜ້າ Cashier ຈະກັບເປັນ 0 ແລະເລີ່ມນັບໃໝ່ເມື່ອເປີດກະໃໝ່
          </p>
          <input
            className="input w-full"
            type="number"
            placeholder="ເງິນເລີ່ມຕົ້ນ"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
          />
          <button className="btn w-full bg-orange-500 text-white" onClick={onOpen}>
            ເປີດກະ
          </button>
        </div>
      )}
    </div>
  );
}
