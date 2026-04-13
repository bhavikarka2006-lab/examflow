const express  = require('express');
const bcrypt   = require('bcryptjs');
const db       = require('../db');
const auth     = require('../middleware/auth');
const router   = express.Router();

const adminAuth = auth(['admin']);

// ── GET /api/admin/dashboard ─────────────────────────────────
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [[{ total_students }]] = await db.query('SELECT COUNT(*) AS total_students FROM Students');
    const [[{ total_courses  }]] = await db.query('SELECT COUNT(*) AS total_courses  FROM Courses');
    const [[{ total_exams    }]] = await db.query('SELECT COUNT(*) AS total_exams    FROM Exams');
    const [[{ total_results  }]] = await db.query('SELECT COUNT(*) AS total_results  FROM Results');
    const [[{ pass_count     }]] = await db.query("SELECT COUNT(*) AS pass_count FROM Results WHERE status='Pass'");
    const [[{ avg_pct        }]] = await db.query('SELECT ROUND(AVG(percentage),2) AS avg_pct FROM Results');

    const [exams]   = await db.query(
      `SELECT e.exam_id, e.title, e.status, e.start_time, c.course_code, f.name AS faculty_name
       FROM Exams e JOIN Courses c ON e.course_id=c.course_id JOIN Faculty f ON c.faculty_id=f.faculty_id
       ORDER BY e.start_time DESC`);

    const [gradeDistribution] = await db.query(
      `SELECT grade, COUNT(*) AS count FROM Results GROUP BY grade ORDER BY grade`);

    res.json({
      stats: { total_students, total_courses, total_exams, total_results, pass_count, avg_pct },
      exams, gradeDistribution
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/admin/students ──────────────────────────────────
router.get('/students', adminAuth, async (req, res) => {
  try {
    const [students] = await db.query(
      `SELECT s.student_id, s.reg_no, s.name, s.email, s.branch, s.semester, s.section,
              COUNT(DISTINCT en.course_id) AS enrolled_courses,
              MAX(r.percentage) AS best_score,
              MAX(r.grade) AS best_grade
       FROM Students s
       LEFT JOIN Enrollments en ON s.student_id = en.student_id
       LEFT JOIN Results r ON s.student_id = r.student_id
       GROUP BY s.student_id
       ORDER BY s.reg_no`);
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/admin/students ─────────────────────────────────
router.post('/students', adminAuth, async (req, res) => {
  const { reg_no, name, email, password, branch, semester, section } = req.body;
  if (!reg_no || !name || !email || !password)
    return res.status(400).json({ error: 'reg_no, name, email, password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await db.query(
      'INSERT INTO Students (reg_no, name, email, password_hash, branch, semester, section) VALUES (?,?,?,?,?,?,?)',
      [reg_no, name, email, hash, branch || 'CSE', semester || 4, section || 'A']);
    res.status(201).json({ message: 'Student created', student_id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Registration number or email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/admin/students/:id ───────────────────────────
router.delete('/students/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM Students WHERE student_id = ?', [req.params.id]);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/admin/courses ───────────────────────────────────
router.get('/courses', adminAuth, async (req, res) => {
  try {
    const [courses] = await db.query(
      `SELECT c.*, f.name AS faculty_name,
              COUNT(DISTINCT en.student_id) AS enrolled_count,
              COUNT(DISTINCT e.exam_id)     AS exam_count
       FROM Courses c
       JOIN Faculty f ON c.faculty_id = f.faculty_id
       LEFT JOIN Enrollments en ON c.course_id = en.course_id
       LEFT JOIN Exams e ON c.course_id = e.course_id
       GROUP BY c.course_id ORDER BY c.course_code`);
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/admin/courses ──────────────────────────────────
router.post('/courses', adminAuth, async (req, res) => {
  const { course_code, course_name, credits, faculty_id, semester } = req.body;
  if (!course_code || !course_name || !faculty_id)
    return res.status(400).json({ error: 'course_code, course_name, faculty_id required' });
  try {
    const [r] = await db.query(
      'INSERT INTO Courses (course_code, course_name, credits, faculty_id, semester) VALUES (?,?,?,?,?)',
      [course_code, course_name, credits || 3, faculty_id, semester || 4]);
    res.status(201).json({ message: 'Course created', course_id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Course code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/admin/exams ─────────────────────────────────────
router.get('/exams', adminAuth, async (req, res) => {
  try {
    const [exams] = await db.query(
      `SELECT e.*, c.course_code, c.course_name, f.name AS faculty_name,
              COUNT(DISTINCT r.result_id) AS result_count
       FROM Exams e
       JOIN Courses c ON e.course_id = c.course_id
       JOIN Faculty f ON c.faculty_id = f.faculty_id
       LEFT JOIN Results r ON r.exam_id = e.exam_id
       GROUP BY e.exam_id ORDER BY e.start_time DESC`);
    res.json(exams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/admin/results ───────────────────────────────────
router.get('/results', adminAuth, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT r.result_id, s.name AS student_name, s.reg_no, s.section,
              e.title AS exam_title, c.course_code,
              r.total_score, r.max_score, r.percentage, r.grade, r.status,
              r.correct_count, r.wrong_count, r.skip_count, r.computed_at
       FROM Results r
       JOIN Students s ON r.student_id = s.student_id
       JOIN Exams    e ON r.exam_id    = e.exam_id
       JOIN Courses  c ON e.course_id  = c.course_id
       ORDER BY r.computed_at DESC`);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/admin/analytics ─────────────────────────────────
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const [classAnalytics] = await db.query('SELECT * FROM vw_class_analytics');
    const [topStudents]    = await db.query(
      `SELECT s.name, s.reg_no, ROUND(AVG(r.percentage),1) AS avg_pct, COUNT(*) AS exams_taken
       FROM Results r JOIN Students s ON r.student_id=s.student_id
       GROUP BY r.student_id ORDER BY avg_pct DESC LIMIT 5`);
    const [facultyLoad]    = await db.query(
      `SELECT f.name, COUNT(DISTINCT e.exam_id) AS exam_count, COUNT(DISTINCT c.course_id) AS course_count
       FROM Faculty f
       JOIN Courses c ON c.faculty_id=f.faculty_id
       LEFT JOIN Exams e ON e.course_id=c.course_id
       GROUP BY f.faculty_id`);
    res.json({ classAnalytics, topStudents, facultyLoad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
