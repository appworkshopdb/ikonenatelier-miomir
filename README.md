# Ikonenatelier Miomir

Webseite für handgemalte orthodoxe Ikonen in Eitempera und echtem Blattgold – mit Galerie, Entstehung, Formaten, Künstlerseite und Anfrageformular.

**Vorschau:** https://appworkshopdb.github.io/ikonenatelier-miomir/

## Dateien

- `index.html` – Startseite mit Anfrageformular
- `galerie.html` – alle Ikonen nach Kategorien
- `style.css` – Gestaltung beider Seiten
- `bilder/` – Fotos der Werke und des Künstlers
- `google-apps-script/Code.gs` – leitet die Anfragen aus dem Formular per Gmail an das Atelier weiter

## Anfrageformular einrichten (Gmail)

Das Formular schickt an eine Google-Apps-Script-Web-App im Google-Konto des Ateliers. Kein Server, kein Webhoster, kostenlos.

1. Im Google-Konto des Ateliers https://script.google.com öffnen → **Neues Projekt**.
2. Den Inhalt von `google-apps-script/Code.gs` einfügen und speichern (Projektname z. B. „Anfrageformular“).
3. Oben die Funktion **testMail** auswählen → **Ausführen** → Berechtigungen erlauben
   (Google warnt „App nicht überprüft“ → „Erweitert“ → „Zu Anfrageformular wechseln“ – das ist bei eigenen Skripten normal).
   Im Postfach kommt eine Test-Mail an.
4. **Bereitstellen** → **Neue Bereitstellung** → Zahnrad → **Web-App**
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
   → **Bereitstellen** und die Web-App-URL kopieren (endet auf `/exec`).
5. Die URL in `index.html` bei `const FORM_ENDPOINT = '';` eintragen.

Solange `FORM_ENDPOINT` leer ist, zeigt das Formular nur die Danke-Meldung und verschickt nichts.

**Optional:** Jede Anfrage zusätzlich in eine Google-Tabelle schreiben – dazu in `Code.gs` bei `TABELLE_ID` die ID der Tabelle eintragen
und die Web-App neu bereitstellen (Bereitstellungen verwalten → Stift → Neue Version).
