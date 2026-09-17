---
title: "Algolia durch eigene Vektorsuche ersetzen"
date: 2026-09-01
weight: 10
summary: "Die Designsuche von JUNIQE lief auf einem SaaS-Dienst, der Wörter treffen konnte, aber keine Bedeutung. Ich habe den Service gebaut, der ihn abgelöst hat — semantische Bildsuche in Go, auf Qdrant und Postgres."
stack: ["Go", "Qdrant", "PostgreSQL", "pgvector", "Redis", "CLIP", "Kubernetes"]
showComments: false
showTableOfContents: true
---

## Das Problem

JUNIQE verkauft Kunstdrucke. Der Katalog umfasst Zehntausende Designs, und fast
jeder Besuch beginnt an einem Suchfeld. Die Suche lief über Algolia — ein gutes
Produkt, das genau das tut, was es verspricht: Es findet Text.

Das Problem ist, dass niemand, der Kunst kauft, so sucht. Getippt wird
*"Katze Aquarell"*, gemeint ist ein Gefühl, keine Zeichenkette. Eine
Keyword-Suche findet dieses Design nur, wenn jemand beide Wörter in Titel oder
Tags geschrieben hat. Designs werden von Creators hochgeladen. Ihre Titel sind
das, wonach den Creators an dem Tag war.

Die Grenze lag also nicht an Algolias Relevanz-Tuning. Sie lag daran, dass im
Index Wörter standen — und das, wonach Kundinnen und Kunden suchten, waren Bilder.

## Rahmenbedingungen

- **Nichts darf schlechter werden.** Die Suche steht ganz oben im Funnel. Eine
  Relevanz-Regression ist eine Umsatz-Regression, und sie fällt nicht immer am
  ersten Tag auf.
- **Die Algolia-API musste weiter funktionieren.** Frontend und Admin-Backend
  sprachen beide mit ihr. Alle drei gleichzeitig umzuschreiben ist der Weg, auf
  dem Migrationen scheitern.
- Latenz ist kundenseitig spürbar, und ein Embedding-Modell im Request-Pfad ist
  etwas Neues und Teures an dieser Stelle.

## Was ich gemacht habe

Einen Suchdienst in Go, der eine Anfrage als Vektor behandelt, nicht als Text.

{{< mermaid >}}
graph TD
  Q["Katze Aquarell"] --> E[CLIP-Embedding]
  E --> V[Qdrant ANN]
  Q --> T[Postgres-Volltext]
  Q --> C[Cluster-Lookup]
  Q --> F[Filtervorschläge]
  V --> M[Zusammenführen + Dedupe]
  T --> M
  C --> M
  F --> M
  M --> EL[Elbow-Schnitt]
  EL --> R[Reranking]
  R --> O[Ergebnisse]
{{< /mermaid >}}

**Das Retrieval läuft vierfach gleichzeitig.** Vektorsuche über Bild-Embeddings
in Qdrant, Volltextsuche über Titel in Postgres, ein Cluster-Lookup für Stil und
Thema sowie semantische Filtervorschläge. Sie sind unabhängig, laufen also
nebenläufig, und der langsamste bestimmt die Latenz.

**Die Vektorseite holt bewusst zu viel.** Sie zieht ein Vielfaches der benötigten
Kandidaten, wendet harte Filter an — Farbe, Thema, Stil, Ausrichtung — und
begrenzt, wie viele Treffer ein einzelner Shop beisteuern darf, damit kein
produktiver Creator die erste Seite besetzt.

**Ein Elbow-Schnitt statt einer festen Grenze.** Statt "gib die Top N zurück"
wird die Kandidatenliste dort gekappt, wo die Ähnlichkeitswerte abstürzen. Eine
Anfrage mit acht wirklich guten Treffern soll acht liefern, nicht vierzig mit
zweiunddreißig Enttäuschungen dahinter.

**Das Reranking mischt Relevanz mit Geschäft.** Semantische Ähnlichkeit, ein
Titeltreffer gewichtet danach, wie selten die Anfrage ist, und kommerzielle
Signale wie Verkäufe und Merklisten. Die Seltenheitsgewichtung mag ich besonders:
Bei einer ausgefallenen Anfrage ist ein wörtlicher Titeltreffer starke Evidenz,
bei einer häufigen fast keine.

### Dorthin kommen ohne Big Bang

Die Migration war bewusst langweilig:

1. Algolias API-Oberfläche nachbauen — index, partial index, remove, getObject,
   search — sodass Aufrufer keinen Unterschied merken.
2. Doppelbetrieb. Jede Indexierung ging an Algolia *und* den neuen Dienst.
3. Den Katalog einmalig migrieren.
4. Das Frontend auf den neuen Dienst umstellen.
5. Beides weiterlaufen lassen und beheben, was der Vergleich zeigt.
6. Algolia abschalten.

Schritt 2 und 5 sind die entscheidenden. Beides parallel zu betreiben macht aus
"ich glaube, die Relevanz passt" etwas, das man tatsächlich prüfen kann.

### Schnell machen

Der Großteil des letzten Jahres war Performance-Arbeit, keine Features:

- **Query-Embeddings in Redis gecacht.** Dieselben Anfragen wiederholen sich
  ständig; es gibt keinen Grund, das Modell zweimal zu bezahlen.
- **Nebenläufige ANN-Abfragen** für mehrteilige Suchen statt nacheinander.
- **Indexierung auf eine dauerhafte Queue verlagert.** Embedding und
  Farbextraktion sind langsam und haben in einem Request nichts verloren.
- **Cache-Lesezugriffe zusammengefasst** auf eine einzige Objektspeicher-Anfrage,
  mit dem Response-Body wortgetreu statt Base64-kodiert in JSON, und
  geschlüsselt auf die ausgehandelte Kodierung — damit ein Brotli- und ein
  Gzip-Client sich nicht um denselben Eintrag streiten.

## Ergebnis

Die Suche versteht, wie ein Design aussieht, nicht nur, wie es benannt wurde. Die
Rechnung für die verwaltete Suche ist weg, und mit ihr die Obergrenze dafür, was
sich beim Ranking machen lässt — Personalisierung, Bildähnlichkeitssuche und
Freitextanfragen mit dialogischer Verfeinerung gehen erst, wenn einem der
Retrieval-Pfad selbst gehört.

**Was es gekostet hat.** Die Relevanz gehört jetzt uns. Algolias Ranking war das
Problem von jemand anderem; unseres ist meines. Die Reranking-Formel ist ein Satz
Regler, und Regler brauchen eine Person und einen Grund — sonst stellt sie, wer
sich zuletzt beschwert hat.

Eine Vektordatenbank selbst zu betreiben ist außerdem echte Betriebsarbeit:
Kapazität, Persistenz, Backfills und ein Kill Switch für den Fall, dass sie
sich danebenbenimmt. Das ist ein echter Tausch, kein Gratisgewinn. Für einen
Katalog, in dem das Produkt *das Bild ist*, war es eindeutig der richtige.
