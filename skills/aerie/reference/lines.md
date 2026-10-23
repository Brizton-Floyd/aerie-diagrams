# Lines in brief

Lines is Aerie's text language. One `.aerie` file describes one model. This page is everything you
need to write one; the checker (`aerie check`) has the last word on what is valid.

## Files, lines and blocks

- A file is UTF-8 text. Indent with **spaces only** (a tab is an error), two per level.
- Every line is blank, a comment, or a statement. A **comment** is a whole line starting with `//`
  (after any indent). There are no comments at the end of other lines.
- A statement belongs to the nearest statement above it with a smaller indent: its **owner**.
  Statements with no owner are at the top level and have no indent. Lines in one block share one
  indent.
- Only descriptions continue over several lines; every other statement fits on one line.

The first characters of a statement decide what it is:

| Starts with                    | Line kind    | Example                                            |
| ------------------------------ | ------------ | -------------------------------------------------- |
| `@`                            | rewording    | `@engineer: \| orders-api :8080`                   |
| `>`                            | description  | `> Takes orders and checks stock.`                 |
| a keyword and a space          | keyword line | `view big-picture: Big picture`                    |
| an id directly followed by `:` | element      | `orders: Orders service \| Takes orders [service]` |
| an id and a space              | sentence     | `web sends orders to orders`                       |

The keywords, all of them: `model`, `audiences`, `view`, `scenario`, `walkthrough`, `step`, `show`,
`kind`, `icon`, `open`, `close`, `for`, `system`, `repo`, `compose`, `code`, `ignore`. None of them
can be an id.

**Ids** are lowercase letters, digits and single hyphens, start with a letter and do not end with a
hyphen: `web`, `screen-api`, `v2-store`. Not `Web`, `screen_api` or `api-`. Elements, views,
scenarios and walkthroughs share one set of ids, each used once. The model's id and audience ids are
separate, so the model and its system may share an id. Tags and kinds are spelled like ids.

**What may go inside what.** Anything else is out of place:

| Owner                                                                                                       | May hold                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| the top level                                                                                               | `model`, `audiences`, `system`, elements, relationships, `view`, `scenario`, `walkthrough`, `ignore` |
| `model`                                                                                                     | descriptions, rewordings                                                                             |
| `system`                                                                                                    | `repo`, `compose`                                                                                    |
| an element                                                                                                  | elements (its children), `icon`, `code`, descriptions, rewordings                                    |
| a relationship                                                                                              | descriptions, rewordings                                                                             |
| `view`                                                                                                      | `show`, `kind`, descriptions, rewordings                                                             |
| `scenario`                                                                                                  | steps (sentences), descriptions, rewordings                                                          |
| a scenario step                                                                                             | descriptions, rewordings                                                                             |
| `walkthrough`                                                                                               | `step`, descriptions, rewordings                                                                     |
| a walkthrough `step`                                                                                        | `open`, `close`, `for`, descriptions, rewordings                                                     |
| `audiences`, `show`, `kind`, `icon`, `code`, `repo`, `compose`, `open`, `close`, `for`, `ignore`, `@level:` | nothing                                                                                              |

**Words** (names, taglines, verb phrases, titles) are one line of plain text, with no Markdown; runs
of spaces count as one. Write
`\|`, `\[`, `\]` or `\\` to use those characters in words. **Descriptions** (`> text`) are
paragraphs, one per `>` line; deeper-indented lines that follow continue the paragraph. They accept
`**bold**`, `*italic*`, `` `code` `` and `[text](https://...)` links.

## The model and audiences

```aerie
model warehouse: Warehouse
  > How stock comes in, is stored and goes out.
  @exec: The warehouse at a glance

audiences exec "Executive", manager "Manager" (default), engineer "Engineer" (code)

stock: Stock system [system]
```

- `model <id>: <title>` is optional, at most once. Its block holds the model's description and
  title rewordings.
- `audiences` lists who the wording is for, in the order the reader's switch shows them: an id, an
  optional name in double quotes, optional flags `(default)` and `(code)`. One to six audiences.
  `(default)` marks the audience readers start with and the voice of all unmarked wording (the first
  one when none is marked). `(code)` sets that audience's wording in a code face.
- With no `audiences` line, the model has exactly
  `exec "Executive", manager "Manager" (default), engineer "Engineer" (code)`. Write the line anyway,
  so readers of the file see it.

## Elements

`<id>: <name> | <tagline> [<tags>]`. The name is required; the tagline and tags are optional. Indent
an element under another to put it inside.

```aerie
shop: Shop | Sells tea online [system]
  storefront: Storefront | Where customers browse [service]
    icon web
    > The pages customers see.
  orders-db: Orders database | Every order [store]
```

- **Tags** are words in one bracket group that ends the line: `[service module]`. Three of them
  change how Aerie draws the element: `person` (someone who uses the system), `external` (a system
  outside the one described) and `store` (where data is kept). People and outside systems sit on
  the edge of the picture. All other tags are yours; views can select by any tag.
- **Icons**: `icon <name>`, at most one per element. The names: `person`, `stack`, `web`, `api`,
  `gear`, `module`, `route`, `dice`, `search`, `books`, `grid`, `monitor`, `cylinder`, `history`,
  `refresh`, `document`, `archive`, `building`, `box`. Without an `icon` line the first of these tags
  decides: `person` gives `person`, `external` gives `building`, `store` gives `cylinder`, `system`
  gives `stack`, `service` gives `gear`, `module` gives `module`; anything else gives `box`. So add
  an `icon` line only when a better one fits.
- **Descriptions** under an element are shown in the side panel, not on the diagram.

## Rewording for an audience

Unmarked wording is what every audience reads. A rewording changes one piece of wording for one
audience and is indented under the line it rewords.

| Line                  | Under                                      | Does                                                                   |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `@a: Name \| tagline` | an element                                 | replaces the name, the tagline or both (leave a part empty to keep it) |
| `@a: words`           | a relationship or scenario step            | replaces the verb phrase                                               |
| `@a: words`           | `model`, `view`, `scenario`, `walkthrough` | replaces the title                                                     |
| `@a > text`           | anything with a description                | replaces the description for that audience                             |
| `@a >> text`          | anything with a description                | adds a paragraph after the description that audience reads             |

```aerie
audiences exec "Executive", manager "Manager" (default), engineer "Engineer" (code)

billing: Billing | Charges customers each month [service]
  > Works out each bill and takes the payment.
  @exec: Revenue engine | Turns usage into income
  @engineer: | billing-svc, Go :9000
  @engineer >> Runs nightly at 02:00 from `cmd/billing`. Retries a failed charge three times.
```

- One `@a:` line per owner per audience. The audience must be declared.
- There is no cascade: wording for `engineer` never changes what `manager` reads.
- A walkthrough step has no title, so it takes only `@a >` and `@a >>`. A `|` belongs only in an
  element's rewording.
- Audience changes wording, never depth: every audience sees the same elements and relationships.

## Relationships

A relationship is a sentence at the top level: `<subject> <verb phrase> <object>`. The first and
last words are element ids; everything between is the verb phrase. It reads aloud with the names in
place of the ids.

```aerie
web: Website
api: Orders API
db: Orders database [store]
broker: Message broker
billing: Billing
pricing: Pricing rules

web sends orders to api
  @engineer: POSTs /orders to
  > Every order the customer confirms.
api saves orders in db
api publishes order events to broker
billing takes order events from broker
api depends on pricing, billing [code]
```

- **The object comes last.** Write "asks for prices from pricing", never "asks pricing for prices".
- Several objects after one verb phrase, separated by commas, declare one relationship each.
- A bracket group at the end is the **kind**: one id. No kind means `runtime`. Use `[code]` for
  build-time dependencies.
- A relationship joins two different elements, neither inside the other, and each is declared once.
  Declare it at the finest grain you know (the module, not the service around it): views draw it
  between whatever is visible.

## Views

```aerie
user: User [person]
shop: Shop [system]
  web: Website [service]
  api: API [service module]
  core: Core rules [module]
api depends on core [code]
web calls api

view big-picture: Big picture
  show user, shop +1

view engineering: Engineering
  show [module]
  kind code
  @exec: How the code is organised
  > Build-time dependencies between the code modules.
```

- `view <id>: <title>`. Views are listed in the order written; the first is the one readers see
  first.
- `show` items, comma-separated, several `show` lines adding up: `<id>` shows the element closed,
  `<id> +N` shows it with N levels of what is inside it open, `[tag]` shows every element with the
  tag. The containers around shown elements are drawn too.
- `kind <kind>, ...` picks which relationship kinds the view draws; without it, `runtime` only.
- A view with no `show` line shows every top-level element. A model with no view gets one, so always
  write your own.

## Scenarios

```aerie
customer: Customer [person]
web: Website
api: Orders API
web sends orders to api
customer buys from web

scenario checkout: Checking out
  > From pressing "Buy" to the confirmation.
  customer presses buy on web
  web sends the order to api
    @engineer: POSTs /orders to
    > The order carries the basket and the address.
  api confirms the order to web
  web shows the confirmation to customer
```

- `scenario <id>: <title>`, then one step per line. A step is a sentence like a relationship, with
  exactly one object and no kind. Its ends may be elements at any depth.
- A reply is its own step in the other direction (`api confirms the order to web`). Aerie sees it is
  a reply because the model only has a relationship the other way.
- A step whose two elements have no relationship between them, in either direction, gets warning
  W601.
- At least one view must show every element the scenario names, or a container around it.

## Walkthroughs

```aerie
user: User [person]
shop: Shop [system]
  web: Website
  api: API
user buys from web
web calls api

view big-picture: Big picture
  show user, shop +1

scenario buy: Buying
  user buys from web
  web calls api

walkthrough tour: A tour of the shop
  step big-picture
    > One shop, two parts.
  step big-picture: api
    > The **API** does the work.
    @exec > The **API** is where orders become revenue.
  step buy: 1-2
    for engineer
    > A purchase, step by step.
```

- `step <view>` shows a view; `step <view>: <id>, ...` also focuses on elements, which must be
  visible in that picture (open their container with `open` if needed).
- `step <scenario>` plays it all; `step <scenario>: <n>` or `<n>-<m>` plays some steps.
- Inside a step: `open <id>, ...` and `close <id>, ...` open or close containers first; `for
<audience>` switches the audience; descriptions are the narration.

## Tying the model to the code

Lines for checking the diagram against the code with `aerie drift`. `aerie check` validates them,
only drift reads them, and they never change what a reader sees. Write them whenever the project
has files drift reads: Docker Compose files, Maven poms (with Spring Boot and Java), and Node
`package.json` files (with Angular).

```aerie
model shop: Corner shop

system
  repo .
  repo ../shop-web
  compose deploy/compose.yaml

shop: Shop [system]
  web: Storefront [service]
    code compose:web npm:shop-web
  api: Orders API [service]
    code compose:api maven:orders-api
    pricing: Pricing rules [module]
      code class:com.shop.orders.pricing.*

web sends orders to api

ignore drift maven:orders-legacy - retiring with the old admin app
```

- `system` (once, at the top level, alone on its line) holds `repo <path>` lines, the repos that form
  the system, and `compose <path>` lines, the Compose files that are the truth (not stale copies).
  Paths are relative to the folder that holds the `.aerie` file, with forward slashes; `repo .` is
  the file's own repo. Without `repo` lines the system is the file's own repo. Each Compose file must
  be inside one of the repos.
- `code <unit> ...` under an element lists the code it stands for, units separated by spaces:
  `compose:<service>`, `maven:<artifactId>`, `npm:<package.json name>`, and for parts
  `class:<Class>`, `class:<com.pkg.Class>` or `class:<com.pkg>.*`. Several `code` lines add up. A
  unit belongs to one element; an element drawn above code level (a service built from several
  modules) lists all its units.
- `ignore drift <subject> - <reason>` (top level) marks a difference from the code as meant. The
  subject is an element id, a code unit, or `a to b` for the connection from one to the other. The
  reason is required. Keep ignore lines together at the end of the file.
- An element without a code line is matched by name: its id or name against the compose services,
  Maven modules and packages. Write the code line anyway, so a rename in the code is caught.

## The commands

`aerie` below means the command you found as SKILL.md says.

| Command                                | Does                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `aerie check <file> --format json`     | prints every diagnostic as JSON; exit code 1 when there are errors, else 0                   |
| `aerie check <file>`                   | the same as lines: `<file>:<line>:<column>: <severity> <id>: <message>`, then a summary line |
| `aerie format <file>` (or `aerie fmt`) | formats the file in place; changes only spacing                                              |
| `aerie format <file> --check`          | changes nothing; exit code 1 and the file name when it would change                          |
| `aerie model <file>`                   | prints the canonical JSON model of a file without errors                                     |
| `aerie drift <file> --format json`     | compares the model with its code; exit code 1 when there is drift, else 0                    |
| `aerie drift <file>`                   | the same as a plain-English report                                                           |
| `aerie drift <file> --format diff`     | every suggested edit as one patch, for `git apply`; changes nothing                          |

Exit code 2 means the command could not run (a missing file, a wrong option); its message says why.
Run `aerie drift` from the folder that holds the file: the paths in its report start there.

The JSON from `check --format json`:

```json
{
  "files": [
    {
      "path": "architecture.aerie",
      "diagnostics": [
        {
          "id": "E008",
          "severity": "error",
          "line": 12,
          "column": 18,
          "endLine": 12,
          "endColumn": 22,
          "message": "There is no element called `mial`. Did you mean `mail`?"
        }
      ]
    }
  ],
  "errors": 1,
  "warnings": 0
}
```

A finding in the JSON from `drift --format json` (`aerie-drift/1`). Each hunk in `edits` and
`instead` replaces the `remove` lines, starting at line `at`, with the `add` lines; with nothing to
remove, the lines go in before line `at`.

```json
{
  "id": "D01",
  "key": "undrawn-code:compose:mailpit",
  "level": "drift",
  "kind": "undrawn-code",
  "title": "The code has the Compose service `compose:mailpit`, but no element stands for it.",
  "detail": "2 techniques found it: Compose service and Compose environment URL.",
  "elements": [],
  "diagram": null,
  "techniques": ["compose-service", "env-url"],
  "evidence": [
    {
      "technique": "compose-service",
      "name": "Compose service",
      "at": "recipe-box/compose.yaml:20",
      "detail": "compose:mailpit",
      "corroborates": false
    },
    {
      "technique": "env-url",
      "name": "Compose environment URL",
      "at": "recipe-box/compose.yaml:11",
      "detail": "compose:api to compose:mailpit (MAIL_API_URL=http://mailpit:8025/api/v1/send)",
      "corroborates": false
    }
  ],
  "edits": [
    {
      "at": 60,
      "remove": [],
      "add": ["", "  mailpit: mailpit [service]", "    code compose:mailpit"]
    },
    {
      "at": 81,
      "remove": [],
      "add": ["api calls mailpit"]
    }
  ],
  "instead": [
    {
      "at": 122,
      "remove": [],
      "add": ["", "ignore drift compose:mailpit - why this difference is meant"]
    }
  ]
}
```

Beside `findings`, the document has `summary` (the counts: `drift`, `likely`, `suggestions`,
`notChecked`, `confirmedElements`, `confirmedLines`, `exitCode` and more), `suggestions` (code
lines drift would pin, each with its edit), `notChecked` (what the code cannot show, each with its
`text`), `ignored` (each ignore line with the findings it excused), `confirmed` and `problems` (what
drift could not read).

## Fixing diagnostics

Every message says what is wrong and how to fix it; follow it, and take the "Did you mean" suggestion
when it is right. This table adds the usual cause.

| Id   | Usual cause                                                           | Fix                                                                                                                                         |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| E001 | a tab in the indent                                                   | indent with spaces                                                                                                                          |
| E002 | a line in a block indented differently from the rest                  | give every line in the block the same indent                                                                                                |
| E003 | a line under an owner that cannot hold it                             | move it (see "What may go inside what"); `show` and `kind` go inside a view; `code` inside an element; `repo` and `compose` inside `system` |
| E004 | a line that starts with none of the line kinds                        | start with an id, a keyword, `>`, `@` or `//`                                                                                               |
| E005 | an id with capitals, underscores or a trailing hyphen                 | `screen_api` becomes `screen-api`                                                                                                           |
| E006 | a keyword used as an id (`view`, `step`, `for`, `code`, `system` ...) | choose another id                                                                                                                           |
| E007 | the same id twice                                                     | rename one; views and scenarios share ids with elements                                                                                     |
| E008 | a typo, or an element not declared yet                                | take the suggestion, or declare the element                                                                                                 |
| E009 | a `[` with no `]`                                                     | close it, or write `\[`                                                                                                                     |
| E010 | a marker with nothing after it                                        | add the wording, or remove the line                                                                                                         |
| E011 | `id:` with no name or title                                           | add one                                                                                                                                     |
| E012 | text after the tags                                                   | move it before the `[`                                                                                                                      |
| E013 | empty brackets `[]`                                                   | add a tag, or remove them                                                                                                                   |
| E014 | a doubled or trailing comma in a list                                 | remove it                                                                                                                                   |
| E101 | two `model` lines                                                     | keep one                                                                                                                                    |
| E102 | two `audiences` lines                                                 | merge them into one                                                                                                                         |
| E103 | an audience, repo, Compose file or code unit listed twice             | remove one                                                                                                                                  |
| E104 | two audiences marked `(default)`                                      | keep one mark                                                                                                                               |
| E105 | more than six audiences                                               | merge audiences                                                                                                                             |
| E106 | a flag other than `default` or `code`                                 | use `(default)`, `(code)` or both                                                                                                           |
| E107 | an audience written wrongly                                           | `dev "Developer" (code)`                                                                                                                    |
| E201 | an icon name not in the set                                           | take the suggestion, or choose from the list above                                                                                          |
| E202 | two `icon` lines on one element                                       | keep one                                                                                                                                    |
| E301 | a rewording for an undeclared audience                                | use a declared audience id, or add it to `audiences`                                                                                        |
| E302 | two `@a:` lines for one audience under one owner                      | keep one                                                                                                                                    |
| E303 | `@a:` under a walkthrough step, or a `\|` outside an element          | use `@a >` or `@a >>`; remove the `\|`                                                                                                      |
| E304 | `>>` with no audience                                                 | write `@a >> text`                                                                                                                          |
| E401 | the object is not the last word                                       | reword so the element comes last: "asks for prices from pricing"                                                                            |
| E402 | a sentence with no verb phrase                                        | add one between the two ids                                                                                                                 |
| E403 | a relationship from an element to itself                              | relate it to the part it really talks to, or remove it                                                                                      |
| E404 | a relationship between an element and its container                   | remove it: nesting already says the container holds it                                                                                      |
| E405 | the same relationship twice                                           | remove the copy                                                                                                                             |
| E406 | more than one kind in brackets                                        | keep one kind                                                                                                                               |
| E501 | a `show` item that is not `id`, `id +N` or `[tag]`                    | write it in one of those forms                                                                                                              |
| E502 | `show [tag]` with a tag no element has                                | fix the tag, or tag the elements                                                                                                            |
| E503 | `kind` naming a kind no relationship has                              | fix the kind, or mark the relationships                                                                                                     |
| E601 | a scenario with no steps                                              | add steps                                                                                                                                   |
| E602 | a step with several objects                                           | write one step per object                                                                                                                   |
| E603 | a step with a `[kind]`                                                | remove it                                                                                                                                   |
| E604 | no view shows everything a scenario names                             | add the named top-level element to a view's `show` line                                                                                     |
| W601 | a step with no relationship behind it                                 | see "Warnings" in SKILL.md: fix the model or the step, never delete the step                                                                |
| E701 | a walkthrough with no steps                                           | add `step <view>` lines                                                                                                                     |
| E702 | `step` naming no view or scenario                                     | take the suggestion                                                                                                                         |
| E703 | focusing on an element hidden in a closed container                   | add `open <container>` to the step, or show it deeper in the view                                                                           |
| E704 | step numbers after a view                                             | put element ids after a view                                                                                                                |
| E705 | element ids after a scenario                                          | put step numbers after a scenario                                                                                                           |
| E706 | step numbers the scenario does not have                               | use numbers from 1 to the number of steps                                                                                                   |
| E707 | `open` or `close` on an element with nothing inside                   | remove it                                                                                                                                   |
| E708 | two `for` lines in one step                                           | keep one                                                                                                                                    |
| E801 | text after `system`                                                   | move it to `repo` or `compose` lines under `system`                                                                                         |
| E802 | two `system` blocks                                                   | merge them into one                                                                                                                         |
| E803 | a `system` block with nothing under it                                | add `repo` or `compose` lines, or remove it                                                                                                 |
| E804 | an absolute path, `~`, a web address or backslashes                   | write the path relative to the `.aerie` file's folder, with `/`                                                                             |
| E805 | a Compose file outside every listed repo                              | add a `repo` line for its repo, or fix the path                                                                                             |
| E806 | a code unit with no `kind:`                                           | write `compose:`, `maven:`, `npm:` or `class:` before the name                                                                              |
| E807 | an unknown kind of code unit                                          | use `compose`, `maven`, `npm` or `class`                                                                                                    |
| E808 | a name the kind does not allow                                        | follow the message's rule for that kind                                                                                                     |
| E809 | one code unit under two elements                                      | keep it on the one element it belongs to                                                                                                    |
| E810 | an `ignore` line without `drift` or a subject                         | write `ignore drift <subject> - <reason>`                                                                                                   |
| E811 | an `ignore` line without a reason                                     | add a hyphen, a space and the reason                                                                                                        |
| E812 | a subject that is not an id, a unit or `a to b`                       | write one of those                                                                                                                          |
| E813 | `a to a`                                                              | name two different ends                                                                                                                     |
| E814 | the same subject ignored twice                                        | keep one line                                                                                                                               |
| W001 | a file with no elements                                               | add elements                                                                                                                                |

## Fixing drift findings

Every finding says what differs and where the code shows it. Check its evidence, then fix the model,
or, when the difference is meant, add its ignore line with the true reason. This table gives the
usual fix of each `kind`.

| Kind                 | Means                                                                | Usual fix                                                                                                                       |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `missing-code`       | a code line names code the project does not have                     | correct the code line to the name the files use, or remove the element if the part is gone                                      |
| `renamed-code`       | the same, and the code has a unit by a close name that nothing names | change the code line to the new name, and the element's name and wording if they used the old one                               |
| `undrawn-code`       | a service, module or package that no element stands for              | add the element, worded like its siblings, with its code line and relationships; ignore it if left out on purpose               |
| `undrawn-connection` | the code joins two elements that no relationship joins               | add the relationship, at the finest grain the code shows, with a verb that says what happens                                    |
| `missing-connection` | a relationship that no call or connection in the code shows          | check the code: remove or redirect the relationship if the code is right; ignore it if drift cannot read the call               |
| `undrawn-dependency` | a build dependency between two elements with no `[code]` line        | add the `[code]` relationship                                                                                                   |
| `missing-dependency` | a `[code]` relationship that no build dependency shows               | remove it, or point it at the module the build depends on now                                                                   |
| `unanswered-calls`   | calls that no endpoint of the system answers                         | tell the user: nothing in the system answers them, so the code may need fixing; if they are meant, ignore the element, with why |
| `unused-ignore`      | an ignore line that excuses nothing any more                         | remove it, as its edit does                                                                                                     |
