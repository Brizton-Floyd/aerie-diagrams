# The Aerie skill for Claude

Slice A12 gives Claude a skill for writing Aerie models. With it, Claude reads a project, finds its
elements, relationships and main flows, writes them in Lines with wording for each audience, and runs
Aerie's checker until the file is clean. Slice A11 then uses the skill to draft the Lotto sample, which
is the skill's first real test. Slice D8 ties the skill to drift detection
([drift.md](drift.md#9-the-claude-skill-slice-d8)): it writes the lines that tie a model to its code,
runs `aerie drift` until the model and the code agree, and keeps the model in step when it changes the
code.

Requirement ids: `SKILL-nnn`. Conventions are in [overview.md](overview.md#reading-this-spec).

## What the skill is

- **SKILL-001** The skill lives in this repository at `skills/aerie/`. Its entry file is `SKILL.md`,
  with front matter giving `name: aerie` and a `description` that says when to use it: describing a
  system as an Aerie diagram, writing or fixing a `.aerie` file, or explaining a codebase's
  architecture to readers at different levels.
- **SKILL-002** Supporting files sit beside it and are read only when needed:
  `reference/lines.md` (the language in brief), `reference/wording.md` (how to write for each
  audience) and `examples/` (small valid models, one per idea).
- **SKILL-003** The skill is self-contained: it needs only its own folder and the `aerie` command
  ([language.md](language.md#15-command-line-tools)). It never tells Claude to read Aerie's source
  code.
- **SKILL-004** Every Lines example in the skill passes `aerie check` with no errors and is already
  formatted.
- **SKILL-005** The skill uses Aerie's own vocabulary ([GLOSSARY.md](../../GLOSSARY.md)) and plain
  English, and refers to no other diagram product or format.
- **SKILL-006** To install it, a user copies `skills/aerie/` into their own skills folder (for example
  `~/.claude/skills/aerie/` or a project's `.claude/skills/aerie/`). How the `aerie` command reaches
  other projects is part of the distribution decision after v1; until then the skill checks for the
  command first and tells the user how to run it from an Aerie checkout if it is missing.

## What it teaches

- **SKILL-101** The language in brief: every line kind and keyword of
  [language.md](language.md#2-files-lines-and-blocks), the ownership table, sentences that end with an
  element id, rewordings, views, scenarios and walkthroughs. Its list of keywords is the parser's.
- **SKILL-102** Ids and names: ids are stable, lowercase and taken from the project's own names
  (`screen-api`, not `component-3`); names are what a reader would call the thing.
- **SKILL-103** Nesting: people and outside systems at the top level beside the system; inside it,
  the deployable services; inside those, modules or parts where the engineer audience needs them.
  Two to four levels is usual. Tags say what each element is (`[person]`, `[external]`, `[service]`,
  `[module]`, `[store]`), and `icon` lines pick a fitting icon.
- **SKILL-104** Relationships: one sentence each, declared once at the finest grain the project shows,
  the object last ("gets screen data from screen-api"), verbs plain, present tense and lower case;
  `[code]` for build-time dependencies, nothing for runtime.
- **SKILL-105** Wording for audiences: the unmarked text is written in the default audience's voice
  (plain English: what a part does and why it matters). Executive wording is sparse: names, taglines
  and a sentence of value for the top levels. Engineer wording is mostly added paragraphs
  (`@engineer >>`) with ports, frameworks, endpoints and class names, and code-like taglines. Audience
  never changes depth: nothing is hidden from one audience and shown to another.
- **SKILL-106** Views: usually a big picture (`show <people>, <system> +1, <outside systems>`), a
  services view one level deeper, and, when build dependencies are known, an engineering view by tag
  with `kind code`. Two to four views.
- **SKILL-107** Scenarios: one to three flows that matter most, as sentences, with replies written as
  their own steps; every step backed by a relationship, so W601 means the model or the step needs
  fixing.
- **SKILL-108** A walkthrough: one tour of five to nine steps, from the big picture into the parts that
  matter and through one scenario, with narration reworded where an audience needs it.

## How it works

- **SKILL-201** **Agree the scope.** Which system to describe, which audiences (the default three
  unless the user says otherwise) and where to write the file (default: `architecture.aerie` at the
  project root). It asks only when the project leaves this unclear.
- **SKILL-202** **Read the project.** In this order, as far as each exists: the README and docs;
  deployment files (compose files, manifests, process files, CI deploy steps); build files and package
  manifests (modules and their dependencies); entry points and route or handler definitions (the APIs);
  configuration naming databases, queues and outside services; tests that name user flows.
- **SKILL-203** **Keep to the evidence.** Every element, relationship and step comes from something the
  skill read, and it can say which file. Where the project does not show something, the skill leaves it
  out and writes a comment line starting `// Unsure:` for the human.
- **SKILL-204** **Inventory, then write.** It lists the elements (with nesting and tags), the
  relationships and the flows, then writes the file in this order: `model`, `audiences`, elements,
  relationships, views, scenarios, walkthrough.
- **SKILL-205** **Check.** It runs `npx aerie check <file> --format json` and reads the diagnostics
  (LANG-963). The exit code says whether there are errors (LANG-966).
- **SKILL-206** **Fix until clean.** It fixes every error, using the message's own advice and the
  suggestion when there is one, and checks again. It stops when there are no errors. After ten rounds,
  or when the same error survives two fixes, it stops and shows the user the message.
- **SKILL-207** **Weigh the warnings.** For W601 it either adds the missing relationship, when the code
  shows one, or corrects the step. It never deletes a meaningful step to silence a warning, and it
  reports any warning it leaves.
- **SKILL-208** **Format.** It runs `npx aerie format <file>`.
- **SKILL-209** **Report.** It tells the user the path written; the number of elements, relationships,
  views and scenarios; the checker's final summary line; drift's result and rounds (from D8); every
  `// Unsure:` point; every ignore line it added, with its reason, and what drift could not check;
  and how to see the diagram: `npx aerie watch <file>`.
- **SKILL-210** **Edit, do not rewrite.** When a `.aerie` file already exists, it changes only what is
  needed and keeps the author's ids, wording and comments.
- **SKILL-211** **Tie the model to the code.** When the project has files drift reads (Docker Compose,
  Maven with Spring Boot and Java, Node with Angular), the skill writes, without being asked, the
  system root after `audiences` (a `repo` line for each repository of the system, `repo .` for the
  model's own, and a `compose` line for the Compose file the project tells people to use) and a
  `code` line under each element that stands for code, with the names the deployment and build files
  use; `class:` hints only for parts of Java modules whose package or classes it can name. People,
  outside systems and code drift does not read get none. It adds them to an existing file that has
  none, and writes neither when the project has no such files.
- **SKILL-212** **Fix drift until clean.** After the check, it runs `aerie drift <file> --format json`
  from the model's folder (DRIFT-507) and fixes every drift and likely finding, until `findings` is
  empty: it corrects the model where the model is wrong, wording any element a suggested edit adds as
  a placeholder like its siblings, and adds the finding's ignore line, with the true reason, where the
  difference is meant. It never adds or removes an element or a relationship the code does not bear
  out to silence a finding. The reference gives the usual fix of every kind of finding. After ten
  runs, or when the same finding survives two fixes, it stops and shows the user the finding.
- **SKILL-213** **Keep the model in step with the code.** When Claude changes the code of a project
  whose model has a system root, in a way that changes what the model describes (a service, module or
  package added, removed or renamed; a connection between parts; an outside system), it runs drift
  and updates the model in the same change, until drift is clean, and says what it changed.

## Proving it

- **SKILL-301** Slice A11 drafts the Lotto sample with the skill and commits a short record next to the
  sample: what the skill read, how many check rounds it took, the warnings it left, and what the human
  changed afterwards.
- **SKILL-302** Worked example 1 is a project drift reads: its deployment and build files sit beside
  its model, and the rounds it shows (the check, drift's rounds, and a later code change with the
  model's update) are what the commands print on them, so the loop ends clean.
