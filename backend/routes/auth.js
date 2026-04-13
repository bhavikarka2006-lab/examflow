const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const router   = express.Router();

// Helper to sign a JWT
const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

// ── POST /api/auth/login ─────────────────────────────────────
// Body: { role: 'student'|'faculty'|'admin', identifier, password }
router.post('/login', async (req, res) => {
  const { role, identifier, password } = req.body;
  if (!role || !identifier || !password)
    return res.status(400).json({ error: 'role, identifier, and password are required' });

  try {
    let user, table;

    if (role === 'student') {
      [user] = await db.query(
        'SELECT student_id AS id, name, email, password_hash, branch, semester, section, reg_no FROM Students WHERE reg_no = ? OR email = ?',
        [identifier, identifier]
      );
      table = 'student';
    } else if (role === 'faculty') {
      [user] = await db.query(
        'SELECT faculty_id AS id, name, email, password_hash, designation FROM Faculty WHERE email = ?',
        [identifier]
      );
      table = 'faculty';
    } else if (role === 'admin') {
      [user] = await db.query(
        'SELECT admin_id AS id, name, email, username, password_hash FROM Admins WHERE username = ? OR email = ?',
        [identifier, identifier]
      );
      table = 'admin';
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (!user.length) return res.status(401).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    const u = user[0];
    delete u.password_hash;

    const token = sign({ id: u.id, role: table, name: u.name, email: u.email,
      ...(role === 'student' && { reg_no: u.reg_no }) });

    res.json({ token, role: table, user: u });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    res.json(decoded);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
