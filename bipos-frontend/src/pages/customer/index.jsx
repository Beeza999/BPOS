import React, { useEffect, useMemo, useState } from 'react';
import { api, money } from '../../lib/api.js';
import { Tab, Empty } from './components/CustomerComponents.jsx';
import { joinTableRoom } from '../../lib/socket.js';
import { useRealtimeReload } from '../../hooks/useRealtimeReload.js';

const statusText = { NEW:'ສັ່ງແລ້ວ', ACCEPTED:'ຮັບອໍເດີແລ້ວ', COOKING:'ກຳລັງເຮັດ', READY:'ພ້ອມແລ້ວ', SERVED:'ເສີບແລ້ວ', CANCELLED:'ຍົກເລີກ' };

export default function Customer() {
  const params = new URLSearchParams(window.location.search);
  const tableTokenFromUrl = params.get('t') || '';
  const legacyQr = params.get('qr') || '';
  const [table,setTable] = useState(null);
  const [tableToken,setTableToken] = useState(tableTokenFromUrl);
  const [menus,setMenus] = useState([]);
  const [cats,setCats] = useState([]);
  const [cat,setCat] = useState('recommended');
  const [cart,setCart] = useState([]);
  const [orders,setOrders] = useState([]);
  const [q,setQ] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  async function load() {
    try {
      setLoading(true); setError('');
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
      if (nextTable?.id && nextToken) setOrders(await api(`/api/orders/table/${nextTable.id}?tableToken=${encodeURIComponent(nextToken)}`));
    } catch (err) {
      console.error(err);
      setError(err.message || 'ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ');
    }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
  }, []);

  useRealtimeReload(load, {
    events: ['order:created', 'order:status', 'order:cancelled', 'kitchen:ticket-status', 'menu:changed'],
  });

  const filtered = useMemo(() => menus.filter(m => {
    const categoryOk = cat === 'all' || (cat === 'recommended' ? m.isRecommended : m.categoryId === cat);
    const term = q.trim().toLowerCase();
    const searchOk = !term || `${m.name} ${m.description || ''}`.toLowerCase().includes(term);
    return categoryOk && searchOk;
  }), [menus, cat, q]);
  const cartQty = cart.reduce((s,i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s,i) => s + i.price * i.quantity, 0);

  function add(menu) {
    const alreadyInCart = cart.some(i => i.menuItemId === menu.id);
    const alreadyOrdered = orders.some(o =>
      o.status !== 'CANCELLED' &&
      (o.items || []).some(item => item.menuItemId === menu.id && item.status !== 'CANCELLED')
    );

    if (alreadyInCart || alreadyOrdered) {
      const ok = window.confirm(`ເມນູ "${menu.name}" ຖືກສັ່ງແລ້ວ. ຕ້ອງການສັ່ງເພີ່ມອີກບໍ?`);
      if (!ok) return;
    }

    const index = cart.findIndex(i => i.menuItemId === menu.id && !i.note);
    if (index >= 0) setCart(cart.map((i, idx) => idx === index ? { ...i, quantity: i.quantity + 1 } : i));
    else setCart([...cart, { menuItemId: menu.id, name: menu.name, price: menu.price, quantity: 1, note: '' }]);
  }
  function changeQty(index, amount) {
    const next = cart.map((i, idx) => idx === index ? { ...i, quantity: i.quantity + amount } : i).filter(i => i.quantity > 0);
    setCart(next);
  }
  function note(index, value) { setCart(cart.map((i, idx) => idx === index ? { ...i, note: value } : i)); }
  async function submit() {
    if (!table?.id || !cart.length || !tableToken) return;
    try {
      const order = await api('/api/orders', { method:'POST', body:{ tableToken, items: cart } });
      setCart([]); setOrders([order, ...orders]); alert('ສົ່ງອໍເດີແລ້ວ');
    } catch (err) { alert('ສົ່ງອໍເດີບໍ່ສຳເລັດ: ' + err.message); }
  }
  async function callStaff() {
    await api('/api/orders/call-staff', {
      method:'POST',
      body:{ tableToken, tableName: table?.name || '', message: 'ລູກຄ້າເອີ້ນພະນັກງານ' },
    }).catch(()=>null);
    alert('ເອີ້ນພະນັກງານແລ້ວ');
  }

  return <main className="mx-auto min-h-screen max-w-md bg-white shadow-xl">
    <section className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur"><div className="px-4 pb-3 pt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-slate-500">ໂຕະຂອງທ່ານ</p><h1 className="text-xl font-bold">ໂຕະ {table?.name || '...'}</h1></div><button className="rounded-full bg-orange-50 px-3 py-2 text-sm font-bold text-orange-600" onClick={callStaff}>ເອີ້ນພະນັກງານ</button></div><div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2"><span className="text-slate-400">🔍</span><input className="w-full bg-transparent text-sm outline-none" placeholder="ຄົ້ນຫາເມນູ" value={q} onChange={e=>setQ(e.target.value)} /></div></div></section>
    <section className="px-4 pt-4"><div className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 p-4 text-white shadow-lg"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl">🍜</div><div><h2 className="text-lg font-bold">BIPOS</h2><p className="text-sm text-white/80">ອາຫານ · ເຄື່ອງດື່ມ · ຂອງຫວານ</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-2xl bg-white/15 p-2"><p className="font-bold">15-25</p><p className="text-white/75">ນາທີ</p></div><div className="rounded-2xl bg-white/15 p-2"><p className="font-bold">4.8</p><p className="text-white/75">ຄະແນນ</p></div><div className="rounded-2xl bg-white/15 p-2"><p className="font-bold">ເປີດຢູ່</p><p className="text-white/75">ມື້ນີ້</p></div></div></div></section>
    {error && <div className="m-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}
    <section className="sticky top-[105px] z-20 bg-white px-4 py-4"><div className="flex gap-2 overflow-x-auto pb-1"><Tab active={cat==='all'} onClick={()=>setCat('all')}>ທັງໝົດ</Tab><Tab active={cat==='recommended'} onClick={()=>setCat('recommended')}>ແນະນຳ</Tab>{cats.map(c => <Tab key={c.id} active={cat===c.id} onClick={()=>setCat(c.id)}>{c.name}</Tab>)}</div></section>
    <section className="px-4"><div className="flex items-center justify-between rounded-3xl border border-amber-100 bg-amber-50 p-4"><div><p className="text-sm font-bold text-amber-700">ໂປຣໂມຊັນມື້ນີ້</p><p className="mt-1 text-xs text-amber-600">ສັ່ງຄົບ 300,000 ກີບ ຮັບຟຣີ ຊາເຢັນ 1 ແກ້ວ</p></div><div className="text-3xl">🥤</div></div></section>
    <section className="px-4 pb-48 pt-5"><h3 className="mb-3 text-lg font-bold">ເມນູ</h3>{loading && <Empty>ກຳລັງໂຫຼດ...</Empty>}{!loading && filtered.length===0 && <Empty>ບໍ່ພົບເມນູ</Empty>}{filtered.map(m => <article className="mb-4 flex gap-3 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm" key={m.id}><div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">{m.imageUrl ? <img alt={m.name} className="h-full w-full object-cover" src={m.imageUrl} /> : <div className="flex h-full w-full items-center justify-center text-3xl">🍽️</div>}</div><div className="flex flex-1 flex-col"><h4 className="font-bold">{m.name}</h4><p className="mt-1 line-clamp-2 text-xs text-slate-500">{m.description || '-'}</p><div className="mt-auto flex items-center justify-between"><p className="text-lg font-bold text-orange-600">{money(m.price)}</p><button className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-xl font-bold text-white shadow" onClick={()=>add(m)}>+</button></div></div></article>)}
      <h3 className="mt-6 text-lg font-bold">ອໍເດີຂອງຂ້ອຍ</h3>{orders.length===0 && <Empty>ຍັງບໍ່ມີອໍເດີ</Empty>}{orders.map(o => <div className="my-2 rounded-2xl bg-slate-50 p-3" key={o.id}><div className="flex justify-between"><b>#{o.orderNumber}</b><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">{statusText[o.status] || o.status}</span></div><p className="mt-2 font-bold text-orange-600">{money(o.total)}</p></div>)}</section>
    {cart.length>0 && <section className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur"><div className="mb-3 max-h-48 overflow-y-auto space-y-2">{cart.map((i,index)=><div className="rounded-2xl bg-slate-50 p-3" key={index}><div className="flex items-center justify-between"><div><p className="font-bold">{i.name}</p><p className="text-xs text-slate-500">{money(i.price)}</p></div><div className="flex items-center rounded-full bg-white p-1"><button className="h-8 w-8 rounded-full bg-slate-100 font-bold" onClick={()=>changeQty(index,-1)}>-</button><span className="w-9 text-center font-bold">{i.quantity}</span><button className="h-8 w-8 rounded-full bg-slate-900 font-bold text-white" onClick={()=>changeQty(index,1)}>+</button></div></div><input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none" placeholder="ໝາຍເຫດ ເຊັ່ນ ບໍ່ເຜັດ" value={i.note} onChange={e=>note(index,e.target.value)} /></div>)}</div><button className="flex w-full items-center justify-between rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white shadow-xl" onClick={submit}><span>ສົ່ງອໍເດີ {cartQty} ລາຍການ</span><span>{money(cartTotal)}</span></button></section>}
  </main>;
}
