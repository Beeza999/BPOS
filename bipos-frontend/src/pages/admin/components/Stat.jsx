import React from "react";

export default function Stat({ label, value, color = "text-slate-900" }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
      {children}
    </div>
  );
}
