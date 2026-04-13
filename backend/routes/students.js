const express = require('express');
const db      = require('../db');
const auth    = require('../middleware/auth');
const router  = express.Router();

// All student routes require student or admin JWT
const studentAuth = auth(['student', 'admin']);

// ── GET /api/students/dashboard ─────────────────────────────
router.get('/dashboard', studentAuth, async (req, res) => {
  const sid = req.user.id;
  try {
    const [[student]] = await db.query(
      'SELECT student_id, reg_no, name, email, branch, semester, section FROM Students WHERE student_id = ?', [sid]);

    const [enrollments] = await db.query(
      `SELECT c.course_code, c.course_name, c.credits, f.name AS faculty_name
       FROM Enrollments en
       JOIN Courses c ON en.course_id = c.course_id
       JOIN Faculty f ON c.faculty_id = f.faculty_id
       WHERE en.student_id = ?`, [sid]);

    const [results] = await db.query(
      `SELECT * FROM vw_result_summary WHERE student_id = ?
       ORDER BY computed_at DESC`, [sid]);
    // Fix: vw_result_summary uses reg_no not student_id for filtering via view
    // Requery directly
    const [res2] = await db.query(
      `SELECT r.*, e.title AS exam_title, c.course_code, c.course_name
       FROM Results r
       JOIN Exams e ON r.exam_id = e.exam_id
       JOIN Courses c ON e.course_id = c.course_id
       WHERE r.student_id = ?
       ORDER BY r.computed_at DESC`, [sid]);

    const [upcomingExams] = await db.query(
      `SELECT e.exam_id, e.title, e.total_marks, e.duration_mins, e.start_time, e.end_time, e.status, c.course_code
       FROM Exams e
       JOIN Courses c ON e.course_id = c.course_id
       JOIN Enrollments en ON c.course_id = en.course_id
       WHERE en.student_id = ? AND e.status IN ('upcoming','live')
       ORDER BY e.start_time ASC`, [sid]);

    res.json({ student, enrollments, results: res2, upcomingExams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/students/exams ──────────────────────────────────
router.get('/exams', studentAuth, async (req, res) => {
  const sid = req.user.id;
  try {
    const [exams] = await db.query(
      `SELECT e.exam_id, e.title, e.total_marks, e.duration_mins,
              e.start_time, e.end_time, e.status,
              c.course_code, c.course_name, f.name AS faculty_name,
              (SELECT result_id FROM Results r WHERE r.student_id = ? AND r.exam_id = e.exam_id) AS result_id
       FROM Exams e
       JOIN Courses c ON e.course_id = c.course_id
       JOIN Faculty f ON c.faculty_id = f.faculty_id
       JOIN Enrollments en ON c.course_id = en.course_id
       WHERE en.student_id = ?
       ORDER BY e.start_time DESC`, [sid, sid]);
    res.json(exams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/students/exams/:examId/questions ────────────────
// Returns questions WITHOUT correct_option
router.get('/exams/:examId/questions', studentAuth, async (req, res) => {
  const { examId } = req.params;
  const sid = req.user.id;
  try {
    // Verify exam is live
    const [[exam]] = await db.query(
      'SELECT exam_id, title, total_marks, duration_mins, status FROM Exams WHERE exam_id = ?', [examId]);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.status !== 'live')
      return res.status(403).json({ error: 'Exam is not currently live' });

    // Check not already submitted
    const [[existing]] = await db.query(
      'SELECT result_id FROM Results WHERE student_id = ? AND exam_id = ?', [sid, examId]);
    if (existing) return res.status(409).json({ error: 'You have already submitted this exam' });

    const [questions] = await db.query(
      `SELECT question_id, question_text, option_a, option_b, option_c, option_d, marks, question_order
       FROM Questions WHERE exam_id = ? ORDER BY question_order`, [examId]);

    res.json({ exam, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/students/exams/:examId/submit ──────────────────
// Body: { answers: { questionId: 'A'|'B'|'C'|'D'|null, ... } }
router.post('/exams/:examId/submit', studentAuth, async (req, res) => {
  const { examId } = req.params;
  const sid = req.user.id;
  const { answers } = req.body;

  if (!answers || typeof answers !== 'object')
    return res.status(400).json({ error: 'answers object required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check exam exists
    const [[exam]] = await conn.query(
      'SELECT exam_id, status FROM Exams WHERE exam_id = ?', [examId]);
    if (!exam) { await conn.rollback(); return res.status(404).json({ error: 'Exam not found' }); }

    // Check no duplicate submission
    const [[existing]] = await conn.query(
      'SELECT result_id FROM Results WHERE student_id = ? AND exam_id = ?', [sid, examId]);
    if (existing) { await conn.rollback(); return res.status(409).json({ error: 'Already submitted' }); }

    // Get all questions for this exam
    const [questions] = await conn.query(
      'SELECT question_id FROM Questions WHERE exam_id = ?', [examId]);

    // Insert responses
    for (const q of questions) {
      const qid   = q.question_id.toString();
      const chosen = answers[qid] || null;
      const skip   = chosen === null;
      await conn.query(
        `INSERT INTO Responses (student_id, exam_id, question_id, chosen_option, is_skipped)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE chosen_option = ?, is_skipped = ?`,
        [sid, examId, q.question_id, chosen, skip, chosen, skip]
      );
    }

    // Call stored procedure to compute result
    await conn.query('CALL sp_compute_result(?, ?)', [sid, examId]);

    // Fetch the computed result
    const [[result]] = await conn.query(
      'SELECT * FROM Results WHERE student_id = ? AND exam_id = ?', [sid, examId]);

    await conn.commit();
    res.json({ message: 'Exam submitted successfully', result });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to submit exam' });
  } finally {
    conn.release();
  }
});

// ── GET /api/students/results ────────────────────────────────
router.get('/results', studentAuth, async (req, res) => {
  const sid = req.user.id;
  try {
    const [results] = await db.query(
      `SELECT r.result_id, r.total_score, r.max_score, r.percentage,
              r.grade, r.status, r.correct_count, r.wrong_count, r.skip_count, r.computed_at,
              e.title AS exam_title, e.duration_mins,
              c.course_code, c.course_name
       FROM Results r
       JOIN Exams e   ON r.exam_id   = e.exam_id
       JOIN Courses c ON e.course_id = c.course_id
       WHERE r.student_id = ?
       ORDER BY r.computed_at DESC`, [sid]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
