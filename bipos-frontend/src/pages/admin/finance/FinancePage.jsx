import React, { useMemo } from "react";
import { money } from "../../../lib/api.js";
import { summarizePayments } from "../utils/date.js";
import Stat, { Empty } from "../components/Stat.jsx";

export default function FinancePage({ payments }) {
  const daily = useMemo(() => summarizePayments(payments), [payments]);
  const allSales = payments.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const byMethodMonth = daily.monthPayments.reduce((map, p) => {
    const method = p.method || "ບໍ່ຮູ້ວິທີ";
    map[method] = (map[method] || 0) + Number(p.total || 0);
    return map;
  }, {});

  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">ການເງິນ</h2>
        <p className="text-sm text-slate-500">
          ລວບລວມເງິນປະຈຳວັນ, ປະຈຳເດືອນ ແລະ ຍອດລວມທັງໝົດ
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="ຍອດເງິນມື້ນີ້" value={money(daily.todaySales)} color="text-emerald-600" />
        <Stat label="ຍອດເງິນເດືອນນີ້" value={money(daily.monthSales)} color="text-blue-600" />
        <Stat label="ຍອດເງິນທັງໝົດ" value={money(allSales)} color="text-orange-600" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-xl font-bold">ລາຍຮັບມື້ນີ້ຕາມຊ່ອງທາງ</h3>
          <div className="mt-4 space-y-3">
            {Object.keys(daily.byPayment).length ? (
              Object.entries(daily.byPayment).map(([method, total]) => (
                <div key={method} className="flex justify-between rounded-2xl bg-slate-50 p-3">
                  <b>{method}</b>
                  <b className="text-emerald-600">{money(total)}</b>
                </div>
              ))
            ) : (
              <Empty>ມື້ນີ້ຍັງບໍ່ມີເງິນເຂົ້າ</Empty>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold">ລາຍຮັບເດືອນນີ້ຕາມຊ່ອງທາງ</h3>
          <div className="mt-4 space-y-3">
            {Object.keys(byMethodMonth).length ? (
              Object.entries(byMethodMonth).map(([method, total]) => (
                <div key={method} className="flex justify-between rounded-2xl bg-slate-50 p-3">
                  <b>{method}</b>
                  <b className="text-blue-600">{money(total)}</b>
                </div>
              ))
            ) : (
              <Empty>ເດືອນນີ້ຍັງບໍ່ມີເງິນເຂົ້າ</Empty>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
