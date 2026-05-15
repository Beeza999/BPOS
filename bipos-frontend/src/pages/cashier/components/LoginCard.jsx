import React from "react";

export default function LoginCard({ loginForm, setLoginForm, onSubmit }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-900">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-orange-600">BIPOS ແຄດເຊຍ</p>
        <h1 className="mt-2 text-2xl font-bold">ລັອກອິນແຄດເຊຍ</h1>
        <p className="mt-1 text-sm text-slate-500">ກະລຸນາລັອກອິນກ່ອນເຂົ້າໜ້າແຄດເຊຍ</p>
        <input className="mt-5 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-orange-400" placeholder="ຊື່ຜູ້ໃຊ້" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
        <input className="mt-3 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-orange-400" type="password" placeholder="PIN" value={loginForm.pin} onChange={(e) => setLoginForm({ ...loginForm, pin: e.target.value })} />
        <button type="submit" className="mt-5 w-full rounded-2xl bg-orange-500 p-4 font-bold text-white shadow active:scale-95">ເຂົ້າລະບົບ</button>
      </form>
    </main>
  );
}
