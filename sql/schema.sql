-- ============================================================
-- Grace College of Engineering - Question Paper Generator
-- Database Name: grace_exam_paper_db (Local XAMPP)
-- Cloud Database: if0_41190104_epass (InfinityFree)
-- ============================================================

-- FOR LOCAL XAMPP:
CREATE DATABASE IF NOT EXISTS grace_exam_paper_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE grace_exam_paper_db;

-- FOR INFINITYFREE CLOUD:
-- In InfinityFree phpMyAdmin, select your database: `if0_41190104_epass`
-- Then run the CREATE TABLE queries below.

-- ============================================================
-- Papers table - stores question paper metadata & full paper JSON
-- ============================================================
CREATE TABLE IF NOT EXISTS papers (
    id VARCHAR(100) PRIMARY KEY,
    regulation VARCHAR(10) NOT NULL DEFAULT '21',
    exam_type VARCHAR(100) NOT NULL DEFAULT 'Internal Assessment-I',
    degree VARCHAR(50) NOT NULL DEFAULT 'B.Tech',
    programme VARCHAR(200) NOT NULL DEFAULT 'Artificial Intelligence and Data Science',
    course_code VARCHAR(50) NOT NULL DEFAULT '',
    course_name VARCHAR(200) NOT NULL DEFAULT '',
    year VARCHAR(20) NOT NULL DEFAULT '',
    semester VARCHAR(20) NOT NULL DEFAULT '',
    branch VARCHAR(200) NOT NULL DEFAULT '',
    exam_date VARCHAR(50) NULL,
    duration VARCHAR(50) NOT NULL DEFAULT '1 1/2 hrs',
    max_marks INT NOT NULL DEFAULT 50,
    instructions TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    paper_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_regulation (regulation),
    INDEX idx_status (status),
    INDEX idx_course_code (course_code),
    INDEX idx_semester (semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Questions table - stores individual questions linked to papers
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_id VARCHAR(100) NOT NULL,
    part VARCHAR(10) NOT NULL,
    question_number INT NOT NULL DEFAULT 1,
    question_text LONGTEXT NOT NULL,
    question_type VARCHAR(30) NOT NULL DEFAULT 'descriptive',
    marks INT NOT NULL DEFAULT 0,
    co VARCHAR(10) NOT NULL DEFAULT 'CO1',
    unit VARCHAR(20) NOT NULL DEFAULT 'Unit 1',
    k_level VARCHAR(10) NOT NULL DEFAULT 'K1',
    image_path LONGTEXT NULL,
    image_alignment VARCHAR(20) DEFAULT 'center',
    image_size VARCHAR(20) DEFAULT 'medium',
    image_width INT NULL,
    image_height INT NULL,
    parent_id INT NULL,
    or_group VARCHAR(10) NULL COMMENT 'a or b for OR pairs',
    sub_number VARCHAR(10) NULL COMMENT 'i, ii, iii etc.',
    sort_order INT NOT NULL DEFAULT 0,
    mcq_options LONGTEXT NULL COMMENT 'JSON array of options',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_paper_part (paper_id, part),
    INDEX idx_sort (paper_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
