/**
 * Anfrageformular – Ikonenatelier Miomir
 *
 * Nimmt die Anfragen aus dem Formular der Webseite entgegen und schickt sie
 * per Gmail an das Atelier-Postfach. Antworten gehen direkt an den Kunden.
 *
 * Einrichtung (einmalig, im Google-Konto des Ateliers):
 *   1. https://script.google.com → „Neues Projekt“ → diesen Code einfügen → speichern.
 *   2. Oben die Funktion „testMail“ auswählen → „Ausführen“ → Berechtigungen erlauben.
 *      Es kommt eine Test-Mail im Postfach an.
 *   3. „Bereitstellen“ → „Neue Bereitstellung“ → Typ „Web-App“
 *        Ausführen als:  Ich
 *        Zugriff:        Jeder
 *      → „Bereitstellen“ → die Web-App-URL (endet auf /exec) kopieren.
 *   4. Diese URL in index.html bei FORM_ENDPOINT eintragen.
 *
 * Nach späteren Änderungen am Code: „Bereitstellen“ → „Bereitstellungen verwalten“
 * → Stift-Symbol → Version „Neue Version“ → „Bereitstellen“. Die URL bleibt gleich.
 *
 * ── EINSTELLUNGEN ─────────────────────────────────────────────────────────────
 */

// Wohin die Anfragen gehen. Leer lassen = an das Google-Konto, unter dem das Skript läuft.
const EMPFAENGER = '';

// Optional: ID einer Google-Tabelle, in die jede Anfrage zusätzlich als Zeile geschrieben wird
// (Sicherung, falls eine Mail im Spam landet). Die ID steht in der Adresse der Tabelle:
// docs.google.com/spreadsheets/d/<ID>/edit – leer lassen, wenn nicht gewünscht.
const TABELLE_ID = '';

// Schutz vor Massenversand: höchstens so viele Anfragen in 10 Minuten (alle Besucher zusammen).
const MAX_ANFRAGEN_PRO_10_MIN = 10;

// ──────────────────────────────────────────────────────────────────────────────

const ERLAUBTE_ARTEN = ['Ikone auf MDF-Tafel', 'Kleinikone auf Stein'];

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Spam-Schutz: Dieses Feld ist auf der Webseite unsichtbar. Bots füllen es aus.
    if (p.website) return antwort(true, 'Vielen Dank für Ihre Anfrage.');

    const art = ERLAUBTE_ARTEN.indexOf(einzeilig(p.art, 60)) >= 0 ? einzeilig(p.art, 60) : ERLAUBTE_ARTEN[0];
    const name = einzeilig(p.name, 120);
    const email = einzeilig(p.email, 200);
    const telefon = einzeilig(p.telefon, 60);
    const format = einzeilig(p.format, 100);
    const motiv = einzeilig(p.motiv, 200);
    const notiz = text(p.notiz, 5000);

    if (name.length < 2) return antwort(false, 'Bitte geben Sie Ihren Namen an.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return antwort(false, 'Bitte geben Sie eine gültige E-Mail-Adresse an.');
    if (motiv.length < 2) return antwort(false, 'Bitte nennen Sie die gewünschte Ikone oder den Heiligen.');
    if (!p.datenschutz) return antwort(false, 'Bitte bestätigen Sie die Datenschutzhinweise.');

    if (!zaehlerOk()) {
      return antwort(false, 'Gerade gehen sehr viele Anfragen ein. Bitte versuchen Sie es in einigen Minuten noch einmal.');
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      return antwort(false, 'Ihre Anfrage konnte heute nicht mehr gesendet werden. Bitte versuchen Sie es morgen noch einmal.');
    }

    const datum = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy, HH:mm');
    const linie = '────────────────────────────────────────────';
    const body = [
      'Neue Anfrage über die Webseite (' + datum + ')',
      linie,
      '',
      'Ikone:      ' + motiv,
      'Art:        ' + art,
      'Format:     ' + (format || 'noch unsicher – bitte beraten'),
      '',
      'Name:       ' + name,
      'E-Mail:     ' + email,
      'Telefon:    ' + (telefon || '–'),
      '',
      'Notiz:',
      notiz || '–',
      '',
      linie,
      'Einfach auf diese E-Mail antworten – die Antwort geht direkt an ' + name + '.'
    ].join('\n');

    MailApp.sendEmail({
      to: EMPFAENGER || Session.getEffectiveUser().getEmail(),
      replyTo: email,
      name: 'Ikonenatelier Miomir – Webseite',
      subject: 'Neue Anfrage: ' + motiv + ' – ' + name,
      body: body
    });

    if (TABELLE_ID) {
      try {
        const blatt = SpreadsheetApp.openById(TABELLE_ID).getSheets()[0];
        if (blatt.getLastRow() === 0) {
          blatt.appendRow(['Datum', 'Ikone', 'Art', 'Format', 'Name', 'E-Mail', 'Telefon', 'Notiz']);
        }
        // Führendes ' verhindert, dass Eingaben mit = als Formel ausgeführt werden
        blatt.appendRow([datum, motiv, art, format, name, email, telefon, notiz].map(function (v) {
          return /^[=+\-@]/.test(v) ? "'" + v : v;
        }));
      } catch (err) {
        console.error('Tabelle nicht beschreibbar: ' + err);
      }
    }

    return antwort(true, 'Vielen Dank für Ihre Anfrage.');
  } catch (err) {
    console.error(err);
    return antwort(false, 'Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es in einigen Minuten erneut oder schreiben Sie direkt an ikonenateliermiomir@gmail.com.');
  }
}

// Aufruf der Adresse im Browser zeigt nur, dass die Web-App läuft.
function doGet() {
  return ContentService.createTextOutput('Anfrage-Formular des Ikonenateliers Miomir ist aktiv.');
}

// Einmal im Editor ausführen: erteilt die Berechtigungen und schickt eine Test-Mail.
function testMail() {
  MailApp.sendEmail({
    to: EMPFAENGER || Session.getEffectiveUser().getEmail(),
    subject: 'Test: Anfrageformular Ikonenatelier Miomir',
    body: 'Wenn diese Mail ankommt, kann das Skript Anfragen verschicken. Verbleibende Mails heute: ' +
      MailApp.getRemainingDailyQuota()
  });
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function antwort(ok, nachricht) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok, nachricht: nachricht }))
    .setMimeType(ContentService.MimeType.JSON);
}

function text(wert, max) {
  return String(wert || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function einzeilig(wert, max) {
  return text(wert, max).replace(/[\r\n\t]+/g, ' ');
}

function zaehlerOk() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const anzahl = Number(cache.get('anfragen') || 0);
    if (anzahl >= MAX_ANFRAGEN_PRO_10_MIN) return false;
    cache.put('anfragen', String(anzahl + 1), 600);
    return true;
  } finally {
    lock.releaseLock();
  }
}
