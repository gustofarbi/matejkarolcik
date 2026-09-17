---
title: "Replacing a GPU render farm with CPUs"
date: 2024-02-26
weight: 30
summary: "Product previews were rendered by a single crash-prone GPU instance. I rewrote the renderer in Rust so it would run on ordinary CPU nodes — and scale sideways instead of up."
stack: ["Rust", "three-d", "OpenGL", "glTF", "Docker", "Kubernetes"]
showComments: false
showTableOfContents: true
---

## The problem

myposter sells physical products that customers design themselves — t-shirts,
mugs, shower curtains, pillows, wall art. Every one of those needs a preview
image: the customer's design, mapped onto a photograph-like render of the actual
object, before they commit to buying it.

The service doing that was built on C# and Unreal Engine. It had three problems,
in descending order of how much they hurt:

- It needed a GPU, so we ran exactly **one** instance of it.
- It crashed constantly.
- It was slow.

One instance meant one point of failure in front of a step every customer has to
pass through. The GPU requirement is what made it one instance: GPU nodes are
expensive, and scaling them out to absorb spikes is not something you do casually.

## Constraints

- Volume in the millions of renders. Latency is customer-facing — someone is
  staring at a spinner while it happens.
- The output has to be convincing. This is the image that sells the product.
- I wanted **no GPU at all**. Not "fewer GPUs" — none. A service that runs on
  ordinary CPU nodes is one you can scale with a replica count instead of a
  procurement conversation.

## What I did

I had been learning Rust on my own time, found the
[three-d](https://github.com/asny/three-d) crate, and rewrote the renderer as a
side project before it was ever a work project.

The result is [gimme-3d](https://github.com/gustofarbi/gimme-3d): an HTTP service
that takes a glTF/GLB model and a set of textures, and returns a rendered image.

{{< mermaid >}}
graph LR
  A[Design + product] --> B[POST /render]
  B --> C[glTF model<br/>local cache]
  B --> D[Textures]
  C --> E[three-d headless<br/>OpenGL under Xvfb]
  D --> E
  E --> F[WebP / PNG]
{{< /mermaid >}}

The decisions worth defending:

**OpenGL under a virtual framebuffer, not a GPU.** The container runs
`xvfb-run ./cmd serve` — a virtual X display, with rendering done on the CPU.
Slower per render than real hardware. But it runs on any node in the cluster,
which is the whole point: the unit of scaling became a pod, not a graphics card.

**A model cache.** Models are fetched from object storage. A `download`
subcommand pre-pulls them to local disk so a render is not waiting on S3.

**One binary, several jobs.** The same `cmd` binary serves HTTP, renders a file
or directory from the command line, converts FBX models to glTF, and collects
model names for configuration. Rendering is easier to debug when you can run it
without a server in front of it.

Health endpoint for Kubernetes probes, Prometheus metrics, WebP output.

## Outcome

Preview rendering moved off a single GPU box onto ordinary CPU nodes, where
capacity is a replica count. The crash-and-restart cycle stopped being a
customer-facing event, because one pod dying is no longer the whole service
dying.

**The trade-off I could not design away.** `three_d::HeadlessContext` is neither
`Send` nor `Sync`. It panics if you create it off the main thread, and it panics
if you create a second one. So a process renders exactly one image at a time — I
gate it with a `tokio::sync::Semaphore` to avoid running out of memory.

That is a real cost. It means throughput per pod is fixed at one, and it means
the rendering pipeline reads strangely until you know why: the structure is
shaped around a constraint the library imposes, not around what the code wants to
look like.

It also means a stock Kubernetes Service is the wrong thing to put in front of
it — round-robin will happily send a request to a pod that is already busy while
another sits idle. That problem became
[the next project]({{< ref "/work/stateful-load-balancing" >}}).

## Where it ended up

The renderer now runs as an AWS Lambda: a container image on arm64, 2 GB of
memory, behind API Gateway.

That is the part of this story I find most instructive. I spent real effort
building a load balancer that tracks which backend is busy, because Kubernetes
would not do it. Lambda gives you that for nothing — one request per execution
environment is how the platform works, so a service whose hard limit is one
concurrent request fits it exactly. The custom machinery I had built to work
around the constraint was, on a different platform, simply unnecessary.

I do not regret building it. It was the right answer in the cluster the service
was living in at the time, and it is how I learned the shape of the problem well
enough to recognise the better answer when it turned up.

**What I would do differently.** I used [warp](https://github.com/seanmonstar/warp)
as the HTTP framework. Nothing about this service needed warp — the API is two
endpoints and a health check. Something plainer would have been less to explain.
