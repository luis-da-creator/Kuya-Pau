const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const h = require('../utils/asyncHandler');
const shop = require('../config/shop');
const { requireAuth } = require('../middleware/auth');
const { daySlots, validateBookingDate, LEAD_MS } = require('../utils/availability');
const { scheduledAt, weekday, slotTimes } = require('../utils/time');
const { sendBookingCode } = require('../utils/notify');
const { addTx } = require('../utils/ledger');
const User = require('../models/User');
const Barber = require('../models/Barber');
const Service = require('../models/Service');
const Booking = require('../models/Booking');

router.use(requireAuth('customer'));

const str = (v) => (typeof v === 'string' ? v : '');
const peso = (n) => `₱${n}`;

const view = (b) => ({
  id: b._id,
  serviceName: b.serviceName,
  category: b.category,
  barberName: b.barberName,
  date: b.date,
  time: b.time,
  scheduledAt: b.scheduledAt,
  notes: b.notes,
  price: b.price,
  downPayment: b.downPayment,
  lateFee: b.lateFee,
  extraCharge: b.extraCharge,
  balance: b.status === 'completed' ? b.balance : b.price - b.downPayment,
  status: b.status,
  refundStatus: b.refundStatus,
  verificationCode: b.verificationCode,
  createdAt: b.createdAt,
});

// Open slots for one barber on one date.
router.get(
  '/availability',
  h(async (req, res) => {
    const barberId = str(req.query.barberId);
    const date = str(req.query.date);
    if (!mongoose.isValidObjectId(barberId)) return res.status(400).json({ message: 'Choose a barber.' });
    const dateError = validateBookingDate(date);
    if (dateError) return res.status(400).json({ message: dateError });
    const barber = await Barber.findById(barberId);
    if (!barber) return res.status(404).json({ message: 'Barber not found.' });
    res.json(await daySlots(barber, date));
  })
);

router.post(
  '/bookings',
  h(async (req, res) => {
    const { serviceId, barberId } = req.body;
    const date = str(req.body.date);
    const time = str(req.body.time);
    const notes = str(req.body.notes).trim().slice(0, 300);
    const paymentRef = str(req.body.paymentRef).trim();

    if (!mongoose.isValidObjectId(serviceId) || !mongoose.isValidObjectId(barberId)) {
      return res.status(400).json({ message: 'Please choose a service and a barber.' });
    }
    const dateError = validateBookingDate(date);
    if (dateError) return res.status(400).json({ message: dateError });
    if (!/^\d{2}:00$/.test(time)) return res.status(400).json({ message: 'Please choose a time slot.' });
  if (!/^\d{6,30}$/.test(paymentRef)) {
      return res.status(400).json({ message: 'Enter the payment reference number (6 to 30 digits).' });
    }

    const [user, service, barber] = await Promise.all([
      User.findById(req.auth.id),
      Service.findById(serviceId),
      Barber.findById(barberId),
    ]);
    if (!user) return res.status(401).json({ message: 'Please log in again.' });
    if (!service || !service.active) return res.status(404).json({ message: 'That service is not available.' });
    if (!barber || barber.status !== 'active') return res.status(400).json({ message: 'That barber is not available.' });
    if (service.category === 'braids' && notes.length < 3) {
      return res.status(400).json({ message: 'For braids, please describe the braid style and whether you need extensions in the notes.' });
    }

    const slotOk =
      barber.workDays.includes(weekday(date)) &&
      slotTimes(barber.shiftStart, barber.shiftEnd).includes(time) &&
      scheduledAt(date, time).getTime() - Date.now() >= LEAD_MS;
    if (!slotOk) return res.status(400).json({ message: 'That time slot is not available. Please pick another.' });

    if (await Booking.exists({ paymentRef: new RegExp(`^${paymentRef}$`, 'i') })) {
      return res.status(409).json({ message: 'That payment reference was already used for another reservation.' });
    }

    const downPayment = Math.round(service.price * shop.rules.downPaymentRate);
    const booking = new Booking({
      customer: user._id,
      customerName: user.name,
      customerPhone: user.phone,
      customerEmail: user.email,
      service: service._id,
      serviceName: service.name,
      category: service.category,
      price: service.price,
      barber: barber._id,
      barberName: barber.name,
      date,
      time,
      scheduledAt: scheduledAt(date, time),
      notes,
      downPayment,
      paymentMethod: shop.payment().method,
      paymentRef,
      verificationCode: String(crypto.randomInt(100000, 1000000)),
      balance: service.price - downPayment,
    });

    try {
      await booking.save();
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'Sorry, that slot was just taken. Please pick another time.' });
      throw err;
    }

    const notified = await sendBookingCode(booking);
    res.status(201).json({ booking: view(booking), notified });
  })
);

router.get(
  '/bookings',
  h(async (req, res) => {
    const list = await Booking.find({ customer: req.auth.id }).sort({ scheduledAt: -1 }).limit(100);
    res.json(list.map(view));
  })
);

// Cancel rules: 12+ hours ahead -> down payment refunded. Less than 12 hours -> forfeited.
router.post(
  '/bookings/:id/cancel',
  h(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid reservation.' });
    const b = await Booking.findOne({ _id: req.params.id, customer: req.auth.id });
    if (!b) return res.status(404).json({ message: 'Reservation not found.' });
    if (!['pending', 'approved'].includes(b.status)) {
      return res.status(400).json({ message: 'This reservation can no longer be cancelled.' });
    }

    const hoursLeft = (b.scheduledAt.getTime() - Date.now()) / 36e5;
    let message;
    if (b.status === 'pending') {
      b.status = 'cancelled';
      message = 'Reservation cancelled. Your payment had not been verified yet. If you already paid, please message the shop about your refund.';
    } else if (hoursLeft >= shop.rules.cancelHours) {
      b.status = 'cancelled';
      b.refundStatus = 'refund-due';
      message = `Reservation cancelled. Your ${peso(b.downPayment)} down payment will be refunded.`;
    } else {
      b.status = 'forfeited';
      b.refundStatus = 'forfeited';
      message = `Cancelled less than ${shop.rules.cancelHours} hours before your schedule, so the ${peso(b.downPayment)} down payment is not refunded.`;
    }
    b.cancelledAt = new Date();
    await b.save();
    if (b.status === 'forfeited') await addTx(b, 'forfeit', 0, `Late cancellation. Down payment ${peso(b.downPayment)} kept`);
    res.json({ message, booking: view(b) });
  })
);

// "Suggested for you": the customer's most-booked completed service, else the shop's most popular.
router.get(
  '/suggestion',
  h(async (req, res) => {
    const top = async (match) =>
      (await Booking.aggregate([{ $match: { status: 'completed', ...match } }, { $group: { _id: '$service', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]))[0];

    let pick = await top({ customer: new mongoose.Types.ObjectId(req.auth.id) });
    let reason = 'Because you keep coming back for it.';
    if (!pick) {
      pick = await top({});
      reason = 'Most popular with our customers.';
    }
    let service = pick && (await Service.findOne({ _id: pick._id, active: true }));
    if (!service) {
      service = await Service.findOne({ category: 'haircut', active: true }).sort({ price: 1, name: 1 });
      reason = 'A clean classic to start with.';
    }
    if (!service) return res.json(null);
    res.json({ id: service._id, name: service.name, price: service.price, image: service.image, reason });
  })
);

module.exports = router;
