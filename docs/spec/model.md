# Model semantics

What a canonical model ([language.md](language.md#12-the-canonical-json-model)) means: how elements
nest, how wording resolves for an audience, what a view draws, how relationships are lifted to the
elements a reader can see, how scenarios and walkthroughs turn into pictures, and the full state of
what a reader is looking at. Everything here is pure computation over the model, with no layout or
drawing, so it is tested without a browser (slice A3).

Requirement ids: `MODEL-nnn`. Conventions are in [overview.md](overview.md#reading-this-spec).

## Elements and tags

- **MODEL-001** **Model order** is the order of the canonical `elements` list (LANG-803). Wherever
  this spec lists elements without another rule, it lists them in model order.
- **MODEL-002** Elements form a forest. An element's **children** are the elements whose `parent` is
  its id; its **descendants** are its children and their descendants; its **ancestors** are its parent
  and the parent's ancestors. **Top-level** elements have no parent. An element's **depth** is the
  number of its ancestors, so top-level elements have depth 0. A **container** is an element with at
  least one child; a **leaf** has none.
- **MODEL-003** An element tagged `person` or `external` is a **rim** element: the layout places it on
  the outer edge of the picture ([layout.md](layout.md#elk-configuration)). `person` and `external`
  also choose the element's shape ([look.md](look.md#shapes)).
- **MODEL-004** An element's icon is the one its `icon` line names. Without one, it is the default
  icon of its first tag that has a default: `person` gives `person`, `external` gives `building`,
  `store` gives `cylinder`, `system` gives `stack`, `service` gives `gear`, `module` gives `module`.
  With no such tag the icon is `box`.
- **MODEL-005** An element's **kind label** heads its side panel. It is "Person" for `person`,
  "Outside the system" for `external`, otherwise its first tag with hyphens read as spaces and the
  first letter in upper case (`data-pipeline` gives "Data pipeline"), and "Element" when it has no
  tags. A nested element's label adds " in " and its parent's name: "Service in Lotto suite".
- **MODEL-006** An element's `code` units, the model's `system` and its `ignores` (LANG-751) mean
  nothing to a reader. Two models that differ only in them have the same views, drawn sets, edges,
  labels, scenarios, walkthrough pictures, layouts and drawings, for every audience and zoom state.
  They are read only by drift detection ([drift.md](drift.md)).

## Audience resolution

- **MODEL-101** The wording of `Words` for audience `a` is `set[a]` if present, otherwise `base`
  (which may be null: an element with no tagline shows none).
- **MODEL-102** The wording of `Prose` for audience `a` is `set[a]` if present, otherwise `base`; then,
  if `add[a]` is present, its paragraphs follow, separated from the rest by a blank line. If both parts
  are missing the description is empty.
- **MODEL-103** No other rule applies: there is no fallback from one audience to another and no
  inheritance from a container to its children.
- **MODEL-104** A relationship's **sentence** for audience `a` is the subject's name, the verb phrase
  and the object's name, all resolved for `a`, joined by spaces and ended with a full stop:
  "Website gets screen data from Screen API." A scenario step's sentence is made the same way.
- **MODEL-105** An audience with the `code` flag reads its taglines, verb phrases, descriptions and
  captions in the monospace face; names are always in the sans face ([look.md](look.md#type)).
- **MODEL-106** A reader starts with the model's default audience unless a shared link names another
  (MODEL-601). The viewer reads every model plain first (INT-101): it shows a model with its first
  audience as the default audience, so the default picture and links without `aud` start there. Which
  audience is the default never changes how wording is resolved (MODEL-101 to MODEL-104).

## View resolution

- **MODEL-201** The **selected** elements of a view are the union of its `show` items: an element item
  `{element: e, depth: n}` selects `e` and every descendant of `e` at most `n` levels below it; a tag
  item selects every element with that tag. A view with no items selects every top-level element.
- **MODEL-202** The **default drawn set** `D0` of a view is its selected elements plus all their
  ancestors. Elements outside the drawn set are not on screen.
- **MODEL-203** In any drawn set `D`, a drawn container is **open** when at least one of its children
  is in `D`, and **closed** otherwise. A closed container is drawn as one box that says how many
  children it holds. A view may open a container only partly, as `show [module]` does when a container
  holds modules and other things; only the selected children are drawn.
- **MODEL-204** The reader changes what is drawn by opening and closing containers in place. This is
  recorded as the **zoom state** `Z`: a map from container id to `open` or `closed`. A container not in
  `Z` is in its **default** state.
- **MODEL-205** The drawn set for a view and a zoom state is built from the top down. Start with the
  top-level elements of `D0`; they never change while the view is shown. Then, for each drawn container
  `c` in model order: if `Z[c]` is `open`, all children of `c` are drawn; if `Z[c]` is `closed`, none
  are; otherwise the children of `c` that are in `D0` are drawn.
- **MODEL-206** Opening container `c` sets `Z[c] = open`; closing it sets `Z[c] = closed`. Closing a
  container hides all its descendants; opening it again shows its children, each in its own default
  state.
- **MODEL-207** Revealing an element `x` (from a link in the side panel, a search in a later version,
  or a walkthrough) opens, from the outermost down, each ancestor of `x` that does not already draw the
  next element on the way to `x`.
- **MODEL-208** The zoom state is kept **normalised**: it holds an entry only for a drawn container
  whose state differs from its default. `open` is dropped when the default already draws every child,
  `closed` when the default draws none, and any entry for a container that is no longer drawn is
  dropped. Two zoom states with the same drawn set are then equal, which makes shared links canonical
  (MODEL-603).
- **MODEL-209** Switching to another view starts from that view's default: the zoom state is emptied.
- **MODEL-210** A view draws relationships of the kinds in its `kinds` list and no others.
- **MODEL-211** Two named zoom states are used by tests and tools: **everything open**, where every
  drawn container is open, recursively; and **all closed**, where every top-level container is closed.

## Lifting

Relationships are declared between elements at any depth. A view draws each one between the elements
the reader can see.

- **MODEL-301** The **lift** of element `x` in drawn set `D` is `x` itself if `x` is drawn, otherwise
  its nearest ancestor that is drawn, otherwise nothing.
- **MODEL-302** For each relationship of a kind the view draws, in model order, let `a` and `b` be the
  lifts of its subject and object. The relationship is **carried** by the drawn edge from `a` to `b`
  unless `a` or `b` is nothing, `a` and `b` are the same element, or one of them contains the other.
- **MODEL-303** There is one **drawn edge** for each ordered pair `(a, b)` that carries at least one
  relationship. Edges are ordered by the model order of the first relationship each carries. An edge
  from `a` to `b` and one from `b` to `a` are separate edges. An edge's id is `a->b`, so it stays the
  same across zoom states and audiences.
- **MODEL-304** An edge's **label** for audience `a` is the verb phrase of the first relationship it
  carries, resolved for `a`. When it carries `n` relationships with `n > 1`, the label is followed by
  " (+N more)" with `N = n - 1`: "fetches draw history from (+1 more)".
- **MODEL-305** The side panel and the label's hover text use each carried relationship's own
  sentence, with its own subject and object (MODEL-104), never the names of the lifted ends.
- **MODEL-306** Every carried relationship is drawn: the rule check of
  [layout.md](layout.md#rule-checks) fails if any carried relationship has no edge.

## Scenarios

- **MODEL-401** A step from `p` to `q` is a **reply** when the model has a relationship from `q` to
  `p` and none from `p` to `q`, of any kind, between exactly these two elements. Every other step is a
  **call**. Replies are drawn differently ([look.md](look.md#scenario-trail)).
- **MODEL-402** A step whose two elements have no relationship between them in either direction, of
  any kind, gets W601 ([language.md](language.md#catalogue)).
- **MODEL-403** A scenario's **participants** are the elements its steps name.
- **MODEL-404** A scenario plays on a **stage view**: the current view, if every participant has a
  lift there; otherwise the first view, in declaration order, whose top-level drawn elements give every
  participant a lift. Some view always qualifies, because a scenario that no view can stage is an error
  (E604). When the stage view is not the current view, it becomes the current view with an empty zoom
  state.
- **MODEL-405** A step is drawn between the lifts of its two elements in the current drawn set. When
  both lifts are the same element, or one contains the other, the step is **folded**: drawn as a loop
  on the inner one (the lift itself when they are the same). Opening the container reveals the step
  between its real ends. Lifting is recomputed whenever the reader opens or closes something during
  playback.
- **MODEL-406** At step `k` of a playing scenario, the lifts of the ends of steps 1 to `k` are
  **visited**, and the lifts of step `k`'s ends are **current**.

## Walkthroughs

- **MODEL-501** A walkthrough is presented one step at a time. The picture for step `k` is worked out
  by starting from the model's first view with an empty zoom state and applying steps 1 to `k` in
  order, as below. It does not depend on how the presenter got to step `k`.
- **MODEL-502** A step whose target is a view: if the view differs from the current one, it becomes
  current with an empty zoom state; if it is the same, the zoom state carries over. Then the step's
  `close` list and then its `open` list are applied, each in model order (MODEL-206). The step's
  `focus` elements are highlighted, and no scenario plays.
- **MODEL-503** A step whose target is a scenario: the stage view is chosen as in MODEL-404, its
  `close` and `open` lists are applied, and the scenario plays its range (all steps when there is no
  range) starting at the first step of the range. There is no focus.
- **MODEL-504** Inside a scenario step of a walkthrough, moving forward plays the next scenario step
  until the end of the range, then moves to the next walkthrough step. Moving back plays the previous
  scenario step until the start of the range, then moves to the previous walkthrough step. Entering a
  scenario step by moving back starts at the last step of its range.
- **MODEL-505** The audience changes only when the presenter switches it or a step with a `for` line
  is entered, forwards or backwards. Entering a step without `for` keeps the current audience.
- **MODEL-506** A step's focus elements must be drawn in the step's picture (E703). A step's narration
  is its description resolved for the current audience (MODEL-102).

## The picture

The **picture** is everything that decides what a reader sees. Shared links carry it
([interaction.md](interaction.md#shared-links)).

- **MODEL-601** A picture has: a view; an audience; a zoom state; and at most one of a selected
  element, a static scenario overview (with its selected step), a playing scenario (with its current step and whether it is shown as lanes), or a presented
  walkthrough (with its current step and, inside a scenario step, the scenario step). The theme, the
  reduced-motion setting and the camera are reader preferences, not part of the picture.
- **MODEL-602** The **default picture** is the first view (or the implicit view when there is none),
  the default audience and an empty zoom state. A view with an authored main scenario opens its static overview at stage 1; other views have nothing selected, playing or presented.
- **MODEL-603** A picture is normalised before it is shown or written to a link: the zoom state as in
  MODEL-208; a selected element that is not drawn is replaced by its lift; a step number outside its
  scenario or walkthrough is clamped to the nearest valid one; anything that names an id the model no
  longer has is dropped. When anything is dropped, the reader is told
  ([interaction.md](interaction.md#shared-links)).
- **MODEL-604** Selection and playback exclude each other: starting a scenario or a walkthrough clears
  the selection.
- **MODEL-605** A static scenario overview shows every step and keeps one selected for explanation.
  It is a separate activity, excluding element selection, playback and presentation. It uses the
  scenario's stage view, clamps its selected step and drops unknown scenarios as playback does.
  Opening containers and changing audience preserve the overview. Default pictures without an authored main scenario are unchanged.

## Worked example: Lotto

These are the exact results for [examples/lotto.aerie](examples/lotto.aerie), and they are tests for
slice A3.

### Big picture: `show user, suite +1, texas`

Drawn: User, Lotto suite (open), Website, Screen API, Analysis engine (closed, 4 inside), Results store
(closed, 4 inside), Texas Lottery website. Five edges, each carrying one relationship:

| Executive                                                      | Manager                                                        | Engineer                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| User uses Website                                              | User uses Website                                              | User uses Website                                                    |
| Website works through Website back end                         | Website gets screen data from Screen API                       | Website calls /ui/\* on Screen API                                   |
| Website back end asks for numbers from Number engine           | Screen API requests analysis from Analysis engine              | Screen API POSTs /api/v1/analysis/\* to Analysis engine              |
| Number engine fetches draw history from Results store          | Analysis engine fetches draw history from Results store        | Analysis engine POSTs /api/v1/state/games to Results store           |
| Results store downloads new results from Texas Lottery website | Results store downloads new results from Texas Lottery website | Results store polls CSV exports every 2 h from Texas Lottery website |

The relationships inside the Analysis engine and inside the Results store are not carried: both of
their ends lift to the same closed box.

### Services: `show user, suite +2, texas`

Drawn: as the Big picture, with the Analysis engine open (Engine service closed with 3 inside,
Strategies library, Shared data formats, Legacy desktop support) and the Results store open (Draw
history service, Results updater, Results reader, Saved draws). Ten edges:

| Executive                                                        | Manager                                                          | Engineer                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| User uses Website                                                | User uses Website                                                | User uses Website                                                      |
| Website works through Website back end                           | Website gets screen data from Screen API                         | Website calls /ui/\* on Screen API                                     |
| Website back end asks for numbers from Engine service            | Screen API requests analysis from Engine service                 | Screen API POSTs /api/v1/analysis/\* to core-server                    |
| Engine service picks and scores tickets with Strategies library  | Engine service picks and scores tickets with Strategies library  | core-server picks and scores tickets with core-result-analyzer         |
| Engine service fetches draw history from Draw history service    | Engine service fetches draw history from Draw history service    | core-server POSTs /api/v1/state/games to Draw history service          |
| Draw history service reads Saved draws                           | Draw history service reads Saved draws                           | Draw history service reads Saved draws                                 |
| Results updater downloads new results from Texas Lottery website | Results updater downloads new results from Texas Lottery website | Results updater polls CSV exports every 2 h from Texas Lottery website |
| Results updater hands the files to Results reader                | Results updater hands the files to Results reader                | Results updater hands the files to Results reader                      |
| Results reader saves draws into Saved draws                      | Results reader saves draws into Saved draws                      | Results reader writes {STATE}/{Game}.ser to Saved draws                |
| Results updater announces new draws to Draw history service      | Results updater announces new draws to Draw history service      | Results updater announces new draws to Draw history service            |

### Engineering: `show [module]`, `kind code`

Selected: Screen API, Engine service, Strategies library, Shared data formats, Legacy desktop support.
Drawn: those plus Lotto suite (open, partly: only Screen API and Analysis engine) and Analysis engine
(open). Engine service is closed with 3 inside; Screen API is a leaf. Six edges:

| Executive                                               | Manager                                               | Engineer                                    |
| ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| Engine service depends on Strategies library            | Engine service depends on Strategies library          | core-server depends on core-result-analyzer |
| Engine service depends on Shared data formats           | Engine service depends on Shared data formats         | core-server depends on core-model           |
| Engine service depends on Legacy desktop support        | Engine service depends on Legacy desktop support      | core-server depends on core-legacy-desktop  |
| Strategies library depends on Shared data formats       | Strategies library depends on Shared data formats     | core-result-analyzer depends on core-model  |
| Legacy desktop support depends on Shared data formats   | Legacy desktop support depends on Shared data formats | core-legacy-desktop depends on core-model   |
| Website back end uses the shapes in Shared data formats | Screen API uses the shapes in Shared data formats     | Screen API depends on core-model            |

The view's title reads "How the code is organised" for executives and "Engineering: code modules" for
the others.

### Scenarios

- Generate picks has 14 steps. Steps 7, 8 and 10 to 14 are replies (for example step 7,
  `history-service returns the full history to history-lookup`, because the model has
  `history-lookup fetches draw history from history-service` and nothing the other way).
- On the Big picture, steps 4, 5 and 8 to 11 are folded onto the Analysis engine. Step 6
  (`history-lookup fetches draw history from history-service`) runs from the Analysis engine to the
  Results store, and step 7, its reply, runs back.
- From the Engineering view, Generate picks plays on the Big picture: the User has no lift in
  Engineering, and the Big picture is the first view that gives every participant one.
- Results poll has 6 steps. Steps 2 and 4 are replies, and step 5 gets W601.

### Walkthrough `tour`

| Step | Picture                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 1    | Big picture, default zoom, focus Website                                                               |
| 2    | Big picture, default zoom, focus Screen API                                                            |
| 3    | Big picture, default zoom, focus Analysis engine                                                       |
| 4    | Services, Engine service open, focus Pick generation                                                   |
| 5    | Big picture, default zoom (the view changed), focus Results store                                      |
| 6    | Services, default zoom (the view changed, so Engine service is closed again), focus Results store      |
| 7    | Services, default zoom, Generate picks playing steps 1 to 14 (Services gives every participant a lift) |
| 8    | Big picture, default zoom, nothing focused                                                             |

## Authored high-level flow semantics

- **MODEL-606** An overview uses authored stages when present, numbered in declaration order. A stage retains its inclusive detailed-step range and anchors to that range's first step, lifted to the current picture. Changing audience or opening containers preserves stage identity and numbering. Without stages, an overview continues to use detailed step numbers. The model never infers stages or chronology from relationships.
- **MODEL-607** The default picture and switching to a view start its declared main scenario's overview at stage 1. A missing main-scenario declaration preserves the ordinary view default. Explicitly cleared and selected pictures remain distinct from a view's default and survive shared links and visits.
