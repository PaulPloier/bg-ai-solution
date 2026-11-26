<?php
/**
 * Nimmt die Anfragen des Kontaktformulars entgegen und verschickt sie per SMTP.
 *
 * Warum SMTP statt mail(): mail() verschickt auf Hostinger über den Webserver.
 * Dessen IP ist im SPF-Eintrag der Domain nicht freigegeben und die Mail wird
 * nicht DKIM-signiert – der Posteingang lehnt sie ab oder sortiert sie still
 * in den Spam, obwohl mail() "Erfolg" meldet. Per SMTP läuft die Mail über
 * den echten Mailserver und kommt zuverlässig an.
 *
 * Zugangsdaten stehen in kontakt-config.php EINE EBENE ÜBER public_html.
 */

define('KONTAKT_CONFIG', true);

const MAX_NACHRICHT = 5000;
const SMTP_TIMEOUT  = 15;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function antwort(int $status, array $daten)
{
    http_response_code($status);
    echo json_encode($daten, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Entfernt Zeilenumbrüche – verhindert das Einschleusen eigener Mail-Header. */
function kopfzeile(string $wert): string
{
    return trim(str_replace(["\r", "\n", "%0a", "%0d"], '', $wert));
}

function feld(string $name, int $maxlen = 200): string
{
    $wert = $_POST[$name] ?? '';
    if (!is_string($wert)) {
        return '';
    }
    $wert = trim($wert);
    return function_exists('mb_substr')
        ? mb_substr($wert, 0, $maxlen)
        : substr($wert, 0, $maxlen);
}

/** Kodiert einen Header-Wert nach RFC 2047, damit Umlaute korrekt ankommen. */
function kodiert(string $text): string
{
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

/**
 * Minimaler SMTP-Client (implizites SSL, AUTH LOGIN).
 * Wirft eine RuntimeException mit der Serverantwort, wenn ein Schritt scheitert.
 */
function smtp_senden(array $cfg, string $von, string $an, string $nachricht): void
{
    $kontext = stream_context_create(['ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
        'peer_name'        => $cfg['smtp_host'],
    ]]);

    $sock = @stream_socket_client(
        'ssl://' . $cfg['smtp_host'] . ':' . $cfg['smtp_port'],
        $errno, $errstr, SMTP_TIMEOUT, STREAM_CLIENT_CONNECT, $kontext
    );
    if (!$sock) {
        throw new RuntimeException("Verbindung fehlgeschlagen: $errstr ($errno)");
    }
    stream_set_timeout($sock, SMTP_TIMEOUT);

    // Liest eine (ggf. mehrzeilige) Antwort und prüft den erwarteten Code.
    $lesen = function (array $erwartet) use ($sock): string {
        $antwort = '';
        while (($zeile = fgets($sock, 1024)) !== false) {
            $antwort .= $zeile;
            // Letzte Zeile einer Antwort: Code gefolgt von Leerzeichen
            if (strlen($zeile) >= 4 && $zeile[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($antwort, 0, 3);
        if (!in_array($code, $erwartet, true)) {
            throw new RuntimeException('SMTP: ' . trim($antwort));
        }
        return $antwort;
    };
    $schreiben = function (string $befehl) use ($sock): void {
        fwrite($sock, $befehl . "\r\n");
    };

    try {
        $lesen([220]);
        $host = kopfzeile($_SERVER['SERVER_NAME'] ?? 'bgaisolution.com');
        $schreiben('EHLO ' . $host);
        $lesen([250]);

        $schreiben('AUTH LOGIN');
        $lesen([334]);
        $schreiben(base64_encode($cfg['smtp_user']));
        $lesen([334]);
        $schreiben(base64_encode($cfg['smtp_pass']));
        $lesen([235]);

        $schreiben('MAIL FROM:<' . $von . '>');
        $lesen([250]);
        $schreiben('RCPT TO:<' . $an . '>');
        $lesen([250, 251]);

        $schreiben('DATA');
        $lesen([354]);
        // Dot-Stuffing: Zeilen, die mit "." beginnen, verdoppeln den Punkt.
        $daten = preg_replace('/^\./m', '..', $nachricht);
        fwrite($sock, $daten . "\r\n.\r\n");
        $lesen([250]);

        $schreiben('QUIT');
    } finally {
        fclose($sock);
    }
}

// ---------------------------------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antwort(405, ['ok' => false, 'error' => 'Methode nicht erlaubt.']);
}

// Honeypot: ein für Menschen unsichtbares Feld. Ist es ausgefüllt, war es
// ein Bot. Wir melden trotzdem Erfolg, damit der Bot nichts dazulernt.
if (feld('fax') !== '') {
    antwort(200, ['ok' => true]);
}

$configPfad = dirname(__DIR__) . '/kontakt-config.php';
if (!is_file($configPfad)) {
    error_log('Kontaktformular: kontakt-config.php fehlt unter ' . $configPfad);
    antwort(500, ['ok' => false, 'error' => 'Formular ist nicht konfiguriert.']);
}
$cfg = require $configPfad;
if (!is_array($cfg) || ($cfg['smtp_pass'] ?? '') === '' || strpos($cfg['smtp_pass'], 'HIER_') === 0) {
    error_log('Kontaktformular: SMTP-Passwort in kontakt-config.php nicht eingetragen.');
    antwort(500, ['ok' => false, 'error' => 'Formular ist nicht konfiguriert.']);
}

$name      = feld('name', 120);
$firma     = feld('company', 160);
$email     = feld('email', 180);
$website   = feld('website', 300);
$nachricht = feld('message', MAX_NACHRICHT);

$fehler = [];
if ($name === '')  { $fehler[] = 'Name fehlt.'; }
if ($firma === '') { $fehler[] = 'Unternehmen fehlt.'; }
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $fehler[] = 'E-Mail-Adresse ist ungültig.';
}
if ($website !== '' && !filter_var($website, FILTER_VALIDATE_URL)) {
    $website = '';   // optionales Feld: ungültige Eingabe still verwerfen
}
if ($fehler) {
    antwort(422, ['ok' => false, 'error' => implode(' ', $fehler)]);
}

$von = $cfg['from'];
$an  = $cfg['to'];

$text = implode("\r\n", [
    'Neue Anfrage über das Kontaktformular auf bgaisolution.com',
    '',
    'Name:        ' . $name,
    'Unternehmen: ' . $firma,
    'E-Mail:      ' . $email,
    'Website:     ' . ($website !== '' ? $website : '-'),
    '',
    'Nachricht:',
    ($nachricht !== '' ? str_replace(["\r\n", "\r"], "\n", $nachricht) : '(keine Nachricht hinterlassen)'),
    '',
    '---',
    'Gesendet am ' . date('d.m.Y, H:i') . ' Uhr',
    'IP des Absenders: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unbekannt'),
]);
$text = str_replace("\n", "\r\n", str_replace("\r\n", "\n", $text));

$domain = substr(strrchr($von, '@'), 1);
$kopf = implode("\r\n", [
    'Date: ' . date('r'),
    'From: ' . kodiert($cfg['from_name']) . ' <' . $von . '>',
    'To: <' . $an . '>',
    'Reply-To: ' . kodiert(kopfzeile($name)) . ' <' . kopfzeile($email) . '>',
    'Subject: ' . kodiert(sprintf('Neue Anfrage von %s (%s)', $name, $firma)),
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    'X-Mailer: bgaisolution-kontaktformular',
]);

// Base64-Körper: keine Probleme mit Umlauten, langen Zeilen oder Punkten.
$nachrichtRoh = $kopf . "\r\n\r\n" . rtrim(chunk_split(base64_encode($text), 76, "\r\n"));

try {
    smtp_senden($cfg, $von, $an, $nachrichtRoh);
} catch (Throwable $e) {
    error_log('Kontaktformular: ' . $e->getMessage());
    antwort(500, ['ok' => false, 'error' => 'Die Nachricht konnte nicht versendet werden.']);
}

antwort(200, ['ok' => true]);
