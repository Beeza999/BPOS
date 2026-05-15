import React from "react";

export default function Header({ onSync, onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">ໜ້າແຄດເຊຍ</h1>
          <p className="text-sm text-slate-500">ປິດບິນ, ຮັບຊຳລະ, ເປີດກະ/ປິດກະ ແລະ ເບິ່ງສະຖານະໂຕະ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSync} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow active:scale-95">ດຶງຂໍ້ມູນໃໝ່</button>
          <button type="button" onClick={onLogout} className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow active:scale-95">ອອກຈາກລະບົບ</button>
        </div>
      </div>
    </header>
  );
}
