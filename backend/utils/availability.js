const Booking = require('../models/Booking');
const shop = require('../config/shop');
const { phToday, addDays, isRealDate, scheduledAt, weekday, slotTimes } = require('./time');

const LEAD_MS = 30 * 60 * 1000; // can't book a slot starting in less than 30 minutes

// Returns an error message, or null if the date can be booked.
function validateBookingDate(date) {
  if (!isRealDate(date)) return 'Please choose a valid date.';
  const today = phToday();
  if (date < today) return 'That date has already passed.';
  if (date > addDays(today, shop.rules.maxAdvanceDays)) {
    return `You can only reserve up to ${shop.rules.maxAdvanceDays} days ahead.`;
  }
  return null;
}

// Slot states: available | pending | approved | past.
// Pending/approved bookings hold the slot; cancelled, rejected, forfeited and completed ones free it.
async function daySlots(barber, date, { withBookings = false } = {}) {
  if (barber.status !== 'active') return { slots: [], reason: `This barber is ${barber.status}.` };
  if (!barber.workDays.includes(weekday(date))) return { slots: [], reason: 'This barber is off on that day.' };

  const held = await Booking.find({ barber: barber._id, date, status: { $in: ['pending', 'approved'] } });
  const byTime = new Map(held.map((b) => [b.time, b]));

  const slots = slotTimes(barber.shiftStart, barber.shiftEnd).map((time) => {
    const b = byTime.get(time);
    const state = b ? b.status : scheduledAt(date, time).getTime() - Date.now() < LEAD_MS ? 'past' : 'available';
    const slot = { time, state };
    if (withBookings && b) slot.booking = { customerName: b.customerName, serviceName: b.serviceName, notes: b.notes };
    return slot;
  });
  return { slots };
}

module.exports = { daySlots, validateBookingDate, LEAD_MS };
