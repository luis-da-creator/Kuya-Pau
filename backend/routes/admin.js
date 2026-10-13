const router = require('express').Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const h = require('../utils/asyncHandler');
const shop = require('../config/shop');
const { requireAuth } = require('../middleware/auth');
const { addTx } = require('../utils/ledger');
const { buildIncome } = require('../utils/stats');
const { escapeRe } = require('../utils/validators');
const { DATE_RE, phToday, addDays } = require('../utils/time');
const Barber = require('../models/Barber');
const Booking = require('../models/Booking');
const Attendance = require('../models/Attendance');
const Transaction = require('../models/Transaction');

router.use(requireAuth('admin'));

const str = (v) => (typeof v === 'string' ? v : '');
const peso = (n) => `₱${n}`;
const notFound = (res) => res.status(404).json({ message: 'Reservation not found.' });

// ---------- Dashboard ----------
router.get(
  '/dashboard',
  h(async (req, res) => {
    const since = new Date(Date.now() - 400 * 864e5);
    const txs = await Transaction.find({ createdAt: { $gte: since } }).select('amount createdAt').lean();
    const [pending, todayApproved, activeBarbers] = await Promise.all([
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ date: phToday(), status: 'approved' }),
      Barber.countDocuments({ status: 'active' }),
    ]);
    res.json({ ...buildIncome(txs), pending, todayApproved, activeBarbers });
  })
);

// ---------- Reservations (the admin controls each barber's schedule) ----------
router.get(
  '/bookings',
  h(async (req, res) => {
    const status = str(req.query.status);
    const date = str(req.query.date);
    const q = str(req.query.q).trim().slice(0, 50);
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (DATE_RE.test(date)) filter.date = date;
    if (q) {
      filter.$or = [
        { verificationCode: q },
        { customerName: new RegExp(escapeRe(q), 'i') },
        { paymentRef: new RegExp(`^${escapeRe(q)}`, 'i') },
      ];
    }
    const upcoming = status === 'pending' || status === 'approved';
    res.json(await Booking.find(filter).sort({ scheduledAt: upcoming ? 1 : -1 }).limit(300).lean());
  })
);

// Approve: payment checked, slot confirmed for the barber. Books the down payment into the ledger.
router.post(
  '/bookings/:id/approve',
  h(async (req, res) => {
    const b = await Booking.findById(req.params.id);
    if (!b) return notFound(res);
    if (b.status !== 'pending') return res.status(400).json({ message: 'Only pending reservations can be approved.' });
    b.status = 'approved';
    await b.save();
    await addTx(b, 'downpayment', b.downPayment, `${b.paymentMethod} ref ${b.paymentRef}`);
    res.json(b);
  })
);

// Reject: payment could not be verified. Frees the slot again.
router.post(
  '/bookings/:id/reject',
  h(async (req, res) => {
    const b = await Booking.findById(req.params.id);
    if (!b) return notFound(res);
    if (b.status !== 'pending') return res.status(400).json({ message: 'Only pending reservations can be rejected.' });
    b.status = 'rejected';
    await b.save();
    res.json(b);
  })
);

// Complete: customer was served. Balance = price - down payment (+ late fee) (+ extras such as braid extensions).
router.post(
  '/bookings/:id/complete',
  h(async (req, res) => {
    const b = await Booking.findById(req.params.id);
    if (!b) return notFound(res);
    if (b.status !== 'approved') return res.status(400).json({ message: 'Only approved reservations can be completed.' });

    const late = req.body.late === true;
    const extra = Math.max(0, Math.min(5000, Math.round(Number(req.body.extra) || 0)));
    b.isLate = late;
    b.lateFee = late ? shop.rules.lateFee : 0;
    b.extraCharge = extra;
    b.balance = b.price - b.downPayment + b.lateFee + extra;
    b.status = 'completed';
    b.completedAt = new Date();
    await b.save();

    const notes = [late && `late fee ${peso(b.lateFee)}`, extra && `extras ${peso(extra)}`].filter(Boolean).join(', ');
    if (b.balance > 0) await addTx(b, 'balance', b.balance, notes || 'Balance paid after service');
    res.json(b);
  })
);

// Forfeit: customer never showed up. Down payment is kept.
router.post(
  '/bookings/:id/forfeit',
  h(async (req, res) => {
    const b = await Booking.findById(req.params.id);
    if (!b) return notFound(res);
    if (b.status !== 'approved') return res.status(400).json({ message: 'Only approved reservations can be forfeited.' });
    b.status = 'forfeited';
    b.refundStatus = 'forfeited';
    await b.save();
    await addTx(b, 'forfeit', 0, `No-show. Down payment ${peso(b.downPayment)} kept`);
    res.json(b);
  })
);

// After the admin sends the refund for an early cancellation.
router.post(
  '/bookings/:id/refund',
  h(async (req, res) => {
    const b = await Booking.findById(req.params.id);
    if (!b) return notFound(res);
    if (b.status !== 'cancelled' || b.refundStatus !== 'refund-due') {
      return res.status(400).json({ message: 'No refund is due for this reservation.' });
    }
    b.refundStatus = 'refunded';
    await b.save();
    // Only reverse money that was actually booked (i.e. the booking had been approved).
    if (await Transaction.exists({ booking: b._id, type: 'downpayment' })) {
      await addTx(b, 'refund', -b.downPayment, 'Down payment refunded (cancelled early)');
    }
    res.json(b);
  })
);

// ---------- Barbers ----------
const TIME_RE = /^([01]\d|2[0-3]):00$/;

function parseBarber(body, isNew) {
  const name = str(body.name).trim();
  const username = str(body.username).trim().toLowerCase();
  const password = str(body.password);
  const status = str(body.status) || 'active';
  const workDays = Array.isArray(body.workDays) ? [...new Set(body.workDays.map(Number))].filter((d) => d >= 0 && d <= 6) : [];
  const shiftStart = str(body.shiftStart);
  const shiftEnd = str(body.shiftEnd);

  if (name.length < 2) return { error: 'Name is required.' };
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) return { error: 'Username must be 3–20 letters, numbers, dot, dash or underscore.' };
  if ((isNew || password) && password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (!['active', 'on-leave', 'resigned'].includes(status)) return { error: 'Invalid status.' };
  if (!workDays.length) return { error: 'Pick at least one work day.' };
  if (!TIME_RE.test(shiftStart) || !TIME_RE.test(shiftEnd) || shiftStart >= shiftEnd) {
    return { error: 'Shift start must be earlier than shift end.' };
  }
  return { data: { name, username, password, status, workDays: workDays.sort(), shiftStart, shiftEnd } };
}

router.get(
  '/barbers',
  h(async (req, res) => {
    const [barbers, today] = await Promise.all([
      Barber.find().sort({ status: 1, name: 1 }).lean(),
      Attendance.find({ date: phToday() }).lean(),
    ]);
    const byBarber = new Map(today.map((a) => [String(a.barber), a]));
    res.json(
      barbers.map((b) => {
        const a = byBarber.get(String(b._id));
        return {
          id: b._id,
          name: b.name,
          username: b.username,
          status: b.status,
          workDays: b.workDays,
          shiftStart: b.shiftStart,
          shiftEnd: b.shiftEnd,
          today: a ? { timeIn: a.timeIn, timeOut: a.timeOut || null } : null,
        };
      })
    );
  })
);

router.post(
  '/barbers',
  h(async (req, res) => {
    const { error, data } = parseBarber(req.body, true);
    if (error) return res.status(400).json({ message: error });
    try {
      const { password, ...rest } = data;
      await Barber.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'That username is already taken.' });
      throw err;
    }
    res.status(201).json({ message: 'Barber added.' });
  })
);

router.put(
  '/barbers/:id',
  h(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid barber.' });
    const barber = await Barber.findById(req.params.id);
    if (!barber) return res.status(404).json({ message: 'Barber not found.' });
    const { error, data } = parseBarber(req.body, false);
    if (error) return res.status(400).json({ message: error });

    const { password, ...rest } = data;
    Object.assign(barber, rest);
    if (password) barber.passwordHash = await bcrypt.hash(password, 10);
    try {
      await barber.save();
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'That username is already taken.' });
      throw err;
    }

    // Tell the admin if a barber who can no longer work still has upcoming reservations.
    let affected = 0;
    if (barber.status !== 'active') {
      affected = await Booking.countDocuments({
        barber: barber._id,
        status: { $in: ['pending', 'approved'] },
        scheduledAt: { $gte: new Date() },
      });
    }
    res.json({ message: 'Barber updated.', affectedBookings: affected });
  })
);

// Time in/out log. Defaults to the last 14 days.
router.get(
  '/attendance',
  h(async (req, res) => {
    const from = str(req.query.from);
    const to = str(req.query.to);
    const barberId = str(req.query.barberId);
    const today = phToday();
    const filter = { date: { $gte: DATE_RE.test(from) ? from : addDays(today, -13), $lte: DATE_RE.test(to) ? to : today } };
    if (mongoose.isValidObjectId(barberId)) filter.barber = barberId;
    const rows = await Attendance.find(filter).populate('barber', 'name').sort({ date: -1, timeIn: -1 }).limit(500).lean();
    res.json(rows.map((r) => ({ id: r._id, date: r.date, barberName: r.barber ? r.barber.name : '(removed)', timeIn: r.timeIn, timeOut: r.timeOut || null })));
  })
);

// ---------- Customers who already came to the shop + haircut trends ----------
router.get(
  '/customers',
  h(async (req, res) => {
    const [trending, customers] = await Promise.all([
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$serviceName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $sort: { scheduledAt: -1 } },
        {
          $group: {
            _id: '$customer',
            name: { $first: '$customerName' },
            phone: { $first: '$customerPhone' },
            email: { $first: '$customerEmail' },
            visits: { $sum: 1 },
            lastVisit: { $first: '$date' },
            lastService: { $first: '$serviceName' },
            lastBarber: { $first: '$barberName' },
          },
        },
        { $sort: { visits: -1, lastVisit: -1 } },
        { $limit: 300 },
      ]),
    ]);
    res.json({ trending: trending.map((t) => ({ name: t._id, count: t.count })), customers });
  })
);

// ---------- Transaction history ----------
router.get(
  '/transactions',
  h(async (req, res) => {
    const from = str(req.query.from);
    const to = str(req.query.to);
    const type = str(req.query.type);
    const q = str(req.query.q).trim().slice(0, 50);
    const filter = {};
    if (DATE_RE.test(from) || DATE_RE.test(to)) {
      filter.createdAt = {};
      if (DATE_RE.test(from)) filter.createdAt.$gte = new Date(`${from}T00:00:00+08:00`);
      if (DATE_RE.test(to)) filter.createdAt.$lte = new Date(`${to}T23:59:59.999+08:00`);
    }
    if (['downpayment', 'balance', 'refund', 'forfeit'].includes(type)) filter.type = type;
    if (q) filter.$or = [{ customerName: new RegExp(escapeRe(q), 'i') }, { bookingCode: q }];

    const [transactions, sum] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
      Transaction.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    res.json({ transactions, total: sum[0] ? sum[0].total : 0 });
  })
);

module.exports = router;
