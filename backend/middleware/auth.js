const jwt = require('jsonwebtoken');

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

// requireAuth('admin') / requireAuth('customer') / requireAuth('barber')
function requireAuth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Please log in.' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ message: 'You are not allowed to do that.' });
      }
      req.auth = payload;
      next();
    } catch {
      res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
  };
}

module.exports = { sign, requireAuth };
