const { Schema, model } = require('mongoose');

// One record per barber per day. timeIn is set on login; timeOut only by the Time Out button.
const attendanceSchema = new Schema(
  {
    barber: { type: Schema.Types.ObjectId, ref: 'Barber', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (Philippine time)
    timeIn: { type: Date, required: true },
    timeOut: Date,
  },
  { timestamps: true }
);

attendanceSchema.index({ barber: 1, date: 1 }, { unique: true });

module.exports = model('Attendance', attendanceSchema);
