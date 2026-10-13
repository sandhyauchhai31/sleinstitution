<?php
/**
 * Cloudinary Secure Upload Endpoint
 * Handles uploading photos, documents, and receipts to Cloudinary using API keys
 */

require_once __DIR__ . '/config.php';

$cloudName = getenv('CLOUDINARY_CLOUD_NAME') ?: (getenv('Cloud_name') ?: 'rl8mwx31');
$apiKey = getenv('CLOUDINARY_API_KEY') ?: (getenv('API_key') ?: '854482785238572');
$apiSecret = getenv('CLOUDINARY_API_SECRET') ?: (getenv('API_secret') ?: 'dqhJ6XiT7pZXQTyw3MDLp0-bf8Y');

// Get raw input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$fileData = null;
$folder = 'sle_institution_uploads';

if (isset($_POST['folder']) && !empty($_POST['folder'])) {
    $folder = trim($_POST['folder']);
} else if (isset($data['folder']) && !empty($data['folder'])) {
    $folder = trim($data['folder']);
}

// Handle file input: either multipart $_FILES or base64 JSON payload
if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $fileData = $_FILES['file']['tmp_name'];
} else if (isset($_FILES['document']) && $_FILES['document']['error'] === UPLOAD_ERR_OK) {
    $fileData = $_FILES['document']['tmp_name'];
} else if (isset($data['fileData']) && !empty($data['fileData'])) {
    $fileData = $data['fileData']; // Base64 Data URI string
} else if (isset($data['image']) && !empty($data['image'])) {
    $fileData = $data['image'];
}

if (!$fileData) {
    echo json_encode(array(
        'success' => false,
        'error' => 'No file or base64 image data provided for upload'
    ));
    exit(0);
}

$timestamp = time();
$paramsToSign = array(
    'folder' => $folder,
    'timestamp' => $timestamp
);

ksort($paramsToSign);

$stringToSign = '';
foreach ($paramsToSign as $k => $v) {
    $stringToSign .= $k . '=' . $v . '&';
}
$stringToSign = rtrim($stringToSign, '&') . $apiSecret;
$signature = sha1($stringToSign);

$postFields = array(
    'api_key' => $apiKey,
    'timestamp' => $timestamp,
    'folder' => $folder,
    'signature' => $signature
);

// If $fileData is a file path on server, use CURLFile
if (is_string($fileData) && file_exists($fileData)) {
    $postFields['file'] = new CURLFile($fileData);
} else {
    $postFields['file'] = $fileData;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://api.cloudinary.com/v1_1/{$cloudName}/auto/upload");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if (($httpCode === 200 || $httpCode === 201) && $response) {
    $resData = json_decode($response, true);
    echo json_encode(array(
        'success' => true,
        'url' => isset($resData['secure_url']) ? $resData['secure_url'] : $resData['url'],
        'secure_url' => isset($resData['secure_url']) ? $resData['secure_url'] : $resData['url'],
        'public_id' => isset($resData['public_id']) ? $resData['public_id'] : '',
        'format' => isset($resData['format']) ? $resData['format'] : '',
        'bytes' => isset($resData['bytes']) ? $resData['bytes'] : 0
    ));
} else {
    echo json_encode(array(
        'success' => false,
        'error' => 'Cloudinary upload failed (HTTP ' . $httpCode . '): ' . $curlErr,
        'raw_response' => $response
    ));
}
