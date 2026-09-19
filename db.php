<?php
/**
 * Database Configuration & Connection Manager
 * Grace College of Engineering - Question Paper Generator
 * 
 * Supports seamless switching between:
 * 1. Local Environment (XAMPP):
 *    - Host: localhost
 *    - Database: grace_exam_paper_db
 *    - User: root
 *    - Password: ""
 * 
 * 2. Cloud Environment (InfinityFree):
 *    - Domain: graceexampapergenrator.freedev.app
 *    - Host: sql308.infinityfree.com
 *    - Database: if0_41190104_epass
 *    - User: if0_41190104
 *    - Password: epass2026
 */

// Detect whether running in Local or Cloud environment
function isLocalEnvironment() {
    $httpHost = $_SERVER['HTTP_HOST'] ?? '';
    $serverAddr = $_SERVER['SERVER_ADDR'] ?? '';

    // If running CLI or PHP built-in server or local hostnames
    if (php_sapi_name() === 'cli' || php_sapi_name() === 'cli-server') {
        return true;
    }
    if (empty($httpHost) || 
        strpos($httpHost, 'localhost') !== false || 
        strpos($httpHost, '127.0.0.1') !== false ||
        strpos($httpHost, '::1') !== false) {
        return true;
    }
    if ($serverAddr === '127.0.0.1' || $serverAddr === '::1') {
        return true;
    }
    return false;
}

// Define configuration constants based on environment
if (isLocalEnvironment()) {
    defined('DB_HOST') or define('DB_HOST', 'localhost');
    defined('DB_PORT') or define('DB_PORT', 3306);
    defined('DB_USER') or define('DB_USER', 'root');
    defined('DB_PASS') or define('DB_PASS', '');
    defined('DB_NAME') or define('DB_NAME', 'grace_exam_paper_db');
    defined('APP_ENV') or define('APP_ENV', 'local');
} else {
    // Cloud: InfinityFree (graceexampapergenrator.freedev.app)
    defined('DB_HOST') or define('DB_HOST', 'sql308.infinityfree.com');
    defined('DB_PORT') or define('DB_PORT', 3306);
    defined('DB_USER') or define('DB_USER', 'if0_41190104');
    defined('DB_PASS') or define('DB_PASS', 'epass2026');
    defined('DB_NAME') or define('DB_NAME', 'if0_41190104_epass');
    defined('APP_ENV') or define('APP_ENV', 'cloud');
}

/**
 * Get PDO database connection with auto-reconnect and error resilience
 * @return PDO|null
 */
function getDBConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 3 // fast 3-second timeout if remote host unreachable
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // If local and database doesn't exist yet, try creating it automatically
        if (APP_ENV === 'local' && (strpos($e->getMessage(), 'Unknown database') !== false || $e->getCode() == 1049)) {
            try {
                $rootDsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";charset=utf8mb4";
                $rootPdo = new PDO($rootDsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            } catch (Exception $ex) {
                return null;
            }
        } else {
            return null;
        }
    }

    if ($pdo) {
        initDatabaseTables($pdo);
    }

    return $pdo;
}

/**
 * Auto-creates papers and questions tables if they do not exist
 */
function initDatabaseTables($pdo) {
    static $initialized = false;
    if ($initialized) return;
    $initialized = true;

    try {
        $pdo->exec("
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
                INDEX idx_course_code (course_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $pdo->exec("
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
                or_group VARCHAR(10) NULL,
                sort_order INT NOT NULL DEFAULT 0,
                mcq_options LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_paper_part (paper_id, part),
                INDEX idx_sort (paper_id, sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } catch (Exception $e) {
        // Table creation errors ignored silently
    }
}

/**
 * Returns database status info for the UI indicator
 */
function getDBInfo() {
    $conn = getDBConnection();
    $connected = ($conn !== null);
    $env = APP_ENV;
    $dbName = DB_NAME;

    if ($connected) {
        $label = ($env === 'local') 
            ? "Local DB: {$dbName}" 
            : "Cloud DB: {$dbName}";
        $details = "Connected to " . DB_HOST . " (" . ($env === 'local' ? 'XAMPP Local' : 'InfinityFree Cloud') . ")";
    } else {
        $label = "Offline Storage";
        $details = "MySQL server unreachable, using browser storage";
    }

    return [
        'connected' => $connected,
        'env' => $env,
        'database' => $dbName,
        'host' => DB_HOST,
        'label' => $label,
        'details' => $details
    ];
}
