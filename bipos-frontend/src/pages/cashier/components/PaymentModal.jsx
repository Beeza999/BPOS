import React from "react";
import { money } from "../../../lib/api.js";
import { RowDark } from "./CashierComponents.jsx";

export default function PaymentModal({ open, paymentMethod, paidAmount, setPaidAmount, calc, changeAmount, activeShift, submitting = false, onClose, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4">
      <div className="mx-auto mt-12 max-w-md rounded-3xl bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">ຮັບຊຳລະເງິນ</h3>
          <button className="rounded-full bg-slate-100 px-3 py-1 font-bold disabled:opacity-50" disabled={submitting} onClick={onClose}>x</button>
        </div>
        <p className="text-sm font-bold text-slate-500">ວິທີຊຳລະ: {paymentMethod}</p>
        <label className="mt-4 block text-sm font-bold">ຈຳນວນເງິນທີ່ຮັບ</label>
        <input type="number" min="0" value={paidAmount} disabled={submitting} onChange={(e) => setPaidAmount(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-xl font-bold outline-none focus:border-orange-400 disabled:bg-slate-100" />
        <div className="mt-3 rounded-2xl bg-slate-50 p-3">
          <RowDark label="ຍອດຕ້ອງຈ່າຍ" value={money(calc.total)} />
          <RowDark label="ເງິນທີ່ຮັບ" value={money(paidAmount)} />
          <div className="mt-3 rounded-2xl bg-emerald-50 p-3"><div className="flex items-center justify-between"><span className="text-sm font-bold text-emerald-700">ເງິນທອນ</span><span className="text-2xl font-bold text-emerald-700">{money(changeAmount)}</span></div></div>
        </div>
        <button onClick={onConfirm} disabled={!activeShift || submitting} className="mt-4 w-full rounded-2xl bg-orange-500 py-4 font-bold text-white shadow active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400">{submitting ? "ກຳລັງບັນທຶກ..." : "ຢືນຢັນຮັບເງິນ"}</button>
      </div>
    </div>
  );
}
