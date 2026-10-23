# Aerie Diagrams

**One model. Every audience.**

Aerie is diagram-as-code for architecture. Engineers describe a system once, in a plain text file, and
every reader explores it as an interactive diagram at their own level: the same model reads differently
for an executive, a manager and an engineer, and opens deeper in place when someone wants more detail.

Private, work in progress. The Lines language, model, layout and the Contour renderer are built;
the interactions come next ([docs/slice-plan.md](docs/slice-plan.md)).

## Getting started

Requires Node.js 24 (see `.nvmrc`).

```sh
npm ci
npx playwright install chromium
npm run check
```

`npm run check` is the single gate: typecheck, lint, unit tests, layout rule checks, goldens,
screenshots and browser journeys. CI runs the same command on every push and pull request.

To check, format or print the model of a Lines file
([docs/spec/language.md](docs/spec/language.md#14-command-line-tools)):

```sh
npx aerie check samples/lotto.aerie
npx aerie format samples/lotto.aerie
npx aerie model samples/lotto.aerie
```

To see Aerie draw, start the viewer and open the address it prints:

```sh
npm run dev
```

It opens the Lotto sample; pick another bundled sample or open a local `.aerie` file from the
sidebar, then choose a view, an audience, a zoom, a selection or a scenario step. "Edit" opens the
live split editor: the Lines text beside the diagram, which updates as you type.

To write a model in your own editor and see its diagram update on every save, build the page once
and watch the file ([docs/spec/interaction.md](docs/spec/interaction.md#watch-mode)):

```sh
npm run build
npx aerie watch samples/lotto.aerie
```

## Where to look

- [AGENTS.md](AGENTS.md) - how to work here, including the clean-room rules (mandatory).
- [GLOSSARY.md](GLOSSARY.md) - the product's own vocabulary.
- [docs/spec/](docs/spec/overview.md) - the functional specification: what Aerie v1 does.
- [docs/decisions/](docs/decisions/) - settled product decisions.
- [docs/slice-plan.md](docs/slice-plan.md) - the order in which v1 is built.

## Licence

All rights reserved. See [LICENSE](LICENSE).
