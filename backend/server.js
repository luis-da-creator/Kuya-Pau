require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'REPLACE_ME') {
  console.error('Set JWT_SECRET in backend/.env first.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});

// API
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/barber', require('./routes/barber'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// Frontend (served from ../frontend)
app.use('/api', async (req, res, next) => {
  try { await connectDB(); next(); } catch (e) { next(e); }
});
// Errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request.' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors)[0].message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid request.' });
  console.error(err);
  res.status(500).json({ message: 'Server error. Please try again.' });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`Kuya Pau's Barbershop running at http://localhost:${PORT}`)))
    .catch((err) => {
      console.error('Could not connect to MongoDB:', err.message);
      process.exit(1);
    });
}
