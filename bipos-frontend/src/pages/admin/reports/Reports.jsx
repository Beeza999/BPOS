import React from "react";

export default function ລາຍງານ({ summary, payments }) {
  return (
    <section className="p-4">
      <div className="card">
        <h2 className="text-2xl font-bold">ລາຍງານ</h2>
        <pre className="mt-4 overflow-auto rounded-2xl bg-slate-900 p-4 text-sm text-white">
          {JSON.stringify({ summary, payments }, null, 2)}
        </pre>
      </div>
    </section>
  );
}
