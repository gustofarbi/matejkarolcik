---
title: "Eine GPU-Renderfarm durch CPUs ersetzen"
date: 2024-02-26
weight: 30
summary: "Produktvorschauen liefen über eine einzige, absturzanfällige GPU-Instanz. Ich habe den Renderer in Rust neu geschrieben, damit er auf gewöhnlichen CPU-Knoten läuft — und in die Breite statt in die Höhe skaliert."
stack: ["Rust", "three-d", "OpenGL", "glTF", "Docker", "Kubernetes"]
showComments: false
showTableOfContents: true
---

## Das Problem

myposter verkauft physische Produkte, die Kundinnen und Kunden selbst gestalten —
T-Shirts, Tassen, Duschvorhänge, Kissen, Wandbilder. Für jedes davon braucht es
ein Vorschaubild: das eigene Design, abgebildet auf einer fotorealistischen
Darstellung des tatsächlichen Objekts, bevor jemand kauft.

Der zuständige Service basierte auf C# und der Unreal Engine. Er hatte drei
Probleme, absteigend nach Schmerzgrad:

- Er brauchte eine GPU, also lief genau **eine** Instanz davon.
- Er stürzte ständig ab.
- Er war langsam.

Eine Instanz bedeutet einen Single Point of Failure vor einem Schritt, den jeder
Kunde durchlaufen muss. Der GPU-Bedarf war der Grund für die eine Instanz:
GPU-Knoten sind teuer, und sie für Lastspitzen zu skalieren ist keine
Nebenbei-Entscheidung.

## Rahmenbedingungen

- Volumen im Millionenbereich. Die Latenz ist kundenseitig spürbar — jemand
  schaut in dieser Zeit auf einen Ladebalken.
- Das Ergebnis muss überzeugen. Dieses Bild verkauft das Produkt.
- Ich wollte **gar keine GPU**. Nicht "weniger GPUs" — keine. Ein Service, der auf
  gewöhnlichen CPU-Knoten läuft, skaliert über eine Replica-Zahl statt über ein
  Beschaffungsgespräch.

## Was ich gemacht habe

Ich hatte in meiner Freizeit Rust gelernt, bin auf das Crate
[three-d](https://github.com/asny/three-d) gestoßen und habe den Renderer als
Nebenprojekt neu geschrieben, bevor daraus ein Arbeitsprojekt wurde.

Das Ergebnis ist [gimme-3d](https://github.com/gustofarbi/gimme-3d): ein
HTTP-Service, der ein glTF/GLB-Modell und Texturen entgegennimmt und ein
gerendertes Bild zurückgibt.

{{< mermaid >}}
graph LR
  A[Design + Produkt] --> B[POST /render]
  B --> C[glTF-Modell<br/>lokaler Cache]
  B --> D[Texturen]
  C --> E[three-d headless<br/>OpenGL unter Xvfb]
  D --> E
  E --> F[WebP / PNG]
{{< /mermaid >}}

Die Entscheidungen, die es zu verteidigen lohnt:

**OpenGL unter einem virtuellen Framebuffer statt auf einer GPU.** Der Container
startet `xvfb-run ./cmd serve` — ein virtuelles X-Display, gerendert wird auf der
CPU. Pro Bild langsamer als echte Hardware. Dafür läuft es auf jedem Knoten im
Cluster, und genau darum ging es: Die Skalierungseinheit wurde ein Pod statt einer
Grafikkarte.

**Ein Modell-Cache.** Modelle liegen im Objektspeicher. Ein `download`-Subcommand
holt sie vorab auf die lokale Platte, damit ein Render nicht auf S3 wartet.

**Ein Binary, mehrere Aufgaben.** Dasselbe `cmd`-Binary bedient HTTP, rendert eine
Datei oder ein Verzeichnis von der Kommandozeile, konvertiert FBX-Modelle nach
glTF und sammelt Modellnamen für die Konfiguration. Rendering lässt sich leichter
debuggen, wenn kein Server davorsteht.

Health-Endpoint für Kubernetes-Probes, Prometheus-Metriken, WebP-Ausgabe.

## Ergebnis

Das Vorschau-Rendering ist von einer einzelnen GPU-Maschine auf gewöhnliche
CPU-Knoten umgezogen, wo Kapazität eine Replica-Zahl ist. Der Absturz-Neustart-
Zyklus ist kein kundenseitiges Ereignis mehr, weil ein sterbender Pod nicht mehr
der ganze Service ist.

**Der Trade-off, den ich nicht wegdesignen konnte.** `three_d::HeadlessContext`
ist weder `Send` noch `Sync`. Er paniced, wenn man ihn außerhalb des
Haupt-Threads erzeugt, und er paniced, wenn man einen zweiten erzeugt. Ein
Prozess rendert also genau ein Bild gleichzeitig — abgesichert über eine
`tokio::sync::Semaphore`, damit der Speicher nicht überläuft.

Das kostet etwas. Der Durchsatz pro Pod ist auf eins festgenagelt, und die
Render-Pipeline liest sich zunächst seltsam: Ihre Struktur folgt einer
Einschränkung der Bibliothek, nicht der Form, die der Code gerne hätte.

Es heißt außerdem, dass ein gewöhnlicher Kubernetes-Service davor das Falsche ist
— Round Robin schickt eine Anfrage bereitwillig an einen Pod, der schon
beschäftigt ist, während nebenan einer leer läuft. Daraus wurde
[das nächste Projekt]({{< ref "/work/stateful-load-balancing" >}}).

## Wo es gelandet ist

Der Renderer läuft heute als AWS Lambda: ein Container-Image auf arm64, 2 GB
Speicher, hinter einem API Gateway.

Das ist der Teil dieser Geschichte, den ich am lehrreichsten finde. Ich habe
echten Aufwand in einen Load Balancer gesteckt, der mitverfolgt, welches Backend
beschäftigt ist — weil Kubernetes das nicht tut. Lambda liefert genau das
umsonst: eine Anfrage pro Execution Environment ist die Funktionsweise der
Plattform, und ein Service, dessen hartes Limit bei einer gleichzeitigen Anfrage
liegt, passt exakt dorthin. Die Mechanik, die ich um die Einschränkung herum
gebaut hatte, war auf einer anderen Plattform schlicht überflüssig.

Ich bereue den Bau nicht. Im damaligen Cluster war es die richtige Antwort, und
erst dadurch kannte ich die Form des Problems gut genug, um die bessere Antwort
zu erkennen, als sie auftauchte.

**Was ich anders machen würde.** Ich habe [warp](https://github.com/seanmonstar/warp)
als HTTP-Framework benutzt. Nichts an diesem Service hat warp gebraucht — die API
sind zwei Endpoints und ein Health-Check. Etwas Schlichteres wäre weniger zu
erklären gewesen.
