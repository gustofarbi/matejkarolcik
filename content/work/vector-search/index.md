---
title: "Replacing Algolia with our own vector search"
date: 2026-09-01
weight: 10
summary: "JUNIQE's design search ran on a managed SaaS that could match words but not meaning. I built the service that replaced it — semantic image search in Go, on Qdrant and Postgres."
stack: ["Go", "Qdrant", "PostgreSQL", "pgvector", "Redis", "CLIP", "Kubernetes"]
showComments: false
showTableOfContents: true
---

## The problem

JUNIQE sells art prints. The catalogue is tens of thousands of designs, and
almost every visit starts with a search box. Search was Algolia — a good product
that does exactly what it says: it matches text.

The trouble is that nobody shopping for art searches like that. They type
*"cat watercolour"*, and they mean a feeling, not a string. A keyword engine can
only find that design if somebody remembered to put both those words in its
title or tags. Designs are uploaded by creators. Their titles are whatever the
creator felt like typing that day.

So the ceiling was not Algolia's relevance tuning. It was that the index
contained words, and the thing customers were searching for was images.

## Constraints

- **Nothing may get worse.** Search is the top of the funnel. A relevance
  regression is a revenue regression, and it is not always obvious on day one.
- **The Algolia API had to keep working.** The frontend and the admin backend
  both spoke it. Rewriting all three at once is how migrations fail.
- Latency is customer-facing, and an embedding model in the request path is a new
  and expensive thing to put there.

## What I did

A search service in Go that treats a query as a vector, not a string.

{{< mermaid >}}
graph TD
  Q["cat watercolour"] --> E[CLIP embedding]
  E --> V[Qdrant ANN]
  Q --> T[Postgres full-text]
  Q --> C[Cluster lookup]
  Q --> F[Filter suggestions]
  V --> M[Merge + dedupe]
  T --> M
  C --> M
  F --> M
  M --> EL[Elbow cut]
  EL --> R[Rerank]
  R --> O[Results]
{{< /mermaid >}}

**Retrieval runs four ways at once.** Vector search over image embeddings in
Qdrant, full-text title search in Postgres, a cluster lookup for style and topic,
and semantic filter suggestions. They are independent, so they run concurrently
and the slowest one sets the latency.

**The vector side over-fetches deliberately.** It pulls several times more
candidates than it needs, applies hard filters — colour, topic, style,
orientation — and caps how many results any one shop can contribute, so a single
prolific creator cannot own the first page.

**An elbow cut instead of a fixed cutoff.** Rather than "return the top N", the
merged candidate list is trimmed where the similarity scores fall off a cliff. A
query with eight genuinely good matches should return eight, not forty with
thirty-two disappointments after them.

**Reranking blends relevance with the business.** Semantic similarity, a title
match weighted by how rare the query is, and commercial signals like sales and
wishlist counts. The rarity weighting is the part I like: for an obscure query a
literal title match is strong evidence, and for a common one it is nearly none.

### Getting there without a big bang

The migration was deliberately boring:

1. Rebuild Algolia's API surface — index, partial index, remove, getObject,
   search — so callers could not tell the difference.
2. Dual-write. Every indexing operation went to both Algolia and the new service.
3. Backfill the catalogue.
4. Point the frontend at the new service.
5. Keep both running, and fix what the comparison exposed.
6. Turn Algolia off.

Steps 2 and 5 are the ones that matter. Running both at once is what turns
"I think relevance is fine" into something you can actually check.

### Making it fast

Most of the last year has been performance work, not features:

- **Query embeddings cached in Redis.** The same queries recur constantly; there
  is no reason to pay for the model twice.
- **Concurrent approximate-nearest-neighbour queries** for multi-part searches
  instead of running them one after another.
- **Indexing moved onto a durable queue.** Embedding and colour extraction are
  slow and must not happen in a request.
- **Cache reads collapsed** to a single object-storage request, storing the
  response body verbatim rather than base64 inside JSON, and keyed on the
  negotiated content encoding so a brotli client and a gzip client do not fight
  over the same entry.

## Outcome

Search understands what a design looks like, not just what it was named. The
managed search bill went away, and with it the ceiling on what we could do with
ranking — personalisation, image-similarity search and prose queries with
conversational refinement are all things you can only build once you own the
retrieval path.

**What it cost.** We now own relevance. Algolia's ranking was someone else's
problem; ours is mine. The reranking formula is a set of dials, and dials need a
person and a reason to turn them — otherwise they get tuned by whoever complained
most recently.

Self-hosting a vector database is also real operational work: capacity,
persistence, backfills, and a kill switch for when it misbehaves. It is a
genuine trade, not a free win. For a catalogue where the product *is* the image,
it was clearly the right one.
