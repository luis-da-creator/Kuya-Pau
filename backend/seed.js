// Run once:  npm run seed
// - Admin and barbers are created only if missing (existing passwords are never overwritten).
// - Services are updated every run, so edit the list below and re-run to change prices/photos.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Barber = require('./models/Barber');
const Service = require('./models/Service');

const SERVICES = [
  { name: 'Low Taper', category: 'haircut', price: 150, image: 'images/Low-taper.jpg', description: 'Low taper with a clean, natural top.' },
  { name: 'Mid Taper', category: 'haircut', price: 150, image: 'images/Mid-taper.jpg', description: 'Mid taper that fades smoothly into the top.' },
  { name: 'Two Block', category: 'haircut', price: 150, image: 'images/Two-blk.jpg', description: 'Korean-style two block with short sides and a longer top.' },
  { name: 'Two Block Mid', category: 'haircut', price: 150, image: 'images/Two-Blk-mid.jpg', description: 'Two block with a mid-length top and rounded fringe.' },
  { name: 'Crew Cut', category: 'haircut', price: 150, image: 'images/Crewcut.jpg', description: 'Short, low-maintenance cut that is easy to style.' },
  { name: 'Undercut', category: 'haircut', price: 150, image: 'images/Undercut.jpg', description: 'Shaved sides with a longer top you can slick back or style up.' },
  { name: 'Mullet', category: 'haircut', price: 150, image: 'images/Mullet.jpg', description: 'Modern mullet with a textured fringe and longer back.' },
  { name: '16 Guard', category: 'haircut', price: 150, image: 'images/16-Guard.jpg', description: 'Taper with a textured top.' },
  { name: '12 Guard', category: 'haircut', price: 150, image: 'images/12-guard.jpg', description: 'Taper with a spiky top.' },
  { name: 'Buzz Cut', category: 'haircut', price: 150, image: 'images/Buzzcut.jpg', description: 'Clean, short buzz cut with a fade.' },
  { name: 'Wolf Cut (W)', category: 'haircut', price: 150, image: 'images/Wolfcut-w.jpg', description: 'Feathered, choppy layers with lots of movement.' },
  { name: 'Apple Cut', category: 'haircut', price: 150, image: 'images/Apple-cut.jpg', description: 'Neat short cut with a soft side part.' },
  { name: 'Layered Cut (W)', category: 'haircut', price: 150, image: 'images/Layered-w.jpg', description: 'Medium-length layers with curtain bangs.' },
  { name: 'Box Braids', category: 'braids', price: 600, image: 'images/box-braids.jpg', description: 'Starts at ₱600. The final price depends on length and extensions, so describe it in the notes when you reserve.' },
  { name: 'Cornrows Braids', category: 'braids', price: 600, image: 'images/Cornrows-braids.jpg', description: 'Starts at ₱600. The final price depends on the number of rows and extensions.' },
  { name: 'Two Twist Braids', category: 'braids', price: 600, image: 'images/two-twist-Braids.jpg', description: 'Starts at ₱600. The final price depends on hair length and twist size.' },
];

const BARBERS = [
  { name: 'Kuya Pau', username: 'kuyapau' },
  { name: 'Kuya Paul', username: 'kuyapaul' },
  { name: 'Kuya Geo', username: 'kuyageo' },
];

(async () => {
  await connectDB();

  const adminUser = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  if (!(await User.exists({ username: adminUser, role: 'admin' }))) {
    await User.create({
      name: 'Admin',
      username: adminUser,
      role: 'admin',
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10),
    });
    console.log(`Admin created: ${adminUser}`);
  } else {
    console.log(`Admin exists: ${adminUser}`);
  }

  const barberPass = process.env.BARBER_DEFAULT_PASSWORD || 'Barber@123';
  for (const b of BARBERS) {
    if (!(await Barber.exists({ username: b.username }))) {
      await Barber.create({ ...b, passwordHash: await bcrypt.hash(barberPass, 10) });
      console.log(`Barber created: ${b.name} (${b.username})`);
    } else {
      console.log(`Barber exists: ${b.name}`);
    }
  }

  for (const s of SERVICES) {
    await Service.updateOne({ name: s.name }, { $set: { ...s, active: true } }, { upsert: true });
  }
  await Service.updateMany({ name: { $nin: SERVICES.map((s) => s.name) } }, { $set: { active: false } });
  console.log(`Services ready: ${SERVICES.map((s) => `${s.name} ₱${s.price}`).join(', ')}`);

  process.exit(0);
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});