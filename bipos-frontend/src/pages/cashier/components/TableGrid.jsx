import React from "react";
import { money } from "../../../lib/api.js";
import { tableStatusText } from "../constants.js";

export default function TableGrid({ tables, billByTable, onSelectTable }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">ສະຖານະໂຕະທັງໝົດ</h2>
        <span className="text-sm font-bold text-slate-500">{tables.length} ໂຕະ</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {tables.map((t) => {
          const bill = billByTable[t.id];
          const active = !!bill;
          return (
            <button key={t.id} type="button" onClick={() => bill && onSelectTable(bill)} className={`rounded-3xl border p-4 text-left transition ${active ? "border-orange-300 bg-orange-50" : "border-slate-100 bg-slate-50"}`}>
              <p className="text-lg font-bold">ໂຕະ {t.name}</p>
              <p className={`mt-1 text-xs font-bold ${active ? "text-orange-600" : "text-slate-500"}`}>{bill ? "ລໍຖ້າຈ່າຍ" : tableStatusText[t.status] || t.status}</p>
              {bill && <p className="mt-1 text-lg font-bold text-orange-600">{money(bill.total)}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
