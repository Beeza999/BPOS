import React from "react";

export default function UsersPage({ user, setUser, users, addUser }) {
  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">ຈັດການຜູ້ໃຊ້</h2>
        <p className="text-sm text-slate-500">
          ເພີ່ມ, ຕັ້ງ PIN ໃໝ່, ກຳນົດສິດ ແລະ ຈັດການພະນັກງານ
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form onSubmit={addUser} className="card space-y-3">
          <input
            className="input w-full"
            placeholder="ຊື່"
            value={user.name}
            onChange={(e) => setUser({ ...user, name: e.target.value })}
          />

          <input
            className="input w-full"
            placeholder="ຊື່ຜູ້ໃຊ້"
            value={user.username}
            onChange={(e) => setUser({ ...user, username: e.target.value })}
          />

          <input
            className="input w-full"
            placeholder="PIN"
            value={user.pin}
            onChange={(e) => setUser({ ...user, pin: e.target.value })}
          />

          <select
            className="input w-full"
            value={user.role}
            onChange={(e) => setUser({ ...user, role: e.target.value })}
          >
            {["OWNER", "ADMIN", "CASHIER", "WAITER", "KITCHEN"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>

          <button className="btn w-full bg-orange-500 text-white">
            ບັນທຶກ
          </button>
        </form>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div className="flex justify-between p-4" key={u.id}>
                <div>
                  <p className="text-lg font-bold">{u.name}</p>
                  <p className="text-sm text-slate-500">
                    {u.username} · {u.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
