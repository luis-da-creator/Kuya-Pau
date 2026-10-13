const Transaction = require('../models/Transaction');

// Record one ledger line for a booking.
const addTx = (b, type, amount, note = '') =>
  Transaction.create({
    booking: b._id,
    bookingCode: b.verificationCode,
    customerName: b.customerName,
    serviceName: b.serviceName,
    barberName: b.barberName,
    type,
    amount,
    note,
  });

module.exports = { addTx };
