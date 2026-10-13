// Shared helpers for every page.
const LOGIN_PAGE = { customer: 'login.html', admin: 'admin-login.html', barber: 'barber-login.html' };
const tokenKey = (role) => `kp_token_${role}`;
const getToken = (role) => { try { return localStorage.getItem(tokenKey(role)); } catch { return null; } };
const setToken = (role, t) => localStorage.setItem(tokenKey(role), t);

async function api(path, { method = 'GET', body, role } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = role && getToken(role);
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && role) {
    localStorage.removeItem(tokenKey(role));
    location.href = LOGIN_PAGE[role];
    throw new Error(data.message || 'Please log in.');
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// Escape anything that came from a user before putting it in innerHTML.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtClock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : '—');
const todayPH = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const addDaysStr = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysLabel = (days) => (days.length === 7 ? 'Every day' : days.map((d) => DAYS[d]).join(', '));
const badge = (s) => `<span class="badge b-${esc(s)}">${esc(s)}</span>`;

function toast(msg, isErr = false) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = isErr ? 'err' : '';
  t.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.style.display = 'none'), 4200);
}

function requireRole(role) { if (!getToken(role)) location.href = LOGIN_PAGE[role]; }
function logout(role) { localStorage.removeItem(tokenKey(role)); location.href = LOGIN_PAGE[role]; }
