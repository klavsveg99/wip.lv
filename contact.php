<?php
header('Content-Type: application/json');

require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// reCAPTCHA Enterprise token verification (legacy siteverify endpoint).
function verify_recaptcha($secret, $token, $action, $remoteip) {
    if (empty($secret) || empty($token)) {
        return false;
    }
    $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'secret' => $secret,
            'response' => $token,
            'remoteip' => $remoteip,
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    if ($response === false) {
        return false;
    }
    $result = json_decode($response, true);
    if (empty($result['success'])) {
        return false;
    }
    if (isset($result['action']) && $result['action'] !== $action) {
        return false;
    }
    if (isset($result['score']) && $result['score'] < 0.5) {
        return false;
    }
    return true;
}

// SMTP configuration
$cfg = require __DIR__ . '/../private/config.php';
$smtpHost = $cfg['smtpHost'];
$smtpUser = $cfg['smtpUser'];
$smtpPass = $cfg['smtpPass'];
$smtpPort = $cfg['smtpPort'];

$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$phone = isset($_POST['phone']) ? trim($_POST['phone']) : '';
$company_name = isset($_POST['company_name']) ? trim($_POST['company_name']) : '';
$company_description = isset($_POST['company_description']) ? trim($_POST['company_description']) : '';

$referer = $_SERVER['HTTP_REFERER'] ?? '';
$isEnglish = (strpos($referer, '/en.html') !== false) || (strpos($referer, '/en?') !== false);

$messages = [
    'lv' => [
        'required' => 'Lūdzu, aizpildiet visus obligātos laukus.',
        'invalid_email' => 'Lūdzu, ievadiet derīgu e-pasta adresi.',
        'invalid_phone' => 'Tālruņa numurs var saturēt tikai ciparus un + zīmi.',
        'captcha' => 'Lūdzu, apstipriniet, ka neesat robots, un mēģiniet vēlreiz.',
        'success' => 'Paldies! Jūsu ziņa ir nosūtīta. Mēs sazināsimies ar jums drīzumā.',
        'error' => 'Kļūda nosūtot ziņojumu. Lūdzu, mēģiniet vēlreiz vai sazinieties ar mums pa e-pastu.'
    ],
    'en' => [
        'required' => 'Please fill in all required fields.',
        'invalid_email' => 'Please enter a valid email address.',
        'invalid_phone' => 'Phone number can only contain numbers and + sign.',
        'captcha' => 'Please confirm you are not a robot and try again.',
        'success' => 'Thank you! Your message has been sent. We will contact you soon.',
        'error' => 'Error sending message. Please try again or contact us by email.'
    ]
];

$lang = $isEnglish ? 'en' : 'lv';

if (empty($name) || empty($email) || empty($company_name) || empty($company_description)) {
    echo json_encode(['success' => false, 'message' => $messages[$lang]['required']]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => $messages[$lang]['invalid_email']]);
    exit;
}

if (!empty($phone) && !preg_match('/^[0-9+]+$/', $phone)) {
    echo json_encode(['success' => false, 'message' => $messages[$lang]['invalid_phone']]);
    exit;
}

$recaptchaSecret = $cfg['recaptchaSecret'] ?? '';
$recaptchaToken = isset($_POST['recaptchaToken']) ? trim($_POST['recaptchaToken']) : '';
if (!verify_recaptcha($recaptchaSecret, $recaptchaToken, 'contact_form', $_SERVER['REMOTE_ADDR'] ?? '')) {
    echo json_encode(['success' => false, 'message' => $messages[$lang]['captcha']]);
    exit;
}

$to = 'info@wip.lv';
$subject = $isEnglish ? 'New message from WIP.LV website - ' . $name : 'Jauna ziņa no WIP.LV mājaslapas - ' . $name;

$email_content = $isEnglish ? "New message from contact form:\n\n" : "Jauna ziņa no kontaktformas:\n\n";
$email_content .= ($isEnglish ? "Name: " : "Vārds: ") . $name . "\n";
$email_content .= ($isEnglish ? "Company Name: " : "Uzņēmuma nosaukums: ") . $company_name . "\n";
$email_content .= ($isEnglish ? "Email: " : "E-pasts: ") . $email . "\n";
$email_content .= ($isEnglish ? "Phone: " : "Tālrunis: ") . ($phone ? $phone : ($isEnglish ? 'Not specified' : 'Nav norādīts')) . "\n";
$email_content .= ($isEnglish ? "Company Description: " : "Uzņēmuma darbības apraksts: ") . $company_description . "\n";
$email_content .= "\n---\n";
$email_content .= ($isEnglish ? "Sent from: " : "Nosūtīts no: ") . ($_SERVER['HTTP_REFERER'] ?? 'Unknown') . "\n";
$email_content .= "IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'Unknown') . "\n";

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port = $smtpPort;
    
    $mail->setFrom($smtpUser, 'WIP.LV Website');
    $mail->addAddress($to);
    $mail->addReplyTo($email, $name);
    
    $mail->Subject = $subject;
    $mail->Body = $email_content;
    $mail->CharSet = 'UTF-8';
    
    $mail->send();
    echo json_encode(['success' => true, 'message' => $messages[$lang]['success']]);
} catch (Exception $e) {
    error_log('PHPMailer Error: ' . $mail->ErrorInfo);
    echo json_encode(['success' => false, 'message' => $messages[$lang]['error']]);
}
