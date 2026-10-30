# Lifely 2.0 – Eine Frage pro Woche

Prototyp einer Projektarbeit an der Berner Fachhochschule BFH (Modul EBDS), nach dem App-Konzept 2.0.

- Landingpage: https://icham135.github.io/lifely2/
- App: https://icham135.github.io/lifely2/app/ (Demo mit Beispieldaten: /app/?demo)

Alles läuft im Browser, ohne Konto und ohne Server. Daten bleiben im localStorage des Geräts; das Notfallpaket wird im Browser mit AES-256 verschlüsselt. Das Kontaktformular ist im Prototyp nicht verbunden.

Lokal starten: `ruby -run -e httpd . -p 5190`, dann http://localhost:5190
Screenshots neu erstellen: `node tools/screens.mjs` (braucht Playwright)
