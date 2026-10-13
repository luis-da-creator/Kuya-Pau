const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts 09XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX. Returns 09XXXXXXXXX or null.
function normalizePhone(raw = '') {
  let p = String(raw).replace(/[\s\-()]/g, '');
  if (p.startsWith('+63')) p = '0' + p.slice(3);
  else if (p.startsWith('63')) p = '0' + p.slice(2);
  return /^09\d{9}$/.test(p) ? p : null;
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { EMAIL_RE, normalizePhone, escapeRe };
