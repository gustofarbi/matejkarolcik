---
title: "Ein Load Balancer, der weiß, welcher Pod beschäftigt ist"
date: 2025-04-18
weight: 50
summary: "Jeder Renderer-Pod kann genau eine Anfrage gleichzeitig bedienen. Kubernetes weiß davon nichts — also habe ich einen Load Balancer geschrieben, der es weiß."
stack: ["Go", "Kubernetes", "Redis", "Helm"]
showComments: false
showTableOfContents: true
---

## Das Problem

Der [Vorschau-Renderer]({{< ref "/work/3d-preview-renderer" >}}) trägt eine harte
Einschränkung in sich: ein Render pro Prozess, gleichzeitig. Der zugrunde
liegende Headless-Grafikkontext lässt sich weder zwischen Threads teilen noch ein
zweites Mal erzeugen — Nebenläufigkeit innerhalb eines Pods ist zu keinem Preis
zu haben.

Skalieren heißt also: viele Pods. Und damit taucht ein Problem auf, das es bei
gewöhnlichen zustandslosen Services nicht gibt:

**Ein Kubernetes-Service weiß nicht, dass ein Pod beschäftigt ist.** kube-proxy
verteilt Verbindungen, ohne zu wissen, was in ihnen passiert. Bei Anfragen im
Millisekundenbereich ist das egal — die Ungleichverteilung mittelt sich heraus.
Bei Anfragen, die Sekunden dauern, nicht: Eine Anfrage landet auf einem Pod, der
mitten im Rendern steckt, und stellt sich dahinter an, während nebenan einer frei
ist.

Least-Connections-Routing kommt näher heran, ist auf Service-Ebene aber nicht
allgemein verfügbar — und "Verbindungen" bleibt ein Hilfsmaß für das, was
eigentlich zählt: ob dieser Pod gerade arbeiten kann.

## Rahmenbedingungen

- Der Balancer darf nicht zum neuen Single Point of Failure werden. Eine fragile
  Instanz durch eine andere zu ersetzen ist kein Fortschritt.
- Er muss mit Pods umgehen, die kommen und gehen — denn das tun Pods.
- Ich wollte ihn über diesen einen Service hinaus nutzbar haben: lang laufende
  Anfragen sind ein allgemeines Muster, keine Eigenart des Renderings.

## Was ich gemacht habe

[lb-9000](https://github.com/gustofarbi/lb-9000): ein Load Balancer in Go, der
über den Zustand jedes Backends selbst Buch führt.

{{< mermaid >}}
graph TD
  A[Anfrage] --> B[lb-9000]
  B --> C{Pool-Zustand}
  C -->|frei| D[Pod A]
  C -.->|belegt| E[Pod B]
  B <--> F[(Redis<br/>gemeinsamer Zustand)]
  B <--> G[Kubernetes-API<br/>Pod-Discovery]
{{< /mermaid >}}

- **Pod-Discovery über die Kubernetes-API**, nach Namespace und Label-Selector, in
  einem Intervall aktualisiert. Dass Pods auftauchen und verschwinden, ist der
  Normalfall, kein Fehlerpfad.
- **Buchführung pro Pod.** Der Pool verfolgt, was jedes Backend gerade tut, und
  die Routing-Strategie wählt danach aus statt über einen Round-Robin-Zähler.
- **Austauschbare Persistenz.** In-Memory für eine einzelne Instanz; Redis, wenn
  der Balancer redundant läuft und die Replicas sich einig sein müssen.
- **Leader Election**, um diesen gemeinsamen Zustand konsistent zu halten — damit
  Redundanz nicht zwei Balancer erkauft, die sich selbstbewusst uneinig sind,
  welcher Pod frei ist.

Strategie, Orchestrierung und Persistenz liegen jeweils hinter einer Schnittstelle.
Die Kubernetes-Orchestrierung ist die, die existiert; die Naht ist da, weil
"welche Pods gibt es" eine andere Frage ist als "welcher Pod bekommt diese
Anfrage" — und beides zu vermischen ist der Weg, wie so etwas unportabel wird.

## Ergebnis

Anfragen landen auf Backends, die sie auch bedienen können. Bei einem Service mit
einer Nebenläufigkeit von eins pro Pod ist das der Unterschied zwischen Kapazität,
die linear mit den Replicas wächst, und Kapazität, die mit Glück wächst.

**Ehrlicher Status:** Das ist ein experimentelles Projekt, und die Readme sagt das
auch. Es löst ein konkretes Problem gut und ist nicht so abgehärtet, wie es etwas
sein müsste, das man einem Team in die Hand gibt.

**Und es ist inzwischen überholt.** Der Renderer, für den es gebaut wurde, läuft
heute auf AWS Lambda, wo eine Anfrage pro Execution Environment eine Eigenschaft
der Plattform ist und nichts, das man selbst durchsetzen muss. Das Problem ist
nicht verschwunden; es ist nur nicht mehr meines. Das sage ich lieber deutlich,
als ein Projekt im Portfolio stehen zu lassen, das so tut, als trüge es noch
Last.

**Der Trade-off.** Redundanz kostet eine Redis-Abhängigkeit und eine Leader
Election, und beide existieren nur, um Replicas am Widersprechen zu hindern. Bei
einem Single-Instance-Deployment ist der In-Memory-Store einfacher — und der
Balancer wird wieder zum Single Point of Failure, also genau zu dem, was ich
vermeiden wollte. Diese Spannung ist nicht aufgelöst; sie ist ein Regler, und die
Konfiguration wählt eine Stellung darauf.
