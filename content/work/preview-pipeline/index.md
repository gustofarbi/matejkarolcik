---
title: "Six years of showing people their design on a thing"
date: 2026-08-01
weight: 20
summary: "One question — what will this look like printed? — answered five different ways, because a poster, a t-shirt and a shopping-cart thumbnail are not the same problem."
stack: ["Go", "Rust", "PHP", "libvips", "AWS Lambda", "Kubernetes"]
showComments: false
showTableOfContents: true
---

## The problem

Everything myposter and JUNIQE sell is printed after it is ordered. There is no
photograph of the product, because the product does not exist until someone buys
it. The only thing standing between a customer and a purchase is a picture of a
thing that isn't real yet.

That one question — *what will this look like?* — has been the through-line of
most of my work since 2020. It sounds like a single service. It isn't, and the
interesting part is why.

## Why one service was never the answer

A framed print, a t-shirt and a thumbnail in the shopping cart are different
problems wearing the same coat:

- A **framed print** is 2D. The design goes in a rectangle, the frame goes around
  it, and the whole thing is compositing.
- A **t-shirt or a mug** is 3D. The design wraps around a surface, and the
  lighting and folds are the entire reason the image is convincing.
- A **cart thumbnail** is tiny, needed constantly, and nobody looks at it closely.
  Spending the 3D budget on it is waste.

Same question, different physics, different cost profiles. So there are several
services, and the seams between them are drawn along the axis that actually
varies.

## What I built

**preview-service** *(Go, 2020 → now)* — the
oldest and longest-lived. Renders a stack of images as a single flattened layer.
Unglamorous compositing, and the workhorse behind the 2D catalogue.

**canvas-renderer** *(PHP, 2021 → 2026)* — SVG rendering for canvas products,
living close to the shop backend so it could share its packages rather than
duplicate them.

**juniqe-preview** *(Go + libvips, 2023 → 2025)* — wall art. Layers canvas images
into mask images, where the placement is not in the code or a config file but in
**XMP metadata embedded in the mask image itself**. That decision is the one worth
defending: it means adding a new product frame is an asset someone uploads, not a
deployment. The design team stopped needing a developer.

**[gimme-3d](https://github.com/gustofarbi/gimme-3d)** *(Rust, 2024 → now)* — the
3D products. Rewriting a crash-prone GPU service to run on CPUs, with a
constraint that dictated the architecture of everything after it. That one has
[its own write-up]({{< ref "/work/3d-preview-renderer" >}}).

**cart-preview** *(Go + libvips on Lambda, 2025 → now)* — cart thumbnails. Bursty,
cheap, and a bad fit for a permanently running pod. It is a Lambda because the
traffic shape says it should be.

## Outcome

Six years on the same question across two brands, in four languages, on three
deployment models — long-running pods, Lambdas, and a PHP service inside the
shop's own cluster.

**What I would tell you if you asked what went wrong.** Five services is also
five things to keep alive. There is real duplication between them —
libvips-based image handling exists in more than one place, and the boundaries
made sense at the time each one was written rather than as a set.

If I were drawing the map fresh today I would consolidate the 2D paths, which are
more alike than their separate repositories suggest, and keep 3D apart, because
that one is genuinely a different animal. The split that survives scrutiny is
2D-versus-3D. The rest is history, and history is a real reason but not a good
one.
