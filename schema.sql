-- ============================================================
--  ExamFlow — Online Examination & Result Management System
--  CSS 2212 Database Systems Lab | MIT Bengaluru
--  Run: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS examflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE examflow_db;

-- ── FACULTY ──────────────────────────────────────────────────
CREATE TABLE Faculty (
  faculty_id    INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  department    VARCHAR(100) DEFAULT 'School of Computer Engineering',
  designation   VARCHAR(100) DEFAULT 'Assistant Professor',
  created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- ── STUDENTS ─────────────────────────────────────────────────
CREATE TABLE Students (
  student_id    INT AUTO_INCREMENT PRIMARY KEY,
  reg_no        VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  branch        VARCHAR(50)  NOT NULL DEFAULT 'CSE',
  semester      INT          NOT NULL CHECK (semester BETWEEN 1 AND 8),
  section       CHAR(1)      NOT NULL DEFAULT 'A',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── ADMINS ───────────────────────────────────────────────────
CREATE TABLE Admins (
  admin_id      INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── COURSES ──────────────────────────────────────────────────
CREATE TABLE Courses (
  course_id     INT AUTO_INCREMENT PRIMARY KEY,
  course_code   VARCHAR(20)  NOT NULL UNIQUE,
  course_name   VARCHAR(150) NOT NULL,
  credits       INT          NOT NULL CHECK (credits BETWEEN 1 AND 6),
  faculty_id    INT          NOT NULL,
  semester      INT          NOT NULL,
  academic_year VARCHAR(10)  NOT NULL DEFAULT '2025-2026',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (faculty_id) REFERENCES Faculty(faculty_id) ON DELETE RESTRICT
);

-- ── ENROLLMENTS ──────────────────────────────────────────────
CREATE TABLE Enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id    INT NOT NULL,
  course_id     INT NOT NULL,
  enrolled_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enrollment (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES Courses(course_id)   ON DELETE CASCADE
);

-- ── EXAMS ────────────────────────────────────────────────────
CREATE TABLE Exams (
  exam_id       INT AUTO_INCREMENT PRIMARY KEY,
  course_id     INT          NOT NULL,
  title         VARCHAR(200) NOT NULL,
  total_marks   INT          NOT NULL CHECK (total_marks > 0),
  duration_mins INT          NOT NULL CHECK (duration_mins > 0),
  start_time    DATETIME     NOT NULL,
  end_time      DATETIME     NOT NULL,
  status        ENUM('upcoming','live','completed') DEFAULT 'upcoming',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE,
  CHECK (end_time > start_time)
);

-- ── QUESTIONS ────────────────────────────────────────────────
CREATE TABLE Questions (
  question_id    INT AUTO_INCREMENT PRIMARY KEY,
  exam_id        INT          NOT NULL,
  question_text  TEXT         NOT NULL,
  option_a       VARCHAR(500) NOT NULL,
  option_b       VARCHAR(500) NOT NULL,
  option_c       VARCHAR(500) NOT NULL,
  option_d       VARCHAR(500) NOT NULL,
  correct_option CHAR(1)      NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  marks          INT          NOT NULL DEFAULT 1 CHECK (marks > 0),
  question_order INT          NOT NULL DEFAULT 1,
  FOREIGN KEY (exam_id) REFERENCES Exams(exam_id) ON DELETE CASCADE
);

-- ── RESPONSES ────────────────────────────────────────────────
CREATE TABLE Responses (
  response_id    INT AUTO_INCREMENT PRIMARY KEY,
  student_id     INT    NOT NULL,
  exam_id        INT    NOT NULL,
  question_id    INT    NOT NULL,
  chosen_option  CHAR(1) CHECK (chosen_option IN ('A','B','C','D')),
  is_skipped     BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_response (student_id, exam_id, question_id),
  FOREIGN KEY (student_id)  REFERENCES Students(student_id)  ON DELETE CASCADE,
  FOREIGN KEY (exam_id)     REFERENCES Exams(exam_id)        ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES Questions(question_id) ON DELETE CASCADE
);

-- ── RESULTS ──────────────────────────────────────────────────
CREATE TABLE Results (
  result_id    INT AUTO_INCREMENT PRIMARY KEY,
  student_id   INT            NOT NULL,
  exam_id      INT            NOT NULL,
  total_score  DECIMAL(6, 2)  NOT NULL DEFAULT 0,
  max_score    INT            NOT NULL,
  percentage   DECIMAL(5, 2)  NOT NULL DEFAULT 0,
  grade        CHAR(2)        NOT NULL DEFAULT 'F',
  status       ENUM('Pass','Fail') NOT NULL DEFAULT 'Fail',
  correct_count INT           NOT NULL DEFAULT 0,
  wrong_count   INT           NOT NULL DEFAULT 0,
  skip_count    INT           NOT NULL DEFAULT 0,
  computed_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_result (student_id, exam_id),
  FOREIGN KEY (student_id) REFERENCES Students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id)    REFERENCES Exams(exam_id)       ON DELETE CASCADE
);

-- ============================================================
--  INDEXES for JOIN performance
-- ============================================================
CREATE INDEX idx_responses_student  ON Responses(student_id);
CREATE INDEX idx_responses_exam     ON Responses(exam_id);
CREATE INDEX idx_results_student    ON Results(student_id);
CREATE INDEX idx_results_exam       ON Results(exam_id);
CREATE INDEX idx_questions_exam     ON Questions(exam_id);
CREATE INDEX idx_enrollments_student ON Enrollments(student_id);
CREATE INDEX idx_enrollments_course  ON Enrollments(course_id);

-- ============================================================
--  VIEWS
-- ============================================================

-- Result summary view (used by student result page & faculty)
CREATE VIEW vw_result_summary AS
SELECT
  r.result_id,
  s.reg_no,
  s.name        AS student_name,
  s.branch,
  s.semester,
  e.title       AS exam_title,
  c.course_code,
  c.course_name,
  r.total_score,
  r.max_score,
  r.percentage,
  r.grade,
  r.status,
  r.correct_count,
  r.wrong_count,
  r.skip_count,
  r.computed_at
FROM Results r
JOIN Students s ON r.student_id = s.student_id
JOIN Exams    e ON r.exam_id    = e.exam_id
JOIN Courses  c ON e.course_id  = c.course_id;

-- Class analytics view (used by faculty analytics page)
CREATE VIEW vw_class_analytics AS
SELECT
  e.exam_id,
  e.title            AS exam_title,
  c.course_code,
  COUNT(r.result_id) AS total_students,
  ROUND(AVG(r.percentage), 2)  AS avg_percentage,
  MAX(r.percentage)  AS highest,
  MIN(r.percentage)  AS lowest,
  SUM(CASE WHEN r.status = 'Pass' THEN 1 ELSE 0 END) AS pass_count,
  SUM(CASE WHEN r.status = 'Fail' THEN 1 ELSE 0 END) AS fail_count,
  SUM(CASE WHEN r.grade  = 'A'    THEN 1 ELSE 0 END) AS grade_a,
  SUM(CASE WHEN r.grade  = 'B'    THEN 1 ELSE 0 END) AS grade_b,
  SUM(CASE WHEN r.grade  = 'C'    THEN 1 ELSE 0 END) AS grade_c,
  SUM(CASE WHEN r.grade  = 'D'    THEN 1 ELSE 0 END) AS grade_d,
  SUM(CASE WHEN r.grade  = 'F'    THEN 1 ELSE 0 END) AS grade_f
FROM Results r
JOIN Exams   e ON r.exam_id   = e.exam_id
JOIN Courses c ON e.course_id = c.course_id
GROUP BY e.exam_id, e.title, c.course_code;

-- ============================================================
--  STORED PROCEDURE — sp_compute_result
--  Called after student submits exam.
--  Reads Responses, computes score, writes to Results.
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_compute_result(IN p_student_id INT, IN p_exam_id INT)
BEGIN
  DECLARE v_correct   INT     DEFAULT 0;
  DECLARE v_wrong     INT     DEFAULT 0;
  DECLARE v_skip      INT     DEFAULT 0;
  DECLARE v_score     DECIMAL(6,2) DEFAULT 0;
  DECLARE v_max       INT     DEFAULT 0;
  DECLARE v_pct       DECIMAL(5,2) DEFAULT 0;
  DECLARE v_grade     CHAR(2) DEFAULT 'F';
  DECLARE v_status    VARCHAR(4) DEFAULT 'Fail';

  -- Count correct answers
  SELECT COUNT(*) INTO v_correct
  FROM Responses rsp
  JOIN Questions q ON rsp.question_id = q.question_id
  WHERE rsp.student_id  = p_student_id
    AND rsp.exam_id     = p_exam_id
    AND rsp.is_skipped  = FALSE
    AND rsp.chosen_option = q.correct_option;

  -- Count wrong answers
  SELECT COUNT(*) INTO v_wrong
  FROM Responses rsp
  JOIN Questions q ON rsp.question_id = q.question_id
  WHERE rsp.student_id  = p_student_id
    AND rsp.exam_id     = p_exam_id
    AND rsp.is_skipped  = FALSE
    AND rsp.chosen_option != q.correct_option;

  -- Count skipped
  SELECT COUNT(*) INTO v_skip
  FROM Responses
  WHERE student_id = p_student_id
    AND exam_id    = p_exam_id
    AND is_skipped = TRUE;

  -- Total score (sum of marks for correct answers)
  SELECT COALESCE(SUM(q.marks), 0) INTO v_score
  FROM Responses rsp
  JOIN Questions q ON rsp.question_id = q.question_id
  WHERE rsp.student_id    = p_student_id
    AND rsp.exam_id       = p_exam_id
    AND rsp.is_skipped    = FALSE
    AND rsp.chosen_option = q.correct_option;

  -- Max possible score
  SELECT total_marks INTO v_max FROM Exams WHERE exam_id = p_exam_id;

  -- Percentage
  SET v_pct = IF(v_max > 0, ROUND((v_score / v_max) * 100, 2), 0);

  -- Grade via CASE
  SET v_grade = CASE
    WHEN v_pct >= 90 THEN 'A'
    WHEN v_pct >= 75 THEN 'B'
    WHEN v_pct >= 60 THEN 'C'
    WHEN v_pct >= 50 THEN 'D'
    ELSE 'F'
  END;

  SET v_status = IF(v_pct >= 50, 'Pass', 'Fail');

  -- Upsert into Results
  INSERT INTO Results
    (student_id, exam_id, total_score, max_score, percentage, grade, status,
     correct_count, wrong_count, skip_count)
  VALUES
    (p_student_id, p_exam_id, v_score, v_max, v_pct, v_grade, v_status,
     v_correct, v_wrong, v_skip)
  ON DUPLICATE KEY UPDATE
    total_score   = v_score,
    max_score     = v_max,
    percentage    = v_pct,
    grade         = v_grade,
    status        = v_status,
    correct_count = v_correct,
    wrong_count   = v_wrong,
    skip_count    = v_skip,
    computed_at   = CURRENT_TIMESTAMP;
END$$

DELIMITER ;

-- ============================================================
--  SEED DATA
-- ============================================================

-- Passwords are bcrypt hashes of the plaintext shown in comments
-- plaintext: faculty123
INSERT INTO Faculty (name, email, password_hash, designation) VALUES
('Dr Pavithra N',  'pavithra@mit.edu', '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'Assistant Professor Senior Scale'),
('Dr Rahul Kumar', 'rahul@mit.edu',    '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'Assistant Professor'),
('Dr Meena Iyer',  'meena@mit.edu',    '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'Associate Professor');

-- plaintext: admin123
INSERT INTO Admins (username, name, email, password_hash) VALUES
('admin', 'Administrator', 'admin@mit.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- plaintext: student123
INSERT INTO Students (reg_no, name, email, password_hash, branch, semester, section) VALUES
('245805270', 'Addala Venkata Rohith Varma', 'rohith@mit.edu',  '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'CSE', 4, 'B'),
('245805190', 'Karka Bhavesh Reddy',         'bhavesh@mit.edu', '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'CSE', 4, 'B'),
('245805301', 'Priya Sharma',                'priya@mit.edu',   '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'CSE', 4, 'A'),
('245805312', 'Arjun Mehta',                 'arjun@mit.edu',   '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'CSE', 4, 'C'),
('245805323', 'Divya Nair',                  'divya@mit.edu',   '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'CSE', 4, 'B'),
('245805334', 'Rohan Gupta',                 'rohan@mit.edu',   '$2b$10$K7L1OJ45/4Y2nIvhRVpCU.ZecD2SXFBkFxuMoq6QORbKFcZFuFVKy', 'CSE', 4, 'A');

INSERT INTO Courses (course_code, course_name, credits, faculty_id, semester) VALUES
('CSS2212', 'Database Systems Lab',  3, 1, 4),
('CSS2201', 'Computer Networks',     4, 2, 4),
('CSS2215', 'Operating Systems',     4, 3, 4),
('CSS2220', 'Data Structures',       3, 1, 4);

-- Enroll all students in all courses
INSERT INTO Enrollments (student_id, course_id)
SELECT s.student_id, c.course_id FROM Students s CROSS JOIN Courses c;

INSERT INTO Exams (course_id, title, total_marks, duration_mins, start_time, end_time, status) VALUES
(1, 'Mid Semester — DBMS',       100, 90, '2026-03-20 09:00:00', '2026-03-20 10:30:00', 'completed'),
(1, 'Lab Quiz — SQL Queries',     25, 20, '2026-04-10 11:00:00', '2026-04-10 11:20:00', 'live'),
(1, 'Unit Test 1 — SQL Basics',   50, 30, '2026-04-12 10:00:00', '2026-04-12 10:30:00', 'upcoming'),
(2, 'Unit Test 2 — Networking',   50, 45, '2026-04-18 14:00:00', '2026-04-18 14:45:00', 'upcoming');

-- Questions for Lab Quiz (exam_id = 2)
INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, question_order) VALUES
(2, 'Which SQL clause is used to filter groups after aggregation?',
 'WHERE', 'HAVING', 'GROUP BY', 'ORDER BY', 'B', 5, 1),
(2, 'Which normal form eliminates transitive functional dependencies?',
 'First Normal Form (1NF)', 'Second Normal Form (2NF)', 'Third Normal Form (3NF)', 'Boyce-Codd Normal Form', 'C', 5, 2),
(2, 'What does a FOREIGN KEY constraint enforce in a relational schema?',
 'Uniqueness of column values', 'Referential integrity between tables', 'Non-null values in a column', 'Automatic index creation', 'B', 5, 3),
(2, 'Which SQL command creates a virtual table based on a SELECT query?',
 'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'C', 5, 4),
(2, 'Which JOIN returns all rows from both tables including non-matching rows?',
 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'D', 5, 5);

-- Questions for Mid Semester (exam_id = 1) — 10 questions
INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, question_order) VALUES
(1, 'What is the primary purpose of a primary key?',
 'To allow duplicate values', 'To uniquely identify each row', 'To link two tables', 'To sort records', 'B', 10, 1),
(1, 'Which SQL statement is used to retrieve data from a database?',
 'INSERT', 'UPDATE', 'SELECT', 'DELETE', 'C', 10, 2),
(1, 'Which of the following is a DDL command?',
 'SELECT', 'INSERT', 'CREATE', 'UPDATE', 'C', 10, 3),
(1, 'In which normal form is a relation if it has no repeating groups?',
 '1NF', '2NF', '3NF', 'BCNF', 'A', 10, 4),
(1, 'Which join returns only the rows with matching values in both tables?',
 'FULL JOIN', 'LEFT JOIN', 'INNER JOIN', 'CROSS JOIN', 'C', 10, 5),
(1, 'What does ACID stand for in database transactions?',
 'Atomicity Consistency Isolation Durability', 'Access Control Integrity Data', 'Automated Commit Insert Delete', 'None of the above', 'A', 10, 6),
(1, 'Which command is used to remove a table from the database?',
 'DELETE TABLE', 'REMOVE TABLE', 'DROP TABLE', 'ERASE TABLE', 'C', 10, 7),
(1, 'A VIEW in SQL is best described as:',
 'A physical copy of a table', 'A virtual table based on a query', 'An index on a table', 'A stored procedure', 'B', 10, 8),
(1, 'Which aggregate function returns the number of rows?',
 'SUM()', 'AVG()', 'COUNT()', 'MAX()', 'C', 10, 9),
(1, 'Which clause is used to sort query results?',
 'GROUP BY', 'HAVING', 'WHERE', 'ORDER BY', 'D', 10, 10);

-- Seed results for Mid Semester for all 6 students
INSERT INTO Responses (student_id, exam_id, question_id, chosen_option, is_skipped) VALUES
-- Student 1 (245805270) - 8 correct, 1 wrong, 1 skipped → 88%
(1,1,11,'B',false),(1,1,12,'C',false),(1,1,13,'C',false),(1,1,14,'A',false),(1,1,15,'C',false),
(1,1,16,'A',false),(1,1,17,'C',false),(1,1,18,'B',false),(1,1,19,'A',false),(1,1,20,'D',false);

CALL sp_compute_result(1, 1);

INSERT INTO Responses (student_id, exam_id, question_id, chosen_option, is_skipped) VALUES
-- Student 2 (245805190) - 7 correct
(2,1,11,'B',false),(2,1,12,'C',false),(2,1,13,'C',false),(2,1,14,'A',false),(2,1,15,'C',false),
(2,1,16,'A',false),(2,1,17,'C',false),(2,1,18,'A',false),(2,1,19,'C',false),(2,1,20,'B',false);

CALL sp_compute_result(2, 1);

INSERT INTO Responses (student_id, exam_id, question_id, chosen_option, is_skipped) VALUES
-- Student 3 (245805301) - 9 correct
(3,1,11,'B',false),(3,1,12,'C',false),(3,1,13,'C',false),(3,1,14,'A',false),(3,1,15,'C',false),
(3,1,16,'A',false),(3,1,17,'C',false),(3,1,18,'B',false),(3,1,19,'C',false),(3,1,20,'D',false);

CALL sp_compute_result(3, 1);

INSERT INTO Responses (student_id, exam_id, question_id, chosen_option, is_skipped) VALUES
-- Student 4 (245805312) - 5 correct
(4,1,11,'B',false),(4,1,12,'A',false),(4,1,13,'C',false),(4,1,14,'B',false),(4,1,15,'C',false),
(4,1,16,'A',false),(4,1,17,'A',false),(4,1,18,'A',false),(4,1,19,'C',false),(4,1,20,'D',false);

CALL sp_compute_result(4, 1);

INSERT INTO Responses (student_id, exam_id, question_id, chosen_option, is_skipped) VALUES
-- Student 5 (245805323) - 4 correct
(5,1,11,'A',false),(5,1,12,'A',false),(5,1,13,'C',false),(5,1,14,'B',false),(5,1,15,'A',false),
(5,1,16,'A',false),(5,1,17,'A',false),(5,1,18,'A',false),(5,1,19,'C',false),(5,1,20,'A',false);

CALL sp_compute_result(5, 1);

INSERT INTO Responses (student_id, exam_id, question_id, chosen_option, is_skipped) VALUES
-- Student 6 (245805334) - 8 correct
(6,1,11,'B',false),(6,1,12,'C',false),(6,1,13,'C',false),(6,1,14,'A',false),(6,1,15,'C',false),
(6,1,16,'A',false),(6,1,17,'C',false),(6,1,18,'B',false),(6,1,19,'A',false),(6,1,20,'A',false);

CALL sp_compute_result(6, 1);
