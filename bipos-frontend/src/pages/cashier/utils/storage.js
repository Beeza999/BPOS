import { CASHIER_SHIFT_CACHE_KEY } from "../constants.js";

export function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    if (!value || value === "undefined") return null;
    return JSON.parse(value);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function readCachedShift() {
  try {
    const raw = localStorage.getItem(CASHIER_SHIFT_CACHE_KEY);
    if (!raw || raw === "undefined") return null;
    const shift = JSON.parse(raw);
    if (String(shift?.status || "").toUpperCase() !== "OPEN") return null;
    return { ...shift, status: "OPEN", isLocalCached: true };
  } catch {
    localStorage.removeItem(CASHIER_SHIFT_CACHE_KEY);
    return null;
  }
}

export function saveCachedShift(shift) {
  if (!shift || String(shift.status || "").toUpperCase() !== "OPEN") return;
  localStorage.setItem(CASHIER_SHIFT_CACHE_KEY, JSON.stringify({ ...shift, status: "OPEN" }));
}

export function clearCachedShift() {
  localStorage.removeItem(CASHIER_SHIFT_CACHE_KEY);
}
