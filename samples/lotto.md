# How the Lotto sample was drafted

The record SKILL-301 asks for ([claude-skill.md](../docs/spec/claude-skill.md#proving-it)): slice
A11 refined [lotto.aerie](lotto.aerie) with the [Aerie skill](../skills/aerie/SKILL.md) against the
real Lotto code, so the flagship sample says what the code does. The spec's worked example,
[docs/spec/examples/lotto.aerie](../docs/spec/examples/lotto.aerie), is where it started and stays
as it was: the spec's tables and examples are about that file.

The skill was run by a Claude Code session in the A11 task, with a second agent reading the code
for evidence and reporting every claim as confirmed, wrong or not found. Everything below is what
the skill's workflow did, step by step; the sources are listed in
[the read log](../docs/clean-room/read-log/a11-v1.md).

## Scope

- **System**: the Lotto suite: the website (`lotto-options-ui`), the Screen API and Analysis engine
  (`lotto-options-core`) and the Results store (`lottery-result-persistence-service`), with the
  Texas Lottery website they download from.
- **Audiences**: the default three, exec, manager (default) and engineer.
- **File**: `samples/lotto.aerie`, which already existed, so the skill edited it rather than writing
  a new one (SKILL-210).

Nothing needed asking: the three repositories are one system, started by one compose file.

## What the skill read

In the skill's order (SKILL-202):

| Step                     | What was read                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. README and docs       | The READMEs, `CONTEXT.md` and `docs/PROJECT.md` of lotto-options-core and the website, the Results store's `CLAUDE.md` (it has no README), and lotto-options-core's ADRs 0001 to 0004, 0009 and 0010.                                                                    |
| 2. Deployment files      | `compose.yaml`, `deploy/backend/Dockerfile`, `deploy/web-ui/Dockerfile` and `default.conf.template` in lotto-options-core; the older `Dockerfile` files and the Results store's own `docker-compose.yml`.                                                                |
| 3. Build files           | The Maven poms of every module of lotto-options-core and the Results store, and the website's `package.json` and `angular.json`.                                                                                                                                         |
| 4. Entry points, routes  | The website's routes and Smart Generator screen; the Screen API's controllers and `CoreApiClient`; the engine's controllers, services and generator factory; the Results store's controller, polling service, job, processors, readers, serializer and cache evictor.    |
| 5. Configuration         | `application.yaml` and `application.properties` of the Screen API and the engine, the Results store's `application.yml` (pool, retry, rate limit, game URLs), and the website's `proxy.conf.json`.                                                                       |
| 6. Tests that name flows | The ArchUnit tests and their frozen baselines, which say where the modules are heading. A search found no end-to-end tests of the suite (only integration tests of legacy support), so the two flows come from the code: the Smart Generator's request, and the refresh. |

## What the evidence changed

Most of the file held up: ports, frameworks, endpoints, class names, the cron expression, the pool,
retry and rate limit, the storage format and the ADRs were all confirmed. These were wrong, and the
skill fixed them to match the code:

- **The results poll had the wrong part doing the work.** The updater only schedules a refresh of
  each game; the reader downloads the file, keeps the latest 8,000 draws and saves them. The
  relationships and the scenario now say so, which also clears the W601 the old sample kept on
  purpose.
- **The engine's dashboards had no path.** The dashboard is the website's first screen, so the
  engine service gained a **Game analysis** part (dashboards, range analysis, betslips).
- **Pick generation searches.** It keeps making and checking sets for up to about 20 seconds until a
  set's target prize is due; the wording says so, and the request carries a target prize.
- **Smaller facts**: the Screen API still computes some statistics (ADR-0009); the Results store
  keeps each game's latest 8,000 draws, not every draw, and answers from memory until the next
  refresh; legacy desktop support still reads draws from the Results store; the shared data formats
  do not depend on the Results store's types (the other modules do); the engine's dependency on
  legacy support is runtime only; the button is "Generate Numbers"; ADR-0002, not ADR-0001, keeps
  the Screen API on the loopback address; the hexagonal module split of ADR-0009 has not started.
- **Engineer names**: the team calls the parts the BFF, the Core API and the Results service, so
  those are the engineer names. The ids stay as they were.

## Check rounds

Three runs of `aerie check samples/lotto.aerie --format json`, each with no errors and no warnings:
after the edit, after moving the `// Unsure:` lines above the elements they concern, as the skill
says (the formatter indents a comment like the statement after it), and after the layout changes
below. `aerie format`
then changed nothing, and the final `aerie check` printed `No problems found.`

## Warnings left

None. The old sample's W601 (`updater saves draws into saved-draws`) was a real mistake, and the
fix was to correct the step, as the skill says.

## What changed after the draft

The draft was then judged on the readability scores ([layout.md](../docs/spec/layout.md#readability-scores)),
which are part of the definition of done. It had added two more things the code shows, and both made
the diagram harder to read:

- A **Draw data formats** module inside the Results store (`lottery-result-persistence-service-models`,
  which the engine's modules build on) put the Results store into the Engineering view with four
  long lines and one crossing, and an unconnected box into the Services view. It is now described in
  the engine's and the store's engineer paragraphs instead.
- **Game analysis uses the strategies library's dashboard analyzers.** That line crossed another in
  the "everything open" pictures. Its engineer paragraph names the analyzers, and a comment in the
  file says why the line is left out.

With both changes every picture has no crossing lines. Against the spec's example the sample has
one more part and three more relationships, so some pictures have more bends and fit at a smaller
scale; that is the new baseline. The owner reviews the file in the A11 pull request.

## Report

The skill's report (SKILL-209), as given:

- **Path**: `samples/lotto.aerie`, a draft for review.
- **Counts**: 19 elements, 21 relationships, 3 views (Big picture, Services, Engineering: code
  modules), 2 scenarios (Generate picks, 14 steps; Results poll, 6 steps) and a walkthrough of 8
  steps.
- **Checker**: `No problems found.` after the third round.
- **Unsure points**, quoted:
  - "the Results store's own `docker-compose.yml` and Dockerfile, and the root Dockerfile of
    lotto-options-core, run older or partial stacks; the README points to `compose.yaml`, so this
    model follows it."
  - "nothing in the website or the Screen API calls `/api/v1/gameout/*`; its caller, if any, is not
    in these repositories."
  - "the desktop client itself is not in these repositories, so it is not drawn. Its
    `HttpLotteryPersistenceClient` calls `/api/v1/lottery-targeting/*`, which the Results store no
    longer offers."
- **Warnings left**: none.
- **To see it**: `npx aerie watch samples/lotto.aerie` (after `npm run build`), or `npm run dev`.

## What the skill could do better

- The skill says to model "at the finest grain the project shows", and says nothing of the
  readability scores. On a project this size, the finest grain added lines that cost crossings for
  little the reader needed. A later version of the skill could say: when a relationship or element
  is not needed to follow a flow, and drawing it adds crossings, describe it in an engineer
  paragraph instead.
- The skill says to write an `// Unsure:` line above the line it concerns, but the first draft put
  two of them at the end of the block they concerned, and `aerie format` moved them under the next
  statement. Saying why (a comment belongs to the statement after it) would make the rule stick.
