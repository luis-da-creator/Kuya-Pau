require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

const NEW_USERNAME = 'Pau';            // your new admin username
const NEW_PASSWORD = 'kuyapau123'; // your new admin password (8+ characters)

(async () => {
  await connectDB();
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);
  const r = await User.updateOne({ role: 'admin' }, { username: NEW_USERNAME, passwordHash: hash });
  console.log(r.matchedCount ? 'Admin updated.' : 'No admin found.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });

require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const Barber = require('./models/Barber');

