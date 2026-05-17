import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import {
  enableNotifySound,
  isNotifySoundEnabled,
  speakNotify,
  orderVoiceText,
} from "../../lib/notifySound.js";
import { useRealtimeReload } from "../../hooks/useRealtimeReload.js";
import { REALTIME_EVENT } from "../../lib/socket.js";
import { sameLocalDay, ticketDate } from "./utils/date.js";
import { stations, statuses, statusClass } from "./constants.js";
import { Stat, Tabs } from "./components/KitchenComponents.jsx";

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

function nextStatus(s) {
  if (s === "NEW") return "ACCEPTED";
  if (s === "ACCEPTED") return "COOKING";
  if (s === "COOKING") return "READY";
  return "READY";
}

function actionText(s) {
  if (s === "NEW") return "ຮັບອໍເດີ";
  if (s === "ACCEPTED") return "ເລີ່ມເຮັດ";
  if (s === "COOKING") return "ພ້ອມເສີບ";
  return "ພ້ອມເສີບແລ້ວ";
}

export default function Kitchen() {
  const [kitchenAuth, setKitchenAuth] = useState(() => ({
    token: localStorage.getItem("bipos_kitchen_token") || "",
    user: readJson("bipos_kitchen_user"),
  }));

  const [loginForm, setLoginForm] = useState({ username: "", pin: "" });
  const [tickets, setTickets] = useState([]);
  const [station, setStation] = useState("all");
  const [status, setStatus] = useState("all");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => isNotifySoundEnabled());
  const notifiedOrderIdsRef = useRef(new Set());

  async function load() {
    if (!kitchenAuth.token) return;

    try {
      setLoading(true);
      const data = await api("/api/kitchen/tickets");
      const todayTickets = Array.isArray(data)
        ? data.filter((ticket) => sameLocalDay(ticketDate(ticket)))
        : [];
      setTickets(todayTickets);
    } catch (error) {
      alert(error.message || "ໂຫຼດອໍເດີບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }

  async function enableSound() {
    const ok = await enableNotifySound();
    setSoundEnabled(ok);

    if (ok) {
      setToast("ເປີດສຽງແຈ້ງເຕືອນແລ້ວ");
      window.setTimeout(() => setToast(""), 2000);
    } else {
      alert("Browser ບໍ່ອະນຸຍາດສຽງ ກະລຸນາເປີດສຽງເຄື່ອງ ແລ້ວກົດປຸ່ມອີກຄັ້ງ");
    }
  }

  function notifyNewOrder(order) {
  const orderId =
    order?.id ||
    order?.orderId ||
    order?.order?.id ||
    `${Date.now()}-${Math.random()}`;

  if (notifiedOrderIdsRef.current.has(orderId)) return;
  notifiedOrderIdsRef.current.add(orderId);

  const speech = orderVoiceText(order);

  setToast(speech);
  speakNotify(speech);

  window.setTimeout(() => setToast(""), 5000);
}

  async function loginKitchen(e) {
    e.preventDefault();

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: loginForm,
      });

      if (data.user?.role !== "KITCHEN") {
        alert("ຜູ້ໃຊ້ນີ້ບໍ່ແມ່ນຫ້ອງຄົວ");
        return;
      }

      // เก็บเฉพาะ session ของ Kitchen เพื่อให้ Admin/Cashier login พร้อมกันได้
      localStorage.setItem("bipos_kitchen_token", data.token);
      localStorage.setItem("bipos_kitchen_user", JSON.stringify(data.user));
      localStorage.removeItem("bipos_closed_at");

      setKitchenAuth({ token: data.token, user: data.user });

      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      alert(error.message || "ລັອກອິນບໍ່ສຳເລັດ");
    }
  }

  function logoutKitchen() {
    // ล้างเฉพาะ Kitchen session ไม่กระทบ Admin/Cashier ที่เปิดอยู่
    localStorage.removeItem("bipos_kitchen_token");
    localStorage.removeItem("bipos_kitchen_user");
    localStorage.removeItem("bipos_closed_at");

    // ให้หน้า /login รู้ว่าต้องแสดง Login ของ Kitchen
    sessionStorage.setItem("bipos_next_path", "/kitchen");

    window.location.href = "/login";
    return;
  }

  useEffect(() => {
    if (kitchenAuth.token) load();
  }, [kitchenAuth.token]);


  useEffect(() => {
    if (!kitchenAuth.token) return undefined;

   function handleRealtime(event) {
  const eventName = event.detail?.event;
  const payload = event.detail?.payload;

  if (eventName === "order:new" || eventName === "order:created") {
    notifyNewOrder(payload);
  }
}

    window.addEventListener(REALTIME_EVENT, handleRealtime);
    return () => window.removeEventListener(REALTIME_EVENT, handleRealtime);
  }, [kitchenAuth.token]);

  useRealtimeReload(load, {
    enabled: Boolean(kitchenAuth.token),
    events: [
      "order:new",
      "order:created",
      "order:status",
      "order:cancelled",
      "kitchen:ticket-status",
      "payment:paid",
      "payment:created",
    ],
  });

  const filtered = useMemo(() => {
    return tickets
      .filter((t) => {
        const stationOk = station === "all" || t.station === station;
        const statusOk = status === "all" || t.status === status;
        return stationOk && statusOk;
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [tickets, station, status]);

  const stats = {
    all: tickets.length,
    NEW: tickets.filter((t) => t.status === "NEW").length,
    ACCEPTED: tickets.filter((t) => t.status === "ACCEPTED").length,
    COOKING: tickets.filter((t) => t.status === "COOKING").length,
    READY: tickets.filter((t) => t.status === "READY").length,
  };

  async function update(ticket, newStatus) {
    try {
      await api(`/api/kitchen/tickets/${ticket.id}/status`, {
        method: "PATCH",
        body: { status: newStatus },
      });

      setToast(
        newStatus === "READY"
          ? "ພ້ອມເສີບແລ້ວ · ແຈ້ງພະນັກງານແລ້ວ"
          : "ອັບເດດສະຖານະແລ້ວ",
      );

      setTimeout(() => setToast(""), 1600);
      await load();
    } catch (error) {
      alert(error.message || "ອັບເດດບໍ່ສຳເລັດ");
    }
  }

  if (!kitchenAuth.token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-900">
        <form
          onSubmit={loginKitchen}
          className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm"
        >
          <h1 className="mt-2 text-2xl font-bold">ລັອກອິນຫ້ອງຄົວ</h1>
          <p className="mt-1 text-sm text-slate-500">
            ກະລຸນາລັອກອິນກ່ອນເຂົ້າໜ້າຫ້ອງຄົວ
          </p>

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

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl bg-orange-500 p-4 font-bold text-white shadow active:scale-95"
          >
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
            <h1 className="text-2xl font-bold">ໜ້າຫ້ອງຄົວ</h1>
            <p className="text-sm text-slate-500">
              ຮັບອໍເດີ, ເຮັດອາຫານ, ກົດພ້ອມເສີບແລ້ວແຈ້ງພະນັກງານ
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={soundEnabled ? "btn bg-emerald-500 text-white" : "btn bg-orange-500 text-white"}
              onClick={enableSound}
            >
              {soundEnabled ? "ເປີດສຽງແລ້ວ" : "ເປີດສຽງແຈ້ງເຕືອນ"}
            </button>

            <button
              type="button"
              className="btn bg-slate-900 text-white"
              onClick={load}
            >
              {loading ? "ກຳລັງໂຫຼດ..." : "ໂຫລດອໍເດີໃໝ່"}
            </button>

            <button
              type="button"
              className="btn bg-red-500 text-white"
              onClick={logoutKitchen}
            >
              ອອກຈາກລະບົບ
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 p-4 md:grid-cols-5">
        <Stat label="ອໍເດີທັງໝົດ" value={stats.all} />
        <Stat label="New" value={stats.NEW} color="text-red-500" />
        <Stat
          label="ຮັບແລ້ວ"
          value={stats.ACCEPTED}
          color="text-amber-600"
        />
        <Stat label="ກຳລັງເຮັດ" value={stats.COOKING} color="text-blue-600" />
        <Stat label="ພ້ອມເສີບ" value={stats.READY} color="text-emerald-600" />
      </section>

      <Tabs items={stations} active={station} setActive={setStation} dark />
      <Tabs items={statuses} active={status} setActive={setStatus} />

      <section className="grid gap-4 p-4 pb-24 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
            {loading ? "ກຳລັງໂຫຼດ..." : "ບໍ່ມີອໍເດີໃນສ່ວນນີ້"}
          </div>
        )}

        {filtered.map((ticket) => (
          <article
            className={`rounded-3xl border bg-white p-4 shadow-sm ${
              statusClass[ticket.status] || ""
            }`}
            key={ticket.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold opacity-70">
                  {stations.find((s) => s.id === ticket.station)?.label ||
                    ticket.station}
                </p>

                <h3 className="text-2xl font-bold">
                  ໂຕະ {ticket.order?.table?.name || "-"}
                </h3>

                <p className="mt-1 text-sm opacity-70">
                  Order #{ticket.order?.orderNumber || "-"} ·{" "}
                  {new Date(ticket.createdAt).toLocaleTimeString("lo-LA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold">
                {ticket.status}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-bold">{ticket.name}</p>
                <p className="rounded-full bg-slate-900 px-3 py-1 text-lg font-bold text-white">
                  x{ticket.quantity}
                </p>
              </div>

              {ticket.order?.note && (
                <p className="mt-2 rounded-xl bg-blue-50 p-2 text-sm font-semibold text-blue-700">
                  ປະເພດ: {String(ticket.order.note).replace("TAKEAWAY | ", "")}
                </p>
              )}

              {ticket.note && (
                <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm font-semibold text-amber-700">
                  ໝາຍເຫດ: {ticket.note}
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                disabled={ticket.status === "READY"}
                className="rounded-2xl bg-slate-900 px-4 py-4 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => update(ticket, nextStatus(ticket.status))}
              >
                {actionText(ticket.status)}
              </button>

              <button
                disabled={ticket.status === "READY"}
                className="rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => update(ticket, "READY")}
              >
                ພ້ອມເສີບ
              </button>
            </div>
          </article>
        ))}
      </section>

      {toast && (
        <div className="fixed left-1/2 top-5 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}
