---
title: "Your cache key probably has Accept-Encoding in it"
date: 2026-09-15
summary: "If your cache stores compressed bodies, the encoding has to be part of the key. Putting the raw header there splits one entry into four, and getting it subtly wrong serves a gzip label on an uncompressed body."
tags: ["http", "caching", "go", "performance"]
---

Here is a cache that looks correct and is not.

A response cache sits at the edge of an HTTP service, outside the compression
middleware. It therefore stores bytes that have already been compressed. The
author knows this, and does the obviously right thing: puts `Accept-Encoding`
into the cache key, so a client that cannot read gzip never receives a gzipped
body.

That is the correct instinct and the wrong implementation.

## One body, four entries

`Accept-Encoding` is not an identifier. It is a sentence, and different clients
write it differently:

```
Chrome    gzip, deflate, br, zstd
Safari    gzip, deflate, br
curl      deflate, gzip, br, zstd
Go        gzip
```

If the raw header goes into the key, each of those is a distinct entry. When they
all end up served gzip — which they do, if gzip is what your middleware
produces — you are storing four byte-identical copies of the same body, and each
one paid its own cache miss to be produced. On a service where generating the
response is the expensive part, that is not a storage problem. It is a miss-rate
problem, and the miss rate is the only number that matters.

It gets worse with traffic diversity. Every new client library, every browser
version that reorders the list, every proxy that rewrites the header, forks
another copy of the same bytes.

## Key on the outcome, not the offer

The header is what the client *asked for*. The key should carry what it is
actually *going to get*:

```go
func negotiatedEncoding(r *http.Request) string {
	switch {
	case compression.AcceptsBrotli(r):
		return "br"
	case compression.AcceptsGzip(r.Header.Get(acceptEncodingHeader)):
		return "gzip"
	default:
		return "identity"
	}
}
```

Three possible values instead of unbounded ones. Every client that will receive
gzip now shares a single entry, while clients that genuinely cannot read a
compressed body stay firmly in their own. The negotiation already collapses a
large input space into a small output space — the bug is doing the collapsing
after the cache lookup instead of before it.

## The trap underneath

This is the part worth internalising, because it is the failure that does not
show up as slowness.

The cache key's idea of the encoding and the encoder's idea of the encoding must
come from the same code.

If they can disagree — if the key says `gzip` because it parsed the header one
way, while the middleware emitted an uncompressed body because it parsed it
another — then an identity body gets filed under a gzip key. The next client to
hit that key receives raw bytes with `Content-Encoding: gzip` on them and fails
to decode a response that is, as far as any log is concerned, a perfectly healthy
200.

So the function above does not interpret `Accept-Encoding` freshly. It defers to
the same compression package the middleware uses, so one set of rules drives both
the key and the encoder. And there is a test that runs the real middleware chain
and asserts the two agree — because "these two pieces of code must stay in
agreement forever" is a comment nobody reads and a test everybody notices.

## While you are in there

Two things usually sit next to this bug.

**Stop base64-ing the body.** If cache entries are JSON with the response body as
a base64 string, every entry is a third larger than it needs to be and every read
and write pays an encode. Store the body verbatim and keep the metadata
separate.

**Count your round trips.** A cache read that fetches metadata and then fetches
the body is two network calls on the hot path to avoid one computation. Sometimes
that still wins. Often it does not, and nobody checked, because the code says
"cache" and cache means fast.

## The general shape

The mistake is not really about compression. It is about putting an input into a
key when what matters is the decision derived from that input.

Any time a cache key contains something a client controls the wording of —
encodings, locales, sort parameters, feature flags expressed as a header — ask
what the set of distinct *behaviours* is. That number is usually small. The
number of ways to ask for them is not.
