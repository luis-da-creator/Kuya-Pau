const router = require('express').Router();
const bcrypt = require('bcryptjs');
const h = require('../utils/asyncHandler');
const rateLimit = require('../utils/rateLimit');
const { sign, requireAuth } = require('../middleware/auth');
const { EMAIL_RE, normalizePhone } = require('../utils/validators');
const { phToday } = require('../utils/time');
const User = require('../models/User');
const Barber = require('../models/Barber');
const Attendance = require('../models/Attendance');

const limiter = rateLimit({ max: 20 });
const str = (v) => (typeof v === 'string' ? v : '');
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role });
const BAD_LOGIN = 'Invalid username or password.';

// ---- Customers ----
router.post(
  '/register',
  limiter,
  h(async (req, res) => {
    const { acceptTerms } = req.body || {};
    const name = str(req.body.name).trim();
    const email = str(req.body.email).trim().toLowerCase();
    const phone = normalizePhone(str(req.body.phone));
    const password = str(req.body.password);

    if (acceptTerms !== true) return res.status(400).json({ message: 'Please agree to the Terms and Conditions first.' });
    if (name.length < 2) return res.status(400).json({ message: 'Please enter your full name.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!phone) return res.status(400).json({ message: 'Enter a valid mobile number (e.g. 09xxxxxxxxx).' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'That email is already registered. Try logging in.' });

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'customer',
      termsAcceptedAt: new Date(),
    });
    res.status(201).json({ token: sign({ id: user._id, role: 'customer' }), user: publicUser(user) });
  })
);

router.post(
  '/login',
  limiter,
  h(async (req, res) => {
    if (req.body.acceptTerms !== true) return res.status(400).json({ message: 'Please agree to the Terms and Conditions first.' });
    const email = str(req.body.email).trim().toLowerCase();
    const user = await User.findOne({ email, role: 'customer' });
    if (!user || !(await bcrypt.compare(str(req.body.password), user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    user.termsAcceptedAt = new Date();
    await user.save();
    res.json({ token: sign({ id: user._id, role: 'customer' }), user: publicUser(user) });
  })
);

router.get(
  '/me',
  requireAuth('customer'),
  h(async (req, res) => {
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(401).json({ message: 'Please log in again.' });
    res.json(publicUser(user));
  })
);

// ---- Admin ----
router.post(
  '/admin/login',
  limiter,
  h(async (req, res) => {
    const username = str(req.body.username).trim().toLowerCase();
    const user = await User.findOne({ username, role: 'admin' });
    if (!user || !(await bcrypt.compare(str(req.body.password), user.passwordHash))) {
      return res.status(401).json({ message: BAD_LOGIN });
    }
    res.json({ token: sign({ id: user._id, role: 'admin' }), user: publicUser(user) });
  })
);

// ---- Barbers: logging in records the day's Time In. Time Out is a separate button. ----
router.post(
  '/barber/login',
  limiter,
  h(async (req, res) => {
    const username = str(req.body.username).trim().toLowerCase();
    const barber = await Barber.findOne({ username });
    if (!barber || !(await bcrypt.compare(str(req.body.password), barber.passwordHash))) {
      return res.status(401).json({ message: BAD_LOGIN });
    }
    if (barber.status !== 'active') {
      return res.status(403).json({ message: `Your account is marked ${barber.status}. Please contact the admin.` });
    }
    const date = phToday();
    let attendance = await Attendance.findOne({ barber: barber._id, date });
    if (!attendance) attendance = await Attendance.create({ barber: barber._id, date, timeIn: new Date() });
    res.json({ token: sign({ id: barber._id, role: 'barber' }), barber: { id: barber._id, name: barber.name }, attendance });
  })
);

module.exports = router;
