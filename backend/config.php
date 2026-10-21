<?php
/**
 * Razorpay & Application Configuration File
 * Reads credentials from root .env or falls back to defined constants.
 */

// Enable CORS and JSON headers for web requests
if (php_sapi_name() !== 'cli' && !headers_sent()) {
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Max-Age: 86400");
    } else {
        header("Access-Control-Allow-Origin: *");
    }

    $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($requestMethod === 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
            header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        }
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
        } else {
            header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
        }
        http_response_code(200);
        exit(0);
    }

    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    header("Content-Type: application/json; charset=UTF-8");
}

// Function to load .env variables if file exists
function loadEnv($envPath) {
    if (!file_exists($envPath) || !is_readable($envPath)) {
        return;
    }
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) return;
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0 || strpos($trimmed, '=') === false) continue;
        $parts = explode('=', $trimmed, 2);
        if (count($parts) < 2) continue;
        $name = trim($parts[0]);
        // Strip outer quotes from value if present
        $value = trim($parts[1], " \t\n\r\0\x0B\"'");
        putenv(sprintf('%s=%s', $name, $value));
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

// Search and load .env from multiple candidate paths
$possibleEnvPaths = [
    __DIR__ . '/.env',
    __DIR__ . '/../.env',
    isset($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') . '/.env' : null,
    isset($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') . '/backend/.env' : null,
    dirname(__DIR__, 2) . '/.env'
];

foreach ($possibleEnvPaths as $envCandidate) {
    if ($envCandidate && file_exists($envCandidate)) {
        loadEnv($envCandidate);
    }
}

// Dynamically select credentials based on active mode (DEFAULT: 'live')
$configuredMode = strtolower(trim((string)(
    getenv('VITE_RAZORPAY_MODE') ?: (getenv('RAZORPAY_MODE') ?: 'live')
)));
$razorpayMode = ($configuredMode === 'test') ? 'test' : 'live';

if ($razorpayMode === 'test') {
    $activeKeyId     = getenv('VITE_RAZORPAY_TEST_KEY_ID') ?: (getenv('TEST_RAZORPAY_KEY_ID') ?: (getenv('RAZORPAY_TEST_KEY_ID') ?: 'rzp_test_SPs6AqG8E3r2Cp'));
    $activeKeySecret = getenv('RAZORPAY_TEST_KEY_SECRET') ?: (getenv('TEST_RAZORPAY_KEY_SECRET') ?: '6EF1JJ2U4Hy5h93WPHVb6GZg');
} else {
    // Production Live Credentials (Active by default)
    $activeKeyId     = getenv('RAZORPAY_LIVE_KEY_ID') ?: (getenv('VITE_RAZORPAY_LIVE_KEY_ID') ?: (getenv('VITE_RAZORPAY_KEY_ID') ?: (getenv('RAZORPAY_KEY_ID') ?: (getenv('key_id') ?: 'rzp_live_TSInBiL96HvXCm'))));
    $activeKeySecret = getenv('RAZORPAY_LIVE_KEY_SECRET') ?: (getenv('VITE_RAZORPAY_LIVE_KEY_SECRET') ?: (getenv('VITE_RAZORPAY_KEY_SECRET') ?: (getenv('RAZORPAY_KEY_SECRET') ?: (getenv('key_secret') ?: 'sadn8Oy8K2TVSKV70kPbcQFG'))));
}

define('RAZORPAY_MODE', $razorpayMode);
define('RAZORPAY_KEY_ID', $activeKeyId);
define('RAZORPAY_KEY_SECRET', $activeKeySecret);
define('RAZORPAY_CURRENCY', 'INR');

