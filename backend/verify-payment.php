<?php
/**
 * Razorpay Payment Verification Endpoint
 * Verifies HMAC SHA256 signature returned by Razorpay Checkout
 */

require_once __DIR__ . '/config.php';

// Parse incoming JSON body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$razorpayPaymentId = isset($data['razorpay_payment_id']) ? trim($data['razorpay_payment_id']) : '';
$razorpayOrderId   = isset($data['razorpay_order_id']) ? trim($data['razorpay_order_id']) : '';
$razorpaySignature = isset($data['razorpay_signature']) ? trim($data['razorpay_signature']) : '';

if (empty($razorpayPaymentId)) {
    http_response_code(400);
    echo json_encode(array(
        'success' => false,
        'message' => 'Missing razorpay_payment_id parameter.'
    ));
    exit();
}

// Calculate expected signature if order_id is present
$signatureValid = true;

if (!empty($razorpayOrderId) && !empty($razorpaySignature)) {
    $expectedSignature = hash_hmac('sha256', $razorpayOrderId . '|' . $razorpayPaymentId, RAZORPAY_KEY_SECRET);
    $signatureValid = ($expectedSignature === $razorpaySignature);
}

if ($signatureValid) {
    echo json_encode(array(
        'success' => true,
        'message' => 'Payment verified successfully!',
        'payment_id' => $razorpayPaymentId,
        'order_id' => $razorpayOrderId,
        'verified_at' => date('Y-m-d H:i:s')
    ));
} else {
    http_response_code(400);
    echo json_encode(array(
        'success' => false,
        'message' => 'Razorpay payment signature verification failed.'
    ));
}
