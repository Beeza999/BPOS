import React from "react";
import { money } from "../../../lib/api.js";
import { FilterButton } from "./CashierComponents.jsx";

export default function BillList({ allBills, selectedBill, filter, setFilter, loading, onSelect }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">ລາຍການບິນ</h2>
          <p className="text-sm text-slate-500">{loading ? "ກຳລັງໂຫຼດ..." : `${allBills.length} ລາຍການ`}</p>
        </div>
        <div className="flex gap-2">
          <FilterButton active={filter === "billing"} onClick={() => setFilter("billing")}>ລໍຖ້າຈ່າຍ</FilterButton>
          <FilterButton active={filter === "paid"} onClick={() => setFilter("paid")}>ຈ່າຍແລ້ວ</FilterButton>
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>ທັງໝົດ</FilterButton>
        </div>
      </div>
      <div className="space-y-3">
        {allBills.map((bill) => {
          const isPaid = bill.status === "PAID";
          const canPay = bill.canPay !== false;
          return (
            <button key={bill.id} type="button" onClick={() => onSelect(bill)} className={`w-full rounded-3xl border p-4 text-left transition ${selectedBill?.id === bill.id ? "border-orange-300 bg-orange-50" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <b className="text-lg">{bill.isTakeaway ? "ກັບບ້ານ" : "ໂຕະ"} {bill.table?.name || "-"}</b>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${isPaid ? "bg-emerald-50 text-emerald-700" : canPay ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {isPaid ? "ຈ່າຍແລ້ວ" : canPay ? "ພ້ອມຄິດເງິນ" : "ລໍຖ້າຄົວ"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {bill.orders?.length || 0} ອໍເດີ · {bill.items?.length || 0} ລາຍການ
                {!isPaid && ` · ພ້ອມ ${bill.readyItems || 0}/${bill.totalItems || bill.items?.length || 0}`}
              </p>
              <p className="mt-2 text-2xl font-bold text-orange-600">{money(bill.total)}</p>
            </button>
          );
        })}
        {!allBills.length && <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">ບໍ່ມີບິນ</div>}
      </div>
    </div>
  );
}
