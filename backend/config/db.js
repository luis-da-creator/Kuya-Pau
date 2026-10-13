const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

let connecting;
module.exports = async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kuyapau_barbershop';
  mongoose.set('strictQuery', true);
  connecting = connecting || mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  await connecting;
};
