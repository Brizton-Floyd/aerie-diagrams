# a10-editor: read log

Task: A10, the live split editor and watch mode: the Lines text beside the diagram, checked 250 ms
after typing stops, keeping the last version without errors and listing errors in plain words with
line and column, inline error marks, colours by line kind, Enter and Tab indenting, completion,
Format, Download and Discard changes; and `aerie watch <file>`, which serves the page and updates it
on every save.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-22

## Files

Built from this repository: `docs/spec/` (above all `interaction.md`, `language.md`, `look.md` and
`acceptance.md`), `docs/slice-plan.md`, `GLOSSARY.md`, the samples, and A2's to A5's code in `src/`.

Package files, from the installed copies in `node_modules/`, read to use and credit them:

- `@codemirror/{autocomplete,commands,language,lint,state,streamparser,view}`, `@lezer/common`,
  `@lezer/highlight`, `@lezer/lr`, `@marijn/find-cluster-break`, `crelt`, `style-mod` and
  `w3c-keyname`: each `package.json` (version and licence) and `LICENSE` (the MIT text and copyright
  line for THIRD_PARTY_NOTICES.md)
- `@codemirror/language/package.json` - its dependencies, to see why `@codemirror/streamparser` was
  installed
- `@codemirror/view/dist/index.js` - `normalizeKeyName`, `modifiers` and `runHandlers`, to learn why
  the Shift+Alt+F binding did not fire on macOS
- `@codemirror/*` type declarations, through the TypeScript compiler's errors only
- `playwright-core/index.mjs` - imported by throwaway exploration scripts in the session's scratch
  folder, to drive the page; `@playwright/test` 1.64.1 - its documented test API only

Firstmate tooling:

- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - run on this worktree, as the
  brief asks (product-neutral)
- `chrome-devtools-axi` - tried against the local dev server (`localhost`); every call failed with
  a validation error, so the page was driven with Playwright instead

The task brief arrived as the session's dispatch message; no brief file was opened.

A session-start hook printed a list of local review sessions, which named file paths only; none of
those files was opened.

## URLs

None opened in a browser other than the local dev, preview and watch servers (`localhost` and
`127.0.0.1`). `npm view` read the npm registry for the CodeMirror packages' latest versions and
licences, and `npm install` downloaded them. The Linux run of the screenshots and journeys used the local
`mcr.microsoft.com/playwright:v1.64.1-noble` image and ran `npm ci` inside it against the npm
registry (package downloads only).

## Forbidden sources opened

None.
