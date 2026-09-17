---
title: "When your resource cannot move: !Send in an async Rust server"
date: 2026-09-05
summary: "A headless OpenGL context has to live on the main thread and cannot be shared. Tokio wants to move things between threads. Here is the shape that makes those two facts coexist."
tags: ["rust", "async", "tokio", "rendering"]
---

Most async Rust is written on the assumption that your state can move. You wrap
it in an `Arc`, hand clones to every request handler, and the runtime schedules
them wherever it likes.

Then you meet a type that says no.

## The constraint

I maintain a service that renders 3D product previews. It uses
[three-d](https://github.com/asny/three-d) with a headless OpenGL context, and
that context comes with three rules:

1. It is neither `Send` nor `Sync`, so it cannot cross a thread boundary or be
   shared between threads.
2. It panics if you create it on any thread other than the main one.
3. It panics if you create a second one.

Rule 1 is common enough. Rules 2 and 3 together are what make it interesting:
there is exactly one of these objects, it lives at a fixed address in your
process, and the async runtime is not allowed anywhere near it.

This is not a Rust problem. It is a graphics problem that Rust is simply honest
about. The same constraint exists in C++; you just find out at runtime.

## The wrong instinct

The reflex is to reach for `spawn_blocking`, or a `LocalSet`, or to wrap the
thing in a `Mutex` and hope.

None of those help. `spawn_blocking` runs your closure on *a* blocking thread,
not *the* main thread. A `LocalSet` keeps futures on one thread, but that thread
is whichever one you built it on, and `main` has usually already been given away
to the runtime by then. And a `Mutex` solves sharing, which was never the
problem — the problem is location.

## The shape that works

Invert the usual arrangement. Instead of running the server on the main thread
and spawning workers, run the *server* as a spawned task and keep the main
thread for the thing that cannot move:

```rust
pub async fn run() {
    let (request_tx, request_rx) = mpsc::channel::<(Request, ResultChannel)>(10);

    // The HTTP server is what gets spawned.
    tokio::spawn(async move {
        serve(config.port, request_tx).await;
    });

    // The renderer is created on the main thread and never leaves it.
    let renderer = Renderer::new(config.models_base_url.clone());
    dispatch(renderer, request_rx).await;
}
```

`dispatch` is an ordinary loop that owns the renderer for the life of the
process:

```rust
pub async fn dispatch(renderer: Renderer, mut request_rx: Receiver<(Request, ResultChannel)>) {
    loop {
        let (request, response_tx) = request_rx.recv().await.unwrap();
        let pixels = renderer.render(request).await;
        let _ = response_tx.send(pixels);
    }
}
```

The piece that makes this pleasant to use is the type of the channel item:

```rust
type ResultChannel = oneshot::Sender<Result<DynamicImage>>;
mpsc::channel::<(Request, ResultChannel)>(10)
```

Every request carries its own return envelope. A handler sends the request plus
one half of a `oneshot`, then awaits the other half. From inside the handler it
reads like a normal `await` on a function call — the channel hop is an
implementation detail, not something every caller has to think about.

## The part that is not about threads

There is a second limit hiding behind the first. One context means one render at
a time, so requests must not pile up faster than they drain. The `mpsc` channel
has a bound, but a full channel only makes senders wait — it does not stop you
accepting a thousand connections that each buffer a multi-megabyte texture
upload while they wait their turn.

So admission happens at the front door, before anything large is allocated:

```rust
let semaphore = Arc::new(Semaphore::new(1));
```

Worth being precise about why. The semaphore is not protecting the renderer —
the channel already guarantees serial access, because there is one consumer. The
semaphore is protecting memory. Without it the service does not race; it runs out
of RAM, which is a considerably more annoying way to fail.

## What this costs

The control flow is genuinely harder to follow than a normal handler. A new
reader sees an HTTP handler that sends into a channel, a loop somewhere else that
receives from it, and a reply arriving through a second channel they have not met
yet. Nothing about that is obvious, and it is the first question anybody asks.

The honest answer is that the structure is not a design preference. It is the
shadow of a constraint the library imposes, and code shaped by an external
constraint always reads as if someone was being clever for no reason. The fix is
a comment at the top of the module saying which constraint, so the next person
knows there was a reason before they try to simplify it.

Which is the general lesson, really: when something cannot move, stop trying to
move it, and move everything else instead.
