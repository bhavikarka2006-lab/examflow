require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/faculty',  require('./routes/faculty'));
app.use('/api/admin',    require('./routes/admin'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', project: 'ExamFlow', course: 'CSS 2212' })
);

// ── Root route (so browser doesn't crash) ─────────────────────
app.get('/', (req, res) => {
  res.send('🚀 ExamFlow Backend is running');
});

// ── 404 for unknown API routes ────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ExamFlow running on port ${PORT}`);
});
