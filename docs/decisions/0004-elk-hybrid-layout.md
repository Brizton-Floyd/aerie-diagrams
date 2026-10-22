# 0004 Hybrid layout: unmodified ELK behind our seam

Status: accepted, 2026-10-22

## Decision

Structure views are laid out by **ELK** (the `elkjs` package, EPL-2.0), used unmodified, behind our
own narrow layout interface. Everything that makes Aerie's layout distinctive is ours:

- lifting relationships to visible containers as the reader zooms;
- reserving space for every audience's wording (on by default);
- label wrapping;
- open and close animation;
- the whole scenario layout (lanes).

## Why

ELK is the strongest open layout engine for nested, directed diagrams. Keeping it behind our own
interface means we can swap in our own engine later without touching the rest of the product.

## Consequences

- No other module imports ELK directly; only the layout implementation does.
- EPL-2.0 obligations (notice, source link) go to the lawyer review before release.
- Layout rule checks run on every view and audience (slice A4).
