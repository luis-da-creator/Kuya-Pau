const { Schema, model } = require('mongoose');

const bookingSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerName: String,
    customerPhone: String,
    customerEmail: String,

    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: String,
    category: String,
    price: { type: Number, required: true },

    barber: { type: Schema.Types.ObjectId, ref: 'Barber', required: true },
    barberName: String,

    date: { type: String, required: true }, // YYYY-MM-DD (Philippine time)
    time: { type: String, required: true }, // HH:mm
    scheduledAt: { type: Date, required: true, index: true },
    notes: { type: String, default: '' },

    downPayment: { type: Number, required: true },
    paymentMethod: String,
    paymentRef: { type: String, index: true },
    verificationCode: { type: String, index: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'completed', 'cancelled', 'forfeited', 'rejected'],
      default: 'pending',
      index: true,
    },
    isLate: { type: Boolean, default: false },
    lateFee: { type: Number, default: 0 },
    extraCharge: { type: Number, default: 0 },
    balance: { type: Number, default: 0 }, // amount settled at the shop after the service
    refundStatus: {
      type: String,
      enum: ['none', 'refund-due', 'refunded', 'forfeited'],
      default: 'none',
    },
    cancelledAt: Date,
    completedAt: Date,

    // true while the booking occupies the barber's slot (pending or approved)
    holdsSlot: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bookingSchema.pre('validate', function () {
  this.holdsSlot = this.status === 'pending' || this.status === 'approved';
});

// One active booking per barber per slot, enforced by the database.
bookingSchema.index(
  { barber: 1, date: 1, time: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true } }
);

module.exports = model('Booking', bookingSchema);
