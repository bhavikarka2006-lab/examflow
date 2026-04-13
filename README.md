# ExamFlow — Online Examination & Result Management System
### CSS 2212 — Database Systems Lab | MIT Bengaluru

---

## Project Structure

```
examflow/
├── schema.sql                  ← Run this first in MySQL
├── backend/
│   ├── server.js               ← Express entry point
│   ├── db.js                   ← MySQL connection pool
│   ├── .env                    ← DB credentials & JWT secret
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js             ← JWT authentication middleware
│   └── routes/
│       ├── auth.js             ← POST /api/auth/login
│       ├── students.js         ← Student APIs
│       ├── faculty.js          ← Faculty APIs
│       └── admin.js            ← Admin APIs
└── frontend/
    └── public/
        └── index.html          ← Complete single-page app
```

---

## Setup Instructions

### Step 1 — Prerequisites
- Node.js v16+ (you have v22)
- MySQL 8.0+

### Step 2 — Database
```bash
mysql -u root -p < schema.sql
```
This creates the database, all 7 tables, indexes, views,
the `sp_compute_result` stored procedure, and seeds sample data.

### Step 3 — Backend dependencies
```bash
cd backend
npm install
```
Installs: express, cors, bcryptjs, jsonwebtoken, mysql2, dotenv

### Step 4 — Configure environment
Edit `backend/.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=examflow_db
JWT_SECRET=examflow_jwt_secret_mit_bengaluru_css2212
JWT_EXPIRES_IN=8h
PORT=3000
```

### Step 5 — Run
```bash
cd backend
node server.js
```
Open: http://localhost:3000

---

## Demo Credentials

| Role    | Identifier      | Password    |
|---------|----------------|-------------|
| Student | 245805270       | student123  |
| Student | 245805190       | student123  |
| Faculty | pavithra@mit.edu| faculty123  |
| Admin   | admin           | admin123    |

---

## API Reference

### Auth
| Method | Endpoint           | Body                                   | Description      |
|--------|--------------------|----------------------------------------|------------------|
| POST   | /api/auth/login    | {role, identifier, password}           | Login all roles  |
| GET    | /api/auth/me       | —                                      | Decode JWT       |

### Student (Bearer token required)
| Method | Endpoint                              | Description                |
|--------|---------------------------------------|----------------------------|
| GET    | /api/students/dashboard               | Dashboard data             |
| GET    | /api/students/exams                   | All enrolled exams         |
| GET    | /api/students/exams/:id/questions     | Exam questions (no answer) |
| POST   | /api/students/exams/:id/submit        | Submit answers             |
| GET    | /api/students/results                 | All results                |

### Faculty (Bearer token required)
| Method | Endpoint                              | Description                |
|--------|---------------------------------------|----------------------------|
| GET    | /api/faculty/dashboard                | Dashboard + analytics      |
| GET    | /api/faculty/courses                  | My courses                 |
| GET    | /api/faculty/exams/:id/results        | Exam result sheet          |
| POST   | /api/faculty/exams                    | Create exam + questions    |
| PATCH  | /api/faculty/exams/:id/status         | Update exam status         |

### Admin (Bearer token required)
| Method | Endpoint                | Description              |
|--------|-------------------------|--------------------------|
| GET    | /api/admin/dashboard    | System-wide stats        |
| GET    | /api/admin/students     | All students             |
| POST   | /api/admin/students     | Add student              |
| DELETE | /api/admin/students/:id | Remove student           |
| GET    | /api/admin/courses      | All courses              |
| POST   | /api/admin/courses      | Add course               |
| GET    | /api/admin/exams        | All exams                |
| GET    | /api/admin/results      | All results              |
| GET    | /api/admin/analytics    | Analytics data           |

---

## Database Schema (6 tables + 2 views + 1 stored procedure)

### Tables
- **Faculty** — faculty_id, name, email, password_hash, designation
- **Students** — student_id, reg_no, name, email, password_hash, branch, semester, section
- **Admins** — admin_id, username, name, email, password_hash
- **Courses** — course_id, course_code, course_name, credits, faculty_id, semester
- **Enrollments** — enrollment_id, student_id, course_id
- **Exams** — exam_id, course_id, title, total_marks, duration_mins, start_time, end_time, status
- **Questions** — question_id, exam_id, question_text, option_a–d, correct_option, marks
- **Responses** — response_id, student_id, exam_id, question_id, chosen_option, is_skipped
- **Results** — result_id, student_id, exam_id, total_score, max_score, percentage, grade, status

### Views
- **vw_result_summary** — Joins Results + Students + Exams + Courses for display
- **vw_class_analytics** — Aggregated stats per exam (avg, pass/fail, grade counts)

### Stored Procedure
- **sp_compute_result(student_id, exam_id)**
  - Joins Responses with Questions
  - Counts correct/wrong/skipped
  - Sums marks for correct answers
  - Applies CASE for grade (A/B/C/D/F)
  - Upserts into Results table

### Key SQL Constraints
- PRIMARY KEY on all id columns
- FOREIGN KEY with referential integrity
- UNIQUE on reg_no, email, course_code
- CHECK on semester (1–8), correct_option (A/B/C/D)
- UNIQUE composite key on (student_id, exam_id, question_id) in Responses

### Indexes
- idx_responses_student, idx_responses_exam
- idx_results_student, idx_results_exam
- idx_questions_exam
- idx_enrollments_student, idx_enrollments_course

---

## Tech Stack (as documented in report Chapter 6)
- **Database**: MySQL 8.0
- **Backend**: Node.js + Express.js
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **DB Driver**: mysql2 with connection pooling
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Fonts**: EB Garamond + DM Sans

---

*CSS 2212 — Database Systems Lab Mini Project*
*School of Computer Engineering, MIT Bengaluru*
*Academic Year 2025–2026*
