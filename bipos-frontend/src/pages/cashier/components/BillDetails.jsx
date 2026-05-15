import React from "react";
import { money } from "../../../lib/api.js";
import { Row } from "./CashierComponents.jsx";

export default function BillDetails({ selectedBill, calc, billingSettings, activeShift, onOpenPayment }) {
  const canPay = selectedBill?.canPay !== false;
  const lockedMessage = selectedBill?.payLockedReason || "ລໍຖ້າ Kitchen ກົດພ້ອມເສີບກ່ອນ";
  const settings = calc?.settings || billingSettings || {};
  const discountText = settings.discountType === "percent"
    ? `${Number(settings.discountValue || 0)}%`
    : money(settings.discountValue || 0);

  return (
    <aside className="rounded-3xl bg-slate-900 p-4 text-white shadow-sm">
      <h2 className="text-xl font-bold">ລາຍລະອຽດບິນ</h2>
      {!selectedBill ? (
        <div className="mt-4 rounded-3xl bg-white/10 p-8 text-center text-white/70">ເລືອກບິນເພື່ອຊຳລະ</div>
      ) : (
        <>
          <div className="mt-4 rounded-3xl bg-white/10 p-4">
            <div className="flex justify-between"><span className="text-white/60">ໂຕະ</span><b>{selectedBill.table?.name || "-"}</b></div>
            {selectedBill.isTakeaway && <p className="mt-2 rounded-2xl bg-orange-500/20 px-3 py-2 text-xs font-bold text-orange-100">ອໍເດີນີ້ແມ່ນສັ່ງກັບບ້ານ</p>}
            {(selectedBill.items || []).map((item) => (
              <div key={item.id} className="mt-3 flex justify-between gap-3 border-t border-white/10 pt-3">
                <div>
                  <b>{item.name}</b>
                  <p className="text-xs text-white/50">x{item.quantity || 1} {item.note ? `· ${item.note}` : ""}</p>
                  <p className={item.status === "READY" ? "mt-1 text-xs font-bold text-emerald-300" : "mt-1 text-xs font-bold text-amber-300"}>
                    {item.status === "READY" ? "ພ້ອມເສີບແລ້ວ" : `ລໍຖ້າຄົວ: ${item.status || "NEW"}`}
                  </p>
                </div>
                <b>{money(Number(item.price || 0) * Number(item.quantity || 1))}</b>
              </div>
            ))}
          </div>

          {selectedBill.status !== "PAID" && !canPay && (
            <div className="mt-4 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
              {lockedMessage}
              <p className="mt-1 text-xs text-amber-100/80">
                ພ້ອມແລ້ວ {selectedBill.readyItems || 0}/{selectedBill.totalItems || selectedBill.items?.length || 0} ລາຍການ
              </p>
            </div>
          )}

          {selectedBill.status !== "PAID" && (
            <div className="mt-4 rounded-3xl border border-blue-300/30 bg-blue-400/10 p-4 text-sm text-blue-50">
              <p className="mt-1 text-xs text-blue-100/80">
                ສ່ວນຫຼຸດ {discountText} · ບໍລິການ {Number(settings.serviceRate || 0)}% · ອາກອນ {Number(settings.vatRate ?? 0)}%
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2 rounded-3xl bg-white/10 p-4">
            <Row label="ລວມ" value={money(calc.subtotal)} />
            <Row label="ສ່ວນຫຼຸດ" value={`-${money(calc.discount)}`} />
            <Row label="ບໍລິການ" value={money(calc.service)} />
            <Row label="ອາກອນ" value={money(calc.vat)} />
            <div className="border-t border-white/10 pt-3"><Row label="ຍອດສຸດທິ" value={money(calc.total)} /></div>
          </div>
          {selectedBill.status !== "PAID" && (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <button onClick={() => onOpenPayment("CASH")} disabled={!activeShift || !canPay} className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-500">ເງິນສົດ</button>
              <button onClick={() => onOpenPayment("PROMPTPAY")} disabled={!activeShift || !canPay} className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-500">QR ພ້ອມເພ</button>
              <button onClick={() => onOpenPayment("CARD")} disabled={!activeShift || !canPay} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white">ບັດ</button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
