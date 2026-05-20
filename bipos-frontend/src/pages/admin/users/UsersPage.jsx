import React from "react";

const OWNER_ROLES = ["OWNER", "ADMIN", "CASHIER", "WAITER", "KITCHEN"];
const ADMIN_ROLES = ["CASHIER", "WAITER", "KITCHEN"];

function roleOptions(currentUser) {
  return currentUser?.role === "OWNER" ? OWNER_ROLES : ADMIN_ROLES;
}

function canEditUser(currentUser, item) {
  if (!currentUser || !item) return false;
  if (currentUser.role === "OWNER") return true;
  return !["OWNER", "ADMIN"].includes(item.role);
}

function canDeleteUser(currentUser, item) {
  if (!canEditUser(currentUser, item)) return false;
  return String(currentUser.id || "") !== String(item.id || "");
}

export default function UsersPage({
  user,
  setUser,
  users,
  saveUser,
  editingUserId,
  editUser,
  cancelEditUser,
  deleteUser,
  currentUser,
  tables = [],
}) {
  const roles = roleOptions(currentUser);

  const branchOptions = Array.from(
    new Map(
      (tables || [])
        .map((table) => {
          const id = table.branchId || table.branch?.id || "";
          if (!id) return null;
          return [id, { id, name: table.branch?.name || "Main Branch" }];
        })
        .filter(Boolean)
    ).values()
  );

  // ສະແດງສະເພາະຜູ້ໃຊ້ ACTIVE
  // ຜູ້ໃຊ້ INACTIVE ຈະບໍ່ສະແດງໃນໜ້ານີ້
  const activeUsers = (users || []).filter((item) => item.status !== "INACTIVE");

  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">ຈັດການຜູ້ໃຊ້</h2>
        <p className="text-sm text-slate-500">
          ເພີ່ມ, ແກ້ໄຂ, ປ່ຽນ PIN, ກຳນົດສິດ ແລະ ລົບຜູ້ໃຊ້
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={saveUser} className="card space-y-3">
          <div>
            <h3 className="text-lg font-bold">
              {editingUserId ? "ແກ້ໄຂຜູ້ໃຊ້" : "ເພີ່ມຜູ້ໃຊ້"}
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {editingUserId
                ? "ຖ້າບໍ່ຕ້ອງການປ່ຽນ PIN ໃຫ້ປ່ອຍຊ່ອງ PIN ວ່າງ"
                : "ໃສ່ PIN 4-12 ຕົວເລກ"}
            </p>
          </div>

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
            placeholder={editingUserId ? "PIN ໃໝ່ (ບໍ່ປ່ຽນໃຫ້ປ່ອຍວ່າງ)" : "PIN"}
            value={user.pin}
            onChange={(e) => setUser({ ...user, pin: e.target.value })}
          />

          <select
            className="input w-full"
            value={user.role}
            onChange={(e) => setUser({ ...user, role: e.target.value })}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          {user.role !== "OWNER" && (
            <select
              className="input w-full"
              value={user.branchId || ""}
              onChange={(e) => setUser({ ...user, branchId: e.target.value })}
            >
              <option value="">ເລືອກສາຂາ</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="input w-full"
            value={user.status || "ACTIVE"}
            onChange={(e) => setUser({ ...user, status: e.target.value })}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn bg-orange-500 text-white">
              {editingUserId ? "ບັນທຶກການແກ້ໄຂ" : "ບັນທຶກ"}
            </button>

            {editingUserId && (
              <button
                type="button"
                className="btn bg-slate-200 text-slate-700"
                onClick={cancelEditUser}
              >
                ຍົກເລີກ
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-lg font-bold">ຜູ້ໃຊ້</h3>
          </div>

          <div className="divide-y divide-slate-100">
            {activeUsers.map((item) => {
              const editable = canEditUser(currentUser, item);
              const deletable = canDeleteUser(currentUser, item);

              return (
                <div
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={item.id}
                >
                  <div>
                    <p className="text-lg font-bold">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {item.username} · {item.role} · {item.status || "ACTIVE"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!editable}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      onClick={() => editUser(item)}
                    >
                      ແກ້ໄຂ
                    </button>

                    <button
                      type="button"
                      disabled={!deletable}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      onClick={() => {
                        if (window.confirm(`ຕ້ອງການລົບ ${item.name} ບໍ?`)) {
                          deleteUser(item.id);
                        }
                      }}
                    >
                      ລົບ
                    </button>
                  </div>
                </div>
              );
            })}

            {!activeUsers.length && (
              <div className="p-8 text-center text-slate-500">
                ຍັງບໍ່ມີຜູ້ໃຊ້
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}