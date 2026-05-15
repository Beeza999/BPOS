import React from "react";

export function StatCard({ label, value, valueClass = "" }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

export function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

export function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/60">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export function RowDark({ label, value }) {
  return (
    <div className="mt-2 flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
