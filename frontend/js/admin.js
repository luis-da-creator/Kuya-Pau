requireRole('admin');

const A = { role: 'admin' };
const LATE_FEE = 20;
const charts = {};
let bookingCache = new Map();
let barberCache = [];

// ---------- navigation ----------
const LOADERS = { dashboard: loadDashboard, bookings: loadBookings, barbers: loadBarbers, customers: loadCustomers, transactions: loadTransactions };
function show() {
  const v = LOADERS[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
  $$('.view').forEach((e) => e.classList.toggle('active', e.id === 'view-' + v));
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === v));
  LOADERS[v]().catch((e) => toast(e.message, true));
}
window.addEventListener('hashchange', show);
$('#logout').onclick = () => logout('admin');

// ---------- charts ----------
function draw(key, canvasId, type, labels, values, opts = {}) {
  const canvas = $('#' + canvasId);
  if (typeof Chart === 'undefined') { canvas.parentElement.innerHTML = '<p class="muted">Chart library did not load. Check your internet connection.</p>'; return; }
  if (charts[key]) charts[key].destroy();
  Chart.defaults.color = '#a89d90';
  Chart.defaults.borderColor = '#352d28';
  const horizontal = opts.horizontal;
  charts[key] = new Chart(canvas, {
    type,
    data: { labels, datasets: [{ label: opts.label || 'Income', data: values, backgroundColor: type === 'line' ? 'rgba(209,161,74,.18)' : '#d1a14a', borderColor: '#d1a14a', borderWidth: 2, fill: type === 'line', tension: 0.3, borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: false } },
      scales: { [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0, callback: (v) => (opts.money ? '₱' + v : v) } } },
    },
  });
}

// ---------- dashboard ----------
async function loadDashboard() {
  const d = await api('/admin/dashboard', A);
  $('#kpis').innerHTML = [
    ['Income today', peso(d.today)], ['This week', peso(d.thisWeek)], ['This month', peso(d.thisMonth)],
    ['Pending approvals', d.pending], ['Approved today', d.todayApproved], ['Active barbers', d.activeBarbers],
  ].map(([l, v]) => `<div class="kpi"><span>${l}</span><strong>${v}</strong></div>`).join('');
  draw('weekly', 'chart-weekly', 'bar', d.weekly.labels, d.weekly.values, { money: true });
  draw('monthly', 'chart-monthly', 'line', d.monthly.labels, d.monthly.values, { money: true });
}

// ---------- reservations ----------
function refundNote(b) {
  return { 'refund-due': `Refund due ${peso(b.downPayment)}`, refunded: 'Refunded', forfeited: 'Down payment kept' }[b.refundStatus] || '';
}

function bookingRow(b) {
  const id = esc(b._id);
  const btn = (act, text, cls) => `<button class="btn sm ${cls}" data-act="${act}" data-id="${id}">${text}</button>`;
  let actions = '';
  if (b.status === 'pending') actions = btn('approve', 'Approve', 'primary') + btn('reject', 'Reject', 'danger');
  else if (b.status === 'approved') actions = btn('complete', 'Complete', 'primary') + btn('forfeit', 'No-show', 'danger');
  else if (b.status === 'cancelled' && b.refundStatus === 'refund-due') actions = btn('refund', 'Mark refunded', '');
  return `<tr>
    <td><b>${esc(b.verificationCode)}</b></td>
    <td>${esc(b.customerName)}<div class="muted small">${esc(b.customerPhone)}</div></td>
    <td>${esc(b.serviceName)} <span class="muted">${peso(b.price)}</span>${b.notes ? `<div class="muted small">${esc(b.notes)}</div>` : ''}</td>
    <td>${esc(b.barberName)}</td>
    <td>${esc(fmtDate(b.date))}<div class="muted small">${fmtTime(b.time)}</div></td>
    <td>${peso(b.downPayment)}<div class="muted small">${esc(b.paymentMethod)} · ${esc(b.paymentRef)}</div></td>
    <td>${badge(b.status)}<div class="muted small">${esc(refundNote(b))}</div></td>
    <td>${actions}</td></tr>`;
}

async function loadBookings() {
  const params = { status: $('#b-status').value, date: $('#b-date').value, q: $('#b-q').value.trim() };
  const list = await api('/admin/bookings?' + qs(params), A);
  bookingCache = new Map(list.map((b) => [b._id, b]));
  $('#b-body').innerHTML = list.length ? list.map(bookingRow).join('') : '<tr><td colspan="8" class="muted center">No reservations found.</td></tr>';
}
$('#b-go').onclick = () => loadBookings().catch((e) => toast(e.message, true));
$('#b-status').onchange = $('#b-go').onclick;
$('#b-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#b-go').click(); });

let completing = null;
function updateBalance() {
  const b = bookingCache.get(completing);
  if (!b) return;
  const total = b.price - b.downPayment + ($('#c-late').checked ? LATE_FEE : 0) + Math.max(0, Number($('#c-extra').value) || 0);
  $('#c-balance').textContent = peso(total);
}
$('#c-late').onchange = updateBalance;
$('#c-extra').oninput = updateBalance;
$('#c-cancel').onclick = () => $('#dlg-complete').close();
$('#complete-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api(`/admin/bookings/${completing}/complete`, { ...A, method: 'POST', body: { late: $('#c-late').checked, extra: Number($('#c-extra').value) || 0 } });
    $('#dlg-complete').close();
    toast('Reservation completed.');
    loadBookings();
  } catch (err) { toast(err.message, true); }
});

$('#b-body').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, id } = b.dataset;
  const bk = bookingCache.get(id);
  if (act === 'complete') {
    completing = id;
    $('#c-info').textContent = `${bk.customerName} · ${bk.serviceName} · down payment ${peso(bk.downPayment)} paid`;
    $('#c-late').checked = false;
    $('#c-extra').value = 0;
    updateBalance();
    $('#dlg-complete').showModal();
    return;
  }
  const ask = {
    approve: `Approve this reservation? Confirm you received ${peso(bk.downPayment)} (${bk.paymentMethod} ref ${bk.paymentRef}).`,
    reject: 'Reject this reservation? Its slot will become free again.',
    forfeit: `Mark as no-show? The ${peso(bk.downPayment)} down payment is kept.`,
    refund: `Confirm you have sent the ${peso(bk.downPayment)} refund?`,
  }[act];
  if (!confirm(ask)) return;
  try {
    await api(`/admin/bookings/${id}/${act}`, { ...A, method: 'POST' });
    toast('Done.');
    loadBookings();
  } catch (err) { toast(err.message, true); }
});

// ---------- barbers ----------
function fillHourSelects() {
  const opts = Array.from({ length: 17 }, (_, i) => { const t = String(i + 6).padStart(2, '0') + ':00'; return `<option value="${t}">${fmtTime(t)}</option>`; }).join('');
  $('#bf-start').innerHTML = opts;
  $('#bf-end').innerHTML = opts;
  $('#bf-days').innerHTML = DAYS.map((d, i) => `<label class="check"><input type="checkbox" value="${i}"> ${d}</label>`).join('');
}
fillHourSelects();

async function loadBarbers() {
  barberCache = await api('/admin/barbers', A);
  $('#barber-body').innerHTML = barberCache.map((b) => `<tr>
    <td>${esc(b.name)}</td><td>${esc(b.username)}</td><td>${badge(b.status)}</td>
    <td>${esc(daysLabel(b.workDays))}</td><td>${fmtTime(b.shiftStart)} – ${fmtTime(b.shiftEnd)}</td>
    <td>${fmtClock(b.today && b.today.timeIn)}</td><td>${fmtClock(b.today && b.today.timeOut)}</td>
    <td><button class="btn sm" data-edit="${esc(b.id)}">Edit</button></td></tr>`).join('');
  const sel = $('#a-barber');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All barbers</option>' + barberCache.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
  sel.value = cur;
  await loadAttendance();
}

async function loadAttendance() {
  const rows = await api('/admin/attendance?' + qs({ from: $('#a-from').value, to: $('#a-to').value, barberId: $('#a-barber').value }), A);
  $('#att-body').innerHTML = rows.length
    ? rows.map((r) => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.barberName)}</td><td>${fmtClock(r.timeIn)}</td><td>${r.timeOut ? fmtClock(r.timeOut) : '<span class="muted">not yet</span>'}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted center">No records in this range.</td></tr>';
}
$('#a-go').onclick = () => loadAttendance().catch((e) => toast(e.message, true));

let editingId = null;
function openBarberForm(b) {
  editingId = b ? b.id : null;
  $('#bf-title').textContent = b ? 'Edit barber' : 'Add barber';
  $('#bf-name').value = b ? b.name : '';
  $('#bf-user').value = b ? b.username : '';
  $('#bf-pass').value = '';
  $('#bf-pass').placeholder = b ? 'Leave blank to keep current password' : 'At least 8 characters';
  $('#bf-pass').required = !b;
  $('#bf-status').value = b ? b.status : 'active';
  $('#bf-start').value = b ? b.shiftStart : '09:00';
  $('#bf-end').value = b ? b.shiftEnd : '21:00';
  const days = b ? b.workDays : [0, 1, 2, 3, 4, 5, 6];
  $$('#bf-days input').forEach((c) => (c.checked = days.includes(Number(c.value))));
  $('#bf-msg').textContent = '';
  $('#dlg-barber').showModal();
}
$('#add-barber').onclick = () => openBarberForm(null);
$('#bf-cancel').onclick = () => $('#dlg-barber').close();
$('#barber-body').addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit]');
  if (b) openBarberForm(barberCache.find((x) => x.id === b.dataset.edit));
});
$('#barber-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: $('#bf-name').value, username: $('#bf-user').value, password: $('#bf-pass').value, status: $('#bf-status').value,
    shiftStart: $('#bf-start').value, shiftEnd: $('#bf-end').value,
    workDays: $$('#bf-days input:checked').map((c) => Number(c.value)),
  };
  try {
    const d = await api(editingId ? `/admin/barbers/${editingId}` : '/admin/barbers', { ...A, method: editingId ? 'PUT' : 'POST', body });
    $('#dlg-barber').close();
    toast(d.affectedBookings ? `Saved. This barber still has ${d.affectedBookings} upcoming reservation(s). Check the Reservations tab.` : d.message);
    loadBarbers();
  } catch (err) { $('#bf-msg').textContent = err.message; }
});

// ---------- customers ----------
async function loadCustomers() {
  const d = await api('/admin/customers', A);
  draw('trend', 'chart-trend', 'bar', d.trending.map((t) => t.name), d.trending.map((t) => t.count), { horizontal: true, label: 'Completed' });
  $('#cust-body').innerHTML = d.customers.length
    ? d.customers.map((c) => `<tr><td>${esc(c.name)}<div class="muted small">${esc(c.lastService)} · ${esc(c.lastBarber)}</div></td>
        <td>${esc(c.phone)}<div class="muted small">${esc(c.email)}</div></td><td>${c.visits}</td><td>${esc(fmtDate(c.lastVisit))}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted center">No completed visits yet.</td></tr>';
}

// ---------- transactions ----------
const TYPE_LABEL = { downpayment: 'Down payment', balance: 'Balance', refund: 'Refund', forfeit: 'Forfeit' };
async function loadTransactions() {
  const d = await api('/admin/transactions?' + qs({ from: $('#t-from').value, to: $('#t-to').value, type: $('#t-type').value, q: $('#t-q').value.trim() }), A);
  $('#t-body').innerHTML = d.transactions.length
    ? d.transactions.map((t) => `<tr><td>${esc(fmtDateTime(t.createdAt))}</td><td>${esc(t.bookingCode)}</td><td>${esc(t.customerName)}</td>
        <td>${esc(t.serviceName)}</td><td>${esc(t.barberName)}</td><td>${esc(TYPE_LABEL[t.type] || t.type)}</td>
        <td class="right ${t.amount < 0 ? 'neg' : ''}">${t.amount < 0 ? '−' : ''}${peso(Math.abs(t.amount))}</td><td class="muted small">${esc(t.note)}</td></tr>`).join('')
    : '<tr><td colspan="8" class="muted center">No transactions found.</td></tr>';
  $('#t-total').textContent = peso(d.total);
}
$('#t-go').onclick = () => loadTransactions().catch((e) => toast(e.message, true));

show();
