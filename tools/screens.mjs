/* Screenshots der App mit Margrits Demo-Daten für die Landingpage.
   Voraussetzung: lokaler Server (ruby -run -e httpd . -p 5190). Aufruf: node tools/screens.mjs → img/*.jpg */
import { execSync } from 'node:child_process';
import { chromium } from '/Users/ilies/Desktop/Brained/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:5190/app/index.html';
const OUT = new URL('../img/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(BASE); await page.evaluate(() => { localStorage.clear(); });
await page.goto(BASE + '?demo#heute');
await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
const shot = async (name, hash, prep) => {
  await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(250);
  if (prep) await page.evaluate(prep);
  await page.waitForTimeout(250); await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: OUT + name + '.png' });
};
await shot('heute', 'heute');
await shot('frage', 'frage', () => { document.querySelector('#txt').value = 'Im Schrank links, im blauen Ordner. Die Versicherungen sind im grünen.'; });
await shot('wegweiser', 'wegweiser');
await shot('kreis', 'kreis');
await shot('coach', 'coach');
await shot('geschichte', 'geschichte');
await shot('assistent', 'assistent', () => document.querySelector('[data-kb="1"]').click());
await shot('notfall', 'notfall');
await shot('ansicht', 'ansicht');
await page.evaluate(() => { localStorage.clear(); });
await page.goto(BASE + '#setup'); await page.addStyleTag({ content: '*{animation:none!important}' }); await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'willkommen.png' });
await browser.close();
execSync(`cd ${OUT} && for f in *.png; do sips -s format jpeg -s formatOptions 82 --resampleWidth 640 "$f" --out "\${f%.png}.jpg" >/dev/null && rm "$f"; done`);
console.log('fertig');
