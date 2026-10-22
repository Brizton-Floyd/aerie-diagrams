# Skill dry run: the Example Voting App

A12's real test of the [Aerie skill](../../skills/aerie/SKILL.md) on a small public project, before
slice A11 uses it on the Lotto sample. The model it produced is [voting-app.aerie](voting-app.aerie),
kept here as a record (the test suite checks that it stays valid).

- **Project**: [dockersamples/example-voting-app](https://github.com/dockersamples/example-voting-app),
  commit `63e9150`, Apache-2.0. Five containers: a Python voting page, a Redis list as a queue, a
  .NET worker, Postgres, and a Node.js results page, plus an on-demand seeder.
- **Why this one**: small enough to read in full, several languages, a queue, a store, and an
  end-to-end test that names the main flow.

## Run 1: by the skill's author

Followed SKILL.md step by step, from a clone outside the Aerie checkout.

| Step                | What happened                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Find the command | Not an Aerie checkout, so `node <checkout>/src/cli/aerie.ts --help`, which printed the expected usage.                                                                                                                                                                                |
| 1. Scope            | One system, the default three audiences, `architecture.aerie` at the project root. Nothing to ask.                                                                                                                                                                                    |
| 2. Read             | README; `docker-compose.yml` and `k8s-specifications/` (services, ports, networks, the `seed` profile); the Dockerfiles, `requirements.txt`, `package.json`, `Worker.csproj`; `vote/app.py`, `result/server.js`, `result/views/app.js`, `worker/Program.cs`; `result/tests/tests.sh`. |
| 3. Evidence         | One `// Unsure:` line: nothing says whether voters and results viewers are different people.                                                                                                                                                                                          |
| 4. Inventory, write | 9 elements (2 people, the system, 6 parts inside it), 8 relationships, 3 views, 2 scenarios, a 6-step walkthrough. No modules: each service is one file, so a third level would add nothing. No `[code]` view: the services share no packages.                                        |
| 5-7. Check, fix     | Round 1: `No problems found.`, exit 0. No errors or warnings to weigh.                                                                                                                                                                                                                |
| 8. Format           | `aerie format` changed nothing.                                                                                                                                                                                                                                                       |
| 9. Report           | Draft for review; the counts above; `No problems found.` after 1 round; the one `// Unsure:` point. `aerie watch` printed "There is no command called watch." (exit 2), so the report said this version of Aerie has no viewer yet, as the skill says.                                |

Choices worth a reviewer's eye:

- **The queue** (`redis`) is an element with the author's own tag `[queue]`; publishing and taking
  votes are two relationships, so the worker's polling is visible.
- **Two scenarios**, from the test script and the worker code: "A vote is counted" (7 steps, with
  the database's reply) and "A voter changes their vote", which the worker's `INSERT`-then-`UPDATE`
  shows.
- **Views by purpose** rather than by depth: Big picture, "How a vote gets in" and "How results get
  out", because the system has only one level inside it.
- **The seeder** is included, tagged `[tool]`, because the compose file defines it; a reviewer may
  prefer to drop it.

The author knows Lines well, so a clean first round says little about the skill's clarity. Run 2
tests that.

## Run 2: a fresh agent with only the skill

A fresh agent got only the skill folder, a clean copy of the project, and the path of an Aerie
checkout it could run but not read. It followed the skill on its own.

- **Result**: 10 elements, 8 relationships, 2 views (Big picture, Services), 2 scenarios ("Casting
  a vote", "Changing a vote") and a 6-step walkthrough. Round 1 was clean, formatting changed
  nothing, and the report said the file is a draft and quoted three `// Unsure:` points.
- **It found something run 1 missed.** The README says the app "does not register additional
  votes" from a browser that has voted, while the vote page and the worker let a voter change their
  vote. The agent modelled the code and marked the contradiction with `// Unsure:`. Run 1 modelled
  the same behaviour but did not flag the README.
- **Reading**: SKILL.md, both reference files and both worked examples, about 87% of the skill. It
  judged that SKILL.md and the two reference files alone would have been enough for a valid file.

It listed every place it had to guess. Each one is now answered in the skill:

| It had to guess                                                | The skill now says                                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| whether to stop and wait after writing the inventory           | carry on, unless the user asked to review the inventory first                                                                          |
| where the summary line comes from, when the check runs as JSON | after formatting, run the check once more in the text form, which ends with the summary line                                           |
| what to do when the README and the code disagree               | the code wins; model it and write an `// Unsure:` line naming both                                                                     |
| which of several deployment files to follow                    | the one the README tells people to use; differences go in engineer paragraphs or `// Unsure:`                                          |
| where dev tools, browser-side code and CDN scripts go          | tools may go in with their own tag, test harnesses stay out; page scripts belong to their service; CDN scripts are not outside systems |
| whether a walkthrough may play more than one scenario          | one or two                                                                                                                             |
| whether `for` lasts beyond its step                            | it lasts until another `for` line or the reader switches                                                                               |
| whether a step's verb must match its relationship's            | no: only the two elements must be related                                                                                              |
| whether the model's id may equal an element's                  | yes: the model's id is separate                                                                                                        |
| whether taglines and verbs take Markdown                       | no: words are plain text                                                                                                               |
| how to spell `aerie watch` for the user                        | the way you ran `aerie`                                                                                                                |
| whether people and the system count as elements in the report  | yes, every element                                                                                                                     |

Neither run needed a second check round, so neither exercised the fixing guidance. That guidance
is covered by worked example 1, whose first-round diagnostics the unit tests regenerate from the
real command and compare with the example word for word. Slice A11, which drafts the Lotto sample
with the skill, is its next real test.
