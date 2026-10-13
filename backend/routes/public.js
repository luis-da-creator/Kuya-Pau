const router = require('express').Router();
const h = require('../utils/asyncHandler');
const shop = require('../config/shop');
const Barber = require('../models/Barber');
const Service = require('../models/Service');

// Shop info for the customer panel (services, about us, contact, rules).
router.get(
  '/info',
  h(async (req, res) => {
    const [barbers, services] = await Promise.all([
      Barber.find({ status: { $ne: 'resigned' } }).sort({ name: 1 }).lean(),
      Service.find({ active: true }).sort({ category: 1, name: 1 }).lean(),
    ]);
    res.json({
      shop: {
        name: shop.name,
        since: shop.since,
        address: shop.address,
        hours: shop.hoursLabel,
        quote: shop.quote,
        facebook: shop.facebook,
        tiktok: shop.tiktok,
      },
      rules: shop.rules,
      payment: shop.payment(),
      barbers: barbers.map((b) => ({
        id: b._id,
        name: b.name,
        status: b.status,
        workDays: b.workDays,
        shiftStart: b.shiftStart,
        shiftEnd: b.shiftEnd,
      })),
      services: services.map((s) => ({
        id: s._id,
        name: s.name,
        category: s.category,
        price: s.price,
        description: s.description,
        image: s.image,
      })),
    });
  })
);

module.exports = router;
