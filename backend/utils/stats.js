const { addDays, weekStart } = require('./time');

const H8 = 8 * 3600e3;
const labelDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const labelMonth = (m) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// Buckets ledger rows into the last 8 weeks (Mon-start) and last 12 months, Philippine time.
function buildIncome(txs) {
  const nowPh = new Date(Date.now() + H8);
  const today = nowPh.toISOString().slice(0, 10);
  const curWeek = weekStart(today);
  const curMonth = today.slice(0, 7);

  const weeks = [];
  for (let i = 7; i >= 0; i--) weeks.push(addDays(curWeek, -7 * i));
  const months = [];
  for (let i = 11; i >= 0; i--) {
    months.push(new Date(Date.UTC(nowPh.getUTCFullYear(), nowPh.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }

  const w = Object.fromEntries(weeks.map((k) => [k, 0]));
  const m = Object.fromEntries(months.map((k) => [k, 0]));
  let todayTotal = 0;

  for (const t of txs) {
    const day = new Date(t.createdAt.getTime() + H8).toISOString().slice(0, 10);
    if (day === today) todayTotal += t.amount;
    const wk = weekStart(day);
    if (wk in w) w[wk] += t.amount;
    if (day.slice(0, 7) in m) m[day.slice(0, 7)] += t.amount;
  }

  return {
    weekly: { labels: weeks.map(labelDay), values: weeks.map((k) => w[k]) },
    monthly: { labels: months.map(labelMonth), values: months.map((k) => m[k]) },
    today: todayTotal,
    thisWeek: w[curWeek],
    thisMonth: m[curMonth],
  };
}

module.exports = { buildIncome };
