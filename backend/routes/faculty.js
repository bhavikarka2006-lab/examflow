const express = require('express');
const db      = require('../db');
const auth    = require('../middleware/auth');
const router  = express.Router();

const facultyAuth = auth(['faculty', 'admin']);

// ── GET /api/faculty/dashboard ───────────────────────────────
router.get('/dashboard', facultyAuth, async (req, res) => {
  const fid = req.user.id;
  try {
    const [[faculty]] = await db.query(
      'SELECT faculty_id, name, email, designation FROM Faculty WHERE faculty_id = ?', [fid]);

    const [exams] = await db.query(
      `SELECT e.exam_id, e.title, e.status, e.total_marks, e.duration_mins,
              e.start_time, c.course_code, c.course_name,
              COUNT(DISTINCT r.result_id) AS submitted_count
       FROM Exams e
       JOIN Courses c ON e.course_id = c.course_id
       LEFT JOIN Results r ON r.exam_id = e.exam_id
       WHERE c.faculty_id = ?
       GROUP BY e.exam_id
       ORDER BY e.start_time DESC`, [fid]);

    const [analytics] = await db.query(
      `SELECT * FROM vw_class_analytics
       WHERE course_code IN (SELECT course_code FROM Courses WHERE faculty_id = ?)`, [fid]);

    const [recentResults] = await db.query(
      `SELECT s.name AS student_name, s.reg_no, r.grade, r.status, r.percentage, e.title AS exam_title
       FROM Results r
       JOIN Students s ON r.student_id = s.student_id
       JOIN Exams e ON r.exam_id = e.exam_id
       JOIN Courses c ON e.course_id = c.course_id
       WHERE c.faculty_id = ?
       ORDER BY r.computed_at DESC LIMIT 10`, [fid]);

    res.json({ faculty, exams, analytics, recentResults });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/faculty/exams/:examId/results ───────────────────
router.get('/exams/:examId/results', facultyAuth, async (req, res) => {
  const { examId } = req.params;
  try {
    const [results] = await db.query(
      `SELECT s.name AS student_name, s.reg_no, s.section,
              r.total_score, r.max_score, r.percentage, r.grade, r.status,
              r.correct_count, r.wrong_count, r.skip_count, r.computed_at
       FROM Results r
       JOIN Students s ON r.student_id = s.student_id
       WHERE r.exam_id = ?
       ORDER BY r.percentage DESC`, [examId]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/faculty/exams ──────────────────────────────────
// Create a new exam with questions
router.post('/exams', facultyAuth, async (req, res) => {
  const fid = req.user.id;
  const { course_id, title, total_marks, duration_mins, start_time, end_time, questions } = req.body;

  if (!course_id || !title || !total_marks || !duration_mins || !start_time || !end_time)
    return res.status(400).json({ error: 'Missing required exam fields' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Verify faculty owns the course
    const [[course]] = await conn.query(
      'SELECT course_id FROM Courses WHERE course_id = ? AND faculty_id = ?', [course_id, fid]);
    if (!course) { await conn.rollback(); return res.status(403).json({ error: 'Not your course' }); }

    const [examResult] = await conn.query(
      `INSERT INTO Exams (course_id, title, total_marks, duration_mins, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'upcoming')`,
      [course_id, title, total_marks, duration_mins, start_time, end_time]);

    const examId = examResult.insertId;

    if (questions && questions.length) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await conn.query(
          `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, question_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [examId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks || 1, i + 1]);
      }
    }

    await conn.commit();
    res.status(201).json({ message: 'Exam created', exam_id: examId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create exam' });
  } finally {
    conn.release();
  }
});

// ── PATCH /api/faculty/exams/:examId/status ──────────────────
router.patch('/exams/:examId/status', facultyAuth, async (req, res) => {
  const { examId } = req.params;
  const { status } = req.body;
  const fid = req.user.id;

  if (!['upcoming', 'live', 'completed'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    await db.query(
      `UPDATE Exams e JOIN Courses c ON e.course_id = c.course_id
       SET e.status = ?
       WHERE e.exam_id = ? AND c.faculty_id = ?`, [status, examId, fid]);
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/faculty/courses ─────────────────────────────────
router.get('/courses', facultyAuth, async (req, res) => {
  const fid = req.user.id;
  try {
    const [courses] = await db.query(
      `SELECT c.*, COUNT(DISTINCT en.student_id) AS enrolled_count
       FROM Courses c LEFT JOIN Enrollments en ON c.course_id = en.course_id
       WHERE c.faculty_id = ?
       GROUP BY c.course_id`, [fid]);
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
