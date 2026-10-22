# a2-language: read log

Task: A2, the Lines language: parser to the canonical JSON model, the error catalogue, the formatter
and printer, spec example tests, and the `aerie check`, `aerie format` and `aerie model` commands.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-22

## Files

Built from this repository only: `docs/spec/` (above all `language.md` and `acceptance.md`), the
examples in `docs/spec/examples/`, `docs/decisions/`, `GLOSSARY.md` and the existing tooling.

- The task brief arrived as the session's dispatch message; its file,
  `/Users/briztonfloyd/Desktop/firstmate/data/aerie-a2-language/brief.md`, was not opened.
- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - run on this worktree, as the
  brief asks (firstmate tooling, product-neutral)

Directory listings only (names, not contents): `/Users/briztonfloyd/Desktop/firstmate/data/`
(filtered for this task's folder) and `/Users/briztonfloyd/Desktop/firstmate/data/aerie-a2-language/`.

Not opened: the map folder, the clean prototypes (`ilo-own-language`, `ilo-own-layout`,
`ilo-own-look`) and everything outside this repository. The spec was enough.

## URLs

None. TypeScript, Node.js and Vitest were used from general knowledge of their documented
behaviour (Node's type stripping for the `aerie` bin, `RegExp` match indices, Vitest's
`toMatchFileSnapshot`).

## Forbidden sources opened

None.
