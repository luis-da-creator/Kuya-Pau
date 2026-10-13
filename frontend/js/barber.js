requireRole('barber');

const B = { role: 'barber' };
$('#logout').onclick = () => logout('barber'); // logging out does NOT record a time out

async function loadOverview() {
  const d = await api('/barber/overview', B);
  $('#b-name').textContent = d.barber.name;
  const a = d.attendance;
  $('#t-in').textContent = a ? fmtClock(a.timeIn) : '—';
  $('#t-out').textContent = a && a.timeOut ? fmtClock(a.timeOut) : '—';
  $('#btn-timeout').disabled = !a || !!a.timeOut;
}

$('#btn-timeout').onclick = async () => {
  if (!confirm('Time out for today?')) return;
  try {
    await api('/barber/time-out', { ...B, method: 'POST' });
    toast('Timed out. Thank you!');
    loadOverview();
  } catch (e) { toast(e.message, true); }
};

async function loadSchedule() {
  const d = await api('/barber/schedule?' + qs({ date: $('#s-date').value }), B);
  const label = { available: 'Free', pending: 'Pending', approved: 'Booked', past: 'Passed' };
  $('#slot-list').innerHTML = d.slots.length
    ? `<div class="table-wrap"><table><tbody>${d.slots.map((s) => `<tr>
        <td style="width:90px"><b>${fmtTime(s.time)}</b></td>
        <td>${s.booking ? `${esc(s.booking.customerName)}<div class="muted small">${esc(s.booking.serviceName)}${s.booking.notes ? ' · ' + esc(s.booking.notes) : ''}</div>` : `<span class="muted">${label[s.state]}</span>`}</td>
        <td>${s.booking ? badge(s.state) : ''}</td></tr>`).join('')}</tbody></table></div>`
    : `<p class="muted">${esc(d.reason || 'No slots for this day.')}</p>`;
}
$('#s-date').addEventListener('change', () => loadSchedule().catch((e) => toast(e.message, true)));

async function loadUpcoming() {
  const list = await api('/barber/bookings', B);
  $('#up-body').innerHTML = list.length
    ? list.map((b) => `<tr><td>${esc(fmtDate(b.date))}<div class="muted small">${fmtTime(b.time)}</div></td>
        <td>${esc(b.customerName)}</td><td>${esc(b.serviceName)}${b.notes ? `<div class="muted small">${esc(b.notes)}</div>` : ''}</td><td>${badge(b.status)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted center">No upcoming reservations.</td></tr>';
}

(async () => {
  $('#s-date').value = todayPH();
  try { await Promise.all([loadOverview(), loadSchedule(), loadUpcoming()]); }
  catch (e) { toast(e.message, true); }
})();
// Keep the schedule fresh when the admin approves or frees slots.
setInterval(() => { loadSchedule().catch(() => {}); loadUpcoming().catch(() => {}); }, 60000);
