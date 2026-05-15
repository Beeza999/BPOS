import React, { useMemo } from "react";
import { money } from "../../../lib/api.js";
import { sameLocalDay, orderDate, summarizePayments } from "../utils/date.js";
import Stat, { Empty } from "../components/Stat.jsx";

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function paymentDate(payment) {
  return new Date(
    payment?.paidAt ||
      payment?.createdAt ||
      payment?.updatedAt ||
      payment?.date ||
      Date.now(),
  );
}

function paymentAmount(payment) {
  return toNumber(
    payment?.total ||
      payment?.totalAmount ||
      payment?.grandTotal ||
      payment?.amount ||
      payment?.paidAmount ||
      payment?.cashReceived ||
      0,
  );
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / total) * 100);
}

function DashboardCard({ title, subtitle, children, right }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ProgressRow({ label, value, max, valueText, index }) {
  const width = max ? Math.max(8, Math.round((Number(value || 0) / max) * 100)) : 0;

  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-sm font-black text-orange-600">
            {index}
          </span>
          <b className="truncate text-sm text-slate-900">{label}</b>
        </div>
        <b className="shrink-0 text-sm text-orange-600">{valueText}</b>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function HourlyChart({ data }) {
  const max = Math.max(...data.map((item) => item.total), 1);
  const activeData = data.filter((item) => item.total > 0);

  if (!activeData.length) {
    return <Empty>ຍັງບໍ່ມີຍອດຂາຍຕາມຊົ່ວໂມງ</Empty>;
  }

  return (
    <div>
      <div className="flex h-52 items-end gap-2 rounded-3xl bg-gradient-to-b from-slate-50 to-white p-4">
        {data.map((item) => {
          const height = item.total
            ? Math.max(12, Math.round((item.total / max) * 100))
            : 3;

          return (
            <div
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
              key={item.hour}
            >
              <div className="pointer-events-none absolute bottom-full z-20 mb-2 hidden min-w-max rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-lg group-hover:block">
                {item.label}: {money(item.total)}
              </div>

              <div
                className={
                  item.total
                    ? "w-full rounded-t-xl bg-gradient-to-t from-emerald-500 to-emerald-300 shadow-sm shadow-emerald-200 transition-all"
                    : "w-full rounded-t-xl bg-slate-200 transition-all"
                }
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-bold text-slate-400 sm:grid-cols-8">
        {["00", "03", "06", "09", "12", "15", "18", "21"].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  if (!items.length || total <= 0) {
    return <Empty>ຍັງບໍ່ມີການຊຳລະ</Empty>;
  }

  let offset = 0;

  return (
    <div className="grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
      <div className="relative mx-auto h-44 w-44">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="12"
          />

          {items.map((item, index) => {
            const dash = (item.value / total) * circumference;
            const currentOffset = offset;
            offset += dash;

            const colors = ["#10b981", "#f97316", "#3b82f6", "#8b5cf6", "#ef4444"];

            return (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <b className="text-xl text-slate-950">{money(total)}</b>
          <span className="text-xs font-bold text-slate-400">ລວມ</span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const colors = [
            "bg-emerald-500",
            "bg-orange-500",
            "bg-blue-500",
            "bg-violet-500",
            "bg-red-500",
          ];

          return (
            <div
              className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"
              key={item.label}
            >
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${colors[index % colors.length]}`} />
                <b className="text-sm text-slate-700">{item.label}</b>
              </div>
              <div className="text-right">
                <b className="block text-sm text-slate-950">{money(item.value)}</b>
                <span className="text-xs font-bold text-slate-400">
                  {percent(item.value, total)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard({ summary, payments, openBills }) {
  const daily = useMemo(() => summarizePayments(payments), [payments]);

  const todayOpenBills = useMemo(
    () =>
      (openBills || []).filter((bill) =>
        (bill.orders || []).some((order) => sameLocalDay(orderDate(order))),
      ),
    [openBills],
  );

  const paymentByMethod = daily.byPayment || {};

  const topMenus = useMemo(
    () =>
      Object.entries(summary?.topMenu || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({
          name,
          qty: Number(qty || 0),
        })),
    [summary],
  );

  const maxTopQty = Math.max(...topMenus.map((item) => item.qty), 1);

  const paymentMethodItems = useMemo(
    () =>
      Object.entries(paymentByMethod)
        .map(([label, value]) => ({
          label,
          value: toNumber(value),
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [paymentByMethod],
  );

  const hourlySales = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      total: 0,
      count: 0,
    }));

    for (const payment of daily.todayPayments || []) {
      const date = paymentDate(payment);
      const hour = date.getHours();

      rows[hour].total += paymentAmount(payment);
      rows[hour].count += 1;
    }

    return rows;
  }, [daily.todayPayments]);

  const openTableCount = new Set(todayOpenBills.map((b) => String(b.tableId))).size;
  const totalPayments = daily.todayPayments?.length || 0;

  return (
    <section className="space-y-5 p-4">
      <div className="rounded-[32px] bg-gradient-to-r from-slate-950 via-slate-900 to-orange-600 p-6 text-white shadow-xl shadow-orange-100">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="mt-2 text-3xl font-black">ພາບລວມຍອດຂາຍມື້ນີ້</h1>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              ເບິ່ງຍອດຂາຍ, ບິນ, ໂຕະທີ່ເປີດ ແລະ ເມນູຂາຍດີແບບເຂົ້າໃຈງ່າຍ
            </p>
          </div>

          <div className="rounded-3xl bg-white/10 px-5 py-4 text-right backdrop-blur">
            <p className="text-sm font-bold text-orange-100">ຍອດລວມມື້ນີ້</p>
            <b className="block text-3xl font-black">{money(daily.todaySales)}</b>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          label="ຍອດຂາຍມື້ນີ້"
          value={money(daily.todaySales)}
          color="text-emerald-600"
        />
        <Stat label="ຈຳນວນບິນ" value={totalPayments} />
        <Stat
          label="ໂຕະທີ່ເປີດຢູ່"
          value={openTableCount}
          color="text-orange-600"
        />
        <Stat
          label="ເມນູທີ່ເປີດຂາຍ"
          value={summary?.activeMenus || 0}
          color="text-blue-600"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard
          title="ກາຟຍອດຂາຍຕາມຊົ່ວໂມງ"
          subtitle="ຊ່ວຍເບິ່ງວ່າຊ່ວງໃດຂາຍດີທີ່ສຸດ"
          right={
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-600">
              {totalPayments} ບິນ
            </span>
          }
        >
          <HourlyChart data={hourlySales} />
        </DashboardCard>

        <DashboardCard
          title="ຍອດຂາຍຕາມຊ່ອງທາງ"
          subtitle="ແຍກຕາມວິທີຊຳລະເງິນ"
        >
          <DonutChart items={paymentMethodItems} />
        </DashboardCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardCard
          title="ເມນູຂາຍດີ"
          subtitle="Top 5 ເມນູທີ່ລູກຄ້າສັ່ງຫຼາຍສຸດ"
        >
          <div className="space-y-3">
            {topMenus.length ? (
              topMenus.map((item, index) => (
                <ProgressRow
                  key={item.name}
                  index={index + 1}
                  label={item.name}
                  value={item.qty}
                  max={maxTopQty}
                  valueText={`${item.qty} ຈານ`}
                />
              ))
            ) : (
              <Empty>ຍັງບໍ່ມີຂໍ້ມູນການຂາຍ</Empty>
            )}
          </div>
        </DashboardCard>

        <DashboardCard
          title="ສະຫຼຸບດ່ວນ"
          subtitle="ຂໍ້ມູນສຳຄັນສຳລັບແອັດມິນ"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-700">ຍອດຂາຍສະເລ່ຍ / ບິນ</p>
              <b className="mt-2 block text-2xl font-black text-emerald-700">
                {money(totalPayments ? daily.todaySales / totalPayments : 0)}
              </b>
            </div>

            <div className="rounded-3xl bg-orange-50 p-4">
              <p className="text-sm font-bold text-orange-700">ໂຕະທີ່ຍັງເປີດ</p>
              <b className="mt-2 block text-2xl font-black text-orange-700">
                {openTableCount} ໂຕະ
              </b>
            </div>

            <div className="rounded-3xl bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-700">ເມນູທີ່ເປີດຂາຍ</p>
              <b className="mt-2 block text-2xl font-black text-blue-700">
                {summary?.activeMenus || 0}
              </b>
            </div>

            <div className="rounded-3xl bg-slate-100 p-4">
              <p className="text-sm font-bold text-slate-600">ຈຳນວນບິນມື້ນີ້</p>
              <b className="mt-2 block text-2xl font-black text-slate-900">
                {totalPayments}
              </b>
            </div>
          </div>
        </DashboardCard>
      </div>
    </section>
  );
}