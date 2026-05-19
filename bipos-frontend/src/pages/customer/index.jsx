import React, { useEffect, useMemo, useState } from 'react';
import { api, money } from '../../lib/api.js';
import { Tab, Empty } from './components/CustomerComponents.jsx';
import { joinTableRoom } from '../../lib/socket.js';
import { useRealtimeReload } from '../../hooks/useRealtimeReload.js';

const statusText = {
  NEW: 'ສັ່ງແລ້ວ',
  ACCEPTED: 'ຮັບອໍເດີແລ້ວ',
  COOKING: 'ກຳລັງເຮັດ',
  READY: 'ພ້ອມແລ້ວ',
  SERVED: 'ເສີບແລ້ວ',
  CANCELLED: 'ຍົກເລີກ',
};

function getStatusClass(status) {
  if (status === 'READY') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  if (status === 'COOKING' || status === 'ACCEPTED') return 'bg-orange-50 text-orange-700 ring-1 ring-orange-100';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 ring-1 ring-red-100';
  if (status === 'SERVED') return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100';
}

function itemImage(menu) {
  if (menu?.imageUrl) return menu.imageUrl;
  if (menu?.image) return menu.image;
  return '';
}

export default function Customer() {
  const params = new URLSearchParams(window.location.search);
  const tableTokenFromUrl = params.get('t') || '';
  const legacyQr = params.get('qr') || '';

  const [table, setTable] = useState(null);
  const [tableToken, setTableToken] = useState(tableTokenFromUrl);
  const [menus, setMenus] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('recommended');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [callingStaff, setCallingStaff] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError('');

      let nextTable = null;
      if (tableTokenFromUrl) {
        nextTable = await api(`/api/tables/session/${encodeURIComponent(tableTokenFromUrl)}`);
      } else if (legacyQr) {
        nextTable = await api(`/api/tables/qr/${encodeURIComponent(legacyQr)}`);
      } else {
        throw new Error('ບໍ່ພົບ QR ຂອງໂຕະ');
      }

      setTable(nextTable || null);

      const nextToken = nextTable?.tableToken || tableTokenFromUrl;
      setTableToken(nextToken);
      if (nextToken) joinTableRoom(nextToken);

      const branchQuery = nextTable?.branchId ? `?branchId=${encodeURIComponent(nextTable.branchId)}` : '';
      const [menuItems, categories] = await Promise.all([
        api(`/api/menu/items${branchQuery}${branchQuery ? '&' : '?'}available=true`),
        api(`/api/menu/categories${branchQuery}`),
      ]);

      setMenus(Array.isArray(menuItems) ? menuItems : []);
      setCats(Array.isArray(categories) ? categories : []);

      if (nextTable?.id && nextToken) {
        const nextOrders = await api(`/api/orders/table/${nextTable.id}?tableToken=${encodeURIComponent(nextToken)}`);
        setOrders(Array.isArray(nextOrders) ? nextOrders : []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useRealtimeReload(load, {
    events: ['order:created', 'order:status', 'order:cancelled', 'kitchen:ticket-status', 'menu:changed'],
  });

  const filtered = useMemo(() => {
    return menus.filter((menu) => {
      const categoryOk = cat === 'all' || (cat === 'recommended' ? menu.isRecommended : menu.categoryId === cat);
      const term = q.trim().toLowerCase();
      const searchOk = !term || `${menu.name} ${menu.description || ''}`.toLowerCase().includes(term);
      return categoryOk && searchOk;
    });
  }, [menus, cat, q]);

  const cartQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const activeOrders = orders.filter((order) => order.status !== 'CANCELLED');

  function add(menu) {
    const alreadyInCart = cart.some((item) => item.menuItemId === menu.id);
    const alreadyOrdered = orders.some(
      (order) =>
        order.status !== 'CANCELLED' &&
        (order.items || []).some((item) => item.menuItemId === menu.id && item.status !== 'CANCELLED'),
    );

    if (alreadyInCart || alreadyOrdered) {
      const ok = window.confirm(`ເມນູ "${menu.name}" ຖືກສັ່ງແລ້ວ. ຕ້ອງການສັ່ງເພີ່ມອີກບໍ?`);
      if (!ok) return;
    }

    const index = cart.findIndex((item) => item.menuItemId === menu.id && !item.note);
    if (index >= 0) {
      setCart(cart.map((item, idx) => (idx === index ? { ...item, quantity: item.quantity + 1 } : item)));
    } else {
      setCart([...cart, { menuItemId: menu.id, name: menu.name, price: menu.price, quantity: 1, note: '' }]);
    }

    setCartOpen(true);
  }

  function changeQty(index, amount) {
    const next = cart
      .map((item, idx) => (idx === index ? { ...item, quantity: item.quantity + amount } : item))
      .filter((item) => item.quantity > 0);

    setCart(next);
    if (next.length === 0) setCartOpen(false);
  }

  function note(index, value) {
    setCart(cart.map((item, idx) => (idx === index ? { ...item, note: value } : item)));
  }

  async function submit() {
    if (!table?.id || !cart.length || !tableToken || submitting) return;

    try {
      setSubmitting(true);
      const order = await api('/api/orders', {
        method: 'POST',
        body: { tableToken, items: cart },
      });

      setCart([]);
      setCartOpen(false);
      setOrders([order, ...orders]);
      alert('ສົ່ງອໍເດີແລ້ວ');
    } catch (err) {
      alert('ສົ່ງອໍເດີບໍ່ສຳເລັດ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function callStaff() {
    if (callingStaff || !tableToken) return;

    try {
      setCallingStaff(true);
      await api('/api/orders/call-staff', {
        method: 'POST',
        body: { tableToken, tableName: table?.name || '', message: 'ລູກຄ້າເອີ້ນພະນັກງານ' },
      });
      alert('ເອີ້ນພະນັກງານແລ້ວ');
    } catch (err) {
      alert('ເອີ້ນພະນັກງານບໍ່ສຳເລັດ: ' + err.message);
    } finally {
      setCallingStaff(false);
    }
  }

  const cartPanel = (
    <div className="flex h-full flex-col rounded-t-[28px] bg-white shadow-2xl ring-1 ring-slate-100 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:rounded-[32px]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-500">Cart</p>
          <h3 className="text-base font-black text-slate-950 sm:text-lg">ກະຕ່າອໍເດີ</h3>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-slate-600 md:hidden"
          onClick={() => setCartOpen(false)}
          aria-label="close cart"
        >
          ×
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">🧺</div>
          <p className="font-bold text-slate-700">ຍັງບໍ່ມີລາຍການ</p>
          <p className="mt-1 text-sm text-slate-400">ເລືອກເມນູແລ້ວກົດ + ເພື່ອສັ່ງ</p>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5 md:max-h-[52vh]">
            {cart.map((item, index) => (
              <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-100" key={`${item.menuItemId}-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-bold leading-snug text-slate-950">{item.name}</p>
                    <p className="mt-1 text-sm font-bold text-orange-600">{money(item.price)}</p>
                  </div>
                  <div className="flex shrink-0 items-center rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-100">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-black text-slate-700 active:scale-95"
                      onClick={() => changeQty(index, -1)}
                    >
                      -
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-950">{item.quantity}</span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-lg font-black text-white active:scale-95"
                      onClick={() => changeQty(index, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-orange-400"
                  placeholder="ໝາຍເຫດ ເຊັ່ນ ບໍ່ເຜັດ"
                  value={item.note}
                  onChange={(event) => note(index, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">ລວມ {cartQty} ລາຍການ</span>
              <span className="text-xl font-black text-slate-950">{money(cartTotal)}</span>
            </div>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-3xl bg-slate-950 px-5 py-4 font-black text-white shadow-xl shadow-slate-300 active:scale-[0.99] disabled:opacity-60"
              onClick={submit}
              disabled={submitting}
            >
              <span>{submitting ? 'ກຳລັງສົ່ງ...' : `ສົ່ງອໍເດີ ${cartQty} ລາຍການ`}</span>
              <span>{money(cartTotal)}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto w-full max-w-7xl md:px-4 md:py-4 lg:px-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 overflow-hidden bg-white shadow-xl md:rounded-[36px]">
            <section className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
              <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] sm:px-5 md:px-6 md:pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">ໂຕະຂອງທ່ານ</p>
                    <h1 className="truncate text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                      ໂຕະ {table?.name || '...'}
                    </h1>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 active:scale-95 disabled:opacity-60 sm:px-5"
                    onClick={callStaff}
                    disabled={callingStaff || !tableToken}
                  >
                    {callingStaff ? 'ກຳລັງເອີ້ນ...' : 'ເອີ້ນພະນັກງານ'}
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-3xl bg-slate-100 px-4 py-3 ring-1 ring-slate-100 focus-within:bg-white focus-within:ring-orange-200">
                  <span className="text-lg text-slate-400">🔍</span>
                  <input
                    className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                    placeholder="ຄົ້ນຫາເມນູ"
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                  />
                  {q && (
                    <button
                      type="button"
                      className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500"
                      onClick={() => setQ('')}
                    >
                      ລ້າງ
                    </button>
                  )}
                </div>
              </div>
            </section>

            {error && (
              <div className="mx-4 mt-4 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-600 ring-1 ring-red-100 sm:mx-5 md:mx-6">
                {error}
              </div>
            )}

            <section className="px-4 pt-4 sm:px-5 md:px-6">
              <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-orange-500 via-red-500 to-rose-500 p-4 text-white shadow-xl shadow-orange-100 sm:p-5 md:p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/20 text-4xl ring-1 ring-white/20 sm:h-20 sm:w-20 sm:text-5xl">
                    🍜
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white/80">Welcome to</p>
                    <h2 className="text-2xl font-black leading-tight sm:text-3xl">BIPOS</h2>
                    <p className="mt-1 text-sm text-white/80 sm:text-base">ອາຫານ · ເຄື່ອງດື່ມ · ຂອງຫວານ</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:gap-3 sm:text-sm">
                  <div className="rounded-3xl bg-white/15 p-3 ring-1 ring-white/10">
                    <p className="font-black">15-25</p>
                    <p className="mt-1 text-white/75">ນາທີ</p>
                  </div>
                  <div className="rounded-3xl bg-white/15 p-3 ring-1 ring-white/10">
                    <p className="font-black">4.8</p>
                    <p className="mt-1 text-white/75">ຄະແນນ</p>
                  </div>
                  <div className="rounded-3xl bg-white/15 p-3 ring-1 ring-white/10">
                    <p className="font-black">ເປີດຢູ່</p>
                    <p className="mt-1 text-white/75">ມື້ນີ້</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="sticky top-[120px] z-20 bg-white/95 px-4 py-4 backdrop-blur sm:px-5 md:static md:px-6 md:pt-5">
              <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 md:-mx-6 md:px-6">
                <Tab active={cat === 'all'} onClick={() => setCat('all')}>
                  ທັງໝົດ
                </Tab>
                <Tab active={cat === 'recommended'} onClick={() => setCat('recommended')}>
                  ແນະນຳ
                </Tab>
                {cats.map((category) => (
                  <Tab key={category.id} active={cat === category.id} onClick={() => setCat(category.id)}>
                    {category.name}
                  </Tab>
                ))}
              </div>
            </section>

            <section className="px-4 sm:px-5 md:px-6">
              <div className="flex items-center justify-between gap-3 rounded-[28px] border border-amber-100 bg-amber-50 p-4 sm:p-5">
                <div>
                  <p className="text-sm font-black text-amber-700 sm:text-base">ໂປຣໂມຊັນມື້ນີ້</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-600 sm:text-sm">
                    ສັ່ງຄົບ 300,000 ກີບ ຮັບຟຣີ ຊາເຢັນ 1 ແກ້ວ
                  </p>
                </div>
                <div className="shrink-0 text-4xl">🥤</div>
              </div>
            </section>

            <section className="px-4 pb-32 pt-5 sm:px-5 md:px-6 md:pb-10">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-950 sm:text-2xl">ເມນູ</h3>
                  <p className="mt-1 text-sm text-slate-500">ພົບ {filtered.length} ລາຍການ</p>
                </div>
                {cartQty > 0 && (
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white md:hidden"
                    onClick={() => setCartOpen(true)}
                  >
                    ກະຕ່າ {cartQty}
                  </button>
                )}
              </div>

              {loading && <Empty>ກຳລັງໂຫຼດ...</Empty>}
              {!loading && filtered.length === 0 && <Empty>ບໍ່ພົບເມນູ</Empty>}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((menu) => (
                  <article
                    className="group flex gap-3 rounded-[28px] border border-slate-100 bg-white p-3 shadow-sm transition active:scale-[0.99] sm:flex-col sm:p-3.5 sm:hover:-translate-y-0.5 sm:hover:shadow-lg"
                    key={menu.id}
                  >
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-slate-100 sm:h-40 sm:w-full md:h-44">
                      {itemImage(menu) ? (
                        <img alt={menu.name} className="h-full w-full object-cover" src={itemImage(menu)} loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl sm:text-5xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div>
                        <h4 className="line-clamp-2 text-base font-black leading-snug text-slate-950 sm:text-lg">{menu.name}</h4>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
                          {menu.description || '-'}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <p className="text-base font-black text-orange-600 sm:text-lg">{money(menu.price)}</p>
                        <button
                          type="button"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-2xl font-black text-white shadow-lg shadow-orange-100 active:scale-95"
                          onClick={() => add(menu)}
                          aria-label={`add ${menu.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-950 sm:text-2xl">ອໍເດີຂອງຂ້ອຍ</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    {activeOrders.length} active
                  </span>
                </div>

                {orders.length === 0 && <Empty>ຍັງບໍ່ມີອໍເດີ</Empty>}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {orders.map((order) => (
                    <div className="rounded-[28px] bg-slate-50 p-4 ring-1 ring-slate-100" key={order.id}>
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate text-slate-950">#{order.orderNumber}</b>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${getStatusClass(order.status)}`}>
                          {statusText[order.status] || order.status}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-black text-orange-600">{money(order.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="hidden md:block">{cartPanel}</aside>
        </div>
      </div>

      {cart.length > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl backdrop-blur md:hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-3xl bg-slate-950 px-5 py-4 font-black text-white shadow-xl active:scale-[0.99]"
            onClick={() => setCartOpen(true)}
          >
            <span>ເບິ່ງກະຕ່າ {cartQty} ລາຍການ</span>
            <span>{money(cartTotal)}</span>
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 backdrop-blur-[2px] md:hidden">
          <button className="absolute inset-0" type="button" onClick={() => setCartOpen(false)} aria-label="close cart overlay" />
          <div className="relative max-h-[88vh] w-full pb-[env(safe-area-inset-bottom)]">{cartPanel}</div>
        </div>
      )}
    </main>
  );
}
