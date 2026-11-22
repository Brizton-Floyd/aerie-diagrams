# Draft Explore this part implementation specification

Status: draft implementation reference for the feature merged in PR #109. "Look inside" refers
to the existing **Explore this part** action; this document proposes no UI rename. It describes
the implemented behavior and identifies follow-ups separately.

The goal is to make a large architecture understandable one part at a time. A reader chooses a
container, sees its immediate children, and keeps the connections to surrounding systems. The
canonical model remains complete. Signal styling, authored audience wording, and ordinary
opening in place remain Aerie's own existing behaviors.

The authoritative requirements remain MODEL-212 and MODEL-213 in
[model.md](model.md#view-resolution), and INT-305 in
[interaction.md](interaction.md#opening-in-place). This document explains their implementation;
it does not introduce a second set of requirement definitions.

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
   pairs using MODEL-301 to MODEL-305. Retain original relationship indexes, direction, order and
   audience-specific labels. A relationship collapsed into one box, or between a box and its
   containing box, follows the existing suppression rules.

Relationships solely between outside parts are omitted, including when a reader opens those
outside containers. Internal relationships and boundary connections remain eligible. All
immediate children of the explored root appear, including children with no eligible relationship.
There is no automatic ranking, arbitrary part limit, or audience-dependent depth.

### Worked example

The [exploration fixture](../../tests/fixtures/exploration.aerie) contains an `engine` with `api`
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
?model=samples/lotto.aerie#explore=engine&sel=engine
?model=samples/lotto.aerie#aud=engineer&explore=engine&open=engine-service&sel=engine-service
```

Open and closed marks are normalised against the exploration's defaults. Old links without
`explore` retain their meaning. An exploration link without an explicit activity opens in reading
mode rather than automatically entering the authored view's main flow.

Unknown or leaf exploration ids are dropped with their scoped zoom and use the existing stale-link
notice. An unknown view also clears exploration. Playback, flow overview and presentation take
precedence over exploration during picture normalisation. Camera position, theme and reduced-motion
preferences remain outside shared picture state; a fresh shared link is fitted on arrival.

## Implementation boundaries

| Module                                                                          | Responsibility                                                                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [model/exploration.ts](../../src/model/exploration.ts)                          | Compute subtree membership, outside representatives and the derived scope                          |
| [model/views.ts](../../src/model/views.ts)                                      | Support explicit drawing roots and scope-aware open, close, reveal and zoom normalisation          |
| [model/picture.ts](../../src/model/picture.ts)                                  | Own `explore`, `endExploration`, state validation and activity transitions                         |
| [model/semantics.ts](../../src/model/semantics.ts)                              | Cache scopes per view/root, build promoted drawing nodes and retain relevant carried relationships |
| [layout/structure.ts](../../src/layout/structure.ts)                            | Include the explored root in layout cache identity and reserve space across audiences              |
| [layout/rules.ts](../../src/layout/rules.ts)                                    | Independently check every eligible relationship touching the explored subtree                      |
| [app/link.ts](../../src/app/link.ts) and [visits.ts](../../src/app/visits.ts)   | Encode exploration in canonical links and existing visit history                                   |
| [app/panel.ts](../../src/app/panel.ts) and [viewer.ts](../../src/app/viewer.ts) | Offer the action, call `Viewer.change`, show context and implement return/fallback behavior        |

The model and layout layers retain their existing pure TypeScript boundaries. The renderer receives
the resulting drawing through the existing Signal pipeline. It needs no alternative renderer or
new theme tokens. Scope changes may move boxes through the existing layout transition; audience
changes do not. The layout cache key includes view, explored root and normalised zoom, with wording
reserved for every audience before positioning.

## Less cluttered opening views

The accompanying [draft architecture model](../../architecture.aerie) changes Big picture from
`show author, aerie +1, reader, github` to `show author, browser, cli, action, reader, github`.
The implicit `aerie` ancestor remains drawn. This reduces the opening from 13 parts and 18 connections
to 7 parts and 7 connections; the implementation views remain available.

This is an authored model change, not a global rule that silently trims arbitrary models. The
existing compact openings of `samples/lotto.aerie` and `samples/aerie.aerie` are preserved. Authors
can use purposeful first views and exploration together without changing wording or losing the
underlying model.

## Validation and acceptance

The acceptance mapping is in [acceptance.md](acceptance.md#explore-this-part). Keep these tests
with any future changes to exploration:

| Coverage                                                                                                                      | Evidence                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Boundary lifting, outside grouping, kind filtering and omitted outside-only relationships                                     | [Model tests](../../tests/unit/model/exploration.test.ts), MODEL-212                 |
| Open/close/reveal, nested roots, canonical and stale links, old links and activity transitions                                | [Model tests](../../tests/unit/model/exploration.test.ts), MODEL-213                 |
| Every sample container in every view, default/open/closed states and every audience                                           | [Layout rule tests](../../tests/rules/exploration.test.ts)                           |
| Detect a missing boundary edge even when removed from the drawing and layout graph                                            | [Independent rule-check regression](../../tests/unit/layout/rules.test.ts), RULE-006 |
| Action visibility at the top of a fresh panel, keyboard activation, unchanged wording geometry, exact return and shared links | [Lotto journeys](../../tests/journeys/exploration.spec.ts), INT-305                  |
| Signal styling in both themes                                                                                                 | [Screenshot tests](../../tests/screenshots/exploration.spec.ts)                      |

Run `npm run check` as the release gate. Screenshot changes use the repository's pinned Linux
environment and compare with Aerie's own baselines. A new feature state must preserve boundary
connections and audience geometry, not merely draw fewer boxes.

For manual acceptance, select Number engine in Lotto, explore it, confirm Website back end and
Results store remain connected, explore Engine service, switch audience wording, open the copied
link in a fresh tab, then use the original tab to return through both exploration levels. Also
start a scenario and confirm the exploration clears.

## Limits and proposed follow-ups

These are not additional implemented requirements:

- **Panel discoverability:** a retained About-panel scroll position can hide the action near the
  top. This was observed in local review. A follow-up could reset scroll on a new selection or keep
  the exploration action visible while scrolling; the current feature does neither automatically.
- **Large fan-out:** one level can still contain many children or outside neighbours. No count cap
  or ranking that drops eligible boundary connections is implemented. Further reduction should remain explicit to readers
  and preserve the explanation of what has been omitted.
- **Static exports:** the existing exporter expands the authored view, independently of the current
  exploration. Exporting only the explored picture would be a separate change to
  [export.md](export.md), not an assumed effect of sharing an exploration link.
- **Unchanged boundaries:** there is no new global depth slider, saved authored exploration view,
  mobile layout, automatic audience-based filtering, or change to Lines syntax in this feature.
