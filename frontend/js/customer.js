requireRole('customer');

let info = null;
let selectedTime = null;
const VIEWS = ['reserve', 'services', 'about', 'description', 'contact', 'mine'];

// ---------- navigation ----------
function show() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'reserve';
  $$('.view').forEach((e) => e.classList.toggle('active', e.id === 'view-' + v));
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === v));
  if (v === 'mine') loadMine();
  if (v === 'description') loadSuggestion();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', show);
$('#logout').onclick = () => logout('customer');

// ---------- render shop info ----------
function renderInfo() {
  const { shop, services, barbers, payment } = info;

    const GROUPS = [
    { title: "Men's Haircuts", match: (s) => s.category === 'haircut' && s.gender !== 'women' },
    { title: "Women's Haircuts", match: (s) => s.category === 'haircut' && s.gender === 'women' },
    { title: 'Braids', match: (s) => s.category === 'braids' },
  ];
  const svcCard = (s) => `
    <article class="card svc">
      <img src="${esc(s.image)}" alt="${esc(s.name)}" loading="lazy">
      <div class="body">
        <h3>${esc(s.name)}</h3>
        <div class="price">${peso(s.price)}</div>
        <p class="muted small">${esc(s.description)}</p>
        <button class="btn primary" data-reserve="${esc(s.id)}">Reserve this</button>
      </div>
    </article>`;

  $('#svc-grid').innerHTML = GROUPS.map((g) => {
    const list = services.filter(g.match);
    return list.length ? `<h2 style="grid-column:1/-1;margin:14px 0 0">${g.title}</h2>` + list.map(svcCard).join('') : '';
  }).join('');

  $('#f-service').innerHTML = '<option value="">Choose a service…</option>' + GROUPS.map((g) => {
    const list = services.filter(g.match);
    return list.length
      ? `<optgroup label="${g.title}">` + list.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} · ${peso(s.price)}</option>`).join('') + '</optgroup>'
      : '';
  }).join('');
  
  $('#f-barber').innerHTML = '<option value="">Choose a barber…</option>' +
    barbers.filter((b) => b.status === 'active').map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');

  $('#about-info').innerHTML = `
    <h3>${esc(shop.name)}</h3>
    <p><b>Location</b><br>${esc(shop.address)}</p>
    <p><b>Shop hours</b><br>${esc(shop.hours)}</p>
    <p><b>Since</b><br>${esc(shop.since)}</p>`;
  $('#about-barbers').innerHTML = barbers.map((b) => `
    <tr><td>${esc(b.name)}</td><td>${badge(b.status)}</td><td>${esc(daysLabel(b.workDays))}</td>
    <td>${fmtTime(b.shiftStart)} – ${fmtTime(b.shiftEnd)}</td></tr>`).join('');

  $('#quote').textContent = '“' + shop.quote + '”';

  $('#contact-card').innerHTML = `
    <p><b>Facebook</b><br><a href="${esc(shop.facebook)}" target="_blank" rel="noopener">${esc(shop.facebook)}</a></p>
    <p><b>TikTok</b><br><a href="${esc(shop.tiktok)}" target="_blank" rel="noopener">${esc(shop.tiktok)}</a></p>
    <p><b>Visit us</b><br>${esc(shop.address)}</p>`;

  $('#pay-help').textContent = payment.number
    ? `Send the 50% down payment via ${payment.method} to ${payment.number} (${payment.accountName}), then enter the reference number below.`
    : `Pay the 50% down payment via ${payment.method}, then enter the reference number below.`;

  renderSummary();
}

async function loadSuggestion() {
  try {
    const s = await api('/customer/suggestion', { role: 'customer' });
    $('#suggest').innerHTML = s
      ? `<h3>Suggested for you</h3>
         <img src="${esc(s.image)}" alt="${esc(s.name)}" style="width:100%;border-radius:10px;margin-bottom:10px">
         <p><b>${esc(s.name)}</b> · ${peso(s.price)}<br><span class="muted">${esc(s.reason)}</span></p>
         <button class="btn primary" data-reserve="${esc(s.id)}">Reserve this</button>`
      : '<h3>Suggested for you</h3><p class="muted">Check out our services.</p>';
  } catch (e) { /* suggestion is optional */ }
}

// ---------- reservation form ----------
const selectedService = () => info.services.find((s) => s.id === $('#f-service').value);

function renderSummary() {
  const s = selectedService();
  const { rules } = info;
  const down = s ? Math.round(s.price * rules.downPaymentRate) : 0;
  $('#summary').innerHTML = `
    <h3>Your total</h3>
    <div><span>Service</span><b>${s ? esc(s.name) : '—'}</b></div>
    <div><span>Price</span><b>${s ? peso(s.price) : '—'}</b></div>
    <div><span>Pay now (50%)</span><b>${s ? peso(down) : '—'}</b></div>
    <div><span>Balance at the shop</span><b>${s ? peso(s.price - down) : '—'}</b></div>
    <p class="muted small" style="margin-top:12px">
      Late arrival adds ${peso(rules.lateFee)} to your balance.<br>
      Cancel at least ${rules.cancelHours} hours before your schedule for a refund. Later cancellations and no-shows are not refunded.
    </p>`;
  const braids = s && s.name.toLowerCase().includes('braid');
  $('#notes-hint').textContent = braids ? '(required: braid style and extensions)' : '(optional)';
  $('#f-notes').required = !!braids;
}

async function loadSlots() {
  selectedTime = null;
  const barberId = $('#f-barber').value, date = $('#f-date').value;
  const box = $('#slots');
  if (!barberId || !date) { box.innerHTML = '<span class="muted small">Choose a barber and a date.</span>'; return; }
  box.innerHTML = '<span class="muted small">Loading…</span>';
  try {
    const d = await api('/customer/availability?' + qs({ barberId, date }), { role: 'customer' });
    if (!d.slots.length) { box.innerHTML = `<span class="muted small">${esc(d.reason || 'No slots.')}</span>`; return; }
    box.innerHTML = d.slots.map((s) => {
      const ok = s.state === 'available';
      return `<button type="button" class="slot" data-time="${esc(s.time)}" ${ok ? '' : 'disabled'}
        title="${ok ? '' : s.state === 'past' ? 'Passed' : 'Booked'}">${fmtTime(s.time)}</button>`;
    }).join('');
  } catch (e) { box.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
}

$('#f-service').addEventListener('change', renderSummary);
$('#f-barber').addEventListener('change', loadSlots);
$('#f-date').addEventListener('change', loadSlots);
$('#slots').addEventListener('click', (e) => {
  const b = e.target.closest('.slot');
  if (!b || b.disabled) return;
  selectedTime = b.dataset.time;
  $$('#slots .slot').forEach((x) => x.classList.toggle('sel', x === b));
});

$('#res-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#res-msg');
  msg.textContent = '';
  const body = {
    serviceId: $('#f-service').value, barberId: $('#f-barber').value, date: $('#f-date').value,
    time: selectedTime, notes: $('#f-notes').value, paymentRef: $('#f-ref').value.trim(),
  };
  if (!body.serviceId) return (msg.textContent = 'Please choose a service.');
  if (!body.barberId) return (msg.textContent = 'Please choose a barber.');
  if (!body.date) return (msg.textContent = 'Please choose a date.');
  if (!body.time) return (msg.textContent = 'Please choose a time slot.');
  if (selectedService().name.toLowerCase().includes('braid') && body.notes.trim().length < 3) {
    return (msg.textContent = 'For braids, describe the braid style and whether you need extensions.');
  }
  if (!body.paymentRef) return (msg.textContent = 'Please enter your payment reference number.');

  const btn = $('#res-submit');
  btn.disabled = true;
  try {
    const d = await api('/customer/bookings', { method: 'POST', body, role: 'customer' });
    const sent = d.notified.email || d.notified.sms;
    $('#done-msg').textContent = sent
      ? 'Your verification code was sent to your email/SMS. It is also saved under My Reservations. The shop will confirm your slot once your down payment is verified.'
      : 'We could not send the code by email/SMS right now. You can find it under My Reservations. The shop will confirm your slot once your down payment is verified.';
    $('#done').showModal();
    $('#f-ref').value = '';
    $('#f-notes').value = '';
    loadSlots();
  } catch (err) {
    msg.textContent = err.message;
    loadSlots();
  } finally { btn.disabled = false; }
});
$('#done-ok').onclick = () => { $('#done').close(); location.hash = '#mine'; };

// Reserve buttons on the Services / Description views jump to the form with that service selected.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-reserve]');
  if (!b) return;
  $('#f-service').value = b.dataset.reserve;
  renderSummary();
  location.hash = '#reserve';
});

// ---------- my reservations ----------
async function loadMine() {
  const box = $('#mine-list');
  try {
    const list = await api('/customer/bookings', { role: 'customer' });
    if (!list.length) { box.innerHTML = '<p class="muted">You have no reservations yet.</p>'; return; }
    box.innerHTML = list.map((b) => {
      const open = b.status === 'pending' || b.status === 'approved';
      const refund = { 'refund-due': 'Refund due', refunded: 'Refunded', forfeited: 'Down payment not refunded' }[b.refundStatus] || '';
      return `<div class="card book">
        <div>
          <h3>${esc(b.serviceName)} ${badge(b.status)}</h3>
          <div>${esc(fmtDate(b.date))} · ${fmtTime(b.time)} · with ${esc(b.barberName)}</div>
          <div class="muted small">Price ${peso(b.price)} · Down payment ${peso(b.downPayment)} · Balance at shop ${peso(b.balance)}${b.lateFee ? ` (incl. ${peso(b.lateFee)} late fee)` : ''}</div>
          ${b.notes ? `<div class="muted small">Notes: ${esc(b.notes)}</div>` : ''}
          ${refund ? `<div class="small">${esc(refund)}</div>` : ''}
        </div>
        <div class="right">
          <div class="muted small">Verification code</div>
          <div class="code">${esc(b.verificationCode)}</div>
          ${open ? `<button class="btn danger sm" data-cancel="${esc(b.id)}" data-sched="${esc(b.scheduledAt)}" data-status="${esc(b.status)}" style="margin-top:8px">Cancel</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

$('#mine-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-cancel]');
  if (!b) return;
  const hours = (new Date(b.dataset.sched) - Date.now()) / 36e5;
  const late = b.dataset.status === 'approved' && hours < info.rules.cancelHours;
  const ask = late
    ? `This is less than ${info.rules.cancelHours} hours before your schedule. Your down payment will NOT be refunded. Cancel anyway?`
    : 'Cancel this reservation?';
  if (!confirm(ask)) return;
  try {
    const d = await api(`/customer/bookings/${b.dataset.cancel}/cancel`, { method: 'POST', role: 'customer' });
    toast(d.message);
    loadMine();
  } catch (err) { toast(err.message, true); }
});

// ---------- start ----------
(async () => {
  const date = $('#f-date');
  date.min = todayPH();
  try {
    const [i, me] = await Promise.all([api('/public/info'), api('/auth/me', { role: 'customer' })]);
    info = i;
    date.max = addDaysStr(todayPH(), info.rules.maxAdvanceDays);
    $('#who').textContent = me.name;
    renderInfo();
    show();
  } catch (e) { toast(e.message, true); }
})();
