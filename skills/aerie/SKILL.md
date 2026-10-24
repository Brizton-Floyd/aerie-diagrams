---
name: aerie
description: Describe a software system as an Aerie diagram, written in a `.aerie` file in the Lines language, with wording for executives, managers and engineers, and keep it in step with the code. Use when the user asks to describe a system or codebase as an Aerie diagram, to write, update or fix a `.aerie` file, or to explain a project's architecture to readers at different levels; and when you change the code of a project that has a `.aerie` file with a system root in a way that changes its architecture.
---

# Aerie: describe a system as a model

Aerie is diagram-as-code for architecture: **one model, every audience**. A `.aerie` file describes a
system once, in the Lines language; readers explore interactive views of it, switch between audience
levels to read it in their own words, and open parts in place to see inside.

With this skill you read a project, decide what its **elements** are and how they nest, write their
**relationships** as plain sentences, choose a few **views**, tell the main flows as **scenarios**,
add a **walkthrough**, and word it all for each audience. You tie the model to the code it
describes with a **system root** and **code lines**. Then you run Aerie's checker until the file is
clean, and **drift**, which compares the model with the code, until the two agree.

**Everything this skill writes is a draft for human review.** You are reading code, not running the
system, and code does not show everything. Say so when you hand the file over, every time, and mark
what you could not confirm with `// Unsure:` lines.

## Files in this skill

- [reference/lines.md](reference/lines.md): the language in brief, the commands, and how to fix each
  diagnostic. Read it before writing your first line of Lines.
- [reference/wording.md](reference/wording.md): how to write for each audience. Read it before
  writing wording.
- [examples/](examples/): small valid models, one per idea, and two worked examples that go through
  this whole workflow:
  - [first-file.aerie](examples/first-file.aerie): the smallest useful model;
  - [audience-wording.aerie](examples/audience-wording.aerie): every kind of rewording;
  - [code-dependencies.aerie](examples/code-dependencies.aerie): `[code]` relationships and a view
    by tag;
  - [scenario-with-replies.aerie](examples/scenario-with-replies.aerie): steps and replies;
  - [walkthrough.aerie](examples/walkthrough.aerie): a narrated tour;
  - [recipe-box.md](examples/recipe-box.md) with
    [recipe-box/architecture.aerie](examples/recipe-box/architecture.aerie): worked example 1, a
    small web app, every step shown, drift's rounds included, and then a change to its code;
  - [parcel-tracker.md](examples/parcel-tracker.md) with
    [parcel-tracker.aerie](examples/parcel-tracker.aerie): worked example 2, a monorepo with a queue,
    build dependencies and two scenarios.

## Installing

Copy this whole `aerie` folder into a skills folder: `~/.claude/skills/aerie/` for every project, or
`.claude/skills/aerie/` inside one project. The skill needs nothing else except the `aerie` command.

## Step 0: find the aerie command

The skill runs `aerie check`, `aerie format` and `aerie drift`. Find the command before anything
else, and write nothing until you have it. In this skill, `aerie` means whichever of these works first:

1. **Inside an Aerie checkout** (the folder's `package.json` has `"name": "aerie-diagrams"`): run
   `npx aerie --help`. The command is `npx aerie`.
2. **Anywhere else, with a checkout on the machine**: if the user gave you its path, or the
   environment variable `AERIE_HOME` holds it, run `node <checkout>/src/cli/aerie.ts --help`. The
   command is `node <checkout>/src/cli/aerie.ts`. It needs Node 24 or later.

The help text starts with `Usage:` and lists `aerie check`, `aerie format` and `aerie model`. If it
does not, that is not Aerie. If it lists no `aerie drift`, this version of Aerie cannot compare a
model with its code: skip the drift steps and say so in your report.

**Never run `npx aerie` outside an Aerie checkout.** npm would download and run an unrelated package
that happens to share the name.

If neither works, stop and tell the user: "The `aerie` command is not available here. Clone the
Aerie repository, then either run me from inside it, or tell me its path (or set `AERIE_HOME` to it)
so I can run `node <checkout>/src/cli/aerie.ts`." Do not write the file without a checker.

## The workflow

### 1. Agree the scope

Settle three things: **which system** to describe, **which audiences** (the default three, exec,
manager and engineer, unless the user says otherwise), and **where to write** the file (default:
`architecture.aerie` at the project root). Ask only when the project leaves one of them unclear,
for example a repository holding several unrelated systems.

If a `.aerie` file already exists, go to [Editing an existing file](#editing-an-existing-file).

### 2. Read the project

Read in this order, as far as each exists, and note which file told you what:

1. **The README and docs**: what the system is for, who uses it, the words the team uses.
2. **Deployment files**: compose files, Kubernetes manifests, Procfiles and process files, CI deploy
   steps. These name the deployable services, their ports, the databases, queues and caches.
3. **Build files and package manifests**: `package.json` workspaces, Maven or Gradle modules, Go
   modules, `pyproject.toml`, `.csproj`, Cargo workspaces. These name the modules and their
   build-time dependencies on each other.
4. **Entry points and route or handler definitions**: the APIs each service offers, and which
   modules handle what.
5. **Configuration**: connection strings, URLs and keys that name databases, queues and outside
   services, and who calls whom (a `BASE_URL` pointing at another service is a relationship).
6. **Tests that name user flows**, above all end-to-end tests: these are your scenarios.

Read enough to answer "what talks to what, and why"; you do not need every file. Note the names the
deployment and build files give each part (the compose service, the Maven `artifactId`, the
`package.json` name): they become its code line.

### 3. Keep to the evidence

Every element, relationship and step must come from something you read, and you must be able to say
which file. Where the project does not show something, leave it out and write a comment line for the
human, above the line it concerns or where the missing thing would go:

```text
// Unsure: the README mentions a nightly export, but no job or schedule defines one.
```

Never invent a part to make the picture look complete.

When sources disagree, the code wins over the docs, and what runs wins over what is planned. Model
what the code does, and write an `// Unsure:` line naming both sources. When there are several
deployment files (a compose file, a stack file, manifests), describe the one the README tells people
to use; differences in the others (replicas, versions, networks) belong in `@engineer >>` paragraphs
or an `// Unsure:` line, not in extra elements.

### 4. Inventory, then write

First write an inventory in your reply (or a scratch note), so the structure can be judged before
any Lines:

- **Elements**, indented to show nesting, each with its id, name, tags and the file it came from.
- **Relationships**, as sentences.
- **Flows** worth a scenario.

Do not wait for approval of the inventory unless the user asked to review it first; carry on and
write the file in this order: `model`, `audiences`, the system root, elements, relationships,
views, scenarios, walkthrough, ignore lines. Use these rules:

**Ids and names.** Ids are stable, lowercase, and taken from the project's own names: `screen-api`
for a service the compose file calls `screen-api`, not `component-3` or `service-a`. Names are what a
reader would call the thing: "Screen API".

**Nesting.** People and outside systems go at the top level, beside the system. Inside the system go
the deployable services and the data stores. Inside a service go modules or parts, only where an
engineer needs them to follow a flow. Two to four levels is usual.

What else belongs:

- **Tools that are part of the project but not of the running system** (a seeder, a migration job)
  may go inside the system with their own tag, such as `[tool]`. Leave out test harnesses and CI
  containers.
- **Code a service sends to the browser** (a page script) belongs to that service, as a module
  inside it if an engineer needs to see it; it is not a separate element.
- **Outside systems** are the ones the system calls or is called by at run time and that a reader
  would name: a payment provider, an email service. Leave out libraries and scripts loaded from a
  content delivery network.

**Tags and icons.** Tag every element with what it is: `[person]`, `[external]`, `[system]`,
`[service]`, `[module]`, `[store]`, or your own word such as `[queue]` or `[package]` when that says
more. Tags choose default icons and let views select by tag; add an `icon` line only when a better
one fits (the icon names are in [reference/lines.md](reference/lines.md#elements)).

**Relationships.** One sentence each, declared once, at the finest grain the project shows (the
module that makes the call, not the service around it). The object comes last: "gets screen data
from screen-api". Verbs are plain, present tense and lower case. Mark build-time dependencies
`[code]`; runtime calls have no kind. A queue is an element: write "publishes ... to" and
"takes ... from" as two relationships.

**Wording.** Follow [reference/wording.md](reference/wording.md). The unmarked text is the default
audience's voice: plain English, what a part does and why it matters. Executive wording is sparse:
names, taglines and a sentence of value on the top levels. Engineer wording is mostly added
paragraphs (`@engineer >>`) with ports, frameworks, endpoints and class names, and code-like
taglines. Audience never changes depth: nothing is hidden from one audience and shown to another.

**Tying it to the code.** Drift reads Docker Compose files, Maven poms with Spring Boot and Java,
and Node packages with Angular. When the project has any of these, tie the model to them, without
being asked:

- **The system root**, after `audiences`: a `system` block with a `repo` line for each repository
  that forms the system (`repo .` for the one that holds the file; `repo ../other` for a sibling)
  and a `compose` line for the Compose file the README tells people to use, when there is one.
- **A code line** under each element that stands for code, naming what the files call it:
  `code compose:<service>`, `code maven:<artifactId>`, `code npm:<package.json name>`, several on
  one line when an element stands for several (a service built from a package lists both). Parts
  inside a Java module get `class:` hints (`class:com.shop.pricing.*`) only where you can name their
  package or classes. People, outside systems and parts in a language drift does not read get no
  code line; drift reports them as not checked.

The forms are in [reference/lines.md](reference/lines.md#tying-the-model-to-the-code). When the
project has none of these files, write no system root and skip the drift steps; say so in your
report.

**Views.** Two to four:

- a big picture: `show <people>, <system> +1, <outside systems>`;
- a services view one level deeper, or one service opened (`show ..., <service> +1, ...`);
- when build dependencies are known, an engineering view by tag with `kind code`.

**Scenarios.** One to three, for the flows that matter most (the ones the tests and README stress).
Each detailed step is a sentence; replies are their own steps. Every step must be backed by a relationship in
the model between the same two elements, in either direction. The step's verb phrase is its own: it
says what happens in this flow ("adds the vote to"), and need not repeat the relationship's ("adds
votes to").

**Main flow and stages.** When a view should open with a numbered explanation, explicitly choose its
main scenario with `scenario <id>` under the view. Group that scenario's detailed steps with stage
declarations such as `step 1: Write the model` and `step 2-4: Check its meaning`. The ranges must
cover every detailed step exactly once, in order; their titles and descriptions support audience
wording. Each stage anchors to its first detailed step. Choose a meaningful summary from the code
and the system's purpose; never infer chronology from relationship declaration order. Existing
views without this declaration keep their ordinary architecture picture.

**Walkthrough.** One tour of five to nine steps: start on the big picture, move into the parts that
matter, play one or two scenarios (whole or in ranges), and reword the narration where an audience
needs it. A `for <audience>` line switches the audience from that step on, until another `for` line
or the reader switches back, so use it sparingly.

### 5. Check

Run:

```text
aerie check <file> --format json
```

Exit code 0 means no errors (warnings may remain); 1 means errors; 2 means the command could not
run. The JSON lists each diagnostic with its `id`, `severity`, `line`, `column` and `message`, then
the `errors` and `warnings` counts ([reference/lines.md](reference/lines.md#the-commands)).

### 6. Fix until clean

Fix every error, using the message's own advice and its "Did you mean" suggestion when there is one,
then check again. The table in [reference/lines.md](reference/lines.md#fixing-diagnostics) gives the
usual cause of each. Stop when there are no errors.

Stop early and show the user the message if you have checked **ten times**, or if **the same error
survives two fixes**. Do not keep guessing.

### 7. Weigh the warnings

Warnings do not stop the model, but each one means something:

- **W601** (a scenario step with no relationship behind it): look at the code. If it shows the two
  parts really do talk, add the missing relationship. If the step names the wrong part, correct the
  step. **Never delete a meaningful step to silence the warning**, and never add a relationship the
  code does not show.
- Any warning you leave, you report, with the reason.

### 8. Check against the code

When the model has a system root, run, from the folder that holds the file:

```text
aerie drift <file> --format json
```

Exit code 0 means no drift, 1 drift, 2 that drift could not run (its message says why: a model with
errors, a repo or Compose file that is not there). The JSON (`aerie-drift/1`) lists `findings`, each
with its `id`, `level` (`drift` or `likely`), `kind`, `title`, `detail`, `evidence` (where in the
code, `repo/path:line`), `edits` (the suggested change, as hunks of the model file) and `instead`
(the ignore line to add if the difference is meant); then `suggestions`, `notChecked`, `ignored`
and the `summary` counts ([reference/lines.md](reference/lines.md#the-commands)). Run it without
`--format json` to read the same report as text.

### 9. Fix drift until clean

The file is clean when `findings` is empty: no drift and no likely findings. For each finding, look
at its evidence in the code, then do one of two things
([reference/lines.md](reference/lines.md#fixing-drift-findings) gives the usual fix of each kind):

- **The model is wrong**, the usual case: fix it. Use the suggested edit as a guide, never as the
  final text: a new element it suggests is only a placeholder, so give it a real name, tagline, tag
  and wording, and draw its relationships at the finest grain the code shows. A finding about a
  `code` line you wrote is your mistake: correct the line.
- **The difference is meant** (a development tool, a part being retired): add the ignore line from
  `instead`, with the true reason in place of `why this difference is meant`.

Never add an element or relationship the code does not show, and never remove a true one, to
silence a finding. A likely finding that the code does not bear out (a connection the code makes in
a way drift cannot read) is meant too: ignore it and say why. Then run `aerie check` and drift
again. `suggestions` (code lines drift would pin) are worth taking; `notChecked` needs no fix, but
goes in your report.

Stop early and show the user the finding if you have run drift **ten times**, or if **the same
finding survives two fixes**.

### 10. Format

Run:

```text
aerie format <file>
```

It changes only spacing. Then run the check once more in the text form, which ends with the summary
line for your report:

```text
aerie check <file>
```

### 11. Report

Tell the user:

- the path written, and that **the file is a draft for their review**;
- how many elements (every one, people and the system included), relationships, views and scenarios
  it has (`aerie model <file>` prints the model as JSON if you need to count);
- the checker's final summary line (such as `No problems found.`) and how many rounds it took;
- drift's result (`No drift.` and how many elements and lines the code confirms) and how many
  rounds it took, or why drift was skipped;
- every `// Unsure:` point, quoted;
- any warning left, with why;
- every ignore line you added, with its reason, and in a sentence what drift could not check;
- how to see the diagram: `aerie watch <file>`, spelled the way you ran `aerie` (for example
  `node <checkout>/src/cli/aerie.ts watch <file>`). If the command answers that there is no `watch`
  command, this version of Aerie has no viewer yet; say so instead.

## Editing an existing file

When a `.aerie` file already exists, edit it; do not rewrite it. Change only what the request or the
project now needs, and keep the author's ids, wording, comments and order. Add new elements beside
their siblings and new relationships beside related ones. If it has no system root and the project
has files drift reads, add the system root and code lines as step 4 says. Then check, run drift, fix,
format and report as above, listing what you changed.

To fix a file the user says is broken, start at step 5.

## Changing code that changes the architecture

When you change the code of a project whose `.aerie` file has a system root, and the change alters
what the model describes, update the model **in the same change**, so code and diagram never drift
apart. Changes that do: adding, removing or renaming a service, a module or a package (a compose
service, a Maven module, a `package.json`); changing which part calls which (a URL, a proxy route, a
client call to another service, a dependency between modules); adding an outside system. Changes
inside one part (a new endpoint on an existing connection, a refactor) do not.

1. Make the code change.
2. Run `aerie drift <file> --format json` (step 8).
3. Edit the model as [Editing an existing file](#editing-an-existing-file) says, fixing every
   finding as step 9 says, until drift is clean; then check and format.
4. In your report of the code change, say what you changed in the model and why.

Run drift even when you think the change does not alter the architecture: a clean run is the proof.
Worked example 1 ends with such a change.
