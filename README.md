# BG AI Solutions – Website

One-Pager für [bgaisolution.com](https://bgaisolution.com): KI-Chatbots für Unternehmenswebsites.
Statisches HTML/CSS/JS ohne Build-Schritt, dazu ein PHP-Skript für das Kontaktformular.

## Aufbau

| Datei / Ordner      | Zweck                                                        |
|---------------------|--------------------------------------------------------------|
| `index.html`        | Startseite (One-Pager)                                       |
| `impressum.html`    | Impressum nach § 5 ECG, § 14 UGB, §§ 24/25 MedienG           |
| `datenschutz.html`  | Datenschutzerklärung nach DSGVO                              |
| `styles.css`        | Gesamtes Design-System (Style Guide V1.0 „Salbei“)           |
| `script.js`         | Navigation, Animationen, Buchungs-Modal, Formularversand     |
| `kontakt.php`       | Verschickt Formularanfragen per SMTP an office@bgaisolution.com |
| `fonts/`            | Lokal gehostete Schriften (keine Verbindung zu Google)       |
| `brand/`            | Logos als SVG (Schrift in Pfade umgewandelt)                 |

Der Inhalt dieses Repos entspricht 1:1 dem Ordner `public_html` auf dem Server.

## Kontaktformular einrichten

`kontakt.php` braucht die Zugangsdaten des Postfachs. Diese liegen in einer eigenen Datei
**eine Ebene über `public_html`** – also außerhalb des Repos und nicht über das Web erreichbar:

```
domains/bgaisolution.com/
├── kontakt-config.php   ← Zugangsdaten, NICHT im Repo
└── public_html/         ← Inhalt dieses Repos
```

Inhalt von `kontakt-config.php`:

```php
<?php
if (!defined('KONTAKT_CONFIG')) { http_response_code(403); exit; }

return [
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_user' => 'office@bgaisolution.com',
    'smtp_pass' => 'PASSWORT DES POSTFACHS',
    'from'      => 'office@bgaisolution.com',
    'from_name' => 'BG AI Solutions Website',
    'to'        => 'office@bgaisolution.com',
];
```

Fehlt die Datei oder steht noch ein Platzhalter darin, zeigt das Formular eine Fehlermeldung
mit direkter Mailadresse an, statt einen Versand vorzutäuschen.

## Deployment

Hostinger kann direkt aus diesem Repo deployen: hPanel → Website → **Erweitert → Git**.
Repository `https://github.com/PaulPloier/bg-ai-solution.git`, Branch `main`, Installationspfad leer
lassen (= `public_html`). Mit aktiviertem Auto-Deployment geht jeder Push auf `main` automatisch live.

## Vor dem Livegang noch offen

- Impressum: Gewerbewortlaut, Gewerbebehörde und WKO-Fachgruppe (nach der Gewerbeanmeldung)
- Datenschutz, Abschnitt 7: Grundlage der US-Übermittlung, Speicherdauer und Trainingsnutzung bei Chatbase
