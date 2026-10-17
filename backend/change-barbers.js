require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const Barber = require('./models/Barber');

// currentUsername = what they use now. Set the new username and password.
const BARBERS = [
  { currentUsername: 'kuyapau',  username: 'Kuyapau',  password: 'PauPass2026!' },
  { currentUsername: 'kuyapaul', username: 'Kuyapaul', password: 'PaulPass2026!' },
  { currentUsername: 'kuyageo',  username: 'Kuyageo',  password: 'GeoPass2026!' },
];

(async () => {
  await connectDB();
  for (const b of BARBERS) {
    const passwordHash = await bcrypt.hash(b.password, 10);
    const r = await Barber.updateOne(
      { username: b.currentUsername },
      { username: b.username.toLowerCase(), passwordHash }
    );
    console.log(b.currentUsername, '->', b.username, r.matchedCount ? 'updated' : 'NOT FOUND');
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });