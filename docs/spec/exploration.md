# Explore this part implementation specification

Status: self-contained implementation specification for Aerie's **Explore this part** feature,
also called "look inside". This document defines the behavior, data contracts, algorithms,
interface wording, integration responsibilities and verification criteria needed to implement it.
All feature-specific decisions and examples are included here.

The goal is to make a large architecture understandable one part at a time. A reader chooses a
container, sees its immediate children, and keeps the connections to surrounding systems. The
canonical model remains complete. Preserve Signal styling, authored audience wording, and ordinary
opening in place.

## Application prerequisites

Aerie provides Lines parsing, a canonical containment tree, directed relationships, authored views,
audience wording, layout, Signal SVG rendering, an About panel, shared picture links, visit history,
scenarios and tours. Implement exploration as an addition to these capabilities.

No new packages, services, database tables, API endpoints or language grammar are required.
The interfaces below describe semantic responsibilities; their names can be adapted to the host
application. Keep the pure model and layout calculations separate from browser rendering and
history effects. Dependencies and browser test tools must be available on the implementation
machine before running automated validation.

## Data contracts and terminology

An element has a stable string id, an optional parent represented as `null` for top-level parts,
and authored wording. A container is an element with at least one child; a leaf has none. Model
order is deterministic and places each parent before its descendants. A relationship has subject
and object element ids, a kind such as `runtime` or `code`, and an authored verb and description.
Its array index is its stable identity within one model. A view selects parts and relationship
kinds. Exploring changes the view's derived selection, not the stored view or model.

The picture contract is:

```ts
type Id = string;
type Zoom = ReadonlyMap<Id, 'open' | 'closed'>;
type Activity =
  | { kind: 'reading' }
  | { kind: 'selected'; element: Id }
  | { kind: 'overview'; scenario: Id; step: number }
  | { kind: 'playing'; scenario: Id; step: number; lanes: boolean }
  | { kind: 'presenting'; walkthrough: Id; step: number; scenarioStep: number | null };

interface Picture {
  view: Id;
  audience: Id;
  zoom: Zoom;
  activity: Activity;
  exploring?: Id | undefined;
}
```

An empty zoom map means the scope's default drawing. `undefined` means no exploration; no special
root id or fake canonical element is introduced. Audience, theme and camera have separate roles:
audience chooses words, theme chooses styling, and camera scales/pans already positioned geometry.

The existing tree adapter must provide these semantics:

| Operation                | Contract                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `has(id)` / `get(id)`    | Test existence / retrieve the canonical element                                              |
| `parent(id)`             | Immediate parent id, or `null`                                                               |
| `children(id)`           | Immediate children in model order                                                            |
| `ancestors(id)`          | Parent first, then its parent, ending at the top-level ancestor; excludes the element itself |
| `contains(outer, inner)` | Strict ancestor test; false for equal ids                                                    |
| `isContainer(id)`        | True exactly when there is at least one child                                                |
| `sort(ids)`              | Sort by canonical model order                                                                |

New public operations are `explore(semantics, picture, id)` and
`endExploration(semantics, picture)`. Add optional `exploring` arguments to
`Semantics.scope(view, exploring)`, `drawn(view, zoom, exploring)`,
`drawing(view, zoom, exploring)`, `Layouter.structure(view, zoom, exploring)` and
`Layouter.picture(view, zoom, audience, exploring)`. Existing callers that omit the argument retain
their old behavior. `Drawing` carries the optional id alongside its view, kinds, normalised zoom,
nodes and edges. Dropped-picture diagnostics add `{ part: 'exploration', id }` to the existing union.

## Reader experience

1. Select a container in an architecture picture.
2. In its About panel, choose **Explore this part**, beneath its description and above
   **More technical**.
3. The chosen container becomes an open drawing root. Its immediate children appear inside it.
   Connected outside parts appear alongside it, with outside containers initially closed.
4. Open or close parts using the existing controls. Select another container and explore it to
   replace the exploration root.
5. Choose **Return to previous picture** to recover the picture and camera from before this
   exploration. A fresh shared exploration offers **Show full view** instead.

Selection alone reads a part. **Open it here** adds children within the existing picture.
**Explore this part** changes which part of the model the picture concentrates on. **More
technical** changes wording. These actions retain separate meanings.

The action is unavailable for leaves, the current exploration root, and during playback or
presentation. Exploring an unknown id or an already explored root is a no-op in the model API.

The exploration panel names the root using the current audience, reports the number of parts
shown and omitted from the whole model, and says that connected outside parts remain visible.
The breadcrumb includes the root's original ancestors even though their boxes are omitted.
Those ancestor labels are context, not new breadcrumb navigation controls.

## Visibility algorithm

The inputs are the canonical model, the current authored view, the explored container id, and the
reader's normalised zoom state. Audience wording is not an input to visibility.

1. Identify the subtree containing the explored container and all its descendants.
2. Read relationships from the complete model. Keep only the current view's relationship kinds
   and relationships with at least one endpoint in that subtree. Incoming and outgoing
   relationships receive the same treatment.
3. For each endpoint outside the subtree, choose a visible representative. Walk its ancestor path,
   including the endpoint, from the top and select the first element outside the explored root's
   ancestor chain. This is the branch below their common ancestor, or the top-level element of
   another tree. Deduplicate representatives in model order.
4. Derive a scope whose drawing roots are the explored container and these representatives.
   Its default selection is the explored root at depth one and outside representatives at depth
   zero. This replaces the authored view's `show` selection for the exploration, while retaining
   its relationship kinds. Connected parts omitted by the original `show` can therefore appear.
5. Apply existing open, close and reveal operations within these roots. Ancestors above them do
   not become boxes. Each drawing root has no drawn parent and drawing depth zero; the canonical
   containment tree and authored names remain unchanged.
6. Lift relationship endpoints to their nearest drawn ancestors and merge shared visible endpoint
   pairs using the lifting and grouping rules below. Retain original relationship indexes, direction, order and
   audience-specific labels. A relationship collapsed into one box, or between a box and its
   containing box, follows the existing suppression rules.

Relationships solely between outside parts are omitted, including when a reader opens those
outside containers. Internal relationships and boundary connections remain eligible. All
immediate children of the explored root appear, including children with no eligible relationship.
There is no automatic ranking, arbitrary part limit, or audience-dependent depth.

### Zoom and edge mechanics

To build the drawn set, scan elements in model order. An explicit drawing root appears when it
belongs to the scope's default selection, regardless of its original parent. Every other element
appears only when its parent is drawn and that parent is marked open, or has no override and the
element belongs to the default selection. A closed parent draws no children. With no exploration,
the original top-level-root behavior is unchanged.

Normalise zoom by keeping only overrides for drawn containers that differ from their default.
Drop `open` when all immediate children are already selected by default, drop `closed` when no
children are selected by default, and drop overrides for hidden, unknown or leaf elements. Preserve
model order in the resulting map. Closing therefore drops descendant overrides; reopening starts
those descendants in their defaults rather than restoring stale marks.

Revealing an element follows its ancestor path from the first permitted drawing root, opening each
container needed to expose the next path element. A part outside every permitted root cannot be
revealed within that scope. The picture operation first exits exploration in that case, then asks
the original authored scope to reveal it.

For every eligible relationship, find the nearest drawn endpoint for each end, using the element
itself when drawn. Suppress a line if either end has no drawn representative, both ends map to the
same box, or one representative contains the other. Group the remaining relationships by ordered
`source->target`; opposite directions are separate edges. Keep their original model indexes in
`carries`. Remove outside-only carried relationships even if a grouped edge also contains eligible
ones. Remove an edge whose `carries` becomes empty; sort edges by their first remaining index.

The displayed edge label uses the first carried relationship's verb in the selected audience,
followed by ` (+N more)` when there are N further relationships. Do not use a removed relationship
to choose the label. All original relationship sentences remain available in the model for the
existing detail panel. Audience resolution uses the chosen audience's authored override when
present and its existing base-wording fallback otherwise. The layout reserves the widest wording
across all audiences before positioning boxes and labels.

### Worked example

The complete verification fixture later in this document contains an `engine` with `api`
and `jobs` children; `handler` is inside `api`. Exploring `engine` in its runtime view draws
`engine`, `api`, `jobs`, `web`, `store` and `remote`. Only `engine` starts open.

| Authored relationship                   | Visible result  | Reason                                             |
| --------------------------------------- | --------------- | -------------------------------------------------- |
| `screen -> handler`                     | `web -> api`    | Incoming connection, both endpoints lifted         |
| `handler -> primary`                    | `api -> store`  | Outgoing connection                                |
| `jobs -> secondary`                     | `jobs -> store` | Another outgoing connection to the collapsed store |
| `remote-api -> handler`                 | `remote -> api` | Incoming connection from another tree              |
| `primary -> screen`                     | Omitted         | Both endpoints are outside the explored subtree    |
| `handler -> unrelated` with kind `code` | Omitted         | The runtime view excludes this relationship kind   |

Opening `api` reveals `handler` without introducing unrelated parts. Exploring `api` instead
removes the surrounding `engine` box and recalculates its outside representatives.

## Picture state and navigation

The reader's `Picture` gains an optional `exploring` element id. This is runtime picture state,
not a new Lines statement or a change to the canonical model. `Drawing` also carries this id so
layout checks can independently determine the relationships the exploration should contain.

| Reader operation                                        | Exploration and zoom behavior                                                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Explore a valid container                               | Set the root, reset zoom to that scope's defaults, select the root and request a fitted arrival                         |
| Explore another container                               | Replace the root and derive a fresh scope                                                                               |
| Open, close or reveal a part within the scope           | Preserve the root; normalise zoom within its drawing roots                                                              |
| Close a container holding the selection                 | Replace the selection with its nearest drawn ancestor                                                                   |
| Change audience                                         | Preserve scope and zoom; reuse geometry and replace wording                                                             |
| Clear selection                                         | Keep the exploration and show the reading panel                                                                         |
| Select a part outside the scope through a detail link   | Leave exploration, then use the authored view's existing reveal rules                                                   |
| Choose a view, flow overview, scenario playback or tour | Clear exploration and its scoped zoom so the activity has its complete stage                                            |
| Return to previous picture                              | Restore the preceding visit with a different exploration root, including its audience, zoom, selection and saved camera |
| Show full view from a fresh shared exploration          | Clear the root and reset authored-view zoom; retain the current audience and normalise the selection                    |

Return scans backwards through visits, skipping changes made within the same exploration, such
as wording, selection and opening children. A nested exploration can therefore return to its
parent exploration. Browser Back and Forward continue to use the existing visit history.

Revealing an outside-scope element does not invent another authored view or expand the model's
top-level view membership. After leaving exploration, the existing view resolution rules apply.

## Links and compatibility

The canonical fragment adds `explore` after `aud` and before `open` and `closed`. For example:

```text
#explore=engine&sel=engine
#aud=engineer&explore=engine&open=api&sel=api
```

Open and closed marks are normalised against the exploration's defaults. Old links without
`explore` retain their meaning. An exploration link without an explicit activity opens in reading
mode rather than automatically entering the authored view's main flow.

Unknown or leaf exploration ids are dropped with their scoped zoom and use the existing stale-link
notice. An unknown view also clears exploration. Playback, flow overview and presentation take
precedence over exploration during picture normalisation. Camera position, theme and reduced-motion
preferences remain outside shared picture state; a fresh shared link is fitted on arrival.

Use this exact canonical key order: `view`, `aud`, `explore`, `open`, `closed`, `sel`, `flow`,
`play`, `lanes`, `present`. Omit default values. `open` and `closed` are comma-separated ids in
model order; `sel` is one id; `flow` is `scenario.stageOrStep` or `none`; `play` is `scenario.step`;
`lanes` is `1`; and `present` is `walkthrough.step` with an optional scenario-step suffix.
For duplicate keys, the first value wins; unknown keys are ignored. The existing decoder handles
percent-escaped values. Presentation takes priority over playback, then flow overview, then
selection. An explicit `flow=none`, or `explore` without another activity, means reading.

Normalisation first validates the view, audience and known zoom ids. A nonexistent or leaf
exploration root produces `{ part: 'exploration', id }`, clears exploration, and discards its zoom
marks. An invalid view or an overview/playing/presenting activity also clears exploration. Then
normalise zoom in the remaining scope, and lift the selection to a drawn ancestor or clear it if
none exists. Existing scenario and tour step-clamping rules still apply. The user-visible notice
for dropped link parts is exactly: "This link is older than the diagram. Showing the closest
picture." Keep it in the existing stale-link notice path rather than adding a new modal.

## UI and layout integration checklist

1. Add `explore(id)` to `PanelActions`. Put one native `button`, `type="button"`, class `tool`,
   with `data-explore` equal to the selected container id, in a paragraph after its description.
   Its visible and accessible name is **Explore this part**. The existing selected-element panel
   is only used while reading/selected, so playback and presentation cannot offer the action.
2. Call `explore(semantics, picture, id)`, then pass its result through
   `Viewer.change(result, { fit: true }, 'navigate', id)`. Do not change the stage, URL or visit
   history independently from that entry point.
3. Pass `picture.exploring` into the container toggle's drawn-set and state lookups, the
   structure layout call, and the selected-element panel's open/closed lookup. Also pass it
   through the model's open, close, reveal and selection operations. Missing one of these sites
   can make the UI state disagree with the displayed picture.
4. Add an exploration section before the normal About-panel content. Use class `exploration`
   and `aria-label="Exploration"`. Show heading **Exploring**, the current root's audience name,
   and the exact summary template below. Show one native `tool` button with
   `data-exit-exploration`, labelled **Return to previous picture** when an earlier different-root
   visit exists, otherwise **Show full view**.
5. Scan visits from `currentIndex - 1` backwards. Parse each stored fragment using the current
   model. The first visit whose `exploring` differs from the current root is the return target.
   Invoke existing history travel to that index; do not reconstruct a fresh approximation or add
   another visit. With no target, send `endExploration(semantics, picture)` through `Viewer.change`
   with a fitted arrival.
6. Add the original ancestors from outermost to innermost, followed by the explored root, to the
   breadcrumb. Resolve every label with `semantics.name(id, audience)`. A reading visit within
   exploration is named `Exploring ${rootName}`; a selected visit retains the selected part's name.
7. Keep existing stage transitions, selection styling, fonts, controls, reduced-motion behavior
   and focus management. Add no dedicated explore shortcut; native Tab and Enter activation is
   sufficient. The existing panel replacement logic restores focus to the new panel heading when
   the prior panel owned focus.

The summary is `${shown} parts shown. ${omitted} parts outside this picture. Connected outside
parts remain visible.` Count `shown` from the drawn-set size and `omitted` from total canonical
elements minus that size. These are element counts, not relationship or immediate-child counts.

The only new CSS uses existing design values:

```css
.panel .exploration {
  margin: 0 0 20px;
  padding: 0 0 16px;
  border-top: 0;
  border-bottom: 1px solid var(--hair);
}
```

Construct `Scene` and Signal SVG through the existing renderer. `Scene` does not need its own
exploration field: it already contains the scoped nodes and edges. Cache derived scopes by
view/root in each `Semantics` instance. Cache geometry by view/root/normalised zoom in `Layouter`;
the existing cache keeps 16 recent layouts and does not retain failed layout promises. Do not
include audience in the geometry key. A newly loaded or edited model creates new semantics and
layout instances, preventing old-model scopes from leaking into new pictures.

Update the independent relationship rule check to ignore a canonical relationship only when its
kind is excluded, neither end touches the explored subtree, or the existing lifting/suppression
rules make it undrawable. For every remaining relationship, independently derive its lifted edge
id and verify the route exists. Do not validate completeness by iterating only the edges the
drawing already emitted; that would miss a dropped boundary connection.

## Implementation responsibilities

| Component                         | Responsibility                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Exploration scope resolver        | Compute subtree membership, outside representatives and default visibility                 |
| View state resolver               | Support promoted drawing roots and scope-aware open, close, reveal and zoom normalisation  |
| Picture state controller          | Own exploration entry, exit, validation and activity transitions                           |
| Semantic drawing builder          | Cache scopes, derive drawing parents and depths, and retain eligible relationships         |
| Layout service                    | Include exploration in cache identity and reserve space across audiences                   |
| Independent layout validator      | Check every eligible relationship directly from the canonical model                        |
| Link and visit services           | Encode exploration, restore complete pictures and preserve camera history                  |
| About panel and viewer controller | Offer actions, apply picture changes centrally, show context and implement return behavior |

The renderer receives the resulting drawing through the Signal pipeline. It needs no alternative
renderer or new theme tokens. Scope changes may move boxes through the normal layout transition;
audience changes must not move boxes. The geometry key includes view, explored root and normalised
zoom, with wording reserved for every audience before positioning.

## Less cluttered opening views

Choose a purposeful first authored view showing the system's main responsibilities and its direct
external connections. Select major containers explicitly instead of expanding every subsystem by
default. Keep the detailed containment model and other authored views available for exploration.

For example, a system with a client, processing engine, data store and several internal modules
can start with the three major parts and the connections between them. Exploring the processing
engine then reveals its immediate children and the connected client and store. There is no fixed
numeric target for the opening view: retain enough parts to explain the system's purpose.

This is an authored view decision. Do not silently trim arbitrary models, change audience wording,
hide boundary connections, or impose a global depth limit. Already compact views need no changes.

## Validation and acceptance

Implement automated checks for these observable outcomes:

| Coverage                       | Required result                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Boundary lifting and grouping  | Incoming and outgoing connections remain; outside-only relationships disappear; kinds are filtered             |
| Scope and zoom                 | Opening, closing, revealing and replacing roots produce the exact fixture outputs below                        |
| Links and activity transitions | Shared state round-trips; stale and old links work; activities clear exploration as specified                  |
| Every container and audience   | Default, fully open and fully closed states satisfy containment, fit and connection completeness rules         |
| Independent edge validation    | Removing a boundary edge from both drawing and layout is still detected from canonical relationships           |
| Browser interactions           | Action availability, keyboard activation, nested return and fresh-link fallback match the interaction contract |
| Geometry and styling           | Audience changes leave geometry unchanged; both themes preserve Signal appearance                              |

Run type checking, formatting, static analysis, unit checks, layout rules, render comparisons,
accessibility checks and browser journeys. Use a consistent browser, font set and operating system
for image comparisons. Capture the new exploration states in both themes. Compare unaffected
states with their pre-change drawings and investigate any unexpected differences. Fewer boxes
alone are not evidence that all required connections survived.

For manual acceptance, load the complete fixture below, select Analysis engine, explore it,
confirm Website, Results store and Partner remain connected, explore Request service, change
wording, open the copied link in a fresh tab, and return through both levels in the original tab.
Start a scenario and confirm exploration clears. Repeat in each theme and with keyboard navigation.

## Limits and proposed follow-ups

These are not additional implemented requirements:

- **Panel discoverability:** a retained About-panel scroll position can hide the action near the
  top. A separate improvement could reset scroll on a new selection or keep
  the exploration action visible while scrolling; the current feature does neither automatically.
- **Large fan-out:** one level can still contain many children or outside neighbours. No count cap
  or ranking that drops eligible boundary connections is implemented. Further reduction should remain explicit to readers
  and preserve the explanation of what has been omitted.
- **Static exports:** the existing exporter expands the authored view, independently of the current
  exploration. Exporting only the explored picture is a separate feature; sharing an exploration
  link does not imply that a static export uses the same scope.
- **Unchanged boundaries:** there is no new global depth slider, saved authored exploration view,
  mobile layout, automatic audience-based filtering, or change to Lines syntax in this feature.

## Complete verification fixture

Use the following complete Lines model as the verification input. Relationships are numbered from zero in declaration order, including relationships
that a particular view does not draw.

```aerie
model exploration: A connected subsystem

suite: Suite [system]
  web: Website [service]
    screen: Screen [module]
  engine: Analysis engine [service]
    @engineer: Processing engine | Implementation details
    api: Request service [module]
      handler: Request handler [module]
    jobs: Background jobs [module]
  store: Results store [store]
    primary: Primary data [store]
    secondary: Secondary data [store]
  unrelated: Reporting [service]
remote: Partner [external]
  remote-api: Partner API [service]

screen sends requests to handler
handler reads primary
jobs writes secondary
primary sends updates to screen
remote-api invokes handler
handler depends on unrelated [code]

view overview: Overview
  show suite +4, remote +1

view dependencies: Code dependencies
  show suite +4, remote +1
  kind code

scenario request: Handle a request
  screen sends a request to handler
  handler reads primary

walkthrough tour: A tour
  step overview
```

These expected outputs are independent acceptance targets. Preserve list and edge order:

| Case                                    | Drawn ids in model order                         | Open containers | Edge ids and carried relationship indexes                                          |
| --------------------------------------- | ------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------- |
| Explore `engine` in runtime overview    | `web, engine, api, jobs, store, remote`          | `engine`        | `web->api [0]`, `api->store [1]`, `jobs->store [2]`, `remote->api [4]`             |
| Then open `api`                         | `web, engine, api, handler, jobs, store, remote` | `engine, api`   | `web->handler [0]`, `handler->store [1]`, `jobs->store [2]`, `remote->handler [4]` |
| Explore `api` directly or from `engine` | `web, api, handler, store, remote`               | `api`           | `web->handler [0]`, `handler->store [1]`, `remote->handler [4]`                    |
| Explore `engine` in `dependencies`      | `engine, api, jobs, unrelated`                   | `engine`        | `api->unrelated [5]`                                                               |

For runtime `engine`, top-level drawing roots are `web, engine, store, remote`. `api` and `jobs`
have drawn parent `engine` and depth one. For exploration of `api`, roots are
`web, api, store, remote`, and `handler` has drawn parent `api`. Original ancestors such as `suite`
are absent as boxes in both cases.

Expected canonical fragments for the fixture:

```text
Explore engine:                    #explore=engine&sel=engine
Open api inside engine:            #explore=engine&open=api&sel=engine
Explore api:                       #explore=api&sel=api
Select handler, then close api:    #explore=engine&sel=api
Explore engine in code view:       #view=dependencies&explore=engine&sel=engine
```

Additional required assertions:

- Changing audience leaves drawn ids, parents, depths, edge ids, routes and box geometry equal.
- An old `#sel=engine` link has no exploration. Read/write/read of a normalised exploration is
  stable. A missing or leaf root clears the root and its scoped zoom.
- Selecting `primary` while exploring `api` opens its outside `store` representative and keeps
  `exploring=api`. Selecting `unrelated` from that runtime scope leaves exploration.
- Starting `request` playback, its overview, `tour`, or another view clears exploration. Exploring
  a leaf, unknown id, or while playing/presenting leaves the picture unchanged.
- Opening an outside neighbour never introduces an edge solely between two outside endpoints.
- A selected hidden descendant lifts to the nearest still-drawn ancestor when its container closes.
- Deliberately removing the incoming edge from both drawing edges and layout graph must still make
  the independent relationship rule check fail. This guards against silently lost connections.
- Keyboard activation, return history and fresh-tab fallback use the same code paths as clicks.
- Returning to an older visit restores that visit's audience as well as its camera; it does not
  retain a wording change made after entering exploration.

## Reference algorithms

The following pseudocode is independent of file layout and imports. `elements` are in canonical
parent-before-child order. `ancestors(id)` returns ids from immediate parent to top-level parent;
`children(id)` returns immediate child ids. `contains(a, b)` is strict ancestry. Treat returned
sets and maps as new values, leaving the canonical model and prior pictures unchanged.

```text
inside(root, id):
  return id == root or contains(root, id)

scope(view, root):
  excludedAncestors = set(ancestors(root))
  neighbours = empty set
  for relationship in all relationships, in declaration order:
    if relationship.kind not in view.kinds: continue
    if neither endpoint is inside(root): continue
    for endpoint in [relationship.subject, relationship.object]:
      if inside(root, endpoint): continue
      path = reverse(ancestors(endpoint)) followed by endpoint
      representative = first id in path not in excludedAncestors
      if representative exists: add representative to neighbours
  roots = set(root) union neighbours
  defaults = roots union set(children(root))
  return roots and defaults, each in canonical order

drawn(scope, zoom):
  result = empty ordered set
  for element in elements:
    if element.id in scope.roots:
      if element.id in scope.defaults: add element.id
      continue
    if element.parent not in result: continue
    mark = zoom[element.parent]
    if mark == open or (mark absent and element.id in scope.defaults):
      add element.id
  return result

normaliseZoom(scope, zoom):
  visible = drawn(scope, zoom)
  result = empty ordered map
  for id in visible:
    mark = zoom[id]
    childIds = children(id)
    if mark absent or childIds empty: continue
    defaultCount = number of childIds in scope.defaults
    if mark == open and defaultCount == size(childIds): continue
    if mark == closed and defaultCount == 0: continue
    result[id] = mark
  return result

open(scope, zoom, id):
  return normaliseZoom(scope, copy(zoom) with id = open)

close(scope, zoom, id):
  return normaliseZoom(scope, copy(zoom) with id = closed)

reveal(scope, zoom, id):
  path = reverse(ancestors(id)) followed by id
  start = first index whose id is in scope.roots
  if start absent: return zoom unchanged, with outsideScope = true
  path = path from start onward
  result = copy(zoom)
  visible = drawn(scope, result)
  if path[0] not in visible: return zoom unchanged
  for each consecutive pair (parent, child) in path:
    if child not in visible:
      result[parent] = open
      visible = drawn(scope, result)
  return normaliseZoom(scope, result)

lift(visible, id):
  return first visible id in [id] followed by ancestors(id), or none

edges(view, root, visible):
  groups = empty map keyed by ordered (source, target)
  for (index, relationship) in all relationships, in declaration order:
    if relationship.kind not in view.kinds: continue
    if neither endpoint is inside(root): continue
    source = lift(visible, relationship.subject)
    target = lift(visible, relationship.object)
    if either is none or source == target: continue
    if contains(source, target) or contains(target, source): continue
    append index to groups[(source, target)].carries
  return groups sorted by their first carried index
```

An outside endpoint that is itself an ancestor of the explored root has no outside branch in its
path. It adds no representative. Its connection is not drawable when no visible ancestor exists;
do not manufacture a duplicate containing box. A relationship whose endpoints are both inside the
root needs no outside representative. Self-connections collapse to one visible box and are omitted
by the same suppression rule as other collapsed relationships.

For each visible element, its drawn parent is its canonical parent if that parent is visible,
otherwise `null`. Its drawn depth is the number of visible canonical ancestors. The canonical
parent and depth must remain unchanged. A drawn container is open if any immediate child is drawn,
closed if none are drawn, and partly open if some but not all are drawn. Leaves have their own
state and never offer the exploration action.

To open everything in a scope, temporarily mark every canonical container open and normalise the
result in that scope. To close everything, mark each scope root that is a container closed and
normalise. Closing the explored root is permitted; its box and connected outside representatives
remain while its children disappear and their eligible connections lift to the root.

### Entering and leaving exploration

```text
explore(picture, id):
  if id unknown, a leaf, or already picture.exploring: return picture unchanged
  if activity is playing or presenting: return picture unchanged
  return normalisePicture(copy(picture) with:
    exploring = id
    zoom = empty map
    activity = selected(id))

endExploration(picture):
  return normalisePicture(copy(picture) with:
    exploring = absent
    zoom = empty map)

returnTarget(visits, currentIndex, currentRoot):
  for index from currentIndex - 1 down to 0:
    previous = decodeAndNormalise(visits[index].fragment)
    if previous.exploring != currentRoot: return index
  return none
```

The action is only offered in reading or selected mode. A direct API call from flow overview can
enter exploration by replacing that activity with selection. An overview, playing or presenting
activity remaining in an incoming picture wins over a simultaneous exploration root during
normalisation.

Apply each result through the central picture-change operation: normalise state, update the
fragment, record a visit when its navigation identity changes, resolve the drawing, and present it
with the requested camera arrival. Navigation identity must include the exploration root. Capture
camera movements on the current visit. Entering exploration requests fitting; returning travels
to the stored visit and uses its saved camera. Do not refit over a restored camera.

### Independent validation and performance

Validate connection completeness by independently walking canonical relationships, filtering by
kind and subtree membership, and calculating expected lifted endpoint pairs. Assert that each
expected pair exists in the routed drawing and carries the appropriate original index. Also reject
outside-only carried indexes, duplicate carried indexes and routes whose endpoints are absent.
This check must not use the already emitted edge list as its source of expected connections.

Cache subtree scope computation by view id and root id. Cache geometry by view id, root id and
normalised zoom entries; use a structured key or unambiguous encoding to avoid id concatenation
collisions. Do not include audience or theme. Invalidate both caches whenever the canonical model
or authored view definitions change. Keep the geometry cache bounded to 16 recent entries and
remove rejected asynchronous layout computations so retry remains possible.

Compute subtree and ancestor membership once per scope when practical. With cached membership,
filtering relationships is linear in relationship count; choosing representatives additionally
walks endpoint ancestry. Visibility and zoom normalisation scan elements and children. This
feature adds no network requests and must not change the canonical model to reduce drawing size.

## Implementation steps and completion criteria

1. Add optional exploration state and implement the pure scope and visibility calculations.
2. Implement lifting, grouping, zoom operations and picture normalisation. Verify every expected
   fixture output before connecting the interface.
3. Add scope identity to drawing and layout caches, and extend the independent connection checks.
4. Implement canonical link encoding and decoding, visit identity, return navigation and fresh-link
   fallback. Confirm old links preserve their meaning.
5. Connect the About-panel controls to the central state controller, retaining visual tokens,
   accessibility, audience wording and camera transitions.
6. Author simpler initial views where needed; preserve the complete model and detailed views.
7. Run the complete acceptance matrix in both themes and all audiences. Test reduced motion and
   native keyboard activation. Confirm that a shared picture opens without prior visit history.

Completion requires all fixture expectations, navigation transitions, connection checks, audience
geometry assertions and browser interactions to pass. Deliver the feature with its automated tests
and the authored opening-view changes. Proposed follow-ups remain separate from this scope.
