---
title: "Sechs Jahre lang zeigen, wie das Design auf dem Ding aussieht"
date: 2026-08-01
weight: 20
summary: "Eine Frage — wie sieht das gedruckt aus? — auf fünf verschiedene Arten beantwortet, weil ein Poster, ein T-Shirt und ein Warenkorb-Thumbnail nicht dasselbe Problem sind."
stack: ["Go", "Rust", "PHP", "libvips", "AWS Lambda", "Kubernetes"]
showComments: false
showTableOfContents: true
---

## Das Problem

Alles, was myposter und JUNIQE verkaufen, wird erst nach der Bestellung gedruckt.
Es gibt kein Produktfoto, weil es das Produkt bis zum Kauf nicht gibt. Zwischen
Kundschaft und Kaufentscheidung steht ausschließlich ein Bild von etwas, das noch
nicht existiert.

Diese eine Frage — *wie wird das aussehen?* — zieht sich seit 2020 durch fast
meine gesamte Arbeit. Es klingt nach einem einzelnen Service. Ist es nicht, und
das Interessante ist der Grund.

## Warum ein Service nie die Antwort war

Ein gerahmter Druck, ein T-Shirt und ein Thumbnail im Warenkorb sind
unterschiedliche Probleme im selben Mantel:

- Ein **gerahmter Druck** ist 2D. Das Design kommt in ein Rechteck, der Rahmen
  darum herum, und das Ganze ist Compositing.
- Ein **T-Shirt oder eine Tasse** ist 3D. Das Design legt sich um eine Oberfläche,
  und Licht und Falten sind der ganze Grund, warum das Bild überzeugt.
- Ein **Warenkorb-Thumbnail** ist winzig, wird ständig gebraucht und von niemandem
  genau angeschaut. Dafür das 3D-Budget auszugeben ist Verschwendung.

Gleiche Frage, andere Physik, andere Kostenprofile. Also gibt es mehrere Services,
und die Nähte liegen entlang der Achse, die tatsächlich variiert.

## Was ich gebaut habe

**preview-service** *(Go, 2020 → heute)* — der
älteste und langlebigste. Rendert einen Stapel Bilder zu einer flachen Ebene.
Unspektakuläres Compositing und das Arbeitstier hinter dem 2D-Katalog.

**canvas-renderer** *(PHP, 2021 → 2026)* — SVG-Rendering für Leinwandprodukte,
nah am Shop-Backend angesiedelt, um dessen Pakete mitzunutzen statt sie zu
duplizieren.

**juniqe-preview** *(Go + libvips, 2023 → 2025)* — Wandbilder. Legt Canvas-Bilder
in Masken-Bilder, wobei die Platzierung weder im Code noch in einer Konfigurations-
datei steht, sondern in **XMP-Metadaten im Maskenbild selbst**. Diese Entscheidung
lohnt die Verteidigung: Ein neuer Produktrahmen ist damit ein Asset, das jemand
hochlädt, kein Deployment. Das Designteam brauchte dafür keine Entwickler mehr.

**[gimme-3d](https://github.com/gustofarbi/gimme-3d)** *(Rust, 2024 → heute)* — die
3D-Produkte. Ein absturzanfälliger GPU-Service, neu geschrieben für CPUs, mit
einer Einschränkung, die die Architektur von allem danach vorgegeben hat. Dazu
gibt es [einen eigenen Text]({{< ref "/work/3d-preview-renderer" >}}).

**cart-preview** *(Go + libvips auf Lambda, 2025 → heute)* — Warenkorb-Thumbnails.
Stoßweise, billig und schlecht geeignet für einen dauerhaft laufenden Pod. Es ist
eine Lambda, weil die Lastform das sagt.

## Ergebnis

Sechs Jahre an derselben Frage, über zwei Marken, in vier Sprachen, auf drei
Deployment-Modellen — langlaufende Pods, Lambdas und ein PHP-Service im Cluster
des Shops selbst.

**Was ich sagen würde, wenn du nach den Fehlern fragst.** Fünf Services sind auch
fünf Dinge, die am Leben bleiben müssen. Es gibt echte Doppelungen — auf libvips
basierende Bildverarbeitung existiert an mehr als einer Stelle, und die Grenzen
ergaben sich jeweils zum Zeitpunkt des Schreibens, nicht als Gesamtbild.

Würde ich die Karte heute neu zeichnen, würde ich die 2D-Pfade zusammenlegen — sie
ähneln sich mehr, als ihre getrennten Repositories vermuten lassen — und 3D
separat halten, weil das wirklich ein anderes Tier ist. Die Aufteilung, die der
Prüfung standhält, ist 2D gegen 3D. Der Rest ist Geschichte, und Geschichte ist
ein echter Grund, aber kein guter.
