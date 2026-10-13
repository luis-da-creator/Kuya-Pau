const { Schema, model } = require('mongoose');

const barberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['active', 'on-leave', 'resigned'], default: 'active' },
    workDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] }, // 0 = Sunday
    shiftStart: { type: String, default: '09:00' },
    shiftEnd: { type: String, default: '21:00' },
  },
  { timestamps: true }
);

module.exports = model('Barber', barberSchema);
