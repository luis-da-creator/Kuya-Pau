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
  { name: 'Regular Haircut', category: 'haircut', price: 150, image: 'images/haircut-regular.jpg', description: 'Classic short textured cut, neat and clean.' },
  { name: 'Taper Fade', category: 'haircut', price: 150, image: 'images/haircut-taper-fade.jpg', description: 'Short sides that fade smoothly into the top.' },
  { name: 'Crew Cut', category: 'haircut', price: 150, image: 'images/haircut-crew-cut.jpg', description: 'Short, low-maintenance cut that is easy to style.' },
  { name: 'Undercut', category: 'haircut', price: 150, image: 'images/haircut-undercut.jpg', description: 'Shaved sides with a longer top you can slick back or style up.' },
  { name: 'Spiky Taper', category: 'haircut', price: 150, image: 'images/haircut-spiky-taper.jpg', description: 'Spiked, textured top with a low taper on the sides.' },
  { name: 'Textured Taper', category: 'haircut', price: 150, image: 'images/haircut-textured-taper.jpg', description: 'Messy textured top with a clean taper.' },
  { name: 'Curly Taper', category: 'haircut', price: 150, image: 'images/haircut-curly-taper.jpg', description: 'Fluffy, curly top with a tight taper.' },
  { name: 'Jay Jo Mullet', category: 'haircut', price: 150, image: 'images/haircut-jay-jo-mullet.jpg', description: 'Modern mullet with a textured fringe and longer back.' },
  { name: 'Two Block Cut', category: 'haircut', price: 150, image: 'images/haircut-two-block.jpg', description: 'Korean-style side-swept top with short sides.' },
  { name: 'Mushroom Cut', category: 'haircut', price: 150, image: 'images/haircut-mushroom-cut.jpg', description: 'Rounded top with a soft fringe and short undercut sides.' },
  { name: 'Layered Cut', category: 'haircut', price: 150, image: 'images/haircut-layered-cut.jpg', description: 'Medium-length layers with curtain bangs.' },
  { name: 'Shag Cut', category: 'haircut', price: 150, image: 'images/haircut-shag-cut.jpg', description: 'Feathered, choppy layers with lots of movement.' },
  { name: 'Short Bob', category: 'haircut', price: 150, image: 'images/haircut-short-bob.jpg', description: 'Neat short bob with a soft side part.' },
  {
    name: 'Braids',
    category: 'braids',
    price: 600,
    image: 'images/braids.jpg',
    description: 'Cornrow braids starting at ₱600. ...',
  },
  { name: 'Two-Strand Twists', category: 'braids', price: 600, image: 'images/braids-twists.jpg', description: '...' },
  { name: 'Stitch Cornrows', category: 'braids', price: 600, image: 'images/braids-cornrows.jpg', description: '...' },
  { name: 'Box Braids', category: 'braids', price: 600, image: 'images/braids-box.jpg', description: '...' },
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
