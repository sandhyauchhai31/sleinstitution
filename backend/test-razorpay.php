<?php
/**
 * Razorpay Test API Verification Script
 * Accessible via /backend/test-razorpay.php
 * Verifies Razorpay credentials and connectivity in Test mode.
 */

require_once __DIR__ . '/config.php';

// Prepare test response
$result = [
    'timestamp' => date('Y-m-d H:i:s'),
    'mode' => defined('RAZORPAY_MODE') ? RAZORPAY_MODE : 'unknown',
    'key_id' => defined('RAZORPAY_KEY_ID') ? RAZORPAY_KEY_ID : 'not_set',
    'has_secret' => defined('RAZORPAY_KEY_SECRET') && !empty(RAZORPAY_KEY_SECRET),
    'api_authenticated' => false,
    'message' => ''
];

if (!defined('RAZORPAY_KEY_ID') || !defined('RAZORPAY_KEY_SECRET') || empty(RAZORPAY_KEY_ID) || empty(RAZORPAY_KEY_SECRET)) {
    $result['message'] = 'Razorpay credentials are missing or empty in configuration.';
    http_response_code(500);
    echo json_encode($result, JSON_PRETTY_PRINT);
    exit;
}

// Perform test cURL request to Razorpay v1/payments with count=1
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.razorpay.com/v1/payments?count=1');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERPWD, RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($httpCode === 200) {
    $result['api_authenticated'] = true;
    $result['http_code'] = $httpCode;
    $result['message'] = 'Razorpay ' . strtoupper($result['mode']) . ' API connected and credentials authenticated successfully!';
} else {
    $result['api_authenticated'] = false;
    $result['http_code'] = $httpCode;
    $result['curl_error'] = $curlError ?: null;
    $decodedResponse = json_decode($response, true);
    $result['razorpay_error'] = $decodedResponse['error'] ?? $response;
    $result['message'] = 'Razorpay API verification returned HTTP ' . $httpCode . '. Check credentials.';
}

echo json_encode($result, JSON_PRETTY_PRINT);
