<?php
require_once 'db.php';
$pdo = getDBConnection();
if ($pdo) {
    echo "SUCCESS: Connected!\n";
    $stmt = $pdo->query('SHOW TABLES');
    echo "Tables: " . implode(', ', $stmt->fetchAll(PDO::FETCH_COLUMN)) . "\n";
} else {
    echo "FAILED: Could not connect to database.\n";
}
?>
  
