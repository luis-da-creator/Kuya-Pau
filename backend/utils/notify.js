const nodemailer = require('nodemailer');
const { to12h } = require('./time');

let transporter;
function getTransporter() {
  if (transporter !== undefined) return transporter;
  transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;
  return transporter;
}

async function sendEmail(to, subject, text) {
  const t = getTransporter();
  if (!t || !to) {
    console.log(`[EMAIL not configured] to=${to}\n${subject}\n${text}\n`);
    return false;
  }
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}

// Semaphore (Philippine SMS gateway). Swap this function to use another provider.
async function sendSms(number, message) {
  const apikey = process.env.SEMAPHORE_API_KEY;
  if (!apikey || !number) {
    console.log(`[SMS not configured] to=${number}: ${message}\n`);
    return false;
  }
  const body = new URLSearchParams({ apikey, number, message });
  if (process.env.SEMAPHORE_SENDER) body.set('sendername', process.env.SEMAPHORE_SENDER);
  const res = await fetch('https://api.semaphore.co/api/v4/messages', { method: 'POST', body });
  return res.ok;
}

// Sends the verification code by email and SMS. Never throws.
async function sendBookingCode(b) {
  const when = `${b.date} ${to12h(b.time)}`;
  const text =
    `Kuya Pau's Barbershop\n` +
    `Verification code: ${b.verificationCode}\n` +
    `${b.serviceName} with ${b.barberName} on ${when}.\n` +
    `Show this code at the shop. Your reservation is confirmed once the admin verifies your down payment.`;
  const sms = `Kuya Pau's: code ${b.verificationCode} for ${b.serviceName} w/ ${b.barberName}, ${when}. Show this at the shop.`;
  const [email, phone] = await Promise.allSettled([
    sendEmail(b.customerEmail, "Your Kuya Pau's Barbershop reservation code", text),
    sendSms(b.customerPhone, sms),
  ]);
  return { email: email.status === 'fulfilled' && email.value, sms: phone.status === 'fulfilled' && phone.value };
}

module.exports = { sendBookingCode };
