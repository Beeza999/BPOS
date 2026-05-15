import React from "react";

export function Stat({ label, value, color = "text-slate-900" }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function Tabs({ items, active, setActive, dark = false }) {
  return (
    <section className="px-4 pt-4">
      <div className="flex gap-2 overflow-x-auto rounded-3xl bg-white p-3 shadow-sm">
        {items.map((i) => (
          <button
            key={i.id}
            onClick={() => setActive(i.id)}
            className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold ${
              active === i.id
                ? dark
                  ? "bg-slate-900 text-white"
                  : "bg-orange-500 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {i.label}
          </button>
        ))}
      </div>
    </section>
  );
}
