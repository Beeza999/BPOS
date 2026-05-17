import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, money } from "../../lib/api.js";
import { useRealtimeReload } from "../../hooks/useRealtimeReload.js";
import { REALTIME_EVENT } from "../../lib/socket.js";
import {
  enableNotifySound,
  isNotifySoundEnabled,
  playNotifySound,
} from "../../lib/notifySound.js";
import { StatCard } from "./components/CashierComponents.jsx";
import LoginCard from "./components/LoginCard.jsx";
import Header from "./components/Header.jsx";
import ShiftPanel from "./components/ShiftPanel.jsx";
import TableGrid from "./components/TableGrid.jsx";
import BillList from "./components/BillList.jsx";
import BillDetails from "./components/BillDetails.jsx";
import PaymentModal from "./components/PaymentModal.jsx";
import { readJson, readCachedShift, saveCachedShift, clearCachedShift } from "./utils/storage.js";
import { printReceipt } from "./utils/receipt.js";
import { CASHIER_SHIFT_CACHE_KEY } from "./constants.js";

const CASHIER_ALERT_TTL_MS = 2 * 60 * 1000;
const DEFAULT_BILLING_SETTINGS = { discountType: "amount", discountValue: 0, serviceRate: 0, vatRate: 7 };

function normalizeBillingSettings(settings = {}) {
  const discountType = settings.discountType === "percent" ? "percent" : "amount";
  const rawDiscount = Math.max(0, Number(settings.discountValue || 0));
  return {
    discountType,
    discountValue: discountType === "percent" ? Math.min(100, rawDiscount) : rawDiscount,
    serviceRate: Math.min(100, Math.max(0, Number(settings.serviceRate || 0))),
    vatRate: Math.min(100, Math.max(0, Number(settings.vatRate ?? 7))),
  };
}

function calculateBySettings(subtotal, settings = DEFAULT_BILLING_SETTINGS) {
  const config = normalizeBillingSettings(settings);
  const nextSubtotal = Math.max(0, Number(subtotal || 0));
  const discount = config.discountType === "percent"
    ? Math.min(nextSubtotal, Math.round((nextSubtotal * config.discountValue) / 100))
    : Math.min(nextSubtotal, Math.round(config.discountValue));
  const base = Math.max(0, nextSubtotal - discount);
  const service = Math.round((base * config.serviceRate) / 100);
  const vat = Math.round(((base + service) * config.vatRate) / 100);
  return { subtotal: nextSubtotal, discount, service, vat, total: Math.round(base + service + vat), settings: config };
}

function NavButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function MenuTogglePage({ menus, cats, onToggle, togglingId }) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const categoryName = (id) => cats.find((item) => item.id === id)?.name || "-";
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (menus || []).filter((menu) => {
      const catOk = cat === "all" || menu.categoryId === cat;
      const searchOk = !term || `${menu.name} ${menu.description || ""}`.toLowerCase().includes(term);
      return catOk && searchOk;
    });
  }, [menus, cat, q]);

  return (
    <section className="px-4 pb-24">
      <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="text-2xl font-bold">ເມນູຂາຍ</h2>
        <p className="mt-1 text-sm text-slate-500">
          ແຄດເຊຍເບິ່ງເມນູ ແລະ ເປີດ/ປິດຂາຍໄດ້ ແຕ່ບໍ່ສາມາດແກ້ຊື່ ລາຄາ ຫຼື ລົບເມນູໄດ້
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="input w-full"
            placeholder="ຄົ້ນຫາເມນູ"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <select className="input" value={cat} onChange={(event) => setCat(event.target.value)}>
            <option value="all">ທຸກໝວດ</option>
            {cats.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex h-36 items-center justify-center bg-slate-100 text-4xl">
              {item.imageUrl ? <img src={item.imageUrl} className="h-full w-full object-cover" alt={item.name} /> : "🍽️"}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{item.name}</h3>
                  <p className="text-sm text-slate-500">{categoryName(item.categoryId)} · {item.station}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {item.isAvailable ? "ເປີດຂາຍ" : "ປິດຂາຍ"}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-orange-600">{money(item.price)}</p>
              {item.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description}</p>}
              <button
                type="button"
                disabled={togglingId === item.id}
                onClick={() => onToggle(item)}
                className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white shadow disabled:opacity-60 ${item.isAvailable ? "bg-red-500" : "bg-emerald-500"}`}
              >
                {togglingId === item.id ? "ກຳລັງບັນທຶກ..." : item.isAvailable ? "ປິດຂາຍ" : "ເປີດຂາຍ"}
              </button>
            </div>
          </article>
        ))}
        {!filtered.length && <div className="col-span-full rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">ບໍ່ມີເມນູ</div>}
      </div>
    </section>
  );
}

function TakeawayOrderPage({ menus, cats, cart, setCart, activeShift, submitting, onSubmit }) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const availableMenus = useMemo(() => (menus || []).filter((item) => item.isAvailable !== false), [menus]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return availableMenus.filter((menu) => {
      const catOk = cat === "all" || menu.categoryId === cat;
      const searchOk = !term || `${menu.name} ${menu.description || ""}`.toLowerCase().includes(term);
      return catOk && searchOk;
    });
  }, [availableMenus, cat, q]);

  const totalQty = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

  function add(menu) {
    const index = cart.findIndex((item) => item.menuItemId === menu.id && !item.note);
    if (index >= 0) {
      setCart(cart.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item));
      return;
    }
    setCart([...cart, { menuItemId: menu.id, name: menu.name, price: menu.price, quantity: 1, note: "" }]);
  }

  function changeQty(index, amount) {
    setCart(cart.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(item.quantity || 1) + amount } : item).filter((item) => item.quantity > 0));
  }

  function changeNote(index, note) {
    setCart(cart.map((item, itemIndex) => itemIndex === index ? { ...item, note } : item));
  }

  return (
    <section className="grid gap-4 px-4 pb-24 lg:grid-cols-[1fr_420px]">
      <div>
        <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="text-2xl font-bold">ສັ່ງອາຫານກັບບ້ານ</h2>
          <p className="mt-1 text-sm text-slate-500">ແຄດເຊຍສັ່ງແທນລູກຄ້າໄດ້ ອໍເດີຈະເຂົ້າ Kitchen ແບບສັ່ງກັບບ້ານ</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input className="input w-full" placeholder="ຄົ້ນຫາເມນູ" value={q} onChange={(event) => setQ(event.target.value)} />
            <select className="input" value={cat} onChange={(event) => setCat(event.target.value)}>
              <option value="all">ທຸກໝວດ</option>
              {cats.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="flex h-32 items-center justify-center bg-slate-100 text-4xl">
                {item.imageUrl ? <img src={item.imageUrl} className="h-full w-full object-cover" alt={item.name} /> : "🍽️"}
              </div>
              <div className="p-4">
                <h3 className="font-bold">{item.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description || "-"}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-lg font-bold text-orange-600">{money(item.price)}</p>
                  <button type="button" onClick={() => add(item)} className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-xl font-bold text-white shadow">+</button>
                </div>
              </div>
            </article>
          ))}
          {!filtered.length && <div className="col-span-full rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">ບໍ່ມີເມນູທີ່ເປີດຂາຍ</div>}
        </div>
      </div>

      <aside className="h-fit rounded-3xl bg-white p-4 shadow-sm lg:sticky lg:top-32">
        <h3 className="text-xl font-bold">ກະຕ່າກັບບ້ານ</h3>
        {!activeShift && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">ຕ້ອງເປີດກະກ່ອນສັ່ງອາຫານ</p>}
        <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-1">
          {cart.map((item, index) => (
            <div key={`${item.menuItemId}-${index}`} className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-xs text-slate-500">{money(item.price)}</p>
                </div>
                <div className="flex items-center rounded-full bg-white p-1">
                  <button type="button" className="h-8 w-8 rounded-full bg-slate-100 font-bold" onClick={() => changeQty(index, -1)}>-</button>
                  <span className="w-9 text-center font-bold">{item.quantity}</span>
                  <button type="button" className="h-8 w-8 rounded-full bg-slate-900 font-bold text-white" onClick={() => changeQty(index, 1)}>+</button>
                </div>
              </div>
              <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none" placeholder="ໝາຍເຫດ" value={item.note} onChange={(event) => changeNote(index, event.target.value)} />
            </div>
          ))}
          {!cart.length && <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">ຍັງບໍ່ມີລາຍການ</div>}
        </div>
        <div className="mt-4 rounded-2xl bg-orange-50 p-3">
          <div className="flex justify-between text-sm font-bold text-orange-700"><span>{totalQty} ລາຍການ</span><span>{money(total)}</span></div>
        </div>
        <button
          type="button"
          disabled={!activeShift || !cart.length || submitting}
          onClick={onSubmit}
          className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white shadow disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "ກຳລັງສົ່ງເຂົ້າ Kitchen..." : "ສົ່ງອໍເດີກັບບ້ານ"}
        </button>
      </aside>
    </section>
  );
}

export default function Cashier() {
  const [cashierAuth, setCashierAuth] = useState(() => ({
    token: localStorage.getItem("bipos_cashier_token") || "",
    user: readJson("bipos_cashier_user"),
  }));
  const [loginForm, setLoginForm] = useState({ username: "", pin: "" });
  const [page, setPage] = useState("bills");
  const [bills, setBills] = useState([]);
  const [paidBills, setPaidBills] = useState([]);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [tables, setTables] = useState([]);
  const [cats, setCats] = useState([]);
  const [menus, setMenus] = useState([]);
  const [billingSettings, setBillingSettings] = useState(DEFAULT_BILLING_SETTINGS);
  const [togglingMenuId, setTogglingMenuId] = useState("");
  const [takeawayCart, setTakeawayCart] = useState([]);
  const [takeawaySubmitting, setTakeawaySubmitting] = useState(false);
  const [shifts, setShifts] = useState(() => {
    const cachedShift = readCachedShift();
    return cachedShift ? [cachedShift] : [];
  });
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("billing");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cashierAlerts, setCashierAlerts] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(() => isNotifySoundEnabled());
  const soundEnabledRef = useRef(false);
  const paymentSubmittingRef = useRef(false);
  const tablesRef = useRef([]);
  const alertTimersRef = useRef({});

  async function load() {
    if (!localStorage.getItem("bipos_cashier_token")) return;
    try {
      setLoading(true);
      const [openBills, allTables, categories, menuItems, nextBillingSettings] = await Promise.all([
        api("/api/cashier/bills"),
        api("/api/tables"),
        api("/api/menu/categories").catch(() => []),
        api("/api/menu/items").catch(() => []),
        api("/api/settings/billing").catch(() => DEFAULT_BILLING_SETTINGS),
      ]);
      const safeBills = Array.isArray(openBills) ? openBills : [];
      setBills(safeBills);
      setTables(Array.isArray(allTables) ? allTables : []);
      setCats(Array.isArray(categories) ? categories : []);
      setMenus(Array.isArray(menuItems) ? menuItems : []);
      setBillingSettings(normalizeBillingSettings(nextBillingSettings));

      let currentOpenShift = null;

      try {
        const allShifts = await api("/api/shifts");
        if (Array.isArray(allShifts)) {
          currentOpenShift = allShifts.find((s) => String(s.status).toUpperCase() === "OPEN") || null;
          if (currentOpenShift) saveCachedShift(currentOpenShift); else clearCachedShift();
          setShifts(allShifts);
          setShiftSummary(currentOpenShift);
        }
      } catch {
        const cachedShift = readCachedShift();
        currentOpenShift = cachedShift || null;
        setShiftSummary(cachedShift || null);
        setShifts((old) => old.some((s) => String(s.status).toUpperCase() === "OPEN") ? old : cachedShift ? [cachedShift] : old);
      }

      try {
        const payments = await api("/api/payments");
        const shiftPayments = Array.isArray(payments) && currentOpenShift
          ? payments.filter((payment) => String(payment.shiftId || payment.shift?.id || "") === String(currentOpenShift.id) && (payment.status || "PAID") === "PAID")
          : [];
        setPaidBills(shiftPayments);
      } catch { setPaidBills([]); }

      if (!selectedId && safeBills.length) setSelectedId(safeBills[0].id);
      if (selectedId && !safeBills.some((bill) => bill.id === selectedId)) setSelectedId(safeBills[0]?.id || null);
    } finally {
      setLoading(false);
    }
  }

  function playBeep() {
    playNotifySound();
  }

  function speak(text) {
    if (!soundEnabledRef.current || !("speechSynthesis" in window) || !text) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "lo-LA";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      // Text-to-speech is optional.
    }
  }

  async function enableSound() {
    const ok = await enableNotifySound();
    soundEnabledRef.current = ok;
    setSoundEnabled(ok);

    if (ok) {
      speak("ເປີດສຽງແຈ້ງເຕືອນແລ້ວ");
    } else {
      alert("Browser ບໍ່ອະນຸຍາດສຽງ ກະລຸນາກົດປຸ່ມອີກຄັ້ງ");
    }
  }

  function removeCashierAlert(id) {
    window.clearTimeout(alertTimersRef.current[id]);
    delete alertTimersRef.current[id];
    setCashierAlerts((old) => old.filter((alert) => alert.id !== id));
  }

  function addCashierAlert(alert) {
    const id = alert.id || `${alert.type}-${Date.now()}-${Math.random()}`;
    const nextAlert = { ...alert, id, createdAt: Date.now() };
    setCashierAlerts((old) => [nextAlert, ...old.filter((item) => item.id !== id)].slice(0, 8));
    window.clearTimeout(alertTimersRef.current[id]);
    alertTimersRef.current[id] = window.setTimeout(() => removeCashierAlert(id), CASHIER_ALERT_TTL_MS);
    playNotifySound();
    speak(alert.speech || alert.title || alert.message);
  }

  function tableNameFromPayload(payload) {
    if (payload?.tableName) return payload.tableName;
    if (payload?.order?.table?.name) return payload.order.table.name;
    const tableId = payload?.tableId || payload?.order?.tableId;
    const table = tablesRef.current.find((item) => item.id === tableId);
    return table?.name || "-";
  }

  useEffect(() => {
    if (cashierAuth.token) load();
  }, [cashierAuth.token]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    return () => {
      Object.values(alertTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      alertTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!cashierAuth.token) return undefined;

    function handleRealtime(event) {
      const eventName = event.detail?.event;
      const payload = event.detail?.payload || {};

      if (eventName === "staff:call") {
        const tableName = tableNameFromPayload(payload);
        addCashierAlert({
          id: `staff-${payload.tableId || "table"}-${payload.calledAt || Date.now()}`,
          type: "staff",
          title: `ໂຕະ ${tableName} ເອີ້ນພະນັກງານ`,
          message: payload.message || "ລູກຄ້າຕ້ອງການພະນັກງານ",
          speech: `ໂຕະ ${tableName} ເອີ້ນພະນັກງານ`,
        });
      }

      if (eventName === "kitchen:ticket-status" && payload.status === "READY") {
        const tableName = tableNameFromPayload(payload);
        const itemName = payload.name || "ອາຫານ";
        const quantity = payload.quantity || 1;
        addCashierAlert({
          id: `ready-${payload.id || Date.now()}-${payload.updatedAt || Date.now()}`,
          type: "ready",
          title: `ພ້ອມເສີບ · ໂຕະ ${tableName}`,
          message: `${itemName} x${quantity} ສຳເລັດແລ້ວ`,
          speech: `ພ້ອມເສີບ ໂຕະ ${tableName} ${itemName} ${quantity}`,
        });
      }
    }

    window.addEventListener(REALTIME_EVENT, handleRealtime);
    return () => window.removeEventListener(REALTIME_EVENT, handleRealtime);
  }, [cashierAuth.token]);

  useRealtimeReload(load, {
    enabled: Boolean(cashierAuth.token),
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
      "table:changed",
      "menu:changed",
      "category:changed",
      "billing:settings",
    ],
  });

  const activeShift = useMemo(() => {
    if (shiftSummary && String(shiftSummary.status).toUpperCase() === "OPEN") return shiftSummary;
    return (shifts || []).find((s) => String(s.status).toUpperCase() === "OPEN") || null;
  }, [shiftSummary, shifts]);
  const branchId = cashierAuth.user?.branchId || tables.find((t) => t.branchId)?.branchId || tables.find((t) => t.branch?.id)?.branch?.id || bills.find((b) => b.table?.branchId)?.table?.branchId || bills.find((b) => b.orders?.[0]?.branchId)?.orders?.[0]?.branchId || "";
  const paidMapped = useMemo(() => paidBills.map((p) => ({ id: p.id, tableId: p.order?.tableId, table: p.order?.table || { name: "-" }, status: "PAID", orders: p.order ? [p.order] : [], items: p.order?.items || [], total: p.total, updatedAt: p.paidAt || p.updatedAt, payment: p, canPay: true })), [paidBills]);
  const allBills = useMemo(() => filter === "paid" ? paidMapped : filter === "all" ? [...bills, ...paidMapped] : bills, [bills, paidMapped, filter]);
  const billByTable = useMemo(() => Object.fromEntries(bills.map((b) => [b.tableId, b])), [bills]);
  const selectedBill = useMemo(() => allBills.find((b) => b.id === selectedId) || bills.find((b) => b.id === selectedId) || null, [allBills, bills, selectedId]);
  const subtotal = useMemo(() => (selectedBill?.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || item.qty || 1), 0), [selectedBill]);
  const calc = useMemo(() => {
    if (selectedBill?.status === "PAID" && selectedBill.payment) {
      return {
        subtotal: Number(selectedBill.payment.subtotal || 0),
        discount: Number(selectedBill.payment.discount || 0),
        service: Number(selectedBill.payment.serviceCharge || 0),
        vat: Number(selectedBill.payment.vat || 0),
        total: Number(selectedBill.payment.total || 0),
        settings: normalizeBillingSettings(billingSettings),
      };
    }
    return calculateBySettings(subtotal, billingSettings);
  }, [subtotal, billingSettings, selectedBill]);

  const shiftTotalSales = activeShift ? Number(activeShift.totalSales ?? paidBills.reduce((sum, p) => sum + Number(p.total || 0), 0)) : 0;
  const shiftCashSales = activeShift ? Number(activeShift.cashSales ?? paidBills.filter((p) => p.method === "CASH").reduce((sum, p) => sum + Number(p.total || 0), 0)) : 0;
  const shiftExpectedCash = activeShift ? Number(activeShift.expectedCash ?? (Number(activeShift.openingCash || 0) + shiftCashSales)) : 0;
  const changeAmount = Math.max(0, Number(paidAmount || 0) - calc.total);
  const waitingTables = bills.length;
  const openMenus = menus.filter((item) => item.isAvailable !== false).length;

  async function loginCashier(e) {
    e.preventDefault();
    try {
      const data = await api("/api/auth/login", { method: "POST", body: loginForm });
      if (data.user?.role !== "CASHIER") return alert("ຜູ້ໃຊ້ນີ້ບໍ່ແມ່ນແຄດເຊຍ");
      localStorage.setItem("bipos_cashier_token", data.token);
      localStorage.setItem("bipos_cashier_user", JSON.stringify(data.user));
      localStorage.removeItem("bipos_closed_at");
      setCashierAuth({ token: data.token, user: data.user });
      setTimeout(() => window.location.reload(), 100);
    } catch (error) { alert(error.message || "ລັອກອິນບໍ່ສຳເລັດ"); }
  }

  async function logoutCashier() {
    if (activeShift) return alert("ກະລຸນາປິດກະກ່ອນອອກຈາກລະບົບ");
    localStorage.removeItem("bipos_cashier_token");
    localStorage.removeItem("bipos_cashier_user");
    localStorage.removeItem("bipos_closed_at");
    localStorage.removeItem(CASHIER_SHIFT_CACHE_KEY);
    sessionStorage.setItem("bipos_next_path", "/cashier");
    window.location.href = "/login";
  }

  function resetCalc() {}
  function selectBill(bill) { setSelectedId(bill.id); resetCalc(); setPage("bills"); }

  function openPayment(method) {
    if (!activeShift) return alert("ກະປິດຢູ່ ບໍ່ສາມາດຂາຍ ຫຼື ຮັບເງິນໄດ້");
    if (!selectedBill || selectedBill.status === "PAID") return alert("ກະລຸນາເລືອກບິນທີ່ຍັງບໍ່ຈ່າຍ");
    if (selectedBill.canPay === false) return alert(selectedBill.payLockedReason || "ລໍຖ້າ Kitchen ກົດພ້ອມເສີບກ່ອນ");
    setPaymentMethod(method);
    setPaidAmount(Math.round(calc.total));
    setPaymentOpen(true);
  }

  async function openShift() {
    const realBranchId = branchId || cashierAuth.user?.branchId;
    if (!realBranchId) return alert("ບໍ່ພົບສາຂາ ກະລຸນາກົດດຶງຂໍ້ມູນໃໝ່ ແລ້ວລອງໃໝ່");
    try {
      const openedShift = await api("/api/shifts/open", { method: "POST", body: { branchId: realBranchId, openingCash: Number(openingCash || 0) } });
      const nextShift = { ...openedShift, status: openedShift.status || "OPEN" };
      saveCachedShift(nextShift);
      setShifts((old) => [nextShift, ...old.filter((s) => s.id !== openedShift.id)]);
      alert("ເປີດກະແລ້ວ");
      await load();
    } catch (error) { alert(error.message || "ເປີດກະບໍ່ສຳເລັດ"); }
  }

  async function closeShift() {
    if (!activeShift) return;
    const countedCash = Number(closingCash || 0);
    const expectedCash = Number(activeShift.expectedCash ?? shiftExpectedCash);
    const difference = countedCash - expectedCash;

    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return alert("ກະລຸນາໃສ່ຈຳນວນເງິນທີ່ນັບໄດ້ຈິງ");
    }

    if (!confirm(`ຢືນຢັນປິດກະ?\nເງິນເລີ່ມຕົ້ນ: ${money(activeShift.openingCash)}\nຍອດຂາຍເງິນສົດໃນກະ: ${money(shiftCashSales)}\nຍອດຂາຍລວມໃນກະ: ${money(shiftTotalSales)}\nເງິນທີ່ຄວນມີໃນລິ້ນຊັກ: ${money(expectedCash)}\nເງິນທີ່ນັບໄດ້ຈິງ: ${money(countedCash)}\nຜົນຕ່າງ: ${money(difference)}\n\nກົດ OK ເພື່ອຢືນຢັນວ່າເງິນມີຕາມນີ້ ແລະ ປິດກະ`)) return;
    try {
      const closedShift = await api(`/api/shifts/${activeShift.id}/close`, { method: "POST", body: { closingCash: countedCash } });
      setShifts((old) => old.map((s) => s.id === activeShift.id ? { ...s, ...closedShift, status: "CLOSED" } : s));
      setShiftSummary(null);
      setPaidBills([]);
      clearCachedShift();
      setClosingCash(0);
      alert("ປິດກະ ແລະ ບັນທຶກແລ້ວ");
      await load();
    } catch (error) { alert(error.message || "ປິດກະບໍ່ສຳເລັດ"); }
  }

  async function toggleMenu(item) {
    if (!item?.id) return;
    setTogglingMenuId(item.id);
    try {
      const updated = await api(`/api/menu/items/${item.id}/availability`, {
        method: "PATCH",
        body: { isAvailable: !item.isAvailable },
      });
      setMenus((old) => old.map((menu) => menu.id === item.id ? { ...menu, ...updated } : menu));
    } catch (error) {
      alert(error.message || "ປ່ຽນສະຖານະເມນູບໍ່ສຳເລັດ");
    } finally {
      setTogglingMenuId("");
    }
  }

  async function submitTakeawayOrder() {
    if (!activeShift) return alert("ກະລຸນາເປີດກະກ່ອນສັ່ງອາຫານ");
    if (!takeawayCart.length) return alert("ກະລຸນາເລືອກເມນູ");
    setTakeawaySubmitting(true);
    try {
      const order = await api("/api/cashier/takeaway-order", {
        method: "POST",
        body: { items: takeawayCart },
      });
      setTakeawayCart([]);
      setPage("bills");
      await load();
      alert(`ສົ່ງອໍເດີກັບບ້ານເຂົ້າ Kitchen ແລ້ວ #${order.orderNumber || ""}`);
    } catch (error) {
      alert(error.message || "ສົ່ງອໍເດີບໍ່ສຳເລັດ");
    } finally {
      setTakeawaySubmitting(false);
    }
  }

  function simpleHash(value) {
    let hash = 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash).toString(36);
  }

  function getBillSubtotal(bill) {
    return (bill?.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || item.qty || 1), 0);
  }

  function calculateBill(nextSubtotal) {
    return calculateBySettings(nextSubtotal, billingSettings);
  }

  function getOrderIds(bill) {
    return (bill?.orders || []).map((order) => String(order.id));
  }

  function sameOrderIds(a = [], b = []) {
    const left = a.map((id) => String(id)).sort().join("|");
    const right = b.map((id) => String(id)).sort().join("|");
    return left === right;
  }

  function findFreshBill(latestBills, oldBill) {
    const oldOrderIds = getOrderIds(oldBill);
    return latestBills.find((bill) => sameOrderIds(getOrderIds(bill), oldOrderIds))
      || latestBills.find((bill) => bill.id === oldBill?.id)
      || (!oldBill?.isTakeaway ? latestBills.find((bill) => bill.tableId === oldBill?.tableId) : null);
  }

  async function confirmPayment() {
    if (paymentSubmittingRef.current) return;
    if (!activeShift) return alert("ກະປິດຢູ່ ບໍ່ສາມາດຮັບເງິນໄດ້");
    if (!selectedBill) return;
    if (selectedBill.canPay === false) return alert(selectedBill.payLockedReason || "ລໍຖ້າ Kitchen ກົດພ້ອມເສີບກ່ອນ");
    const received = Number(paidAmount || 0);
    if (received < calc.total) return alert("ເງິນທີ່ຮັບບໍ່ພໍ");
    paymentSubmittingRef.current = true;
    setPaymentSubmitting(true);
    const receiptWindow = window.open("", "_blank", "width=420,height=700");
    if (receiptWindow) {
      receiptWindow.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>ໃບບິນ</title></head><body style="font-family: Arial, sans-serif; padding: 24px;"><h3>ກຳລັງສ້າງໃບບິນ...</h3></body></html>`);
      receiptWindow.document.close();
    } else {
      alert("ບຣາວເຊີບລັອກ popup ກະລຸນາອະນຸຍາດ popup ເພື່ອພິມບິນ");
    }

    try {
      const [latestBills, latestSettings] = await Promise.all([
        api("/api/cashier/bills"),
        api("/api/settings/billing").catch(() => billingSettings),
      ]);
      const safeLatestBills = Array.isArray(latestBills) ? latestBills : [];
      const freshSettings = normalizeBillingSettings(latestSettings);
      const freshBill = findFreshBill(safeLatestBills, selectedBill);

      setBills(safeLatestBills);
      setBillingSettings(freshSettings);

      if (!freshBill) {
        setPaymentOpen(false);
        setSelectedId(safeLatestBills[0]?.id || null);
        if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
        return alert("ບິນນີ້ຖືກຊຳລະແລ້ວ ຫຼື ບໍ່ມີລາຍການຄ້າງຈ່າຍ");
      }

      if (freshBill.canPay === false) {
        setSelectedId(freshBill.id);
        if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
        return alert(freshBill.payLockedReason || "ລໍຖ້າ Kitchen ກົດພ້ອມເສີບກ່ອນ");
      }

      const currentOrderIds = getOrderIds(selectedBill);
      const freshOrderIds = getOrderIds(freshBill);
      const freshCalc = calculateBySettings(getBillSubtotal(freshBill), freshSettings);

      if (!sameOrderIds(currentOrderIds, freshOrderIds) || freshCalc.total !== calc.total) {
        setSelectedId(freshBill.id);
        setPaidAmount(freshCalc.total);
        if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
        return alert("ບິນມີລາຍການໃໝ່ ຫຼື ຍອດປ່ຽນແປງ ກະລຸນາກວດບິນແລ້ວກົດຊຳລະໃໝ່");
      }

      if (received < freshCalc.total) {
        setPaidAmount(freshCalc.total);
        if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
        return alert("ເງິນທີ່ຮັບບໍ່ພໍ ກະລຸນາກວດຍອດໃໝ່");
      }

      const paidPayment = await api("/api/cashier/pay", {
        method: "POST",
        body: {
          tableId: freshBill.tableId,
          orderIds: freshOrderIds,
          method: paymentMethod,
          paidAmount: received,
          idempotencyKey: `cashier-${freshBill.id}-${simpleHash(freshOrderIds.sort().join("|"))}-${paymentMethod}-${Math.round(freshCalc.total)}`,
        },
      });

      printReceipt({ bill: freshBill, payment: paidPayment || freshCalc, received, receiptWindow, paymentMethod, money });
      setPaymentOpen(false);
      resetCalc();

      const nextBills = safeLatestBills.filter((bill) => bill.id !== freshBill.id);
      setBills(nextBills);
      setSelectedId((current) => (current === selectedBill.id || current === freshBill.id ? nextBills[0]?.id || null : current));
      await load();
    } catch (error) {
      console.error(error);
      if (receiptWindow && !receiptWindow.closed) receiptWindow.close();
      await load().catch(() => null);
      alert(error.message || "ຊຳລະເງິນບໍ່ສຳເລັດ");
    } finally {
      paymentSubmittingRef.current = false;
      setPaymentSubmitting(false);
    }
  }

  if (!cashierAuth.token) return <LoginCard loginForm={loginForm} setLoginForm={setLoginForm} onSubmit={loginCashier} />;

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-slate-100 text-slate-900">
      <Header onSync={load} onLogout={logoutCashier} />

      <nav className="sticky top-[93px] z-20 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          <NavButton active={page === "bills"} onClick={() => setPage("bills")}>ບິນ / ຮັບເງິນ</NavButton>
          <NavButton active={page === "menu"} onClick={() => setPage("menu")}>ເມນູເປີດ/ປິດ</NavButton>
          <NavButton active={page === "takeaway"} onClick={() => setPage("takeaway")}>ສັ່ງກັບບ້ານ</NavButton>
        </div>
      </nav>

      <section className="mx-4 mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={soundEnabled ? "btn bg-emerald-500 text-white" : "btn bg-orange-500 text-white"}
          onClick={enableSound}
        >
          {soundEnabled ? "ເປີດສຽງແລ້ວ" : "ເປີດສຽງແຈ້ງເຕືອນ"}
        </button>
        <p className="text-xs font-semibold text-slate-500">
          ສຽງແຈ້ງເຕືອນຈະດັງເມື່ອລູກຄ້າເອີ້ນ ຫຼື ຫ້ອງຄົວກົດພ້ອມເສີບ
        </p>
      </section>

      {cashierAlerts.length > 0 && (
        <section className="mx-4 mt-4 space-y-3">
          {cashierAlerts.map((alert) => (
            <div
              key={alert.id}
              className={
                alert.type === "ready"
                  ? "rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
                  : "rounded-3xl border border-orange-200 bg-orange-50 p-4 shadow-sm"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{alert.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{alert.message}</p>
                  <p className="mt-1 text-xs text-slate-500">ຈະປິດເອງພາຍໃນ 2 ນາທີ</p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 shadow-sm"
                  onClick={() => removeCashierAlert(alert.id)}
                >
                  ປິດ
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-4 p-4 md:grid-cols-5">
        <StatCard label="ບິນຍັງບໍ່ຈ່າຍ" value={bills.length} />
        <StatCard label="ໂຕະທັງໝົດ" value={tables.length} />
        <StatCard label="ໂຕະລໍຖ້າຈ່າຍ" value={waitingTables} valueClass="text-amber-600" />
        <StatCard label="ເມນູເປີດຂາຍ" value={openMenus} valueClass="text-blue-600" />
        <StatCard label="ຍອດຂາຍໃນກະ" value={money(shiftTotalSales)} valueClass="text-emerald-600" />
      </section>
      <section className="px-4 pb-4">
        <StatCard label="ສະຖານະກະ" value={activeShift ? "ເປີດຢູ່" : "ປິດຢູ່"} valueClass={activeShift ? "text-emerald-600 text-xl" : "text-red-500 text-xl"} />
      </section>
      {!activeShift && <div className="mx-4 mb-4 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">ກະປິດຢູ່: ບໍ່ສາມາດຂາຍ, ສັ່ງກັບບ້ານ ຫຼື ຮັບເງິນໄດ້. ກະລຸນາເປີດກະກ່ອນ.</div>}

      {page === "bills" && (
        <>
          <section className="grid gap-4 px-4 pb-6 lg:grid-cols-[360px_1fr]">
            <ShiftPanel activeShift={activeShift} openingCash={openingCash} setOpeningCash={setOpeningCash} closingCash={closingCash} setClosingCash={setClosingCash} shiftCashSales={shiftCashSales} shiftTotalSales={shiftTotalSales} shiftExpectedCash={shiftExpectedCash} onOpen={openShift} onClose={closeShift} />
            <TableGrid tables={tables} billByTable={billByTable} onSelectTable={selectBill} />
          </section>
          <section className="grid gap-4 px-4 pb-24 lg:grid-cols-[0.95fr_1.05fr]">
            <BillList allBills={allBills} selectedBill={selectedBill} filter={filter} setFilter={setFilter} loading={loading} onSelect={selectBill} />
            <BillDetails selectedBill={selectedBill} calc={calc} billingSettings={billingSettings} activeShift={activeShift} onOpenPayment={openPayment} />
          </section>
        </>
      )}

      {page === "menu" && (
        <MenuTogglePage menus={menus} cats={cats} onToggle={toggleMenu} togglingId={togglingMenuId} />
      )}

      {page === "takeaway" && (
        <TakeawayOrderPage menus={menus} cats={cats} cart={takeawayCart} setCart={setTakeawayCart} activeShift={activeShift} submitting={takeawaySubmitting} onSubmit={submitTakeawayOrder} />
      )}

      <PaymentModal open={paymentOpen} paymentMethod={paymentMethod} paidAmount={paidAmount} setPaidAmount={setPaidAmount} calc={calc} changeAmount={changeAmount} activeShift={activeShift} submitting={paymentSubmitting} onClose={() => setPaymentOpen(false)} onConfirm={confirmPayment} />
    </main>
  );
}
