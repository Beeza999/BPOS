const API_BASE = import.meta.env.VITE_API_URL || "https://bpos.onrender.com";

export function getAuthToken() {
  const path = window.location.pathname;

  if (path.startsWith('/customer')) return '';
  if (path.startsWith('/cashier')) return localStorage.getItem('bipos_cashier_token') || '';
  if (path.startsWith('/kitchen')) return localStorage.getItem('bipos_kitchen_token') || '';

  return localStorage.getItem('bipos_admin_token') || '';
}

export async function api(path, options = {}) {
  const token = path === '/api/auth/login' ? '' : getAuthToken();

  const headers = {
    ...(options.headers || {}),
  };

  let body = options.body;

  if (body instanceof FormData) {
    // FormData ບໍ່ຕ້ອງຕັ້ງ Content-Type ເອງ
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';

    if (typeof body !== 'string') {
      body = JSON.stringify(body);
    }
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && (data?.error || data?.message)
        ? data.error || data.message
        : `ການຮ້ອງຂໍບໍ່ສຳເລັດ: ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export function money(value) {
  return new Intl.NumberFormat('lo-LA', {
    style: 'currency',
    currency: 'LAK',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function customerUrl(table) {
  const base = window.location.origin;
  if (typeof table === 'string') return `${base}/customer?qr=${encodeURIComponent(table)}`;
  if (table?.tableToken) return `${base}/customer?t=${encodeURIComponent(table.tableToken)}`;
  if (table?.qrUrl) return table.qrUrl.startsWith('http') ? table.qrUrl : `${base}${table.qrUrl}`;
  if (table?.qrCode) return `${base}/customer?qr=${encodeURIComponent(table.qrCode)}`;
  return `${base}/customer`;
}
