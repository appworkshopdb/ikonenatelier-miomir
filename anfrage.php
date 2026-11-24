<?php
/**
 * Anfrageformular – Ikonenatelier Miomir
 *
 * Nimmt die Anfrage aus index.html entgegen und verschickt
 *   1. eine E-Mail mit allen Angaben und den Bildvorlagen als Anhang an Miomir,
 *   2. eine kurze Eingangsbestätigung an den Kunden.
 *
 * Voraussetzung: Webhoster mit PHP 7.4 oder neuer und aktivierter mail()-Funktion
 * (Standard bei IONOS, Strato, all-inkl, Hostinger, netcup u. a.).
 *
 * ── EINSTELLUNGEN ─────────────────────────────────────────────────────────────
 */

// An diese Adresse gehen die Anfragen (Miomirs Postfach):
const EMPFAENGER = 'BITTE-EINTRAGEN@beispiel.de';

// Absender der E-Mails. Muss eine Adresse der EIGENEN Domain sein
// (z. B. anfrage@ikonen-miomir.de), sonst landen die Mails oft im Spam
// oder werden vom Webhoster nicht verschickt.
const ABSENDER = 'BITTE-EINTRAGEN@beispiel.de';
const ABSENDER_NAME = 'Ikonenatelier Miomir';

// Soll der Kunde eine automatische Eingangsbestätigung bekommen?
const BESTAETIGUNG_AN_KUNDEN = true;

// Grenzen für die Bildvorlagen
const MAX_BILDER = 5;
const MAX_BYTES_PRO_BILD = 8 * 1024 * 1024;   // 8 MB
const ERLAUBTE_TYPEN = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic'];

// ──────────────────────────────────────────────────────────────────────────────

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function antwort(bool $ok, string $nachricht = '', int $status = 200): void {
    http_response_code($status);
    echo json_encode(['ok' => $ok, 'nachricht' => $nachricht], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antwort(false, 'Bitte nutzen Sie das Anfrageformular auf der Webseite.', 405);
}

if (strpos(EMPFAENGER, 'BITTE-EINTRAGEN') !== false || strpos(ABSENDER, 'BITTE-EINTRAGEN') !== false) {
    antwort(false, 'Das Formular ist noch nicht fertig eingerichtet. Bitte schreiben Sie uns vorerst direkt eine E-Mail.', 500);
}

// Spam-Schutz: Dieses Feld ist für Menschen unsichtbar. Bots füllen es aus.
if (!empty($_POST['website'])) {
    antwort(true); // so tun, als ob alles geklappt hat
}

// ── Eingaben lesen und prüfen ────────────────────────────────────────────────
function feld(string $name, int $maxLaenge = 200): string {
    $wert = trim((string)($_POST[$name] ?? ''));
    $wert = str_replace("\0", '', $wert);
    return mb_substr($wert, 0, $maxLaenge);
}
function einzeilig(string $s): string {
    return trim(preg_replace('/[\r\n\t]+/', ' ', $s));   // verhindert Header-Injection
}

$art     = einzeilig(feld('art', 60));
$name    = einzeilig(feld('name', 120));
$email   = einzeilig(feld('email', 200));
$telefon = einzeilig(feld('telefon', 60));
$format  = einzeilig(feld('format', 80));
$motiv   = einzeilig(feld('motiv', 200));
$notiz   = feld('notiz', 5000);
$consent = !empty($_POST['datenschutz']);

$erlaubteArten = ['Ikone auf MDF-Tafel', 'Kleinikone auf Stein'];
if (!in_array($art, $erlaubteArten, true)) $art = 'Ikone auf MDF-Tafel';

if (mb_strlen($name) < 2)                          antwort(false, 'Bitte geben Sie Ihren Namen an.', 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL))    antwort(false, 'Bitte geben Sie eine gültige E-Mail-Adresse an.', 422);
if (!$consent)                                     antwort(false, 'Bitte bestätigen Sie die Datenschutzhinweise.', 422);

// ── Bilder einsammeln ────────────────────────────────────────────────────────
$anhaenge = [];
if (!empty($_FILES['bilder']) && is_array($_FILES['bilder']['name'])) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $anzahl = count($_FILES['bilder']['name']);
    if ($anzahl > MAX_BILDER) antwort(false, 'Bitte senden Sie höchstens ' . MAX_BILDER . ' Bilder.', 422);

    for ($i = 0; $i < $anzahl; $i++) {
        $fehler = $_FILES['bilder']['error'][$i];
        if ($fehler === UPLOAD_ERR_NO_FILE) continue;
        if ($fehler === UPLOAD_ERR_INI_SIZE || $fehler === UPLOAD_ERR_FORM_SIZE) {
            antwort(false, 'Ein Bild ist zu groß. Bitte verkleinern Sie es oder senden Sie weniger Bilder.', 413);
        }
        if ($fehler !== UPLOAD_ERR_OK) antwort(false, 'Ein Bild konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.', 400);

        $tmp = $_FILES['bilder']['tmp_name'][$i];
        if (!is_uploaded_file($tmp)) continue;
        if (filesize($tmp) > MAX_BYTES_PRO_BILD) antwort(false, 'Ein Bild ist größer als 8 MB. Bitte verkleinern Sie es.', 413);

        $mime = $finfo->file($tmp);
        if (!isset(ERLAUBTE_TYPEN[$mime])) antwort(false, 'Bitte senden Sie nur Bilder (JPG, PNG oder WEBP).', 415);

        $anhaenge[] = [
            'name' => 'vorlage-' . ($i + 1) . '.' . ERLAUBTE_TYPEN[$mime],
            'mime' => $mime,
            'data' => file_get_contents($tmp),
        ];
    }
}

// ── E-Mail an Miomir ─────────────────────────────────────────────────────────
function kodiere(string $s): string { return '=?UTF-8?B?' . base64_encode($s) . '?='; }

$datum = date('d.m.Y, H:i');
$text  = "Neue Anfrage über die Webseite ($datum)\n";
$text .= str_repeat('─', 44) . "\n\n";
$text .= "Art:        $art\n";
$text .= "Name:       $name\n";
$text .= "E-Mail:     $email\n";
$text .= "Telefon:    " . ($telefon !== '' ? $telefon : '–') . "\n";
$text .= "Format:     " . ($format !== '' ? $format : 'noch unsicher – bitte beraten') . "\n";
$text .= "Motiv:      " . ($motiv !== '' ? $motiv : '–') . "\n";
$text .= "Bilder:     " . count($anhaenge) . " im Anhang\n\n";
$text .= "Notiz:\n" . ($notiz !== '' ? $notiz : '–') . "\n\n";
$text .= str_repeat('─', 44) . "\n";
$text .= "Antworten Sie einfach auf diese E-Mail, um dem Kunden Ihr Angebot zu schicken.\n";

$grenze  = 'b_' . bin2hex(random_bytes(12));
$betreff = "Neue Anfrage: $art – $name";

$header  = 'From: ' . kodiere(ABSENDER_NAME . ' – Webseite') . ' <' . ABSENDER . ">\r\n";
$header .= 'Reply-To: ' . kodiere($name) . " <$email>\r\n";
$header .= "MIME-Version: 1.0\r\n";
$header .= "Content-Type: multipart/mixed; boundary=\"$grenze\"\r\n";

$body  = "--$grenze\r\n";
$body .= "Content-Type: text/plain; charset=UTF-8\r\n";
$body .= "Content-Transfer-Encoding: base64\r\n\r\n";
$body .= chunk_split(base64_encode($text)) . "\r\n";
foreach ($anhaenge as $a) {
    $body .= "--$grenze\r\n";
    $body .= "Content-Type: {$a['mime']}; name=\"{$a['name']}\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n";
    $body .= "Content-Disposition: attachment; filename=\"{$a['name']}\"\r\n\r\n";
    $body .= chunk_split(base64_encode($a['data'])) . "\r\n";
}
$body .= "--$grenze--\r\n";

$gesendet = mail(EMPFAENGER, kodiere($betreff), $body, $header, '-f' . ABSENDER);
if (!$gesendet) {
    antwort(false, 'Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder schreiben Sie uns direkt eine E-Mail.', 500);
}

// ── Eingangsbestätigung an den Kunden ────────────────────────────────────────
if (BESTAETIGUNG_AN_KUNDEN) {
    $k  = "Guten Tag $name,\n\n";
    $k .= "vielen Dank für Ihre Anfrage. Sie ist gut bei mir angekommen.\n\n";
    $k .= "Ich sehe mir Ihre Vorlage in Ruhe an und schicke Ihnen ein persönliches Angebot ";
    $k .= "mit Preis und voraussichtlichem Fertigstellungstermin an diese E-Mail-Adresse.\n\n";
    $k .= "Ihre Angaben:\n";
    $k .= "  Art:    $art\n";
    $k .= "  Format: " . ($format !== '' ? $format : 'noch offen') . "\n";
    $k .= "  Motiv:  " . ($motiv !== '' ? $motiv : '–') . "\n\n";
    $k .= "Herzliche Grüße\nMiomir\nIkonenatelier Miomir\n";

    $kh  = 'From: ' . kodiere(ABSENDER_NAME) . ' <' . ABSENDER . ">\r\n";
    $kh .= 'Reply-To: ' . EMPFAENGER . "\r\n";
    $kh .= "MIME-Version: 1.0\r\n";
    $kh .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $kh .= "Content-Transfer-Encoding: base64\r\n";

    @mail($email, kodiere('Ihre Anfrage beim Ikonenatelier Miomir'), chunk_split(base64_encode($k)), $kh, '-f' . ABSENDER);
}

antwort(true, 'Vielen Dank für Ihre Anfrage.');
