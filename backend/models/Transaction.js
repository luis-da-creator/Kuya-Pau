const { Schema, model } = require('mongoose');

// Cash ledger. Income = sum of amount (refunds are negative).
const transactionSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    bookingCode: String,
    customerName: String,
    serviceName: String,
    barberName: String,
    type: { type: String, enum: ['downpayment', 'balance', 'refund', 'forfeit'], required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

transactionSchema.index({ createdAt: -1 });

module.exports = model('Transaction', transactionSchema);
