const router = require('express').Router();
const h = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { daySlots, validateBookingDate } = require('../utils/availability');
const { phToday, isRealDate } = require('../utils/time');
const Barber = require('../models/Barber');
const Booking = require('../models/Booking');
const Attendance = require('../models/Attendance');

router.use(requireAuth('barber'));

// Load the barber and make sure the account is still active.
router.use(
  h(async (req, res, next) => {
    const barber = await Barber.findById(req.auth.id);
    if (!barber || barber.status !== 'active') {
      return res.status(403).json({ message: 'Your account is not active. Please contact the admin.' });
    }
    req.barber = barber;
    next();
  })
);

router.get(
  '/overview',
  h(async (req, res) => {
    const attendance = await Attendance.findOne({ barber: req.barber._id, date: phToday() });
    res.json({ barber: { id: req.barber._id, name: req.barber.name }, attendance });
  })
);

// Time Out is its own action. Logging out of the account does NOT time you out.
router.post(
  '/time-out',
  h(async (req, res) => {
    const att = await Attendance.findOne({ barber: req.barber._id, date: phToday() });
    if (!att) return res.status(400).json({ message: 'You have not timed in today.' });
    if (att.timeOut) return res.status(400).json({ message: 'You already timed out today.' });
    att.timeOut = new Date();
    await att.save();
    res.json(att);
  })
);

// This barber's slot grid for a day, with who booked each slot.
router.get(
  '/schedule',
  h(async (req, res) => {
    const date = typeof req.query.date === 'string' && isRealDate(req.query.date) ? req.query.date : phToday();
    res.json({ date, ...(await daySlots(req.barber, date, { withBookings: true })) });
  })
);

// Upcoming reservations (from today onward).
router.get(
  '/bookings',
  h(async (req, res) => {
    const list = await Booking.find({
      barber: req.barber._id,
      status: { $in: ['pending', 'approved'] },
      date: { $gte: phToday() },
    })
      .sort({ scheduledAt: 1 })
      .limit(100)
      .lean();
    res.json(
      list.map((b) => ({
        id: b._id,
        customerName: b.customerName,
        serviceName: b.serviceName,
        notes: b.notes,
        date: b.date,
        time: b.time,
        status: b.status,
      }))
    );
  })
);

module.exports = router;
