<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(bool $success, string $message, int $status = 200): never {
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Method not allowed.', 405);
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    respond(false, 'Mail configuration is missing.', 500);
}
$config = require $configFile;

$requiredConfig = ['smtp_host','smtp_port','smtp_username','smtp_password','mail_from','mail_to'];
foreach ($requiredConfig as $key) {
    if (empty($config[$key]) || $config[$key] === 'PUT_EMAIL_PASSWORD_HERE') {
        respond(false, 'Mail configuration is incomplete.', 500);
    }
}

// Honeypot spam protection.
if (!empty($_POST['website'] ?? '')) {
    respond(true, 'OK');
}

$name = trim((string)($_POST['name'] ?? ''));
$phone = trim((string)($_POST['phone'] ?? ''));
$email = trim((string)($_POST['email'] ?? ''));
$type = trim((string)($_POST['type'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

if ($name === '' || $phone === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please complete all required fields correctly.', 422);
}
if (mb_strlen($name) > 100 || mb_strlen($phone) > 30 || mb_strlen($email) > 150 || mb_strlen($message) > 3000) {
    respond(false, 'One or more fields are too long.', 422);
}

function sanitizeHeader(string $value): string {
    return trim(str_replace(["\r", "\n"], '', $value));
}
function smtpRead($socket): string {
    $data = '';
    while (($line = fgets($socket, 515)) !== false) {
        $data .= $line;
        if (isset($line[3]) && $line[3] === ' ') break;
    }
    return $data;
}
function smtpCommand($socket, string $command, array $expected): string {
    fwrite($socket, $command . "\r\n");
    $response = smtpRead($socket);
    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $expected, true)) {
        throw new RuntimeException('SMTP error: ' . trim($response));
    }
    return $response;
}

$subject = 'New quotation request - ' . sanitizeHeader($name);
$body = "A new request was submitted through the Almad Alali website.\r\n\r\n"
      . "Name: {$name}\r\n"
      . "Phone: {$phone}\r\n"
      . "Email: {$email}\r\n"
      . "Request type: {$type}\r\n\r\n"
      . "Message:\r\n{$message}\r\n";

$boundarySafeSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$headers = [
    'Date: ' . date(DATE_RFC2822),
    'From: ' . sanitizeHeader((string)($config['mail_from_name'] ?? 'Almad Alali Website')) . ' <' . sanitizeHeader((string)$config['mail_from']) . '>',
    'To: <' . sanitizeHeader((string)$config['mail_to']) . '>',
    'Reply-To: ' . sanitizeHeader($name) . ' <' . sanitizeHeader($email) . '>',
    'Subject: ' . $boundarySafeSubject,
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@almadalali.ly>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];

try {
    $host = (string)$config['smtp_host'];
    $port = (int)$config['smtp_port'];
    $transport = (($config['smtp_secure'] ?? 'ssl') === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
            'peer_name' => $host,
        ],
    ]);
    $socket = @stream_socket_client($transport, $errno, $errstr, 20, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) throw new RuntimeException("SMTP connection failed: {$errstr} ({$errno})");
    stream_set_timeout($socket, 20);

    $greeting = smtpRead($socket);
    if ((int)substr($greeting, 0, 3) !== 220) throw new RuntimeException('Invalid SMTP greeting.');
    smtpCommand($socket, 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'almadalali.ly'), [250]);
    smtpCommand($socket, 'AUTH LOGIN', [334]);
    smtpCommand($socket, base64_encode((string)$config['smtp_username']), [334]);
    smtpCommand($socket, base64_encode((string)$config['smtp_password']), [235]);
    smtpCommand($socket, 'MAIL FROM:<' . $config['mail_from'] . '>', [250]);
    smtpCommand($socket, 'RCPT TO:<' . $config['mail_to'] . '>', [250, 251]);
    smtpCommand($socket, 'DATA', [354]);

    $mailData = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    $mailData = preg_replace('/(?m)^\./', '..', $mailData);
    fwrite($socket, $mailData . "\r\n.\r\n");
    $result = smtpRead($socket);
    if ((int)substr($result, 0, 3) !== 250) throw new RuntimeException('SMTP rejected the message.');
    smtpCommand($socket, 'QUIT', [221]);
    fclose($socket);

    respond(true, 'Message sent successfully.');
} catch (Throwable $e) {
    error_log('[Almad contact form] ' . $e->getMessage());
    respond(false, 'Unable to send the message right now.', 500);
}
