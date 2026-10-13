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
  { name: 'Regular Haircut', category: 'haircut', price: 150, image: 'images/haircut-regular.svg', description: 'Classic scissor and clipper cut, neat and clean.' },
  { name: 'Taper Fade', category: 'haircut', price: 150, image: 'images/haircut-taper-fade.svg', description: 'Short sides that fade smoothly into the top.' },
  { name: 'Crew Cut', category: 'haircut', price: 150, image: 'images/haircut-crew-cut.svg', description: 'Short, low-maintenance cut that is easy to style.' },
  { name: 'Undercut', category: 'haircut', price: 150, image: 'images/haircut-undercut.svg', description: 'Shaved sides with a longer top you can slick back or style up.' },
  {
    name: 'Braids',
    category: 'braids',
    price: 600,
    image: 'images/braids.svg',
    description: 'Starts at ₱600. The final price depends on the braid style and whether extensions are needed, so describe it in the notes when you reserve.',
  },
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
  console.log(`Services ready: ${SERVICES.map((s) => `${s.name} ₱${s.price}`).join(', ')}`);

  process.exit(0);
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
