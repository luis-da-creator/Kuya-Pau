const { Schema, model } = require('mongoose');

const serviceSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, enum: ['haircut', 'braids'], required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    image: { type: String, default: '' }, // path under /frontend, e.g. images/haircut-regular.svg
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('Service', serviceSchema);
