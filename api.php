<?php
/**
 * REST API Endpoint for Question Paper Generator
 * Supports Local XAMPP and InfinityFree Cloud
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Helper function to send JSON responses
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$pdo = getDBConnection();

// Status check endpoint
if ($action === 'status') {
    $info = getDBInfo();
    sendResponse(['success' => true, 'data' => $info]);
}

// If database is not reachable, return an informative fallback
if (!$pdo) {
    sendResponse([
        'success' => false,
        'message' => 'Database connection unavailable',
        'env' => APP_ENV,
        'fallback' => 'localStorage'
    ], 200);
}

// ============================================================
// GET PAPERS LIST
// ============================================================
if ($action === 'get_papers' && $method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT id, regulation, exam_type, degree, programme, course_code, course_name, year, semester, duration, max_marks, status, created_at, updated_at, paper_json FROM papers ORDER BY updated_at DESC");
        $rows = $stmt->fetchAll();

        $papers = [];
        foreach ($rows as $row) {
            if (!empty($row['paper_json'])) {
                $decoded = json_decode($row['paper_json'], true);
                if (is_array($decoded)) {
                    $papers[] = $decoded;
                    continue;
                }
            }
            // Fallback to row structure if paper_json wasn't set
            unset($row['paper_json']);
            $papers[] = $row;
        }

        sendResponse(['success' => true, 'data' => $papers]);
    } catch (Exception $e) {
        sendResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

// ============================================================
// GET SINGLE PAPER
// ============================================================
if ($action === 'get_paper' && $method === 'GET') {
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        sendResponse(['success' => false, 'message' => 'Missing paper id'], 400);
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM papers WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        if (!$row) {
            sendResponse(['success' => false, 'message' => 'Paper not found'], 404);
        }

        if (!empty($row['paper_json'])) {
            $decoded = json_decode($row['paper_json'], true);
            if (is_array($decoded)) {
                sendResponse(['success' => true, 'data' => $decoded]);
            }
        }

        sendResponse(['success' => true, 'data' => $row]);
    } catch (Exception $e) {
        sendResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

// ============================================================
// SAVE / UPDATE PAPER
// ============================================================
if ($action === 'save_paper' && $method === 'POST') {
    $raw = file_get_contents('php://input');
    $paper = json_decode($raw, true);

    if (!is_array($paper)) {
        $paper = $_POST;
    }

    if (empty($paper) || empty($paper['id'])) {
        sendResponse(['success' => false, 'message' => 'Invalid paper data'], 400);
    }

    $id = (string)$paper['id'];
    $regulation = (string)($paper['regulation'] ?? '21');
    $exam_type = (string)($paper['exam_type'] ?? 'Internal Assessment-I');
    $degree = (string)($paper['degree'] ?? 'B.Tech');
    $programme = (string)($paper['programme'] ?? 'Artificial Intelligence and Data Science');
    $course_code = (string)($paper['course_code'] ?? '');
    $course_name = (string)($paper['course_name'] ?? '');
    $year = (string)($paper['year'] ?? '');
    $semester = (string)($paper['semester'] ?? '');
    $branch = (string)($paper['branch'] ?? '');
    $exam_date = !empty($paper['exam_date']) ? (string)$paper['exam_date'] : null;
    $duration = (string)($paper['duration'] ?? '1 1/2 hrs');
    $max_marks = (int)($paper['max_marks'] ?? 50);
    $instructions = (string)($paper['instructions'] ?? '');
    $status = (string)($paper['status'] ?? 'draft');
    $paper_json = json_encode($paper, JSON_UNESCAPED_UNICODE);

    try {
        $sql = "INSERT INTO papers (
            id, regulation, exam_type, degree, programme, course_code, course_name,
            year, semester, branch, exam_date, duration, max_marks, instructions,
            status, paper_json, updated_at
        ) VALUES (
            :id, :regulation, :exam_type, :degree, :programme, :course_code, :course_name,
            :year, :semester, :branch, :exam_date, :duration, :max_marks, :instructions,
            :status, :paper_json, NOW()
        ) ON DUPLICATE KEY UPDATE
            regulation = VALUES(regulation),
            exam_type = VALUES(exam_type),
            degree = VALUES(degree),
            programme = VALUES(programme),
            course_code = VALUES(course_code),
            course_name = VALUES(course_name),
            year = VALUES(year),
            semester = VALUES(semester),
            branch = VALUES(branch),
            exam_date = VALUES(exam_date),
            duration = VALUES(duration),
            max_marks = VALUES(max_marks),
            instructions = VALUES(instructions),
            status = VALUES(status),
            paper_json = VALUES(paper_json),
            updated_at = NOW()";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id' => $id,
            ':regulation' => $regulation,
            ':exam_type' => $exam_type,
            ':degree' => $degree,
            ':programme' => $programme,
            ':course_code' => $course_code,
            ':course_name' => $course_name,
            ':year' => $year,
            ':semester' => $semester,
            ':branch' => $branch,
            ':exam_date' => $exam_date,
            ':duration' => $duration,
            ':max_marks' => $max_marks,
            ':instructions' => $instructions,
            ':status' => $status,
            ':paper_json' => $paper_json
        ]);

        // Synchronize questions relational table
        if (!empty($paper['questions']) && is_array($paper['questions'])) {
            $delStmt = $pdo->prepare("DELETE FROM questions WHERE paper_id = :paper_id");
            $delStmt->execute([':paper_id' => $id]);

            $qSql = "INSERT INTO questions (
                paper_id, part, question_number, question_text, question_type,
                marks, co, unit, k_level, image_path, or_group, sort_order, mcq_options
            ) VALUES (
                :paper_id, :part, :question_number, :question_text, :question_type,
                :marks, :co, :unit, :k_level, :image_path, :or_group, :sort_order, :mcq_options
            )";
            $qStmt = $pdo->prepare($qSql);

            $order = 0;
            foreach ($paper['questions'] as $q) {
                $qStmt->execute([
                    ':paper_id' => $id,
                    ':part' => $q['part'] ?? 'A',
                    ':question_number' => (int)($q['question_number'] ?? ($order + 1)),
                    ':question_text' => (string)($q['question_text'] ?? ''),
                    ':question_type' => (string)($q['question_type'] ?? 'descriptive'),
                    ':marks' => (int)($q['marks'] ?? 0),
                    ':co' => (string)($q['co'] ?? 'CO1'),
                    ':unit' => (string)($q['unit'] ?? 'Unit 1'),
                    ':k_level' => (string)($q['k_level'] ?? 'K1'),
                    ':image_path' => !empty($q['image_path']) ? (string)$q['image_path'] : null,
                    ':or_group' => !empty($q['or_group']) ? (string)$q['or_group'] : null,
                    ':sort_order' => $order++,
                    ':mcq_options' => !empty($q['mcq_options']) ? json_encode($q['mcq_options']) : null
                ]);
            }
        }

        sendResponse([
            'success' => true,
            'message' => 'Paper saved to database successfully',
            'id' => $id,
            'db_name' => DB_NAME,
            'env' => APP_ENV
        ]);
    } catch (Exception $e) {
        sendResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

// ============================================================
// DELETE PAPER
// ============================================================
if ($action === 'delete_paper') {
    $id = $_GET['id'] ?? '';
    if (empty($id) && $method === 'POST') {
        $raw = file_get_contents('php://input');
        $parsed = json_decode($raw, true);
        $id = $parsed['id'] ?? '';
    }

    if (empty($id)) {
        sendResponse(['success' => false, 'message' => 'Missing paper id'], 400);
    }

    try {
        $delQ = $pdo->prepare("DELETE FROM questions WHERE paper_id = :id");
        $delQ->execute([':id' => $id]);

        $delP = $pdo->prepare("DELETE FROM papers WHERE id = :id");
        $delP->execute([':id' => $id]);

        sendResponse(['success' => true, 'message' => 'Paper deleted successfully']);
    } catch (Exception $e) {
        sendResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

// Fallback for unknown action
sendResponse(['success' => false, 'message' => 'Unknown action or method'], 400);
