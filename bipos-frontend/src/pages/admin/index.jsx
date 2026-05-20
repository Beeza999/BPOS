import React, { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { notifySocketAuthChanged } from "../../lib/socket.js";
import { useRealtimeReload } from "../../hooks/useRealtimeReload.js";
import { emptyMenu } from "./constants.js";
import Dashboard from "./dashboard/Dashboard.jsx";
import MenuPage from "./menu/MenuPage.jsx";
import TablesPage from "./tables/TablesPage.jsx";
import UsersPage from "./users/UsersPage.jsx";
import FinancePage from "./finance/FinancePage.jsx";
import ShiftHistoryPage from "./shifts/ShiftHistoryPage.jsx";
import BillingSettingsPage from "./settings/BillingSettingsPage.jsx";


function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    if (!value || value === "undefined") return null;
    return JSON.parse(value);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export default function Admin() {
  const [adminAuth, setAdminAuth] = useState(() => ({
    token: localStorage.getItem("bipos_admin_token") || "",
    user: readJson("bipos_admin_user"),
  }));

  const [loginForm, setLoginForm] = useState({ username: "", pin: "" });
  const [page, setPage] = useState("dashboard");

  const [summary, setSummary] = useState({});
  const [payments, setPayments] = useState([]);
  const [openBills, setOpenBills] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [cats, setCats] = useState([]);
  const [menus, setMenus] = useState([]);
  const [tables, setTables] = useState([]);
  const [users, setUsers] = useState([]);
  const [billingSettings, setBillingSettings] = useState({
    discountType: "amount",
    discountValue: 0,
    serviceRate: 0,
    vatRate: 7,
  });

  const [menu, setMenu] = useState(emptyMenu);
  const [editingMenuId, setEditingMenuId] = useState(null);

  const [table, setTable] = useState({ name: "", branchId: "", seats: 4 });

  const [user, setUser] = useState({
    name: "",
    username: "",
    pin: "",
    role: "WAITER",
    status: "ACTIVE",
    restaurantId: "",
    branchId: "",
  });
  const [editingUserId, setEditingUserId] = useState(null);

  async function loginAdmin(e) {
    e.preventDefault();

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: loginForm,
      });

      if (!["OWNER", "ADMIN"].includes(data.user?.role)) {
        alert("ຜູ້ໃຊ້ນີ້ບໍ່ແມ່ນແອດມິນ");
        return;
      }

      // เก็บเฉพาะ session ของ Admin เพื่อให้ Cashier/Kitchen login พร้อมกันได้
      localStorage.setItem("bipos_admin_token", data.token);
      localStorage.setItem("bipos_admin_user", JSON.stringify(data.user));
      localStorage.removeItem("bipos_closed_at");

      setAdminAuth({ token: data.token, user: data.user });
      notifySocketAuthChanged();

      setTimeout(() => window.location.reload(), 100);
    } catch (error) {
      alert(error.message || "ລັອກອິນແອດມິນບໍ່ສຳເລັດ");
    }
  }

  function logoutAdmin() {
    // ล้างเฉพาะ Admin session ไม่กระทบ Cashier/Kitchen ที่เปิดอยู่
    localStorage.removeItem("bipos_admin_token");
    localStorage.removeItem("bipos_admin_user");
    localStorage.removeItem("bipos_closed_at");

    // ให้หน้า /login รู้ว่าต้องแสดง Login ของ Admin
    sessionStorage.setItem("bipos_next_path", "/");

    window.location.href = "/login";
    return;
  }

  async function load() {
    const [s, c, m, t, u, p, b, sh, bs] = await Promise.all([
      api("/api/reports/summary").catch(() => ({})),
      api("/api/menu/categories"),
      api("/api/menu/items"),
      api("/api/tables"),
      api("/api/users").catch(() => []),
      api("/api/payments").catch(() => []),
      api("/api/cashier/bills").catch(() => []),
      api("/api/shifts").catch(() => []),
      api("/api/settings/billing").catch(() => ({ discountType: "amount", discountValue: 0, serviceRate: 0, vatRate: 7 })),
    ]);

    setSummary(s);
    setPayments(Array.isArray(p) ? p : []);
    setOpenBills(Array.isArray(b) ? b : []);
    setShifts(Array.isArray(sh) ? sh : []);
    setCats(Array.isArray(c) ? c : []);
    setMenus(Array.isArray(m) ? m : []);
    setTables(Array.isArray(t) ? t : []);
    setUsers(Array.isArray(u) ? u : []);
    setBillingSettings(bs || { discountType: "amount", discountValue: 0, serviceRate: 0, vatRate: 7 });

    const firstCat = c?.[0];
    const firstTable = t?.[0];

    setMenu((x) => ({
      ...x,
      categoryId: x.categoryId || firstCat?.id || "",
      restaurantId: x.restaurantId || firstCat?.restaurantId || "",
      branchId: x.branchId || firstCat?.branchId || firstTable?.branchId || "",
    }));

    setTable((x) => ({
      ...x,
      branchId: x.branchId || firstTable?.branchId || firstCat?.branchId || "",
    }));

    setUser((x) => ({
      ...x,
      restaurantId: x.restaurantId || firstCat?.restaurantId || "",
      branchId: x.branchId || firstTable?.branchId || firstCat?.branchId || "",
    }));
  }

  useEffect(() => {
    if (adminAuth.token) load();
  }, [adminAuth.token]);

  useRealtimeReload(load, {
    enabled: Boolean(adminAuth.token),
    events: [
      "order:new",
      "order:created",
      "order:status",
      "order:cancelled",
      "kitchen:ticket-status",
      "payment:created",
      "payment:paid",
      "payment:voided",
      "payment:refunded",
      "shift:opened",
      "shift:closed",
      "menu:changed",
      "category:changed",
      "table:changed",
      "user:changed",
      "staff:call",
      "billing:settings",
    ],
  });

  async function saveMenu(e) {
    e.preventDefault();

    const body = {
      ...menu,
      price: Number(menu.price || 0),
    };

    if (editingMenuId) {
      await api("/api/menu/items/" + editingMenuId, {
        method: "PUT",
        body,
      });
    } else {
      await api("/api/menu/items", {
        method: "POST",
        body,
      });
    }

    setEditingMenuId(null);
    setMenu({
      ...emptyMenu,
      categoryId: menu.categoryId,
      restaurantId: menu.restaurantId,
      branchId: menu.branchId,
    });

    await load();
  }

  function editMenu(item) {
    setEditingMenuId(item.id);
    setMenu({
      name: item.name || "",
      description: item.description || "",
      price: item.price || 0,
      categoryId: item.categoryId || item.category?.id || "",
      station: item.station || "HOT",
      restaurantId: item.restaurantId || item.category?.restaurantId || "",
      branchId: item.branchId || item.category?.branchId || "",
      imageUrl: item.imageUrl || "",
      isRecommended: !!item.isRecommended,
      isAvailable: item.isAvailable !== false,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditMenu() {
    setEditingMenuId(null);
    setMenu({
      ...emptyMenu,
      categoryId: cats[0]?.id || "",
      restaurantId: cats[0]?.restaurantId || "",
      branchId: cats[0]?.branchId || tables[0]?.branchId || "",
    });
  }

  async function addTable(e) {
    e.preventDefault();

    await api("/api/tables", {
      method: "POST",
      body: { ...table, seats: Number(table.seats) },
    });

    setTable({ ...table, name: "" });
    await load();
  }

  function resetUserForm() {
    setEditingUserId(null);
    setUser({
      name: "",
      username: "",
      pin: "",
      role: "WAITER",
      status: "ACTIVE",
      restaurantId: user.restaurantId || cats[0]?.restaurantId || "",
      branchId: user.branchId || tables[0]?.branchId || cats[0]?.branchId || "",
    });
  }

  async function saveUser(e) {
    e.preventDefault();

    try {
      if (editingUserId) {
        const body = {
          name: user.name,
          username: user.username,
          role: user.role,
          status: user.status || "ACTIVE",
          branchId: user.role === "OWNER" ? null : user.branchId || null,
        };

        if (user.pin) body.pin = user.pin;

        await api("/api/users/" + editingUserId, {
          method: "PUT",
          body,
        });
      } else {
        await api("/api/users", {
          method: "POST",
          body: {
            ...user,
            status: user.status || "ACTIVE",
            branchId: user.role === "OWNER" ? null : user.branchId || null,
          },
        });
      }

      resetUserForm();
      await load();
    } catch (error) {
      alert(error.message || "ບັນທຶກຜູ້ໃຊ້ບໍ່ສຳເລັດ");
    }
  }

  function editUser(item) {
    setEditingUserId(item.id);
    setUser({
      name: item.name || "",
      username: item.username || "",
      pin: "",
      role: item.role || "WAITER",
      status: item.status || "ACTIVE",
      restaurantId: item.restaurantId || user.restaurantId || "",
      branchId: item.branchId || user.branchId || tables[0]?.branchId || cats[0]?.branchId || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateUserStatus(id, status) {
    try {
      await api("/api/users/" + id, {
        method: "PUT",
        body: { status },
      });

      if (editingUserId === id) resetUserForm();
      await load();
    } catch (error) {
      alert(error.message || "ປ່ຽນສະຖານະຜູ້ໃຊ້ບໍ່ສຳເລັດ");
    }
  }

  async function disableUser(id) {
    if (!confirm("ຢືນຢັນປິດໃຊ້ງານບັນຊີນີ້?")) return;
    await updateUserStatus(id, "INACTIVE");
  }

  async function activateUser(id) {
    await updateUserStatus(id, "ACTIVE");
  }

  async function deleteUser(id) {
    if (!confirm("ຢືນຢັນລົບຜູ້ໃຊ້ນີ້ອອກຈາກໜ້າ Admin ຖາວອນ?")) return;

    try {
      await api("/api/users/" + id, { method: "DELETE" });
      if (editingUserId === id) resetUserForm();
      await load();
    } catch (error) {
      alert(error.message || "ລົບຜູ້ໃຊ້ບໍ່ສຳເລັດ");
    }
  }

  async function toggleMenu(item) {
    await api("/api/menu/items/" + item.id, {
      method: "PUT",
      body: { isAvailable: !item.isAvailable },
    });

    await load();
  }

  async function deleteMenu(id) {
    if (!confirm("ຢືນຢັນລົບເມນູ?")) return;

    await api("/api/menu/items/" + id, { method: "DELETE" });

    if (editingMenuId === id) cancelEditMenu();
    await load();
  }

  async function saveBillingSettings(e) {
    e.preventDefault();
    try {
      const saved = await api("/api/settings/billing", {
        method: "PUT",
        body: {
          discountType: billingSettings.discountType || "amount",
          discountValue: Number(billingSettings.discountValue || 0),
          serviceRate: Number(billingSettings.serviceRate || 0),
          vatRate: Number(billingSettings.vatRate || 0),
        },
      });
      setBillingSettings(saved);
      alert("ບັນທຶກການຕັ້ງຄ່າຄິດເງິນແລ້ວ");
      await load();
    } catch (error) {
      alert(error.message || "ບັນທຶກການຕັ້ງຄ່າບໍ່ສຳເລັດ");
    }
  }

  async function deleteTable(id) {
    if (!confirm("ຢືນຢັນລົບໂຕະ?")) return;

    await api("/api/tables/" + id, { method: "DELETE" });
    await load();
  }

  const nav = ["dashboard", "finance", "shifts", "settings", "menu", "tables", "users"];
  const navLabels = { dashboard: "ໜ້າຫຼັກ", finance: "ການເງິນ", shifts: "ປະຫວັດກະ", settings: "ຕັ້ງຄ່າບິນ", menu: "ເມນູ", tables: "ໂຕະ", users: "ຜູ້ໃຊ້" };

  if (!adminAuth.token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-900">
        <form
          onSubmit={loginAdmin}
          className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-semibold text-orange-600">BIPOS ແອດມິນ</p>
          <h1 className="mt-2 text-2xl font-bold">ລັອກອິນແອດມິນ</h1>

          <input
            className="mt-5 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-orange-400"
            placeholder="ຊື່ຜູ້ໃຊ້"
            value={loginForm.username}
            onChange={(e) =>
              setLoginForm({ ...loginForm, username: e.target.value })
            }
          />

          <input
            className="mt-3 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:border-orange-400"
            type="password"
            placeholder="PIN"
            value={loginForm.pin}
            onChange={(e) =>
              setLoginForm({ ...loginForm, pin: e.target.value })
            }
          />

          <button className="mt-5 w-full rounded-2xl bg-orange-500 p-4 font-bold text-white">
            ເຂົ້າລະບົບ
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-600">
              BIPOS ແອດມິນ
            </p>
            <h1 className="text-2xl font-bold">
              ໜ້າແອດມິນ
            </h1>
            <p className="text-sm text-slate-500">
              ຈັດການເມນູ, ໂຕະ, ພະນັກງານ, QR ແລະ ລາຍງານ
            </p>
          </div>

          <div className="flex gap-2">
            <button className="btn bg-slate-900 text-white" onClick={load}>
              ໂຫລດໃໝ່
            </button>
            <button className="btn bg-red-500 text-white" onClick={logoutAdmin}>
              ອອກຈາກລະບົບ
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[93px] z-20 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          {nav.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold ${
                page === n
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              {navLabels[n] || n}
            </button>
          ))}
        </div>
      </nav>

      {page === "dashboard" && (
        <Dashboard
          summary={summary}
          payments={payments}
          openBills={openBills}
        />
      )}

      {page === "finance" && <FinancePage payments={payments} />}

      {page === "shifts" && <ShiftHistoryPage shifts={shifts} />}

      {page === "settings" && (
        <BillingSettingsPage
          billingSettings={billingSettings}
          setBillingSettings={setBillingSettings}
          saveBillingSettings={saveBillingSettings}
        />
      )}

      {page === "menu" && (
        <MenuPage
          menu={menu}
          setMenu={setMenu}
          cats={cats}
          menus={menus}
          saveMenu={saveMenu}
          editingMenuId={editingMenuId}
          editMenu={editMenu}
          cancelEditMenu={cancelEditMenu}
          toggleMenu={toggleMenu}
          deleteMenu={deleteMenu}
        />
      )}

      {page === "tables" && (
        <TablesPage
          table={table}
          setTable={setTable}
          tables={tables}
          addTable={addTable}
          deleteTable={deleteTable}
        />
      )}

      {page === "users" && (
        <UsersPage
          user={user}
          setUser={setUser}
          users={users}
          saveUser={saveUser}
          editingUserId={editingUserId}
          editUser={editUser}
          cancelEditUser={resetUserForm}
          disableUser={disableUser}
          activateUser={activateUser}
          deleteUser={deleteUser}
          currentUser={adminAuth.user}
          tables={tables}
        />
      )}

    </main>
  );
}
