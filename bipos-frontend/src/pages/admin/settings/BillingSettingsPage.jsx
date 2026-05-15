import React from "react";
import { money } from "../../../lib/api.js";

export default function BillingSettingsPage({ billingSettings, setBillingSettings, saveBillingSettings }) {
  const settings = billingSettings || {};
  const discountType = settings.discountType || "amount";
  const discountValue = Number(settings.discountValue || 0);
  const serviceRate = Number(settings.serviceRate || 0);
  const vatRate = Number(settings.vatRate || 0);
  const exampleSubtotal = 100000;
  const exampleDiscount = discountType === "percent"
    ? Math.min(exampleSubtotal, Math.round((exampleSubtotal * discountValue) / 100))
    : Math.min(exampleSubtotal, Math.round(discountValue));
  const exampleBase = Math.max(0, exampleSubtotal - exampleDiscount);
  const exampleService = Math.round((exampleBase * serviceRate) / 100);
  const exampleVat = Math.round(((exampleBase + exampleService) * vatRate) / 100);
  const exampleTotal = exampleBase + exampleService + exampleVat;

  function patch(next) {
    setBillingSettings({ ...settings, ...next });
  }

  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">ຕັ້ງຄ່າການຄິດເງິນ</h2>
        <p className="text-sm text-slate-500">
          ແອດມິນກຳນົດສ່ວນຫຼຸດ, ຄ່າບໍລິການ ແລະ ອາກອນ. ໜ້າ Cashier ຈະໃຊ້ຄ່ານີ້ອັດຕະໂນມັດ ແລະ ບໍ່ໃຫ້ Cashier ແກ້ເອງ.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form onSubmit={saveBillingSettings} className="card space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700">ປະເພດສ່ວນຫຼຸດ</label>
            <select
              className="input mt-2 w-full"
              value={discountType}
              onChange={(event) => patch({ discountType: event.target.value })}
            >
              <option value="amount">ສ່ວນຫຼຸດເປັນເງິນ</option>
              <option value="percent">ສ່ວນຫຼຸດ %</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              {discountType === "percent" ? "ສ່ວນຫຼຸດ (%)" : "ສ່ວນຫຼຸດ (LAK)"}
            </label>
            <input
              className="input mt-2 w-full"
              type="number"
              min="0"
              max={discountType === "percent" ? "100" : undefined}
              value={settings.discountValue ?? 0}
              onChange={(event) => patch({ discountValue: event.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">ຄ່າບໍລິການ (%)</label>
            <input
              className="input mt-2 w-full"
              type="number"
              min="0"
              max="100"
              value={settings.serviceRate ?? 0}
              onChange={(event) => patch({ serviceRate: event.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">ອາກອນ (%)</label>
            <input
              className="input mt-2 w-full"
              type="number"
              min="0"
              max="100"
              value={settings.vatRate ?? 7}
              onChange={(event) => patch({ vatRate: event.target.value })}
            />
          </div>

          <button className="btn w-full bg-orange-500 text-white">ບັນທຶກການຕັ້ງຄ່າ</button>
        </form>

        <div className="card">
          <h3 className="text-xl font-bold">ຕົວຢ່າງການຄິດເງິນ</h3>
          <p className="mt-1 text-sm text-slate-500">ຕົວຢ່າງນີ້ຄິດຈາກຍອດອາຫານ {money(exampleSubtotal)}</p>

          <div className="mt-5 space-y-3 rounded-3xl bg-slate-50 p-4">
            <div className="flex justify-between gap-3"><span className="text-slate-500">ລວມອາຫານ</span><b>{money(exampleSubtotal)}</b></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">ສ່ວນຫຼຸດ</span><b>-{money(exampleDiscount)}</b></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">ຄ່າບໍລິການ</span><b>{money(exampleService)}</b></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">ອາກອນ</span><b>{money(exampleVat)}</b></div>
            <div className="border-t border-slate-200 pt-3 text-lg">
              <div className="flex justify-between gap-3"><span className="font-bold">ຍອດສຸດທິ</span><b className="text-orange-600">{money(exampleTotal)}</b></div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">
            ຫຼັງບັນທຶກ Cashier ຈະເຫັນຍອດຄິດເງິນຕາມຄ່ານີ້ເລີຍ. ຖ້າເປີດໜ້າ Cashier ຢູ່ ໃຫ້ກົດໂຫລດໃໝ່ ຫຼື ລໍຖ້າ realtime sync.
          </div>
        </div>
      </div>
    </section>
  );
}
