const { Schema, model } = require('mongoose');

// Customers sign in with email; the admin signs in with a username.
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    termsAcceptedAt: Date,
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
