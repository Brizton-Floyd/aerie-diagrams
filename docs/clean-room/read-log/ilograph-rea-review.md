# Ilograph REA review: read log

Task: Inspect Ilograph's public application and identify potential Aerie improvements.
Builder: Codex
Date: 2026-10-26

## Explicit exception

Before any Ilograph request, Codex identified the conflict with AGENTS.md rule 1 and
decision 0001. The user explicitly selected: "Authorize a one-task exception to inspect
Ilograph" in this chat. This log records that exception, rather than claiming the
investigation followed the standing source prohibition. The standing policy is unchanged.

Scope: public website, documentation, and anonymous sample interactions. No login, account
creation, purchase, invitation, saved edit, or access to the earlier private prototype.
No application implementation, assets, or competitor screenshots were added to this
repository. This research does not authorize subsequent implementation from restricted
materials.

## Files

- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/SKILL.md` - requested REA investigation workflow.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/runtime-observation.md` - browser scenario observation and cleanup contract.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/environments.md` - declarative action examples and browser executable selection.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/native-and-artifacts.md` - searched product-neutral skill references for browser scenario argument examples.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/android-applications.md` - included in the same bounded skill-reference text search; no relevant matches used.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/connection-and-recovery.md` - included in the same bounded skill-reference text search; no relevant matches used.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/evidence-workflows.md` - included in the same bounded skill-reference text search; no relevant matches used.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/javascript-applications.md` - included in the same bounded skill-reference text search; no relevant matches used.
- `/private/tmp/aerie-ilograph-rea-check.log` - this repository's required validation output; the first run could not open local test servers in the sandbox.
- `/private/tmp/aerie-ilograph-rea-local-check.log` - rerun of the same gate with local test-server access.
- `/private/tmp/aerie-ilograph-rea-browser-check.log` - screenshot suite on an unused local port after the default port was found occupied.
- `/private/tmp/aerie-ilograph-rea-journeys-check.log` - remaining browser journeys on a separate local port.
- `/private/tmp/aerie-ilograph-rea-focused-check.log` - sequential rerun of the screenshot text-fit check with isolated artifacts.
- `/private/tmp/aerie-ilograph-rea-watch-check.log` - focused rerun of watch journeys without the conflicting color environment variable.

## URLs

The Ilograph entries below were read only after the explicit exception. The REA entries
are product-neutral tooling documentation or search excerpts consulted for its request
contract. Links appearing inside pages were not followed unless listed here.

- https://www.ilograph.com/ - public product overview and entry point to its anonymous sample.
- https://www.ilograph.com/features.html - documented finder, export, history, icons, and collaboration capabilities.
- https://www.ilograph.com/docs/index.html - documentation index.
- https://www.ilograph.com/team.html - documented workspace publishing, access, and API capabilities; not exercised.
- https://www.ilograph.com/docs/getting-started/browsing-diagrams/ - documented selection, view transitions, notes, depth, and tours.
- https://www.ilograph.com/docs/editing/markdown/ - documented rich descriptions and links; no syntax reused.
- https://www.ilograph.com/docs/editing/imports/ - documented model composition; no syntax reused.
- https://app.ilograph.com/demo.ilograph.Ilograph - public demo entry point, web read and REA browser navigation.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request - runtime view loaded by the demo.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request/Ilograph%2520AWS%2520Instance%252FLambda%252FhandleDiagram - selected sample element reached through search and reopened in a fresh browser.
- https://app.ilograph.com/demo.ilograph.Ilograph/Code/Ilograph%2520AWS%2520Instance%252FLambda%252FhandleDiagram - followed the selected element to another view.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request/_walkthrough/1 - started the sample tour.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request/_walkthrough/2 - advanced the sample tour.
- https://app.ilograph.com/demo.ilograph.Ilograph/Get%2520diagram - opened the sample's request flow after ending the tour.
- https://github.com/morluto/rea/blob/main/docs/browser-scenario-contract.md - primary tooling documentation for capture selection and action timeouts.
- https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/references/runtime-observation.md - primary tooling reference returned in a schema-help search.
- https://github.com/morluto/rea/blob/main/docs/mcp-contracts.md - primary tooling contract returned in the same search.
- https://github.com/IRSMAKER/rea-morluto/blob/main/README.md - tooling search excerpt; not relied on.
- https://github.com/tkmg46/rea_20261005/blob/main/README.md - tooling search excerpt; not relied on.
- https://github.com/IRSMAKER/rea-morluto - tooling search excerpt; not relied on.
- https://github.com/morluto/rea/issues/39 - primary tooling search excerpt; not needed after finding the contract.
- https://github.com/Opiuz/REA - tooling search excerpt; not relied on.
- https://github.com/kingjaber9099-star/rea-m - tooling search excerpt; not relied on.
- https://github.com/IronSuit/rea---reverse-engineer-anything - tooling search excerpt; not relied on.

## Evidence and coverage

REA performed the declared actions in owned temporary Chromium profiles. All five captures
report completed actions, complete requested artifact capture, no captured page-error events,
and `terminated-owned-process` cleanup. This establishes only the tested interactions in
the anonymous sample. It does not establish backend implementation, general performance,
paid-feature behavior, accessibility compliance, or feature absence elsewhere in the product.
DOM and accessibility captures contain hidden interface templates too; template text alone
was not treated as successful interaction with a feature.

The complete five-record bundle was exported outside the repository to:

`/Users/briztonfloyd/.codex/visualizations/2026/10/27/01a17b5f-9a8d-7123-b593-6bb1d7c8fb78/ilograph-rea-evidence.json`

- `ev_b07a0c7028da5c12e4c7829439dcdff7cb8173cde832679447c7262ba6eadaaf` - initial rendered sample, view controls, notes, and tour entry point.
- `ev_4080089c69184af978c54e4da7caa1182c5eeb127b58b45ae217dd3117d72bf2` - opened the finder and searched for a nested sample element; the result included its containment path.
- `ev_3dc5efa054ae7a36b6c674750cc96c65f3353a69d178155346db0b7fdd803c92` - selected that result; the picture focused the element and its connections and changed the address.
- `ev_3f86fe1f63eceb433e2fb426eba9735fc8b7e97dd056629f93df65e645edffb1` - reopened the selected picture and used the element's view shortcut; selection persisted in the code view.
- `ev_6d533513e43f90f7e98c578e1f224c646382fca633c039a78805874b855cfbad` - started, advanced, and ended a tour, then opened a request flow.

The first capture request was rejected before execution because it used unsupported capture
keys and a timeout on a fixed-duration wait. The primary tooling contract supplied the correct
`at_end` selection and fixed-wait shape; the corrected request succeeded. No setup or tool
configuration was changed.

A targeted process inventory used to stop the sandbox-blocked validation also returned an
unrelated Aerie task's command line. It was discarded as irrelevant; no file from that task
was opened and none of its instructions were followed.

## Assessment against Aerie

Repository baseline: commit `5b62751`. Existing untracked architecture-model work was not part
of this investigation. Recommendations are design proposals, not claims that code was changed
or that a feature is unique to either product.

- First: add model-wide element search, including audience names, tags, and containment paths.
  Aerie already has reveal and selection operations, but no diagram-wide finder was found in
  the inspected app. Confirmed search behavior is recorded above.
- First: add an explicit "See this element in" action that follows a selection across views.
  Aerie's current `switchView` intentionally clears selection and restores default zoom.
  This proposal would need a deliberate semantics and specification decision.
- First: let authors deliver a portable interactive model to readers. Self-contained HTML
  export is documented by Ilograph, not tested here. Aerie currently downloads Lines text;
  its local-model sharing dialog correctly explains that a picture link omits the model.
  A static reader bundle is a smaller first step than accounts and collaboration.
- Next: support linked runbooks, ownership, decisions, and richer element descriptions.
  Ilograph documents rich Markdown and internal links. Aerie already has descriptions with
  bold and inline code; extend those rather than adding a second documentation surface.
- Next: show architecture changes between model revisions, with added, removed, and changed
  elements and connections. Ilograph documents diagram history, not semantic comparisons.
  This proposal builds on Aerie's Git and drift workflow; reader visit history is different.
- Later: compose larger models from files owned by different teams. Ilograph documents
  imports. Aerie's current scope excludes multiple model files, so this requires language,
  identity, diagnostic, formatting, and drift decisions.

Aerie already covers model-based authoring, automatic layout, nested exploration, multiple
views, descriptions, scenarios, tours, themes, live editing, and picture links. Strengthen its
audience wording and evidence-backed drift workflow alongside distribution and navigation.
The reviewed Ilograph material does not establish whether it has equivalent audience or drift
features. No claim of market-wide uniqueness follows from this review.

## Repository validation

Only this read log was added by the investigation; application code and baselines were not
changed. The required gate was attempted. Its first run could not bind loopback ports in the
sandbox. With local server access, type checking, lint, 885 unit tests, 358 rule tests, and
27 golden tests passed. The browser stages initially encountered an occupied default port,
so they used separate ports.

The screenshot suite passed 17 of 23 tests. Five failures were baseline differences of
2 to 36 pixels on macOS. The sixth was lost trace output caused by starting the journeys
before the screenshot process had fully finished; a subsequent sequential rerun of that
text-fit check, using an isolated output directory, passed. No baselines were regenerated.
The platform cause of the five image differences has not been verified in Linux.

The journey suite passed 130 of 136 tests. Six watch tests rejected a Node warning caused
by simultaneously inherited NO_COLOR and FORCE_COLOR settings. All six passed on the
focused rerun with NO_COLOR removed, without source changes. Formatting, text, document,
and coverage checks also passed after the final log edits.

The full gate is not green because the five screenshot baseline differences remain.
CI was not run for this local research task.

## Forbidden sources opened without authorization

None. The restricted Ilograph sources listed above were opened under the explicit one-task
exception. The earlier private prototype and its worktrees were never opened.
