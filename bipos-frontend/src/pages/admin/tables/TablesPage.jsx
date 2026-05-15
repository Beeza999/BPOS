import React from "react";
import { customerUrl } from "../../../lib/api.js";

function qrImageUrl(table) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    customerUrl(table),
  )}`;
}

export default function TablesPage({ table, setTable, tables, addTable, deleteTable }) {
  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">ຈັດການໂຕະ / QR</h2>
        <p className="text-sm text-slate-500">
          ເພີ່ມໂຕະແລ້ວລະບົບຈະສ້າງ QR ແບບມີ token ປ້ອງກັນການປອມໂຕະ
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form onSubmit={addTable} className="card space-y-3">
          <h3 className="text-xl font-bold">+ ເພີ່ມໂຕະ</h3>

          <input
            required
            className="input w-full"
            placeholder="A1"
            value={table.name}
            onChange={(e) =>
              setTable({ ...table, name: e.target.value.toUpperCase() })
            }
          />

          <input
            className="input w-full"
            type="number"
            value={table.seats}
            onChange={(e) => setTable({ ...table, seats: e.target.value })}
          />

          <button className="btn w-full bg-orange-500 text-white">
            ສ້າງ QR ອັດຕະໂນມັດ
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {tables.map((t) => (
            <article className="card" key={t.id}>
              <h3 className="text-xl font-bold">ໂຕະ {t.name}</h3>

              <div className="mt-4 flex h-44 items-center justify-center rounded-2xl bg-slate-100 p-3">
                <img
                  alt={`QR ${t.name}`}
                  src={qrImageUrl(t)}
                  className="h-full w-full object-contain"
                />
              </div>

              <p className="mt-3 break-all text-xs text-slate-500">
                {customerUrl(t)}
              </p>

              <p className="mt-1 text-xs font-bold text-slate-400">
                QR: {t.qrCode}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                  onClick={() => window.open(customerUrl(t), "_blank")}
                >
                  ເປີດໜ້າລູກຄ້າ
                </button>

                <button
                  className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                  onClick={() => deleteTable(t.id)}
                >
                  ລົບ
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
