import React, { useEffect, useMemo, useState } from 'react';
import { api, money } from '../../lib/api.js';
import { joinTableRoom } from '../../lib/socket.js';
import { useRealtimeReload } from '../../hooks/useRealtimeReload.js';

const statusText = {
  NEW: 'ລໍຖ້າຢືນຢັນ',
  ACCEPTED: 'ຮັບອໍເດີແລ້ວ',
  COOKING: 'ກຳລັງເຮັດ',
  READY: 'ພ້ອມເສີບ',
  SERVED: 'ເສີບແລ້ວ',
  CANCELLED: 'ຍົກເລີກ',
};

function shortMoney(value) {
  return money(value);
}

function getOrderTime(order) {
  const raw = order?.createdAt || order?.updatedAt || new Date().toISOString();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' });
}

function IconButton({ children, onClick, active = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl shadow-sm transition active:scale-95 ${
        active ? 'bg-orange-500 text-white' : 'bg-white text-orange-500'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function CategoryButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[56px] min-w-[126px] shrink-0 rounded-xl px-5 py-3 text-center text-base font-semibold shadow-sm transition active:scale-95 sm:min-w-[145px] ${
        active ? 'bg-orange-600 text-white' : 'bg-white text-slate-900'
      }`}
    >
      <span className="line-clamp-1">{children}</span>
    </button>
  );
}

function MenuCard({ menu, onAdd, compact = false }) {
  return (
    <article
      className={`relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 ${
        compact ? 'flex items-center gap-3 p-3' : 'min-h-[175px] p-4'
      }`}
    >
      <div
        className={`shrink-0 overflow-hidden rounded-2xl bg-slate-100 ${
          compact ? 'h-24 w-24' : 'mb-3 h-20 w-20'
        }`}
      >
        {menu.imageUrl ? (
          <img alt={menu.name} className="h-full w-full object-cover" src={menu.imageUrl} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🍽️</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-lg font-extrabold leading-tight text-slate-800">{menu.name}</h4>
        {compact && <p className="mt-1 line-clamp-1 text-sm text-slate-400">ລາຄາຍັງບໍ່ລວມ VAT</p>}
        {!compact && menu.description && <p className="mt-1 line-clamp-1 text-sm text-slate-400">{menu.description}</p>}
        <p className="mt-3 text-lg font-extrabold text-orange-600">{shortMoney(menu.price)}</p>
      </div>

      <button
        type="button"
        onClick={() => onAdd(menu)}
        className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-2xl font-black leading-none text-white shadow-lg transition active:scale-90"
        aria-label="add menu"
      >
        +
      </button>
    </article>
  );
}

function EmptyBox({ children }) {
  return <div className="rounded-3xl bg-white/80 p-8 text-center font-semibold text-slate-400 shadow-sm">{children}</div>;
}

function CartPanel({ cart, cartQty, cartTotal, changeQty, note, submit, closeCart }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl rounded-t-[32px] bg-white p-4 shadow-2xl ring-1 ring-slate-100 pb-[calc(16px+env(safe-area-inset-bottom))] lg:right-6 lg:left-auto lg:bottom-6 lg:w-[390px] lg:rounded-[32px]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">ກະຕ່າອາຫານ</h3>
          <p className="text-sm font-semibold text-slate-400">{cartQty} ລາຍການ</p>
        </div>
        <button type="button" onClick={closeCart} className="rounded-full bg-slate-100 px-4 py-2 font-bold text-slate-500">ປິດ</button>
      </div>

      <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
        {cart.map((item, index) => (
          <div className="rounded-3xl bg-slate-50 p-3" key={`${item.menuItemId}-${index}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-1 font-extrabold text-slate-800">{item.name}</p>
                <p className="text-sm font-bold text-orange-600">{shortMoney(item.price)}</p>
              </div>
              <div className="flex shrink-0 items-center rounded-full bg-white p-1 shadow-sm">
                <button type="button" className="h-9 w-9 rounded-full bg-slate-100 text-lg font-black" onClick={() => changeQty(index, -1)}>-</button>
                <span className="w-10 text-center font-extrabold">{item.quantity}</span>
                <button type="button" className="h-9 w-9 rounded-full bg-slate-900 text-lg font-black text-white" onClick={() => changeQty(index, 1)}>+</button>
              </div>
            </div>
            <input
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400"
              placeholder="ໝາຍເຫດ ເຊັ່ນ ບໍ່ເຜັດ"
              value={item.note}
              onChange={(event) => note(index, event.target.value)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-4 flex w-full items-center justify-between rounded-3xl bg-orange-600 px-5 py-4 text-lg font-extrabold text-white shadow-xl transition active:scale-[0.98]"
      >
        <span>ສົ່ງອໍເດີ</span>
        <span>{shortMoney(cartTotal)}</span>
      </button>
    </div>
  );
}

export default function Customer() {
  const params = new URLSearchParams(window.location.search);
  const tableTokenFromUrl = params.get('t') || '';
  const legacyQr = params.get('qr') || '';

  const [view, setView] = useState('home');
  const [table, setTable] = useState(null);
  const [tableToken, setTableToken] = useState(tableTokenFromUrl);
  const [menus, setMenus] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('recommended');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const orderList = await api(`/api/orders/table/${nextTable.id}?tableToken=${encodeURIComponent(nextToken)}`);
        setOrders(Array.isArray(orderList) ? orderList : []);
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

  const recommendedMenus = useMemo(() => {
    const list = filtered.filter((menu) => menu.isRecommended);
    return (list.length ? list : filtered).slice(0, 4);
  }, [filtered]);

  const sellerMenus = useMemo(() => {
    const recommendedIds = new Set(recommendedMenus.map((menu) => menu.id));
    const list = filtered.filter((menu) => !recommendedIds.has(menu.id));
    return (list.length ? list : filtered).slice(0, 12);
  }, [filtered, recommendedMenus]);

  const cartQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function add(menu) {
    const alreadyInCart = cart.some((item) => item.menuItemId === menu.id);
    const alreadyOrdered = orders.some((order) =>
      order.status !== 'CANCELLED' &&
      (order.items || []).some((item) => item.menuItemId === menu.id && item.status !== 'CANCELLED')
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
    if (!table?.id || !cart.length || !tableToken) return;

    try {
      const order = await api('/api/orders', { method: 'POST', body: { tableToken, items: cart } });
      setCart([]);
      setCartOpen(false);
      setOrders([order, ...orders]);
      setView('orders');
      alert('ສົ່ງອໍເດີແລ້ວ');
    } catch (err) {
      alert('ສົ່ງອໍເດີບໍ່ສຳເລັດ: ' + err.message);
    }
  }

  async function callStaff(message = 'ລູກຄ້າເອີ້ນພະນັກງານ') {
    await api('/api/orders/call-staff', {
      method: 'POST',
      body: { tableToken, tableName: table?.name || '', message },
    }).catch(() => null);
    alert(message === 'ລູກຄ້າຂໍເກັບເງິນ' ? 'ເອີ້ນເກັບເງິນແລ້ວ' : 'ເອີ້ນພະນັກງານແລ້ວ');
  }

  const tableName = table?.name || '...';

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-white text-slate-900 lg:bg-slate-100">
      <div className="mx-auto min-h-screen w-full bg-white lg:max-w-5xl lg:shadow-2xl">
        {view === 'home' && (
          <section className="min-h-screen w-full bg-white px-4 pb-28 pt-[calc(24px+env(safe-area-inset-top))] sm:px-6 lg:px-8">
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">BPOS Restaurant</h1>
                <p className="mt-3 flex items-start gap-2 text-base font-medium leading-snug text-slate-500">
                  <span className="text-2xl text-slate-300">📍</span>
                  <span>ສັ່ງອາຫານຜ່ານ QR Code</span>
                </p>
              </div>
              <button className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xl shadow-xl ring-1 ring-slate-100" type="button">
                🇱🇦 <span className="text-sm">⌄</span>
              </button>
            </header>

            <div className="mt-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-yellow-300 via-orange-400 to-orange-600 p-6 text-white shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-black opacity-90">BPOS QR</p>
                  <h2 className="mt-2 text-4xl font-black leading-none tracking-tight">ເມນູດິຈິຕອນ</h2>
                  <p className="mt-3 max-w-[250px] text-base font-bold text-white/90">ສັ່ງອາຫານ, ເອີ້ນພະນັກງານ ໄດ້ຈາກໂທລະສັບຂອງທ່ານ</p>
                </div>
                <div className="hidden text-7xl sm:block">🍔</div>
              </div>
              <div className="mt-5 h-1 w-10 rounded-full bg-white/70" />
            </div>

            <div className="mt-7 text-center">
              <h2 className="text-2xl font-black text-slate-800">🌙 ສະບາຍດີ</h2>
              <p className="mt-3 text-lg font-medium text-slate-600">
                ພວກເຮົາຈະນຳອາຫານໄປໃຫ້ທ່ານທີ່ໂຕະ: <span className="rounded-full border-2 border-slate-800 px-3 py-0.5 font-black text-slate-900">{tableName}</span>
              </p>
            </div>

            {error && <div className="mt-5 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}

            <div className="mt-6 flex items-center justify-between rounded-3xl bg-sky-100 p-4 shadow-sm ring-1 ring-sky-200">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🎁</div>
                <div>
                  <p className="text-lg font-black leading-tight text-sky-700">ໃສ່ເບີໂທເພື່ອສະສົມແຕ້ມ</p>
                  <p className="mt-1 text-sm font-semibold text-sky-500">ຟັງຊັນນີ້ສາມາດເພີ່ມຕໍ່ໄດ້</p>
                </div>
              </div>
              <span className="text-4xl font-black text-sky-600">›</span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <button type="button" onClick={() => callStaff('ລູກຄ້າຂໍເກັບເງິນ')} className="min-h-[128px] rounded-3xl bg-gradient-to-br from-white to-orange-50 p-3 text-left shadow-sm ring-1 ring-slate-100 active:scale-95">
                <p className="text-base font-black text-slate-800">ເກັບເງິນ</p>
                <div className="mt-5 text-5xl">💳</div>
              </button>
              <button
                type="button"
                onClick={() => callStaff()}
                className="relative min-h-[128px] overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 p-3 text-left text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-200 active:scale-95"
                aria-label="ເອີ້ນພະນັກງານ"
              >
                <span className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/20" />
                <span className="inline-flex rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">Call Staff</span>
                <p className="mt-2 text-lg font-black leading-tight drop-shadow-sm">ເອີ້ນພະນັກງານ</p>
                <p className="mt-1 text-[11px] font-bold leading-tight text-white/90">ກົດເພື່ອໃຫ້ພະນັກງານມາທີ່ໂຕະ</p>
                <div className="mt-3 flex items-end justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">🔔</span>
                  <span className="text-5xl drop-shadow-sm">🧑‍🍳</span>
                </div>
              </button>
              <button type="button" onClick={() => setView('orders')} className="min-h-[128px] rounded-3xl bg-gradient-to-br from-white to-yellow-50 p-3 text-left shadow-sm ring-1 ring-slate-100 active:scale-95">
                <p className="text-base font-black text-slate-800">ອໍເດີຂອງຂ້ອຍ</p>
                <div className="mt-5 text-5xl">⭐</div>
              </button>
            </div>

            <button type="button" onClick={() => setView('menu')} className="mt-6 flex min-h-[110px] w-full items-center justify-between overflow-hidden rounded-[28px] bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-300 px-6 text-left text-white shadow-xl active:scale-[0.99]">
              <span className="text-2xl font-black">ເບິ່ງເມນູ - ສັ່ງອາຫານ</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30 text-4xl font-black">›</span>
            </button>

            <button
              type="button"
              onClick={() => callStaff()}
              className="fixed bottom-[calc(24px+env(safe-area-inset-bottom))] right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-3xl shadow-2xl shadow-emerald-300 ring-4 ring-white active:scale-95 sm:h-20 sm:w-20 sm:text-4xl lg:right-[calc(50%-480px)]"
              aria-label="ເອີ້ນພະນັກງານ"
            >
              📣
            </button>
          </section>
        )}

        {view === 'menu' && (
          <section className="min-h-screen w-full bg-slate-50 pb-[calc(128px+env(safe-area-inset-bottom))]">
            <div className="sticky top-0 z-30 w-full bg-white/95 px-3 pb-4 pt-[calc(16px+env(safe-area-inset-top))] shadow-sm backdrop-blur sm:px-5">
              <div className="flex items-center gap-3">
                <IconButton onClick={() => setView('home')}>⌂</IconButton>
                <label className="flex h-12 flex-1 items-center gap-3 rounded-2xl bg-slate-100 px-4 ring-1 ring-slate-200">
                  <span className="text-2xl text-slate-300">⌕</span>
                  <input
                    className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-slate-300"
                    placeholder="ທ່ານຕ້ອງການຊອກຫາຫຍັງ?"
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                  />
                </label>
              </div>

              <div className="mt-5 grid grid-flow-col grid-rows-2 gap-3 overflow-x-auto pb-1">
                <CategoryButton active={cat === 'recommended'} onClick={() => setCat('recommended')}>ເມນູໃໝ່</CategoryButton>
                <CategoryButton active={cat === 'all'} onClick={() => setCat('all')}>ຂາຍດີ</CategoryButton>
                {cats.map((item) => (
                  <CategoryButton key={item.id} active={cat === item.id} onClick={() => setCat(item.id)}>
                    {item.name}
                  </CategoryButton>
                ))}
              </div>
            </div>

            {error && <div className="mx-4 mt-5 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}

            <div className="px-4 pt-5 sm:px-6 lg:px-8">
              <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-rose-50 via-orange-50 to-yellow-100 p-5 shadow-sm ring-1 ring-orange-100">
                <div className="absolute right-3 top-[-4px] rotate-12 rounded-full bg-pink-500 px-4 py-3 text-sm font-black text-white shadow-lg">NEW</div>
                <h2 className="mb-5 text-2xl font-black text-slate-800">ເມນູໃໝ່ຕ້ອງລອງ</h2>

                {loading && <EmptyBox>ກຳລັງໂຫຼດ...</EmptyBox>}
                {!loading && recommendedMenus.length === 0 && <EmptyBox>ບໍ່ພົບເມນູ</EmptyBox>}

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {recommendedMenus.map((menu) => (
                    <MenuCard key={menu.id} menu={menu} onAdd={add} />
                  ))}
                </div>
              </section>

              <section className="mt-7 rounded-[32px] bg-gradient-to-br from-cyan-50 via-emerald-50 to-green-100 p-5 shadow-sm ring-1 ring-emerald-100">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-800">ຂາຍດີ</h2>
                  <span className="text-5xl">🏅</span>
                </div>

                {!loading && sellerMenus.length === 0 && <EmptyBox>ບໍ່ພົບເມນູ</EmptyBox>}
                <div className="space-y-4">
                  {sellerMenus.map((menu) => (
                    <MenuCard key={menu.id} menu={menu} onAdd={add} compact />
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}

        {view === 'orders' && (
          <section className="min-h-screen w-full bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.08),transparent_26%),radial-gradient(circle_at_70%_35%,rgba(251,146,60,0.08),transparent_24%)] bg-white pb-[calc(96px+env(safe-area-inset-bottom))]">
            <header className="bg-white px-4 pb-7 pt-[calc(28px+env(safe-area-inset-top))] shadow-sm sm:px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <IconButton onClick={() => setView('home')}>⌂</IconButton>
                <h1 className="text-4xl font-black tracking-tight text-slate-800">ອາຫານທີ່ສັ່ງ</h1>
              </div>
              <button type="button" onClick={() => setView('home')} className="ml-16 mt-4 text-xl font-bold text-sky-700">‹ ກັບຄືນ</button>
            </header>

            <div className="px-4 pt-8 sm:px-6 lg:px-8">
              {orders.length === 0 && <EmptyBox>ຍັງບໍ່ມີອໍເດີ</EmptyBox>}

              <div className="space-y-4">
                {orders.map((order) => (
                  <article key={order.id} className="rounded-3xl bg-white/95 p-5 shadow-sm ring-1 ring-slate-200">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl text-slate-400">◷</span>
                        <div>
                          <p className="text-2xl font-black text-slate-800">{getOrderTime(order)} - ທ່ານສັ່ງ:</p>
                          <p className="text-sm font-semibold text-slate-400">#{order.orderNumber || order.id}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-xl bg-green-50 px-3 py-2 text-sm font-black text-green-600">{statusText[order.status] || order.status}</span>
                    </div>

                    <div className="space-y-3 border-l-2 border-slate-100 pl-6">
                      {(order.items || []).map((item) => (
                        <div key={item.id || `${item.menuItemId}-${item.name}`} className="flex items-start justify-between gap-4 text-lg">
                          <span className="min-w-0 text-slate-700">{item.quantity || 1} x {item.menuItem?.name || item.menuName || item.name || 'ເມນູ'}</span>
                          <span className="shrink-0 font-semibold text-slate-700">{shortMoney(item.price || item.unitPrice || 0)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="font-black text-slate-500">ລວມ</span>
                      <span className="text-xl font-black text-orange-600">{shortMoney(order.total || 0)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {cartQty > 0 && !cartOpen && view !== 'orders' && (
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-between rounded-3xl bg-slate-900 px-5 py-4 text-white shadow-2xl active:scale-[0.98] lg:max-w-xl"
          >
            <span className="font-black">🛒 {cartQty} ລາຍການ</span>
            <span className="font-black">{shortMoney(cartTotal)}</span>
          </button>
        )}

        {cartQty > 0 && cartOpen && (
          <CartPanel
            cart={cart}
            cartQty={cartQty}
            cartTotal={cartTotal}
            changeQty={changeQty}
            note={note}
            submit={submit}
            closeCart={() => setCartOpen(false)}
          />
        )}
      </div>
    </main>
  );
}
