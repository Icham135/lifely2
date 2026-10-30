/* Lifely 2.0 – Inhalte: Wochenfragen, Wegweiser, Coach, Wissensbasis, Hilfsnummern.
   Fragetypen: m = Erinnerung (Büchlein), w = «Das ist mir wichtig», f = Fundort (trägt in den Wegweiser ein),
   v = Vertretungsperson (startet Coach), k = Mein Kreis, p = praktische Notiz. */
const QUESTIONS = [
  ['m', 'Was war Ihr schönster Tag als Kind?'],
  ['m', 'Woran erinnern Sie sich bei Ihrem Elternhaus?'],
  ['m', 'Welches Rezept soll nie vergessen gehen?'],
  ['f', 'Wo bewahren Sie Ihre wichtigen Papiere auf?', 'papiere'],
  ['v', 'Wem würden Sie vertrauen, wenn Sie nicht mehr selbst entscheiden könnten?'],
  ['w', 'Was ist Ihnen wichtig, wenn Sie schwer krank sind?'],
  ['m', 'Welche Musik begleitet Sie schon Ihr ganzes Leben?'],
  ['m', 'Wie haben Sie einen Menschen kennengelernt, der Ihnen bis heute wichtig ist?'],
  ['f', 'Haben Sie eine Patientenverfügung? Wo liegt sie?', 'patvf'],
  ['m', 'Was war Ihre erste Arbeitsstelle?'],
  ['m', 'Welcher Ort auf der Welt bedeutet Ihnen am meisten?'],
  ['k', 'Wer sollte sofort informiert werden, wenn Ihnen etwas passiert?'],
  ['w', 'Welche Gewohnheit gibt Ihrem Tag Halt?'],
  ['f', 'Welche Versicherungen haben Sie, und wo liegen die Policen?', 'versicherungen'],
  ['m', 'Was haben Sie von Ihren Eltern gelernt?'],
  ['m', 'Welches Fest feiern Sie am liebsten, und wie?'],
  ['f', 'Gibt es ein Testament? Wo liegt das Original?', 'testament'],
  ['m', 'Was möchten Sie jüngeren Menschen mitgeben?'],
  ['m', 'Worauf sind Sie besonders stolz?'],
  ['w', 'Wer soll sich um Haustier, Pflanzen oder Wohnung kümmern, wenn Sie länger weg sind?'],
  ['f', 'Bei welchen Banken haben Sie Konten? Bitte nur die Namen, keine Zugangsdaten.', 'konten'],
  ['m', 'Welches Buch oder welcher Film hat Sie geprägt?'],
  ['m', 'Wie sah ein ganz normaler Sonntag in Ihrer Kindheit aus?'],
  ['w', 'Was gibt Ihnen Kraft in schweren Zeiten?'],
  ['p', 'Wer ist Ihr Hausarzt oder Ihre Hausärztin?'],
  ['m', 'Welche Reise werden Sie nie vergessen?'],
  ['w', 'Was soll bei Ihrer Abdankung gespielt oder gesagt werden?'],
  ['m', 'Welchen Rat würden Sie Ihrem jüngeren Ich geben?'],
  ['f', 'Haben Sie einen Vorsorgeauftrag? Wo liegt er?', 'vorsorgeauftrag'],
  ['m', 'Mit wem haben Sie als Kind am liebsten gespielt?'],
  ['w', 'Was bedeutet für Sie ein gutes Leben?'],
  ['f', 'Welche Verträge und Abos laufen auf Ihren Namen?', 'konten'],
  ['m', 'Was war Ihr liebstes Schulfach, und warum?'],
  ['w', 'Wo möchten Sie leben, wenn Sie einmal Hilfe brauchen?'],
  ['m', 'Welches Erlebnis bringt Sie bis heute zum Lachen?'],
  ['p', 'Wer hat einen Schlüssel zu Ihrer Wohnung?'],
  ['m', 'Welche Tradition soll in Ihrer Familie weiterleben?'],
  ['m', 'Was möchten Sie noch erleben?'],
  ['k', 'Wem möchten Sie diese Woche erzählen, wo Ihre Unterlagen liegen?'],
  ['m', 'Welche Arbeit hat Ihnen am meisten Freude gemacht?'],
  ['w', 'Gibt es Erinnerungsstücke, die bestimmte Menschen bekommen sollen?'],
  ['m', 'Welches grosse Ereignis haben Sie miterlebt, und wie?'],
  ['w', 'Was sollte das Spital über Ihre Gewohnheiten und Vorlieben wissen?'],
  ['m', 'Welche Freundschaft hat Sie ein Leben lang begleitet?'],
  ['p', 'Wer hat eine Kopie Ihrer wichtigsten Unterlagen?'],
  ['m', 'Welches Essen erinnert Sie an zu Hause?'],
  ['m', 'Wofür sind Sie heute dankbar?'],
  ['w', 'Was wünschen Sie sich für Ihre Bestattung? Alles ist freiwillig.'],
  ['m', 'Welcher Mensch hat Ihr Leben verändert?'],
  ['w', 'Was möchten Sie Ihren Liebsten noch sagen?'],
  ['p', 'Ist Ihr Wegweiser noch aktuell? Was hat sich dieses Jahr geändert?'],
  ['m', 'Wenn Sie auf dieses Jahr zurückblicken: Was war schön?'],
].map(([type, text, target], i) => ({ n: i + 1, type, text, target }));

// Wegweiser: die sechs Kernunterlagen. review = Monate bis «Prüfen».
const GUIDE = [
  { id: 'patvf', name: 'Patientenverfügung', icon: 'heart', review: 24, hint: 'Was Sie medizinisch wünschen, falls Sie nicht mehr entscheiden können.' },
  { id: 'vorsorgeauftrag', name: 'Vorsorgeauftrag', icon: 'pen', review: 36, coach: true, hint: 'Wer für Sie entscheidet, wenn Sie urteilsunfähig werden.' },
  { id: 'testament', name: 'Testament', icon: 'file', review: 60, hint: 'Ihr letzter Wille. Das Original zählt.' },
  { id: 'vertretung', name: 'Vertretungsperson', icon: 'people', person: true, hint: 'Die Person, die im Ernstfall Bescheid weiss und handelt.' },
  { id: 'versicherungen', name: 'Versicherungen', icon: 'shield', review: 36, hint: 'Krankenkasse, Haftpflicht, Leben, Hausrat.' },
  { id: 'konten', name: 'Konten & Verträge', icon: 'folder', review: 36, hint: 'Nur wo Konten und Verträge sind. Nie Passwörter oder PINs.' },
];

const COACH = [
  ['Wer soll entscheiden?', 'Eine Person, der Sie vertrauen, und am besten eine Ersatzperson.'],
  ['Was soll sie regeln?', 'Zum Beispiel Finanzen, Post, persönliche und medizinische Anliegen.'],
  ['Von Hand schreiben', 'Vollständig von Hand schreiben, mit Datum und Unterschrift, oder öffentlich beurkunden lassen. Zu prüfen: Art. 361 ZGB. Muster gibt es bei Pro Senectute und der KESB Ihres Kantons.'],
  ['Original ablegen', 'Wo liegt das Original? Tragen Sie den Fundort im Wegweiser ein.'],
  ['Beim Zivilstandsamt eintragen', 'Sie können eintragen lassen, dass es einen Vorsorgeauftrag gibt und wo er liegt (Gebühr je nach Kanton).'],
  ['Die Person informieren', 'Sagen Sie der Person, dass sie eingesetzt ist und wo das Original liegt.'],
  ['Jährlich prüfen', 'Passt alles noch? Lifely erinnert Sie.'],
];

// Wissensbasis für den Assistenten (geprüfte Kurzantworten, keine Rechtsberatung)
const KB = [
  { q: 'Was gehört in eine Patientenverfügung?', keys: ['patient', 'verfügung', 'spital', 'medizin', 'behandlung'],
    a: 'In der Patientenverfügung halten Sie fest, welche medizinischen Behandlungen Sie wünschen oder ablehnen, falls Sie nicht mehr selbst entscheiden können. Sie muss <b>schriftlich, datiert und unterschrieben</b> sein (Art. 371 ZGB). Geben Sie Ihrem Hausarzt eine Kopie und prüfen Sie sie alle 1–2 Jahre. Vorlagen gibt es z. B. bei Pro Senectute, der FMH oder dem Roten Kreuz.', go: 'wegweiser/patvf' },
  { q: 'Was ist ein Vorsorgeauftrag?', keys: ['vorsorgeauftrag', 'vollmacht', 'urteilsunfähig', 'kesb', 'beistand'],
    a: 'Mit einem Vorsorgeauftrag bestimmen Sie, wer für Sie entscheidet, wenn Sie es nicht mehr selbst können: bei Geld, Post und persönlichen Dingen. Er muss <b>vollständig von Hand geschrieben</b>, datiert und unterschrieben oder öffentlich beurkundet sein (Art. 361 ZGB).', go: 'coach' },
  { q: 'Wie schreibe ich ein gültiges Testament?', keys: ['testament', 'erbe', 'erben', 'nachlass', 'pflichtteil'],
    a: 'Ein eigenhändiges Testament muss <b>von Anfang bis Ende von Hand geschrieben</b> sein, mit Ort, Datum und Unterschrift (Art. 505 ZGB). Beachten Sie die Pflichtteile. Bewahren Sie das Original sicher auf, z. B. beim Notariat, und notieren Sie den Fundort im Wegweiser.', go: 'wegweiser/testament' },
  { q: 'Was müssen Angehörige im Todesfall zuerst tun?', keys: ['tod', 'todesfall', 'gestorben', 'verstorben', 'zuerst'],
    a: 'Zuerst stellt eine Ärztin oder ein Arzt die Todesbescheinigung aus. Der Todesfall wird <b>innert 2 Tagen</b> beim Zivilstandsamt gemeldet, oft übernehmen das Spital, das Heim oder der Bestatter. Danach: Bestatter kontaktieren, Wünsche beachten und ein Testament sofort der zuständigen Behörde einreichen (Art. 556 ZGB).', go: 'notfall' },
  { q: 'Wen muss man nach einem Todesfall informieren?', keys: ['informieren', 'bank', 'versicherung', 'ahv', 'pensionskasse'],
    a: 'Banken, AHV-Ausgleichskasse, Pensionskasse, Kranken- und weitere Versicherungen sowie Vermieter. Banken geben meist erst mit einer <b>Erbbescheinigung</b> Auskunft. Im Wegweiser unter «Konten & Verträge» steht, welche Stellen es gibt.', go: 'wegweiser/konten' },
  { q: 'Soll ich Passwörter in Lifely speichern?', keys: ['passwort', 'pin', 'zugang', 'login'],
    a: '<b>Nein.</b> Lifely speichert bewusst keine Passwörter oder PINs. Notieren Sie nur, <i>wo</i> Sie Konten haben. Für den digitalen Nachlass eignet sich ein Passwort-Manager mit Notfallzugang oder ein versiegelter Umschlag beim Notariat.' },
  { q: 'Wo sind meine Daten?', keys: ['daten', 'sicher', 'cloud', 'server', 'gespeichert'],
    a: 'Alles bleibt <b>nur auf diesem Gerät</b>. Lifely hat kein Konto, keine Cloud und keinen Server. Für den Ernstfall erstellen Sie ein <b>verschlüsseltes Notfallpaket</b>, das nur mit dem Passwort auf dem Notfallblatt geöffnet werden kann.', go: 'sicherheit' },
  { q: 'Mit wem kann ich reden, wenn es mir nicht gut geht?', keys: ['reden', 'allein', 'traurig', 'einsam', 'hilfe', 'gespräch'],
    a: 'Rufen Sie jemanden aus «Mein Kreis» an, ein kurzes Hallo freut die meisten mehr, als man denkt. Rund um die Uhr hört Ihnen die <b>Dargebotene Hand unter 143</b> zu. Täglich von 9 bis 20 Uhr gibt es <b>malreden, 0800 890 890</b>, gratis und anonym. In einem Notfall wählen Sie <b>144</b>.', go: 'kreis' },
];

// Hilfsnummern (Stand Recherche 30.10.2026; Zeiten/Kosten vor Veröffentlichung prüfen)
const HELP = [
  { n: '143', tel: '143', name: 'Die Dargebotene Hand', sub: 'Zuhören am Telefon, auch Chat' },
  { n: '0800 890 890', tel: '0800890890', name: 'malreden', sub: 'Täglich 9–20 Uhr, gratis und anonym' },
  { n: '058 591 15 15', tel: '0585911515', name: 'Pro Senectute', sub: 'Beratung rund ums Alter' },
  { n: '058 058 80 00', tel: '0580588000', name: 'Alzheimer-Telefon', sub: 'Mo–Fr, Deutsch, Französisch, Italienisch' },
  { n: '144', tel: '144', name: 'Sanitätsnotruf', sub: 'Bei einem medizinischen Notfall', urgent: true },
];

// Gesprächsideen für «Mein Kreis», falls keine Wochenfrage passt
const TOPICS = ['Was war diese Woche schön?', 'Was hast du gerade vor?', 'Welches Foto hast du zuletzt gemacht?', 'Was gab es heute zu essen?', 'Worauf freust du dich?'];

const RHYTHMS = [[7, 'jede Woche'], [14, 'alle 2 Wochen'], [30, 'einmal im Monat']];
const RELATIONS = ['Tochter', 'Sohn', 'Partner/in', 'Enkelkind', 'Schwester', 'Bruder', 'Freund/in', 'Nachbar/in', 'Andere'];
