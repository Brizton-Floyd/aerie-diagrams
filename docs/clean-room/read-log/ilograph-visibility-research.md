# ilograph-visibility-research: authorized exception

Task: inspect Ilograph's component visibility and drill-down behavior, then suggest
improvements that retain Aerie's identity.
Builder: Codex
Date: 2026-11-22

## Authorization and boundary

The user explicitly authorized this exception in this chat:

> I'm authorizing an exception to the clean-room rule for this research. Inspect
> how Ilograph handles showing fewer components and drilling into them, then
> suggest how Aerie can improve while keeping its own identity.

This authorization covers the public documentation and demo inspected below. It
does not amend the standing repository policy or authorize access to the banned
local prototype or its worktrees. None of those local sources was accessed.
No application code, model, spec or screenshot baseline was changed. Competitor
captures stay in the local research artifact outside this repository.

## External files

- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/SKILL.md` - REA investigation workflow.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/runtime-observation.md` - browser runtime boundaries and evidence.
- `/Users/briztonfloyd/.agents/skills/reverse-engineer-anything/references/environments.md` - browser scenario request examples; no environment bundle was built.
- `/Users/briztonfloyd/.agents/skills/lavish/SKILL.md` - visual report workflow.
- `/private/tmp/aerie-ilograph-research-evidence.json` - tool-generated evidence export, read to extract screenshots and retain the investigation.

Product-neutral executable interfaces inspected: `chrome-devtools-axi --help` and
Lavish's comparison and plan playbooks. A filename-only search for browser scenario
contracts under `/Users/briztonfloyd/.npm/_npx` returned no matches and read no files.

## URLs

- https://www.ilograph.com/ - public homepage and demo/documentation entry points.
- https://www.ilograph.com/docs/index.html - documentation index.
- https://app.ilograph.com/demo.ilograph.Ilograph - public demo, browser scenario start.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request - runtime request view.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request/Ilograph%2520AWS%2520Instance%252FLambda%252FhandleDiagram - observed selected handler state.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request/Ilograph%2520AWS%2520Instance%252FLambda - observed selected container state.
- https://app.ilograph.com/demo.ilograph.Ilograph/Request/Ilograph%2520AWS%2520Instance%252FLambda?zoom=Ilograph%2520AWS%2520Instance%252FLambda - observed container focus state.
- https://www.ilograph.com/docs/getting-started/browsing-diagrams/ - selection, depth, container focus and navigation documentation.
- https://www.ilograph.com/docs/editing/perspectives/resource-sizes-and-positions/ - documented detail overrides and layout behavior.
- https://www.ilograph.com/docs/editing/perspectives/relation-perspectives/ - documented relationship-driven views and placement options.
- https://raw.githubusercontent.com/morluto/rea/main/docs/browser-scenarios.md - attempted product-neutral tool contract lookup; returned 404.
- https://raw.githubusercontent.com/morluto/rea/main/docs/browser-scenario-capture.md - attempted product-neutral tool contract lookup; returned 404.
- https://github.com/morluto/rea/tree/main/docs - product-neutral REA documentation inventory.
- https://raw.githubusercontent.com/morluto/rea/main/docs/browser-scenario-contract.md - attempted contract lookup from inventory; returned 404.
- https://github.com/morluto/rea/blob/main/docs/browser-scenario-contract.md - attempted contract lookup; returned 404.

The browser loaded the public demo's normal dependencies. No script-source or
network-body capture was requested. The retained DOM includes markup and normal
page text. Linked third-party pages in the demo were not followed.

## Evidence and observations

REA launched temporary unauthenticated Chrome sessions at 1280 x 720 and reported
`terminated-owned-process` cleanup. No accounts were created and no diagram edits
were saved. The preferred Chrome CLI bridge failed to start; REA browser scenarios
provided the runtime evidence instead.

- `ev_38f58c05669cc7bdaeb98c9acb550ba02778c78ae237db13717e3f504e8ab11a` - default request view and screenshot; 36 containers marked visible.
- `ev_5ddf5edef0639e71a156b586a7bab73f25ed5abc6c9606503387e176aa3908b3` - selecting handleDiagram; 18 containers marked visible and the relevant path enlarged.
- `ev_550b2c1f64eb267272d7554ccabb6e6c2e1e9961487141d59919ed58314fb031` - selecting Lambda, then its fullscreen control; 7 containers marked visible in the focused state, with external endpoints outside the picture.
- `ev_1621c5da0272f30310c02aec0f636edc8dc27dbcbd66647438fce5d08ad396c1` - clicking the detail control changed its reported value from 1 to 0.333; parent emphasis increased, some children remained as previews, and selecting Lambda expanded its children at that setting.
- `ev_caf7e6958784574122bdebce325a3e21f0c0df6c801c74ef59bff1e52fe11f29` - deselecting the handler restored the request view and 36 visible-marked containers.

Counts use `blockContainer visible` DOM markers and include hierarchy containers.
They do not count independently readable services or guarantee every marked
container is inside the viewport. Screenshots corroborate the visible behavior.

## Limitations

No proprietary layout algorithm or filtering traversal was recovered. This was
runtime behavior inspection, not code decompilation. Documentation describes
relationship-driven positioning and author overrides; the precise implementation
is unknown. Tests cover one public demo, not mobile, arbitrary models or scale.

An initial URL-only capture established successful navigation. Two rejected
requests corrected capture field names before any browser scenario ran. Sending
Home to the detail slider did not change its value. Re-clicking a selected name
timed out because another DOM element intercepted the pointer; later steps in
that scenario were cancelled. That parent-navigation behavior remains documented,
not independently verified. Deselection was verified in a separate successful run.

## Recommendation

Make Aerie's opening views selective first. Add an explicit exploration operation
showing one subsystem, its immediate children and collapsed, named outside
neighbors. Keep ordinary selection for reading, and retain opening in place.
Carry exploration scope in the picture, shared links and visits. Preserve
audience-independent geometry and represent every in-scope relationship, including
explicit expandable groups when the boundary is dense. Do not silently discard
connections to hit a numerical box target.

The local visual report and evidence bundle are under
`/Users/briztonfloyd/.codex/visualizations/2026/11/22/01a203a9-dd2b-7e00-9d22-514ac31abae9/visibility-research/`.
The report uses Aerie's existing Signal tokens and bundled Inter font. It includes
the existing Aerie screenshot from the repository as an identified historical
reference, and keeps competitor screenshots labeled as research evidence.
