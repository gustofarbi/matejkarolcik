---
title: "Infrastruktur für zwei Shops"
date: 2026-07-01
weight: 40
summary: "Zwei E-Commerce-Marken, vier Umgebungen, ein Satz Terraform-Module. Die langweilige Hälfte der Backend-Arbeit — und die, die entscheidet, ob die interessante Hälfte je live geht."
stack: ["Terraform", "AWS", "Kubernetes", "Helm", "GitHub Actions"]
showComments: false
showTableOfContents: true
---

## Das Problem

myposter und JUNIQE sind zwei Shops mit getrennten Katalogen, getrennten
Frontends und größtenteils getrennten Services — aber derselben kleinen Gruppe
von Menschen dahinter. Jeder hat eine Produktions- und eine Staging-Umgebung.
Jeder neue Service braucht eine Datenbank, eine Queue, einen Cache, eine
IAM-Rolle, einen Bucket, eine Deployment-Pipeline und einen Weg, nachzusehen,
wenn er sich danebenbenimmt.

Macht man das viermal pro Service von Hand, passieren zwei Dinge: Es dauert eine
Woche, irgendetwas zu starten, und die vier Umgebungen hören still und leise auf,
einander zu ähneln. Das Zweite ist schlimmer, weil man es während eines Incidents
erfährt.

## Rahmenbedingungen

- Staging muss Produktion tatsächlich vorhersagen. Eine Staging-Umgebung, die sich
  auf interessante Weise unterscheidet, ist ein sehr teurer Weg, nichts zu lernen.
- Entwicklerinnen und Entwickler sollten keine Terraform-Autoren sein müssen, um
  einen Service auszuliefern.
- Nichts darf eine Big-Bang-Migration erfordern. Das sind laufende Shops.

## Was ich gemacht habe

**Umgebungs-Repositories, eines pro Umgebung.** Jedes enthält einen
Terraform-Stack pro Service — die Renderer, den Suchdienst, die Backends, die
Lambdas, die Gateways. Die Infrastruktur eines Service liegt neben der der
anderen Services derselben Umgebung; was dort existiert, ist ein
Verzeichnislisting entfernt.

**Eine gemeinsame Modulbibliothek.** Versionierte, wiederverwendbare Module für
das, was jeder Service braucht:

- Aurora Serverless v2, Postgres und MySQL
- ElastiCache — Redis, Redis Serverless, Valkey Serverless
- RabbitMQ, SQS-Queues, API Gateway
- IAM-Rollen, darunter eine eigene Kubernetes-Anwendungsrolle
- S3-Buckets, Kostenalarme und ein Metadaten-Modul, das Tagging konsistent macht
  statt bloß wünschenswert

Module werden nach Version eingebunden, nicht nach Branch. Ein Datenbankmodul zu
aktualisieren ist eine Entscheidung, die jede Umgebung bewusst trifft — und genau
darum geht es: Produktion soll hinter Staging liegen, absichtlich, und so lange,
wie es dauert, sicher zu sein.

**Gemeinsame Deployment-Workflows.** Wiederverwendbare GitHub-Actions-Pipelines,
gesteuert über zwei Dateien im Repository-Root, die die Helm-Values- und
Terraform-Var-Dateien auflisten. Einen Service hinzuzufügen heißt, eine Zeile
hinzuzufügen, nicht eine Pipeline zu schreiben. Der Workflow wird einmal für alle
gepflegt statt kopiert und dann vergessen.

## Ergebnis

Ein neuer Service erreicht Staging mit einem Stack-Verzeichnis und ein paar Zeilen
Konfiguration, auf denselben Primitiven wie alles andere. Die vier Umgebungen
bleiben vergleichbar, weil sie aus denselben Teilen bestehen, und Drift zeigt sich
als Versionsunterschied statt als Überraschung.

**Was es kostet.** Gemeinsame Module sind eine Kopplung. Eine Änderung am
Datenbankmodul nehmen irgendwann alle mit, also muss das Modul vorsichtiger und
konservativer sein, als es ein einzelner Aufrufer bräuchte. Versionierung macht
das erträglich; umsonst macht sie es nicht.

Und Module als versionierte Archive im Objektspeicher zu verteilen ist pragmatisch
statt elegant. Eine richtige Registry böte bessere Auffindbarkeit und Herkunft.
Das hier funktioniert, war billig, und es zu ersetzen war nie das Wertvollste, was
in einer gegebenen Woche zu tun war — was der ehrliche Grund dafür ist, warum die
meiste Infrastruktur so aussieht, wie sie aussieht.
