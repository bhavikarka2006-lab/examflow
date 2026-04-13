const jwt = require('jsonwebtoken');

const auth = (allowedRoles = []) => (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Access denied for your role' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = auth;
