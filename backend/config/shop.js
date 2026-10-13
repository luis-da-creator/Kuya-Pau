// Shop-wide settings and booking rules. Edit here, not in the routes.
module.exports = {
  name: "Kuya Pau's Barbershop",
  since: 2021,
  address: 'Ma. Socorro, Abangan Norte, Marilao, Bulacan',
  hoursLabel: 'Daily, 9:00 AM – 9:00 PM',
  quote: 'Walk in as a customer, walk out as a regular.',
  facebook: 'https://www.facebook.com/search/top?q=Kuya%20Pau',
  tiktok: 'https://www.tiktok.com/@paulouchi08',
  rules: {
    downPaymentRate: 0.5, // 50% paid before a slot is reserved
    lateFee: 20,          // pesos, added to the balance for late arrival
    cancelHours: 12,      // cancel at least this many hours ahead to get a refund
    maxAdvanceDays: 30,
  },
  payment() {
    return {
      method: process.env.PAYMENT_METHOD || 'GCash',
      number: process.env.PAYMENT_NUMBER || '',
      accountName: process.env.PAYMENT_ACCOUNT_NAME || '',
    };
  },
};
