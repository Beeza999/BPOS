import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { api } from './lib/api.js';
import { notifySocketAuthChanged } from './lib/socket.js';
import SocketProvider from './providers/SocketProvider.jsx';
import Admin from './pages/Admin.jsx';
import Customer from './pages/Customer.jsx';
import Kitchen from './pages/Kitchen.jsx';
import Cashier from './pages/Cashier.jsx';

const CLOSED_TIMEOUT_MS = 5 * 60 * 1000; // 5 นาที
const CLOSED_AT_KEY = 'bipos_closed_at';
const NEXT_PATH_KEY = 'bipos_next_path';

const AUTH_KEYS = [
  'bipos_token',
  'bipos_user',

  'bipos_admin_token',
  'bipos_admin_user',

  'bipos_cashier_token',
  'bipos_cashier_user',

  'bipos_kitchen_token',
  'bipos_kitchen_user',

  'bipos_last_active',
];

function clearAllSessions() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem(NEXT_PATH_KEY);
}

function markClosedTime() {
  localStorage.setItem(CLOSED_AT_KEY, String(Date.now()));
}

function clearClosedTime() {
  localStorage.removeItem(CLOSED_AT_KEY);
}

function wasClosedTooLong() {
  const closedAt = Number(localStorage.getItem(CLOSED_AT_KEY) || 0);
  if (!closedAt) return false;
  return Date.now() - closedAt > CLOSED_TIMEOUT_MS;
}

function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    if (!value || value === 'undefined') return null;
    return JSON.parse(value);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function getAreaFromPath(pathname) {
  if (pathname === '/login') {
    const nextPath = sessionStorage.getItem(NEXT_PATH_KEY) || '/';
    if (nextPath.startsWith('/customer')) return 'customer';
    if (nextPath.startsWith('/cashier')) return 'cashier';
    if (nextPath.startsWith('/kitchen')) return 'kitchen';
    return 'admin';
  }

  if (pathname.startsWith('/customer')) return 'customer';
  if (pathname.startsWith('/cashier')) return 'cashier';
  if (pathname.startsWith('/kitchen')) return 'kitchen';
  return 'admin';
}

function getUserForArea(area) {
  if (area === 'admin') return readJson('bipos_admin_user');
  if (area === 'cashier') return readJson('bipos_cashier_user');
  if (area === 'kitchen') return readJson('bipos_kitchen_user');
  return null;
}

function hasTokenForArea(area) {
  if (area === 'admin') return Boolean(localStorage.getItem('bipos_admin_token'));
  if (area === 'cashier') return Boolean(localStorage.getItem('bipos_cashier_token'));
  if (area === 'kitchen') return Boolean(localStorage.getItem('bipos_kitchen_token'));
  return false;
}

function isAllowedForArea(area, role) {
  if (area === 'admin') return ['OWNER', 'ADMIN'].includes(role);
  if (area === 'cashier') return role === 'CASHIER';
  if (area === 'kitchen') return role === 'KITCHEN';
  return false;
}

function areaLabel(area) {
  if (area === 'admin') return 'ແອດມິນ';
  if (area === 'cashier') return 'ແຄດເຊຍ';
  if (area === 'kitchen') return 'ຫ້ອງຄົວ';
  return 'BIPOS';
}

function saveLoginForArea(area, token, user) {
  if (area === 'admin') {
    localStorage.setItem('bipos_admin_token', token);
    localStorage.setItem('bipos_admin_user', JSON.stringify(user));
    return;
  }

  if (area === 'cashier') {
    localStorage.setItem('bipos_cashier_token', token);
    localStorage.setItem('bipos_cashier_user', JSON.stringify(user));
    return;
  }

  if (area === 'kitchen') {
    localStorage.setItem('bipos_kitchen_token', token);
    localStorage.setItem('bipos_kitchen_user', JSON.stringify(user));
  }
}

function Login({ area, onLogin }) {
  const [username, setຊື່ຜູ້ໃຊ້] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: { username, pin },
      });

      const role = result.user?.role;

      if (!isAllowedForArea(area, role)) {
        setErr(`ຜູ້ໃຊ້ນີ້ບໍ່ມີສິດເຂົ້າໜ້າ ${areaLabel(area)}`);
        return;
      }

      const nextPath = sessionStorage.getItem(NEXT_PATH_KEY) || '/';

      // สำคัญ: ไม่ล้าง session อื่น เพื่อให้ admin/cashier/kitchen login พร้อมกันได้
      saveLoginForArea(area, result.token, result.user);
      clearClosedTime();

      onLogin(result.user);
      notifySocketAuthChanged();

      sessionStorage.removeItem(NEXT_PATH_KEY);
      window.history.replaceState(null, '', nextPath);
      window.dispatchEvent(new Event('popstate'));
    } catch (error) {
      setErr(error.message || 'ລັອກອິນບໍ່ສຳເລັດ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <form onSubmit={submit} className="card w-full space-y-3">
        <p className="text-sm font-semibold text-orange-600">BIPOS {areaLabel(area)}</p>
        <h1 className="text-2xl font-bold">ເຂົ້າລະບົບ</h1>

        <input
          className="input w-full"
          value={username}
          onChange={(e) => setຊື່ຜູ້ໃຊ້(e.target.value)}
          placeholder="ຊື່ຜູ້ໃຊ້"
          autoComplete="username"
        />

        <input
          className="input w-full"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          type="password"
          autoComplete="current-password"
        />

        <button
          type="submit"
          className="btn w-full bg-orange-500 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'ກຳລັງເຂົ້າລະບົບ...' : 'ເຂົ້າລະບົບ'}
        </button>

        {err && <p className="text-sm font-bold text-red-500">{err}</p>}

      </form>
    </main>
  );
}

function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const area = getAreaFromPath(currentPath);

  const [user, setUser] = useState(() => {
    try {
      if (wasClosedTooLong()) {
        clearAllSessions();
        clearClosedTime();
        return null;
      }

      clearClosedTime();

      const firstArea = getAreaFromPath(window.location.pathname);
      if (firstArea === 'customer') return null;
      if (!hasTokenForArea(firstArea)) return null;

      return getUserForArea(firstArea);
    } catch {
      clearAllSessions();
      clearClosedTime();
      return null;
    }
  });

  useEffect(() => {
    function handlePopState() {
      const nextPath = window.location.pathname;
      setCurrentPath(nextPath);

      const nextArea = getAreaFromPath(nextPath);
      if (nextArea === 'customer') {
        setUser(null);
        return;
      }

      if (hasTokenForArea(nextArea)) {
        setUser(getUserForArea(nextArea));
      } else {
        setUser(null);
      }
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    function handlePageHide() {
      markClosedTime();
    }

    function handleBeforeUnload() {
      markClosedTime();
    }

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // หน้าลูกค้า QR เข้าได้เลย ไม่ต้อง login
  if (area === 'customer') {
    return <Customer />;
  }

  // ต้อง login เฉพาะ area นั้น ๆ: admin/cashier/kitchen แยกกัน ไม่ชนกัน
  if (!hasTokenForArea(area) || !user) {
    if (currentPath !== '/login') {
      sessionStorage.setItem(
        NEXT_PATH_KEY,
        window.location.pathname + window.location.search
      );

      window.history.replaceState(null, '', '/login');
      window.dispatchEvent(new Event('popstate'));
    }

    return <Login area={area} onLogin={setUser} />;
  }

  if (currentPath === '/login') {
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new Event('popstate'));
    return null;
  }

  if (area === 'kitchen') {
    return <Kitchen />;
  }

  if (area === 'cashier') {
    return <Cashier />;
  }

  return <Admin user={user} />;
}

createRoot(document.getElementById('root')).render(
  <SocketProvider>
    <App />
  </SocketProvider>,
);
