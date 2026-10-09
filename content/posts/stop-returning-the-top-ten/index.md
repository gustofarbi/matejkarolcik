---
title: "Stop returning the top ten"
date: 2026-09-10
summary: "A fixed result count is a guess that is wrong in both directions. Finding the elbow in the score curve is about fifteen lines, and it lets the query decide how many results it deserves."
tags: ["search", "ranking", "go", "algorithms"]
---

Every search implementation starts with `LIMIT 10`, and most of them never
revisit it.

The problem with a fixed count is that it is wrong in both directions at once.
A very specific query might have four genuinely good matches — you return ten,
so six of them are padding, and the user learns that results further down the
page are not worth looking at. A broad query might have two hundred equally good
matches — you return ten, and the cutoff between position ten and position eleven
is pure coincidence.

The number of good results is a property of the query. Hard-coding it throws that
information away.

## What the scores look like

Any ranked retrieval — vector similarity, BM25, a blend — gives you a score per
candidate. Sort them descending and the curve usually has a shape: a plateau of
things that genuinely match, then a drop, then a long tail of things that share
a word or sit vaguely nearby in the embedding space.

That drop is the answer. It is where the engine stops being confident, and it
happens at a different index for every query.

Finding it is the classic elbow problem, and the geometric solution is small
enough to keep in your head.

## The method

Normalise both axes to `[0, 1]` — position across, score up. The curve now runs
from roughly `(0, 1)` to `(1, 0)`. Draw the straight chord between those corners.
The elbow is the point furthest from that chord.

For a line `x + y = 1`, the perpendicular distance from a point is
`|x + y - 1| / √2`, which makes the whole thing one pass:

```go
func FindElbow(scores []float32, tolerance float32) float32 {
	n := len(scores)
	if n < 3 {
		return scores[n-1]
	}

	slices.SortFunc(scores, func(a, b float32) int {
		return cmp.Compare(b, a)
	})

	yMax, yMin := scores[0], scores[n-1]

	bestIdx := 0
	bestDist := 0.0

	for i, y := range scores {
		x := float32(i) / float32(n-1)
		yn := (y - yMin) / (yMax - yMin)
		dist := math.Abs(float64(x+yn-1.0)) / math.Sqrt2
		if dist > bestDist {
			bestDist = dist
			bestIdx = i
		}
	}

	adjustedIdx := bestIdx + int(tolerance*float32(n-1))
	// clamp, then return scores[adjustedIdx] as the threshold
}
```

No derivatives, no smoothing, no parameters to fit. One pass after a sort, and it
returns a score threshold rather than an index — which matters, because you
usually want to apply it to a list you are still merging.

## The tolerance dial

`tolerance` shifts the cut by a fraction of the list length. Positive is more
generous, negative is stricter.

This exists because the mathematically correct elbow is not always the product
decision. A grid that looks broken with three items might want a floor. A
carousel might want a ceiling. Better to have one honest, named dial than to
have somebody quietly special-case the algorithm six months later.

## Where it misbehaves

It is not free, and the failure modes are all versions of the same thing: the
method assumes a curve with a shape.

**Everything is equally bad.** A query matching nothing produces a flat line of
low scores. A flat line has no elbow, so the maximum distance lands somewhere
arbitrary. Normalisation hides this by construction: it stretches any range to
`[0, 1]`, so a dismal top score and an excellent one look identical once
normalised.

Which is the real limitation of the whole approach. An elbow cut answers *where
does quality fall off*, and it cannot answer *was there any quality to begin
with*. Those are two separate questions, and the method only addresses one of
them — so it wants pairing with an absolute minimum score, applied before
normalisation throws the scale away.

**Everything is equally good.** The mirror image, and mostly harmless: you fall
back to roughly a fixed count, which is where you started.

**Tiny lists.** Under three items there is no shape to find, which is why the
function returns early rather than pretending.

**It is sensitive to the tail.** Because `yMin` comes from the last element, how
many bad candidates you retrieved changes the normalisation and therefore the
cut. Retrieve a consistent number of candidates, or the cut moves for reasons
that have nothing to do with the query.

## Why bother

Because "how many results are good?" is a real question with a real answer, and a
constant is a refusal to ask it.

The user-visible effect is subtle and worth it: specific queries stop being
padded with near-misses, and the tail stops training people to ignore anything
below the fold.
