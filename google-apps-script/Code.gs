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
    if (/^Eigenes Format/.test(format)) {
      const m = format.match(/^Eigenes Format: (\d+) × (\d+) cm/);
      const ok = function (v) { v = Number(v); return v >= 10 && v <= 200 && v % 10 === 0; };
      if (!m || !ok(m[1]) || !ok(m[2])) {
        return antwort(false, 'Bitte geben Sie Breite und Höhe jeweils von 10 bis 200 cm in 10-cm-Schritten an.');
      }
    }

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
      'Telefon:    ' + (telefon || 'nicht angegeben'),
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
      body: body,
      htmlBody: anfrageHtml({ datum: datum, motiv: motiv, art: art, format: format, name: name, email: email, telefon: telefon, notiz: notiz })
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

// Im Editor ausführen: schickt eine Beispiel-Anfrage im neuen Design ans eigene Postfach.
function testAnfrageMail() {
  const d = {
    datum: Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy, HH:mm'),
    motiv: 'Hl. Nikolaus (Beispiel)', art: 'Ikone auf MDF-Tafel', format: '40 × 30 cm',
    name: 'Maria Beispiel', email: 'maria@example.com', telefon: '',
    notiz: 'Zur Taufe unseres Sohnes im März.\nGern mit Goldhintergrund.'
  };
  MailApp.sendEmail({
    to: EMPFAENGER || Session.getEffectiveUser().getEmail(),
    replyTo: d.email,
    name: 'Ikonenatelier Miomir – Webseite',
    subject: 'Neue Anfrage: ' + d.motiv + ' – ' + d.name,
    body: 'Beispiel-Anfrage im neuen Design (HTML).',
    htmlBody: anfrageHtml(d)
  });
}

// ── Gestaltete Anfrage-Mail (HTML) ───────────────────────────────────────────
// Tabellen und Stile direkt am Element, damit Gmail auf PC und Handy alles richtig anzeigt.

function anfrageHtml(d) {
  const nacht = '#16202b', gold = '#b8903a', goldHell = '#d9b86a', papier = '#fffaf2',
        linie = '#e6dccb', grau = '#5b4f44', zinnober = '#9c2f22', tinte = '#221b15';
  const serif = 'Georgia,\'Times New Roman\',serif', sans = 'Arial,Helvetica,sans-serif';
  const vorname = d.name.split(/\s+/)[0];

  const antwortLink = 'mailto:' + encodeURIComponent(d.email) +
    '?subject=' + encodeURIComponent('Ihr Angebot: ' + d.motiv) +
    '&body=' + encodeURIComponent('Guten Tag ' + d.name + ',\n\nvielen Dank für Ihre Anfrage zur Ikone „' + d.motiv + '“.\n\n');

  function zeile(label, wert, letzte) {
    const rand = 'border-top:1px solid ' + linie + ';' + (letzte ? 'border-bottom:1px solid ' + linie + ';' : '');
    return '<tr>' +
      '<td style="padding:9px 0;width:110px;color:' + grau + ';vertical-align:top;' + rand + '">' + label + '</td>' +
      '<td style="padding:9px 0;color:' + tinte + ';' + rand + '">' + wert + '</td></tr>';
  }

  const zeilen = [
    ['Art', esc(d.art)],
    ['Format', esc(d.format || 'noch unsicher – bitte beraten')],
    ['Name', esc(d.name)],
    ['E-Mail', '<a href="mailto:' + esc(d.email) + '" style="color:' + zinnober + ';text-decoration:none">' + esc(d.email) + '</a>'],
    ['Telefon', d.telefon
      ? '<a href="tel:' + esc(d.telefon.replace(/[^\d+]/g, '')) + '" style="color:' + tinte + ';text-decoration:none">' + esc(d.telefon) + '</a>'
      : '<span style="color:' + grau + '">nicht angegeben</span>']
  ];

  return '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f1ece3">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ece3"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:' + papier + ';border:1px solid #d8cbb6;border-radius:6px;border-collapse:separate;overflow:hidden">' +

    // Kopf
    '<tr><td style="background:' + nacht + ';padding:18px 24px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="width:34px;height:34px;border:1px solid ' + gold + ';border-radius:50%;text-align:center;vertical-align:middle;font-family:' + serif + ';font-size:17px;color:' + goldHell + '">M</td>' +
        '<td style="padding-left:12px">' +
          '<div style="font-family:' + serif + ';font-size:17px;color:#f1e8d8">Ikonenatelier Miomir</div>' +
          '<div style="font-family:' + sans + ';font-size:11px;letter-spacing:2px;color:' + goldHell + '">NEUE ANFRAGE</div>' +
        '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="height:3px;line-height:3px;font-size:0;background:' + gold + '">&nbsp;</td></tr>' +

    // Inhalt
    '<tr><td style="padding:22px 24px 8px">' +
      '<div style="font-family:' + sans + ';font-size:12px;color:' + grau + '">' + esc(d.datum) + ' · über die Webseite</div>' +
      '<div style="font-family:' + serif + ';font-size:24px;line-height:1.25;color:' + tinte + ';margin:6px 0 16px">' + esc(d.motiv) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:' + sans + ';font-size:14px">' +
        zeilen.map(function (z, i) { return zeile(z[0], z[1], i === zeilen.length - 1); }).join('') +
      '</table>' +
      '<div style="font-family:' + sans + ';font-size:12px;color:' + grau + ';margin:18px 0 6px">Notiz</div>' +
      '<div style="background:#f6f0e6;padding:12px 14px;font-family:' + sans + ';font-size:14px;line-height:1.6;color:' + tinte + '">' +
        (d.notiz ? esc(d.notiz).replace(/\r?\n/g, '<br>') : '<span style="color:' + grau + '">Keine Notiz</span>') +
      '</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 10px"><tr>' +
        '<td style="background:' + gold + ';border-radius:4px">' +
          '<a href="' + esc(antwortLink) + '" style="display:inline-block;padding:11px 20px;font-family:' + sans + ';font-size:14px;color:#ffffff;text-decoration:none">' + esc(vorname) + ' antworten</a>' +
        '</td></tr></table>' +
    '</td></tr>' +

    // Fuß
    '<tr><td style="padding:14px 24px;border-top:1px solid ' + linie + ';font-family:' + sans + ';font-size:12px;line-height:1.5;color:' + grau + '">' +
      '„Antworten“ in Gmail geht ebenfalls direkt an ' + esc(d.name) + '.' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
