// All shop dates/times are Philippine time (UTC+8, no DST).
const H8 = 8 * 3600e3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const phToday = () => new Date(Date.now() + H8).toISOString().slice(0, 10);
const phDateOf = (d) => new Date(new Date(d).getTime() + H8).toISOString().slice(0, 10);
const scheduledAt = (date, time) => new Date(`${date}T${time}:00+08:00`);
const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekStart(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
}

function isRealDate(date) {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T12:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === date;
}

// Hourly slots: ("09:00", "21:00") -> 09:00 ... 20:00
function slotTimes(start, end) {
  const out = [];
  for (let h = parseInt(start, 10); h < parseInt(end, 10); h++) out.push(String(h).padStart(2, '0') + ':00');
  return out;
}

function to12h(t) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

module.exports = { DATE_RE, phToday, phDateOf, scheduledAt, weekday, addDays, weekStart, isRealDate, slotTimes, to12h };
