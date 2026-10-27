# Reader tools and portable export: read log

Task: Implement element search, following across views, portable interactive HTML, and richer documentation.
Builder: Codex, with navigation, documentation, and export-test agents.
Date: 2026-10-26
Integration and final validation: 2026-10-27

## Scope

The user requested these features directly after the earlier research task. This is a separate
implementation task. The standing clean-room policy applies: no competitor website, documentation,
application, source, screenshots, or earlier private prototype was opened for this implementation.
Requirements and code are Aerie's own, recorded in decision 0009 and the reader-tools specification.

Work began on `codex/reader-tools-export` in the managed reader-tools-export worktree.
That validated branch remains intact. After upstream main added PNG/PDF export in commit
`77f96d8`, integration continued on `codex/reader-tools-integrated` from that new main.
The original checkout's untracked architecture model and its read log are untouched.

## Files

- `/Users/briztonfloyd/.agents/skills/codebase-design/SKILL.md` - small interfaces, injected layout engines, and behavior-level testing.
- `/Users/briztonfloyd/.agents/skills/captain-workflow/SKILL.md` - checked applicability; this is a vanilla TypeScript project, not Java or Angular feature work.
- `/Users/briztonfloyd/.agents/skills/no-mistakes/SKILL.md` - checked the conditional validation and publication workflow; no pipeline was started.
- `/Users/briztonfloyd/.codex/skills/aerie/SKILL.md` - checked model-maintenance obligations while changing viewer/build entry points.
- `/Users/briztonfloyd/.agents/skills/code-review/SKILL.md` - independent review of the search, documentation, and portable-reader interfaces.
- `/Users/briztonfloyd/.agents/skills/code-review/workflows/review-pr.md` - scoped review workflow.
- `/Users/briztonfloyd/.agents/skills/code-review/references/review-standard.md` - code-health review standard.
- `/Users/briztonfloyd/.agents/skills/code-review/references/what-to-look-for.md` - correctness, design, testing and documentation checks.
- `/Users/briztonfloyd/.agents/skills/code-review/references/navigating-cl.md` - review of the changed modules in their surrounding code.
- `/Users/briztonfloyd/.agents/skills/code-review/references/writing-comments.md` - actionable review findings.
- `/Users/briztonfloyd/.agents/skills/code-review/references/cl-size.md` - split review by the three implementation areas and separate image baselines from code.
- `/Users/briztonfloyd/.agents/skills/release/SKILL.md` - feature-branch commits and review preparation; existing repository documentation conventions retained.
- `/Users/briztonfloyd/.agents/skills/gh-axi/SKILL.md` - connected repository dashboard, pull request and CI metadata.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/vite/dist/node/index.d.ts` - installed library-build configuration contract.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/rolldown/dist/shared/binding-CVMT71K4.d.mts` - installed bundle output contract.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/rolldown/dist/shared/define-config-BoIay7tU.d.mts` - installed code-splitting configuration contract.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/@fontsource/inter/400.css` - bundled font subsets and embedded-asset requirements.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/@playwright/test/README.md` - installed browser-test entry point.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/playwright-core/types/types.d.ts` - offline contexts, downloads, and browser test contract.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/elkjs/lib/elk-api.d.ts` - layout-worker factory contract.
- `/Users/briztonfloyd/Desktop/aerie-diagrams/node_modules/elkjs/lib/elk-api.js` - factory initialization behavior, avoiding a duplicate embedded worker.
- `/private/tmp/aerie-reader-typecheck.log` - this task's type-check output.
- `/private/tmp/aerie-reader-build.log` - this task's production and portable-reader build output.
- `/private/tmp/aerie-reader-focused.log` - this task's focused navigation and documentation browser output.
- `/private/tmp/aerie-reader-lint.log` - repository lint and documentation checks.
- `/private/tmp/aerie-reader-final-lint.log` - final working-tree lint and documentation checks before committing.
- `/private/tmp/aerie-reader-integrated-install.log` - isolated dependencies after preserving upstream's existing PNG/PDF export dependency.
- `/private/tmp/aerie-reader-integrated-typecheck.log` - type checking after combining both export controls.
- `/private/tmp/aerie-reader-integrated-lint.log` - lint, documentation and coverage checks after integration.
- `/private/tmp/aerie-reader-integrated-build.log` - integrated authoring and portable builds.
- `/private/tmp/aerie-reader-integrated-focused.log` - navigation, documentation, offline HTML and upstream PNG/PDF browser journeys.
- `/private/tmp/aerie-reader-integrated-linux.log` - fresh Linux dependencies, regenerated combined-toolbar baselines and the complete integrated gate.
- `/private/tmp/aerie-reader-integrated-final-lint.log` - final documentation and read-log validation.
- `/private/tmp/aerie-reader-pr-body.md` - this task's pull request description and validation record.
- `/private/tmp/aerie-reader-combined.log` - combined navigation, documentation and export journeys.
- `/private/tmp/aerie-reader-portable.log` - relocated offline exports, injection, invalid drafts and retry behavior.
- `/private/tmp/aerie-reader-portable-pending.log` - valid pending-edit export after resuming the test clock for the new tab.
- `/private/tmp/aerie-reader-portable-results/portable-export-INT-1021-I-c332e-malizes-a-removed-selection-journeys/error-context.md` - investigated a test-clock stall in the portable reader.
- `/private/tmp/aerie-reader-portable-results/portable-export-INT-1021-I-c332e-malizes-a-removed-selection-journeys/trace.zip` - the same investigation; no runtime error was recorded.
- `/private/tmp/aerie-reader-navigation.log` - navigation regressions, including readable camera focus in a large destination view.
- `/private/tmp/aerie-reader-linux-setup.log` - fresh pinned dependency installation in the required Linux image.
- `/private/tmp/aerie-reader-linux-check.log` - Linux baseline generation and initial full-gate output.
- `/private/tmp/aerie-reader-linux-final.log` - complete gate exposing three older toolbar/list/label assertions.
- `/private/tmp/aerie-reader-linux-gate.log` - final complete Linux gate.
- `/private/tmp/aerie-reader-preview-build.log` - the final local preview build.
- `/private/tmp/aerie-reader-toolbar.log` - focused Linux check of the final fixed-width, single-line toolbar labels.
- `/private/tmp/aerie-reader-linux.HS3qYv/tests/screenshots/__screenshots__/signal.spec.ts/lotto-big-picture-exec-dark.png` - reviewed Aerie's new toolbar against its previous screenshot, with identical diagram geometry.
- `/private/tmp/aerie-reader-linux.HS3qYv/tests/screenshots/__screenshots__/reader-tools.spec.ts/element-finder-dark.png` - reviewed the new finder against Aerie's own visual language.
- `/private/tmp/aerie-reader-linux.HS3qYv/tests/screenshots/__screenshots__/reader-tools.spec.ts/element-finder-light.png` - reviewed the integrated finder in the light theme.
- `/private/tmp/aerie-reader-linux.HS3qYv/tests/screenshots/__screenshots__/export.spec.ts/export-preview-dark.png` - reviewed the preserved PNG/PDF preview with the combined toolbar.
- `/Users/briztonfloyd/.codex/visualizations/2026/10/27/01a17b5f-9a8d-7123-b593-6bb1d7c8fb78/aerie-reader-tools.png` - actual-text visual review of the completed finder and toolbar.

## URLs

- http://localhost:4471/ - this repository's production viewer for focused browser journeys; query strings and fragments name Aerie's own samples and pictures.
- http://localhost:4472/ - combined feature journeys on this repository's production viewer.
- http://localhost:4473/ - focused portable-export journeys, followed by relocated local files with the network disabled.
- http://localhost:4474/ - readable-focus and follow/search navigation regressions.
- http://127.0.0.1:4475/ - final preview and actual-control export of the bundled Lotto sample.
- http://localhost:4476/ - integrated navigation, documentation and both export workflows.
- http://localhost:4173/ - the repository's production viewer inside the isolated Linux validation container.
- https://registry.npmjs.org/ - fresh pinned dependencies for Linux validation; individual resolved package URLs are already recorded in package-lock.json.
- https://github.com/Brizton-Floyd/aerie-diagrams - this repository's connected dashboard and task review/CI metadata, through gh-axi.

## Review and validation

The implementation was independently reviewed as three areas: navigation, documentation, and
portable publishing. The review found a camera defect: forcing a whole-picture fit discarded
the selected element's reveal target. Search and explicit following now use the existing target
camera path, with regressions for readable scale and actual stage position. Re-review found no
remaining actionable issue.

Focused browser runs verified offline relocated HTML, embedded fonts and worker, Unicode and
script-shaped source, selected/open/audience/theme and scenario/lanes state, history/reload,
all reader tools, valid and invalid pending drafts, and retry after a runtime-load failure.
The paused-clock test was corrected to resume time before opening its second tab. The finder
also explicitly handles Escape because a native search input can otherwise consume the key.

Linux validation uses `mcr.microsoft.com/playwright:v1.64.1-noble`, a temporary source copy,
and a fresh `npm ci`; it never uses the macOS node_modules symlink. Screenshot baselines were
deliberately regenerated with `--update-snapshots=all` for the two new toolbar controls and the
finder in both themes. Baselines are committed separately. Existing render goldens and
readability/contrast baselines are unchanged.

The complete regression run also required updating the font-bundling test to inspect the
shared appearance module, naming the follow-view list separately from the children list,
updating the toolbar expectation, and identifying watch mode's absent Model chooser by its
combobox role rather than matching the hidden search label. Visual review caught a wrapping
finder label; fixed-width padding and a label-fit assertion cover it.

Before upstream integration, the complete Linux `npm run check` passed: 907 unit tests, 358 rule tests, 27 golden tests,
25 screenshot tests and 149 browser journeys. The final label-fit assertion is checked
separately as well. Type, lint, documentation and coverage checks pass. No new dependency,
render golden, readability score or contrast baseline was introduced by these reader additions.

The upstream PNG/PDF flow is preserved alongside Export HTML. Its lazy controller is installed
only by the authoring/watch entry point; the portable reader imports neither its encoders nor
the PDF library. Its existing invalid-last-good warning, preview, download, focus and modal-key
behavior remain covered by the upstream journeys. Conflicting documentation and toolbar
expectations were combined deliberately, without replacing either feature set.

A separate integration review confirmed the PNG/PDF controller preserves last-valid snapshots,
warning, focus restoration, modal shortcuts and retry behavior. Its existing panel, encoders
and pure export modules are unchanged from upstream. Bundle inspection also confirmed that
the portable runtime does not contain the PNG/PDF control, encoders or PDF library.

After integration, the complete Linux `npm run check` passed: 916 unit tests, 358 rule tests,
27 golden tests, 27 screenshot tests and 155 browser journeys. The 19 focused browser journeys
covering navigation, documentation and both export workflows also passed on macOS. Type, lint,
documentation and coverage checks pass. The final maintenance-note changes are checked by a
separate lint run. Linux baselines were reviewed against Aerie's own previous images; expected
toolbar changes and small existing animation-edge differences were recorded deliberately.

## Forbidden sources opened

None.
