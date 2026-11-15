const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function verifyToken(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ err: 'Invalid token.' });
    }

    const token = authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded._id);

    if (!user || !user.isActive) {
      return res.status(403).json({ err: 'Account is not active.' });
    }

    req.user = decoded;
    req.user.role = user.role;

    return next();
  } catch (err) {
    return res.status(401).json({ err: 'Invalid token.' });
  }
}

module.exports = verifyToken;
