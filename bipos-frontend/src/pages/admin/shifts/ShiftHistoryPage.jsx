import React, { useMemo, useState } from "react";
import { money } from "../../../lib/api.js";
import Stat, { Empty } from "../components/Stat.jsx";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("lo-LA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: import.meta.env.VITE_BUSINESS_TIMEZONE || "Asia/Vientiane",
  }).format(date);
}

function shiftCashSales(shift) {
  if (shift.cashSales !== undefined && shift.cashSales !== null) return Number(shift.cashSales || 0);
  return (shift.payments || [])
    .filter((payment) => payment.method === "CASH" && (payment.status || "PAID") === "PAID")
    .reduce((sum, payment) => sum + Number(payment.total || 0), 0);
}

function shiftTotalSales(shift) {
  if (shift.totalSales !== undefined && shift.totalSales !== null) return Number(shift.totalSales || 0);
  return (shift.payments || [])
    .filter((payment) => (payment.status || "PAID") === "PAID")
    .reduce((sum, payment) => sum + Number(payment.total || 0), 0);
}

export default function ShiftHistoryPage({ shifts = [] }) {
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => {
    return (shifts || []).filter((shift) => status === "all" || String(shift.status).toUpperCase() === status);
  }, [shifts, status]);

  const closedShifts = (shifts || []).filter((shift) => String(shift.status).toUpperCase() === "CLOSED");
  const openShifts = (shifts || []).filter((shift) => String(shift.status).toUpperCase() === "OPEN");
  const closedCash = closedShifts.reduce((sum, shift) => sum + Number(shift.closingCash || 0), 0);
  const allSales = (shifts || []).reduce((sum, shift) => sum + shiftTotalSales(shift), 0);

  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">ປະຫວັດເປີດ/ປິດກະ</h2>
        <p className="text-sm text-slate-500">
          ເບິ່ງວ່າ Cashier ຄົນໃດເປີດກະ, ປິດກະເວລາໃດ ແລະ ເງິນຫຼັງປິດກະເທົ່າໃດ
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="ກະທີ່ເປີດຢູ່" value={openShifts.length} color="text-emerald-600" />
        <Stat label="ກະທີ່ປິດແລ້ວ" value={closedShifts.length} />
        <Stat label="ເງິນຫຼັງປິດກະລວມ" value={money(closedCash)} color="text-orange-600" />
        <Stat label="ຍອດຂາຍຕາມກະລວມ" value={money(allSales)} color="text-blue-600" />
      </div>

      <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-xl font-bold">ລາຍການກະ</h3>
          <select className="input md:w-56" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">ທຸກສະຖານະ</option>
            <option value="OPEN">ເປີດຢູ່</option>
            <option value="CLOSED">ປິດແລ້ວ</option>
          </select>
        </div>

        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-3 pr-3">Cashier</th>
                  <th className="py-3 pr-3">ສະຖານະ</th>
                  <th className="py-3 pr-3">ເປີດກະ</th>
                  <th className="py-3 pr-3">ປິດກະ</th>
                  <th className="py-3 pr-3 text-right">ເງິນເລີ່ມ</th>
                  <th className="py-3 pr-3 text-right">ຂາຍເງິນສົດ</th>
                  <th className="py-3 pr-3 text-right">ຍອດຂາຍລວມ</th>
                  <th className="py-3 pr-3 text-right">ຄວນມີ</th>
                  <th className="py-3 pr-3 text-right">ເງິນຫຼັງປິດກະ</th>
                  <th className="py-3 text-right">ຜົນຕ່າງ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((shift) => {
                  const cashSales = shiftCashSales(shift);
                  const totalSales = shiftTotalSales(shift);
                  const expectedCash = Number(shift.expectedCash ?? Number(shift.openingCash || 0) + cashSales);
                  const difference = shift.difference ?? (shift.closingCash == null ? null : Number(shift.closingCash || 0) - expectedCash);
                  const isOpen = String(shift.status).toUpperCase() === "OPEN";

                  return (
                    <tr key={shift.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        <b>{shift.cashier?.name || shift.cashierName || "-"}</b>
                        <p className="text-xs text-slate-500">{shift.cashier?.username || ""}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {isOpen ? "ເປີດຢູ່" : "ປິດແລ້ວ"}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{formatDateTime(shift.openedAt)}</td>
                      <td className="py-3 pr-3">{formatDateTime(shift.closedAt)}</td>
                      <td className="py-3 pr-3 text-right font-bold">{money(shift.openingCash)}</td>
                      <td className="py-3 pr-3 text-right">{money(cashSales)}</td>
                      <td className="py-3 pr-3 text-right">{money(totalSales)}</td>
                      <td className="py-3 pr-3 text-right">{money(expectedCash)}</td>
                      <td className="py-3 pr-3 text-right font-bold text-orange-600">{shift.closingCash == null ? "-" : money(shift.closingCash)}</td>
                      <td className={`py-3 text-right font-bold ${Number(difference || 0) === 0 ? "text-slate-700" : "text-red-600"}`}>
                        {difference == null ? "-" : money(difference)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ຍັງບໍ່ມີຂໍ້ມູນກະ</Empty>
        )}
      </div>
    </section>
  );
}
