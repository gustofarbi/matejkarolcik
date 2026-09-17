---
title: "A load balancer that knows which pod is busy"
date: 2025-04-18
weight: 50
summary: "Each renderer pod can serve exactly one request at a time. Kubernetes has no idea about that, so I wrote a load balancer that does."
stack: ["Go", "Kubernetes", "Redis", "Helm"]
showComments: false
showTableOfContents: true
---

## The problem

The [preview renderer]({{< ref "/work/3d-preview-renderer" >}}) has a hard
constraint baked into it: one render per process at a time. The underlying
headless graphics context cannot be shared between threads and cannot be
instantiated twice, so concurrency inside a pod is not available at any price.

Scaling it therefore means running many pods. Which surfaces a problem that does
not exist for ordinary stateless services:

**A Kubernetes Service does not know that a pod is busy.** kube-proxy distributes
connections without any notion of what is happening inside them. For requests
that finish in milliseconds this is fine — the imbalance evens out. For requests
that take seconds, it is not: a request gets routed to a pod that is mid-render
and queues behind it, while a pod next door sits idle.

Least-connections routing gets you closer, but it is not generally available at
the Service level, and "connections" is still a proxy for the thing you actually
care about, which is whether that pod is currently able to do work.

## Constraints

- The balancer itself cannot become the new single point of failure. Replacing
  one fragile instance with a different fragile instance is not progress.
- It has to work with pods that come and go, because that is what pods do.
- I wanted it usable for more than this one service — long-running requests are a
  general shape, not a quirk of rendering.

## What I did

[lb-9000](https://github.com/gustofarbi/lb-9000): a load balancer in Go that
keeps its own book on the state of every backend.

{{< mermaid >}}
graph TD
  A[Request] --> B[lb-9000]
  B --> C{Pool state}
  C -->|free| D[Pod A]
  C -.->|busy| E[Pod B]
  B <--> F[(Redis<br/>shared state)]
  B <--> G[Kubernetes API<br/>pod discovery]
{{< /mermaid >}}

- **Pod discovery through the Kubernetes API**, by namespace and label selector,
  refreshed on an interval. Pods appearing and disappearing is the normal case,
  not an error path.
- **Per-pod bookkeeping.** The pool tracks what each backend is doing, and the
  routing strategy picks from that rather than from a round-robin counter.
- **Pluggable storage.** In-memory for a single instance; Redis when the balancer
  runs redundantly and replicas need to agree.
- **Leader election** to keep that shared state consistent, so redundancy does not
  buy you two balancers confidently disagreeing about which pod is free.

Strategy, orchestration and storage are each behind an interface. The Kubernetes
orchestration is the one that exists; the seam is there because "which pods are
there" is a different question from "which pod should get this request", and
conflating them is how this kind of thing becomes unportable.

## Outcome

Requests land on backends that can actually serve them, which for a service with
a per-pod concurrency of one is the difference between capacity scaling linearly
with replicas and capacity scaling with luck.

**Honest status:** this is an experimental project, and the readme says so. It
solves a specific problem well and has not been hardened the way something you
would hand to a team needs to be.

**And it has since been superseded.** The renderer it was built for now runs on
AWS Lambda, where one request per execution environment is a property of the
platform rather than something you have to enforce yourself. The problem did not
go away; it stopped being mine to solve. I would rather say that plainly than
leave a project on a portfolio implying it is still load-bearing.

**The trade-off.** Redundancy costs a Redis dependency and a leader election, and
both exist purely to stop replicas from disagreeing. For a single-instance
deployment the in-memory store is simpler and the balancer becomes a single point
of failure again — which is exactly the thing I was trying to avoid. That tension
is not resolved; it is a dial, and the config picks a position on it.
