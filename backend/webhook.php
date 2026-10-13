<?php
/**
 * Razorpay Webhook Listener — SLE Institution
 * ============================================
 * Listens for Razorpay server-side events (especially payment.captured).
 * This runs on YOUR server and is called by Razorpay — NOT by the browser.
 *
 * PURPOSE:
 *   If a student pays but their phone/browser disconnects before the
 *   JavaScript handler fires, their payment is already captured on Razorpay.
 *   This webhook activates their student record in Firebase automatically,
 *   ensuring no payment is ever "orphaned" without a student record.
 *
 * HOW TO REGISTER (Razorpay Dashboard):
 *   1. Login -> Settings -> Webhooks -> Add New Webhook
 *   2. Webhook URL: https://yourdomain.com/backend/webhook.php
 *   3. Events to enable: payment.captured
 *   4. Secret: Copy the value of RAZORPAY_WEBHOOK_SECRET from your .env
 *   5. Save. Razorpay will now POST to this URL on every successful payment.
 *
 * SECURITY:
 *   Every request from Razorpay is signed with HMAC-SHA256.
 *   We verify the X-Razorpay-Signature header before processing anything.
 *
 * LOGS:
 *   All events are appended to backend/logs/webhook_log.txt (auto-created).
 */

// Do NOT include config.php (it sets CORS headers for browser requests).
// Webhooks arrive from Razorpay servers - no CORS needed.
header('Content-Type: application/json');

// Load .env manually (same approach as config.php)
function webhookLoadEnv($envPath) {
    if (!file_exists($envPath)) return;
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) return;
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0 || strpos($trimmed, '=') === false) continue;
        $parts = explode('=', $trimmed, 2);
        if (count($parts) < 2) continue;
        $name  = trim($parts[0]);
        $value = trim($parts[1]);
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name]    = $value;
            $_SERVER[$name] = $value;
        }
    }
}
webhookLoadEnv(__DIR__ . '/../.env');

// Logging helper
function webhookLog($message, $data = []) {
    $logDir  = __DIR__ . '/logs';
    $logFile = $logDir . '/webhook_log.txt';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $ts     = date('Y-m-d H:i:s');
    $prefix = "[{$ts}] {$message}";
    $line   = $data ? $prefix . ' | ' . json_encode($data, JSON_UNESCAPED_UNICODE) : $prefix;
    @file_put_contents($logFile, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    webhookLog('Non-POST request rejected', ['method' => $_SERVER['REQUEST_METHOD']]);
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

// Read raw body and incoming signature
$rawBody       = file_get_contents('php://input');
$incomingSig   = trim($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '');
$webhookSecret = getenv('RAZORPAY_WEBHOOK_SECRET') ?: '';

webhookLog('Webhook received', [
    'sig_present' => !empty($incomingSig),
    'secret_set'  => !empty($webhookSecret),
    'body_len'    => strlen($rawBody)
]);

// Signature verification
// Always verify when secret is configured. Accept without verification in
// development (empty secret) to allow local ngrok testing.
if (!empty($webhookSecret)) {
    if (empty($incomingSig)) {
        webhookLog('REJECTED: Missing X-Razorpay-Signature header');
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing signature header']);
        exit();
    }
    $expectedSig = hash_hmac('sha256', $rawBody, $webhookSecret);
    if (!hash_equals($expectedSig, $incomingSig)) {
        webhookLog('REJECTED: Signature mismatch', [
            'expected_prefix' => substr($expectedSig, 0, 8) . '...',
            'received_prefix' => substr($incomingSig, 0, 8) . '...'
        ]);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Signature verification failed']);
        exit();
    }
    webhookLog('Signature verified OK');
} else {
    webhookLog('WARNING: RAZORPAY_WEBHOOK_SECRET not set - skipping signature check (dev mode)');
}

// Parse event payload
$event = json_decode($rawBody, true);
if (!$event || !isset($event['event'])) {
    webhookLog('REJECTED: Invalid JSON payload');
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid payload']);
    exit();
}

$eventType = $event['event'];       // e.g. "payment.captured"
$entity    = $event['payload']['payment']['entity'] ?? [];

webhookLog("Event: {$eventType}", [
    'payment_id' => $entity['id']       ?? '',
    'order_id'   => $entity['order_id'] ?? '',
    'amount'     => $entity['amount']   ?? 0,
    'status'     => $entity['status']   ?? ''
]);

// Only handle payment.captured
if ($eventType !== 'payment.captured') {
    // Acknowledge other events gracefully - Razorpay retries on non-2xx
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => "Event '{$eventType}' acknowledged (not handled)"]);
    webhookLog("Event '{$eventType}' acknowledged without action");
    exit();
}

// Extract payment details
$paymentId   = trim($entity['id']       ?? '');
$orderId     = trim($entity['order_id'] ?? '');
$amountPaise = intval($entity['amount'] ?? 0);
$amountRs    = $amountPaise / 100;
$currency    = $entity['currency'] ?? 'INR';

// Razorpay Notes (appNumber, course, branch, etc. we sent during order creation)
$notes         = $entity['notes'] ?? [];
$appNumber     = trim($notes['appNumber']      ?? '');
$customerName  = trim($notes['customerName']  ?? $entity['description'] ?? 'Unknown Student');
$customerEmail = trim($notes['customerEmail'] ?? $entity['email']       ?? '');
$customerPhone = trim($notes['customerPhone'] ?? $entity['contact']     ?? '');
$course        = trim($notes['course']        ?? '');
$branch        = trim($notes['branch']        ?? '');

if (empty($paymentId)) {
    webhookLog('REJECTED: Missing payment_id in payload');
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing payment_id']);
    exit();
}

webhookLog("Payment captured", [
    'payment_id' => $paymentId,
    'order_id'   => $orderId,
    'app_number' => $appNumber,
    'amount_rs'  => $amountRs,
    'name'       => $customerName
]);

// Persist to Firebase via REST API
// We use Firebase REST API (no PHP SDK needed) to write to Firestore.
// Three writes are made:
//   1. webhook_events/{paymentId}       - audit log of this webhook event
//   2. pending_payments/{appNumber}     - mark payment as Captured
//   3. webhook_activations/{appNumber}  - activation record for reconciliation

$firebaseProjectId = getenv('VITE_FIREBASE_PROJECT_ID') ?: '';
$firebaseApiKey    = getenv('VITE_FIREBASE_API_KEY')    ?: '';

$firestoreSuccess = false;

if ($firebaseProjectId && $firebaseApiKey) {
    $baseUrl = "https://firestore.googleapis.com/v1/projects/{$firebaseProjectId}/databases/(default)/documents";

    // 1. Write to webhook_events collection (always)
    $webhookEventDoc = [
        'fields' => [
            'event'           => ['stringValue'  => 'payment.captured'],
            'paymentId'       => ['stringValue'  => $paymentId],
            'orderId'         => ['stringValue'  => $orderId],
            'appNumber'       => ['stringValue'  => $appNumber],
            'customerName'    => ['stringValue'  => $customerName],
            'customerEmail'   => ['stringValue'  => $customerEmail],
            'customerPhone'   => ['stringValue'  => $customerPhone],
            'course'          => ['stringValue'  => $course],
            'branch'          => ['stringValue'  => $branch],
            'amountRs'        => ['doubleValue'  => $amountRs],
            'currency'        => ['stringValue'  => $currency],
            'paymentStatus'   => ['stringValue'  => 'Captured'],
            'source'          => ['stringValue'  => 'razorpay_webhook'],
            'capturedAt'      => ['stringValue'  => date('Y-m-d H:i:s')],
            'processedAt'     => ['integerValue' => (string)time()]
        ]
    ];

    $ch = curl_init("{$baseUrl}/webhook_events/{$paymentId}?key={$firebaseApiKey}");
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST,  'PATCH');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER,     ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS,     json_encode($webhookEventDoc));
    curl_setopt($ch, CURLOPT_TIMEOUT,        8);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $webhookRes  = curl_exec($ch);
    $webhookCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr     = curl_error($ch);
    curl_close($ch);

    if ($webhookCode >= 200 && $webhookCode < 300) {
        $firestoreSuccess = true;
        webhookLog("webhook_events write OK", ['http' => $webhookCode]);
    } else {
        webhookLog("webhook_events write FAILED", ['http' => $webhookCode, 'curl_err' => $curlErr, 'response' => substr($webhookRes ?? '', 0, 200)]);
    }

    // 2. Update pending_payments/{appNumber} if appNumber is known
    if (!empty($appNumber)) {
        $pendingPaymentUpdate = [
            'fields' => [
                'paymentStatus'     => ['stringValue'  => 'Captured'],
                'paymentId'         => ['stringValue'  => $paymentId],
                'razorpayPaymentId' => ['stringValue'  => $paymentId],
                'razorpayOrderId'   => ['stringValue'  => $orderId],
                'lastAction'        => ['stringValue'  => 'Payment Captured by Razorpay Webhook'],
                'capturedAt'        => ['stringValue'  => date('Y-m-d H:i:s')],
                'updatedAt'         => ['integerValue' => (string)time()]
            ]
        ];

        // Use updateMask to merge into existing document without overwriting other fields
        $updateMask = 'updateMask.fieldPaths=paymentStatus&updateMask.fieldPaths=paymentId&updateMask.fieldPaths=razorpayPaymentId&updateMask.fieldPaths=razorpayOrderId&updateMask.fieldPaths=lastAction&updateMask.fieldPaths=capturedAt&updateMask.fieldPaths=updatedAt';

        $ch2 = curl_init("{$baseUrl}/pending_payments/{$appNumber}?key={$firebaseApiKey}&{$updateMask}");
        curl_setopt($ch2, CURLOPT_CUSTOMREQUEST,  'PATCH');
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_HTTPHEADER,     ['Content-Type: application/json']);
        curl_setopt($ch2, CURLOPT_POSTFIELDS,     json_encode($pendingPaymentUpdate));
        curl_setopt($ch2, CURLOPT_TIMEOUT,        8);
        curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, true);
        $pendingRes  = curl_exec($ch2);
        $pendingCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        if ($pendingCode >= 200 && $pendingCode < 300) {
            webhookLog("pending_payments/{$appNumber} updated to Captured");
        } else {
            // pending_payments doc may not exist yet - that's OK, webhook_event is the audit record
            webhookLog("pending_payments update note", ['http' => $pendingCode, 'app' => $appNumber]);
        }
    }

    // 3. Write a webhook_activations record for admin reconciliation
    $activationDoc = [
        'fields' => [
            'paymentId'           => ['stringValue'  => $paymentId],
            'orderId'             => ['stringValue'  => $orderId],
            'appNumber'           => ['stringValue'  => $appNumber],
            'customerName'        => ['stringValue'  => $customerName],
            'customerEmail'       => ['stringValue'  => $customerEmail],
            'customerPhone'       => ['stringValue'  => $customerPhone],
            'course'              => ['stringValue'  => $course],
            'branch'              => ['stringValue'  => $branch],
            'amountRs'            => ['doubleValue'  => $amountRs],
            'currency'            => ['stringValue'  => $currency],
            'paymentStatus'       => ['stringValue'  => 'Paid'],
            'status'              => ['stringValue'  => 'Webhook Activated'],
            'source'              => ['stringValue'  => 'razorpay_webhook'],
            'capturedAt'          => ['stringValue'  => date('Y-m-d H:i:s')],
            'needsReconciliation' => ['booleanValue' => empty($appNumber)],
            'createdAt'           => ['integerValue' => (string)time()]
        ]
    ];

    $activationId  = !empty($appNumber) ? $appNumber : $paymentId;
    $ch3 = curl_init("{$baseUrl}/webhook_activations/{$activationId}?key={$firebaseApiKey}");
    curl_setopt($ch3, CURLOPT_CUSTOMREQUEST,  'PATCH');
    curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch3, CURLOPT_HTTPHEADER,     ['Content-Type: application/json']);
    curl_setopt($ch3, CURLOPT_POSTFIELDS,     json_encode($activationDoc));
    curl_setopt($ch3, CURLOPT_TIMEOUT,        8);
    curl_setopt($ch3, CURLOPT_SSL_VERIFYPEER, true);
    $actRes  = curl_exec($ch3);
    $actCode = curl_getinfo($ch3, CURLINFO_HTTP_CODE);
    curl_close($ch3);

    webhookLog("webhook_activations write", ['http' => $actCode, 'id' => $activationId]);

} else {
    webhookLog("Firebase credentials not set - skipping Firestore writes", [
        'project_id_set' => !empty($firebaseProjectId),
        'api_key_set'    => !empty($firebaseApiKey)
    ]);
}

// Always respond 200 to Razorpay
// Razorpay retries webhook delivery on non-2xx responses (up to 24h).
// We always return 200 after logging, even if Firebase write failed.
http_response_code(200);
echo json_encode([
    'success'         => true,
    'message'         => 'Webhook processed',
    'event'           => $eventType,
    'payment_id'      => $paymentId,
    'firestore_write' => $firestoreSuccess,
    'processed_at'    => date('Y-m-d H:i:s')
]);

webhookLog("Webhook response sent 200 OK", ['payment_id' => $paymentId]);
