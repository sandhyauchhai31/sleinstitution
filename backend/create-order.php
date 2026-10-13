<?php
/**
 * Razorpay Create Order Endpoint
 * Creates an official order on Razorpay API using cURL
 */

require_once __DIR__ . '/config.php';

// Parse incoming JSON body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$amountInRupees = isset($data['amount']) ? floatval($data['amount']) : 2000;
$amountInPaise = intval(round($amountInRupees * 100)); // Razorpay expects amount in paise (₹2000 = 200000 paise)
$currency = isset($data['currency']) ? strtoupper($data['currency']) : RAZORPAY_CURRENCY;
$planId = isset($data['planId']) ? $data['planId'] : 'plan-2yr';
$receipt = 'rcpt_' . time() . '_' . rand(100, 999);

$postFields = array(
    'amount' => $amountInPaise,
    'currency' => $currency,
    'receipt' => $receipt,
    'payment_capture' => 1, // Automatic capture
    'notes' => array(
        'planId' => $planId,
        'customerName' => isset($data['customerName']) ? $data['customerName'] : 'Franchisee Partner',
        'customerEmail' => isset($data['customerEmail']) ? $data['customerEmail'] : 'partner@sle-franchise.org',
        'customerPhone' => isset($data['customerPhone']) ? $data['customerPhone'] : '',
        'appNumber' => isset($data['appNumber']) ? $data['appNumber'] : '',
        'course' => isset($data['course']) ? $data['course'] : '',
        'branch' => isset($data['branch']) ? $data['branch'] : '',
        'franchiseeId' => isset($data['franchiseeId']) ? $data['franchiseeId'] : ''
    )
);

try {
    // Call Razorpay API v1 Orders endpoint via cURL
    $ch = curl_init();
    if (!$ch) {
        throw new Exception("cURL initialization failed");
    }
    curl_setopt($ch, CURLOPT_URL, 'https://api.razorpay.com/v1/orders');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postFields));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($httpCode === 200 || $httpCode === 201) {
        $resData = json_decode($response, true);
        echo json_encode(array(
            'success' => true,
            'order_id' => $resData['id'],
            'amount' => $resData['amount'],
            'currency' => $resData['currency'],
            'key_id' => RAZORPAY_KEY_ID,
            'mode' => defined('RAZORPAY_MODE') ? RAZORPAY_MODE : 'live',
            'receipt' => $resData['receipt'],
            'status' => $resData['status']
        ));
    } else {
        $fallbackOrderId = 'order_mock_' . time() . rand(100, 999);
        echo json_encode(array(
            'success' => true,
            'is_mock' => true,
            'order_id' => $fallbackOrderId,
            'amount' => $amountInPaise,
            'currency' => $currency,
            'key_id' => RAZORPAY_KEY_ID,
            'mode' => defined('RAZORPAY_MODE') ? RAZORPAY_MODE : 'test',
            'receipt' => $receipt,
            'notice' => 'Fallback order generated. Razorpay HTTP Code: ' . $httpCode . ' ' . $error
        ));
    }
} catch (Throwable $e) {
    $fallbackOrderId = 'order_mock_' . time() . rand(100, 999);
    echo json_encode(array(
        'success' => true,
        'is_mock' => true,
        'order_id' => $fallbackOrderId,
        'amount' => $amountInPaise,
        'currency' => $currency,
        'key_id' => RAZORPAY_KEY_ID,
        'mode' => 'fallback',
        'receipt' => $receipt,
        'notice' => 'Exception handled: ' . $e->getMessage()
    ));
}

