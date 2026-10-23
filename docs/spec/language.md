# Lines: the Aerie diagram language

Lines is the text language authors use to describe a model. This document defines every line of it:
the grammar, what each line means, the canonical JSON model every file parses to, the plain-English
error catalogue, the formatter and the command-line tools. Meaning beyond the text itself (lifting,
audience resolution, what a view draws) is in [model.md](model.md).

Requirement ids: `LANG-nnn` for rules, `Ennn` and `Wnnn` for diagnostics. Conventions are in
[overview.md](overview.md#reading-this-spec).

## 1. A first look

```aerie
model shop: Corner shop
audiences owner "Owner" (default), developer "Developer" (code)

customer: Customer [person]

shop: Shop | Sells things online [system]
  web: Storefront | Where customers browse
    @developer: | Next.js app
  orders: Orders store [store]

customer buys from web
web saves orders in orders
  @developer: INSERTs rows into

view overview: Overview
  show customer, shop +1
```

- `customer: Customer [person]` declares an element with the id `customer`, the name "Customer" and
  the tag `person`. Indenting `web` under `shop` puts the Storefront inside the Shop.
- `customer buys from web` is a relationship. It reads as a sentence: the first word and the last word
  are element ids, everything between is the verb phrase.
- `@developer: INSERTs rows into` rewords the relationship above it for the Developer audience. Every
  other audience reads "saves orders in".
- `view overview` shows the customer and the shop opened one level.

The full file, with a scenario and a walkthrough, is [examples/shop.aerie](examples/shop.aerie); its
canonical JSON model is [examples/shop.json](examples/shop.json). The large worked example is
[examples/lotto.aerie](examples/lotto.aerie) (section 16).

## 2. Files, lines and blocks

- **LANG-001** A Lines file is UTF-8 text with the extension `.aerie`. A leading byte order mark is
  accepted and ignored. Lines end with LF or CRLF; both are accepted.
- **LANG-002** Every line is one of three things: a blank line (only spaces), a comment line, or a
  statement. Blank lines and comment lines never change the structure of the file.
- **LANG-003** A comment line starts with `//` after any indent. It runs to the end of the line. There
  are no comments at the end of other lines, so `//` inside a description or a URL is just text.
  Comments are recognised everywhere, including in the middle of a description that continues over
  several lines (LANG-010).
- **LANG-004** Indentation uses spaces only. A tab anywhere in a line's indent is an error (E001).
- **LANG-005** A statement belongs to the nearest statement above it with a smaller indent: its
  **owner**. A statement with no owner is at the **top level** and must have no indent. Statements
  that share an owner must share an indent (E002). The formatter indents each level by two spaces.
- **LANG-006** Which statements an owner may hold is fixed by this table. Anything else is out of
  place (E003).

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

- **LANG-007** The first characters of a statement decide what it is, in this order:
  1. `@` starts a rewording (section 6);
  2. `>` starts a description (LANG-010);
  3. a keyword followed by a space, or alone on its line, starts a keyword line: `model`,
     `audiences`, `view`, `scenario`, `walkthrough`, `step`, `show`, `kind`, `icon`, `open`,
     `close`, `for`, `system`, `repo`, `compose`, `code`, `ignore`;
  4. an id followed directly by `:` starts an element (section 4);
  5. an id followed by a space starts a sentence: a relationship at the top level, a step inside a
     scenario (sections 7 and 9);
  6. anything else cannot be read (E004).

  In rules 4 and 5, a first word that looks meant as an id but breaks LANG-008 (such as `Web` or
  `screen_api`) still decides what the line is, so it is reported as a wrong id (E005) or an unknown
  element (E008) rather than an unreadable line. A line of one word is unreadable.

- **LANG-008** An **id** is lowercase ASCII letters, digits and single hyphens, starting with a letter
  and not ending with a hyphen: `web`, `screen-api`, `v2-store`. Anything else is E005. Elements,
  views, scenarios and walkthroughs share one set of ids, and each id is used once (E007). Audience
  ids are a separate set. Tags and relationship kinds use the same spelling as ids. E005 is for a
  word that declares an id; a word that refers to something declared, but names nothing, is reported
  as unknown instead (E008, E301, E502, E503, E702), with a suggestion.
- **LANG-009** The keywords of LANG-007 cannot be used as ids (E006).
- **LANG-010** A **description** line is `>` followed by text. Each description line is one
  paragraph. A paragraph continues on the following lines that are indented deeper than the `>` line;
  each continuation line is trimmed and joined to the paragraph with one space. The text is a small
  Markdown subset: `**bold**`, `*italic*`, `` `code` `` and `[text](https://...)` links. Anything else
  is shown as plain text.
- **LANG-011** **Words** are the one-line texts: names, taglines, verb phrases and titles. Inside
  words, runs of spaces count as one space, leading and trailing spaces are dropped, and a backslash
  makes the next `|`, `[`, `]` or `\` an ordinary character. Descriptions have no backslash escapes.
- **LANG-012** Every keyword line, element line and rewording fits on one line. Only descriptions
  continue over several lines.

## 3. Grammar

The grammar below is EBNF over one statement at a time, after the indent is removed. The block
structure is LANG-005 and LANG-006. Where the grammar accepts a line that breaks a rule given in prose
(an unknown id, a duplicate), the prose rule and its diagnostic apply.

```ebnf
(* characters *)
lower      = "a" | "b" | ... | "z" ;
digit      = "0" | "1" | ... | "9" ;
sp         = " " , { " " } ;
id         = lower , { lower | digit } , { "-" , ( lower | digit ) , { lower | digit } } ;
number     = digit , { digit } ;
text       = { any character } ;                    (* to the end of the line *)
words      = text ;                                 (* LANG-011; must not be empty *)
list       = id , { [ sp ] , "," , [ sp ] , id } ;

(* statements *)
statement  = model | audiences | element | icon | view | show | kind
           | scenario | walkthrough | walk-step | open | close | for
           | system | repo | compose | code | ignore
           | description | rewording | sentence ;

model      = "model" , sp , id , [ sp ] , ":" , [ sp ] , words ;
audiences  = "audiences" , sp , audience , { [ sp ] , "," , [ sp ] , audience } ;
audience   = id , [ sp , '"' , { any character - '"' } , '"' ]
                , [ sp , "(" , flag , { [ sp ] , "," , [ sp ] , flag } , ")" ] ;
flag       = "default" | "code" ;

element    = id , ":" , [ sp ] , name , [ [ sp ] , "|" , [ sp ] , tagline ] , [ sp , tags ] ;
name       = words ;                                 (* up to an unescaped "|" or the tags *)
tagline    = words ;                                 (* up to the tags *)
tags       = "[" , [ sp ] , id , { sp , id } , [ sp ] , "]" ;   (* the last thing on the line *)
icon       = "icon" , sp , id ;

view       = "view" , sp , id , [ sp ] , ":" , [ sp ] , words ;
show       = "show" , sp , item , { [ sp ] , "," , [ sp ] , item } ;
item       = id , [ sp , "+" , number ] | "[" , [ sp ] , id , [ sp ] , "]" ;
kind       = "kind" , sp , list ;

scenario   = "scenario" , sp , id , [ sp ] , ":" , [ sp ] , words ;
walkthrough = "walkthrough" , sp , id , [ sp ] , ":" , [ sp ] , words ;
walk-step  = "step" , sp , id , [ [ sp ] , ":" , [ sp ] , ( list | range ) ] ;
range      = number , [ [ sp ] , "-" , [ sp ] , number ] ;
open       = "open" , sp , list ;
close      = "close" , sp , list ;
for        = "for" , sp , id ;

system     = "system" ;
repo       = "repo" , sp , path ;
compose    = "compose" , sp , path ;
path       = text ;                                 (* LANG-753; kept as written *)
code       = "code" , sp , unit , { sp , unit } ;
unit       = code-kind , ":" , unit-name ;          (* LANG-756 *)
code-kind  = "compose" | "maven" | "npm" | "class" ;
unit-name  = { any character - " " }- ;
ignore     = "ignore" , sp , "drift" , sp , subject , sp , "-" , sp , reason ;
subject    = end | end , sp , "to" , sp , end ;     (* LANG-759 *)
end        = id | unit ;
reason     = words ;

description = ">" , [ sp ] , text ;                  (* text must not be empty *)
rewording  = "@" , id , ( [ sp ] , ":" , [ sp ] , text
                        | [ sp ] , ">>" , [ sp ] , text
                        | [ sp ] , ">" , [ sp ] , text ) ;

sentence   = id , sp , verb , sp , { id , "," , sp } , id , [ sp , "[" , [ sp ] , id , [ sp ] , "]" ] ;
verb       = word , { sp , word } ;                  (* at least one word *)
word       = { any character - " " }- ;
```

- **LANG-013** A sentence is split on spaces. The first word is the subject. If the line ends with a
  bracket group, that group is the kind. The last remaining word is the object; a run of words ending
  in a comma just before it are further objects (`depends on strategies, formats, legacy`). The words
  between the subject and the objects are the verb phrase, and there must be at least one (E402).
- **LANG-014** After a `step` keyword and its target, text after the colon that is a number or two
  numbers joined by a hyphen is a range; otherwise it is a list of ids.

## 4. The model line and audiences

- **LANG-101** `model <id>: <title>` names the model. It is optional; a file has at most one (E101).
  Its owner block may hold descriptions (the model's description) and `@level:` rewordings of the
  title. Without a model line the model has no id and no title, and the reader sees the file name.
- **LANG-102** `audiences` declares who the wording is written for, in the order the audience switch
  shows them. Each audience is an id, an optional display name in double quotes, and optional flags in
  parentheses. Without a display name, the name is the id with its first letter in upper case. A file has
  at most one `audiences` line (E102); an audience is listed once (E103).
- **LANG-103** Without an `audiences` line the model has three audiences, exactly as if the file said
  `audiences exec "Executive", manager "Manager" (default), engineer "Engineer" (code)`.
- **LANG-104** The `(default)` flag marks the **default audience**: the one a reader starts with, and
  the voice of all unmarked wording. At most one audience is the default (E104). If none is marked, the
  first one listed is the default.
- **LANG-105** The `(code)` flag marks an audience that reads code-like wording. Its taglines, verbs
  and descriptions are set in the monospace face ([look.md](look.md#type)). Any number of audiences may
  have it. A flag other than `default` or `code` is E106.
- **LANG-106** A model has 1 to 6 audiences (E105).

```aerie
audiences board "Board", product "Product" (default), dev "Developer" (code), ops "Operations" (code)
```

## 5. Elements

- **LANG-201** An element line is `<id>: <name> | <tagline> [<tags>]`. The name is required (E011);
  the tagline and the tags are optional. The name is what the element is called; the tagline is a short
  line under the name that says what it does.
- **LANG-202** Indenting an element under another element makes it a **child** of that element. There
  is no limit to the depth of nesting.
- **LANG-203** Tags are words in one bracket group at the end of the line, separated by spaces:
  `[service module]`. Views select elements by tag (LANG-503). A repeated tag counts once.
- **LANG-204** Three tags carry meaning for Aerie: `person` (someone who uses the system), `external`
  (a system outside the one being described) and `store` (somewhere data is kept). What they change is
  in [model.md](model.md#elements-and-tags) and [look.md](look.md#shapes). Every other tag is the
  author's own.
- **LANG-205** `icon <name>` chooses the element's icon from Aerie's icon set
  ([look.md](look.md#icons)). An unknown name is E201; a second `icon` line on one element is E202.
  Without an `icon` line the icon follows the element's tags ([model.md](model.md#elements-and-tags)).
- **LANG-206** Description lines under an element describe it. They are shown in the side panel, not
  on the diagram.

```aerie
store: Results store | Keeps every past draw [service]
  icon cylinder
  > Downloads winning numbers, keeps every past draw, and answers the engine's questions.

  saved-draws: Saved draws | One file per game [store]
```

## 6. Rewording for an audience

Unmarked wording is what every audience reads. A rewording line changes one piece of wording for one
audience, and sits indented under the statement it rewords (its owner).

- **LANG-301** `@<audience>: <words>` replaces the owner's one-line wording for that audience:
  - under an element it is `@level: <name> | <tagline>`. Either part may be left empty to keep the
    unmarked one: `@exec: Number engine` changes only the name, `@engineer: | core-server :8002`
    changes only the tagline;
  - under a relationship or a scenario step it replaces the verb phrase;
  - under `model`, `view`, `scenario` or `walkthrough` it replaces the title;
  - under a walkthrough step it is E303, because a step has no one-line wording.

  A `|` in a rewording of anything but an element is also E303.

- **LANG-302** `@<audience> > <text>` replaces the owner's description for that audience. Several such
  lines for one audience give several paragraphs, in order.
- **LANG-303** `@<audience> >> <text>` adds a paragraph to the owner's description for that audience,
  after the description that audience would otherwise read. Several such lines add several paragraphs.
- **LANG-304** Both `>` forms continue over deeper-indented lines, like LANG-010.
- **LANG-305** The audience must be declared (E301). One owner has at most one `@level:` line per
  audience (E302). A `>>` without an audience is E304.
- **LANG-306** A rewording for the default audience is allowed: the default audience then reads it,
  and every audience without its own rewording still reads the unmarked wording.
- **LANG-307** There is no cascade between audiences: a rewording for `engineer` never changes what
  `manager` reads, whatever their order. The exact resolution rule is in
  [model.md](model.md#audience-resolution).

```aerie
engine: Analysis engine | Generates and scores picks [service]
  > The brains of the suite.
  @exec: Number engine | Turns past draws into suggested picks
  @exec > Where the value is: it studies every past draw and suggests numbers to play.
  @engineer: | lotto-options-core-server :8002
  @engineer >> Spring Boot on port 8002, one jar built from the modules in the Engineering view.
```

An executive reads "Number engine", "Turns past draws into suggested picks" and the one replaced
paragraph. A manager reads the unmarked name, tagline and paragraph. An engineer reads the unmarked
name, the new tagline, the unmarked paragraph and then the added one.

## 7. Relationships

- **LANG-401** A relationship is a sentence at the top level: `<subject> <verb phrase> <object>`. It
  reads aloud as written, with the element names in place of the ids: the line
  `website gets screen data from screen-api` reads "Website gets screen data from Screen API". Verb
  phrases are plain English and lower case by convention; Aerie shows them as written.
- **LANG-402** Both ends must be declared elements (E008). The object must be the last word, so the
  verb phrase is written to end before the object ("asks for picks from screen-api", never "asks
  screen-api for picks"). A last word that is not an element is E401 when it is not spelled as an
  id, or when a declared element appears in the verb phrase (the object was probably written in the
  middle); otherwise it is an unknown element, E008, as in the example of section 13.
- **LANG-403** Several objects separated by commas declare one relationship per object, in order, with
  the same verb phrase, kind, description and rewordings:
  `engine-service depends on strategies, formats, legacy [code]` declares three.
- **LANG-404** A bracket group at the end of a relationship is its **kind**, one id (E406). Without
  one, the kind is `runtime`. Views draw one or more kinds (LANG-504); `code` is the conventional kind
  for build-time dependencies.
- **LANG-405** A relationship joins two different elements (E403), neither inside the other (E404). The
  same subject, verb phrase, object and kind may be declared only once (E405). The same two elements
  may have several relationships with different verb phrases.
- **LANG-406** Relationships are declared once, at the finest grain the author knows, wherever the
  elements are nested. Views never list relationships; they are drawn between whatever is visible
  ([model.md](model.md#lifting)). Relationships may come before or after the elements they name.
- **LANG-407** A relationship's owner block may hold a description (shown in the side panel under the
  sentence) and rewordings of its verb phrase.

```aerie
history-lookup fetches draw history from history-service
  @engineer: POSTs /api/v1/state/games to
  > The engine's only way to get draw data.
```

## 8. Views

- **LANG-501** `view <id>: <title>` declares a view. Views appear in the reader's sidebar in the order
  they are declared, and the first is the one a reader sees first.
- **LANG-502** `show` lines list what the view shows. Items are separated by commas; several `show`
  lines add up. `<id>` shows that element; `<id> +N` shows it and its descendants down to N levels
  below it (`+0` is the element alone, `+1` adds its children). N is 0 to 99.
- **LANG-503** `[<tag>]` shows every element that has the tag. A tag no element has is E502.
- **LANG-504** `kind <kind>, ...` chooses which relationship kinds the view draws. Without a `kind`
  line, a view draws `runtime`. A kind that no relationship has (other than `runtime`) is E503.
- **LANG-505** A view without any `show` line shows every top-level element, unopened.
- **LANG-506** A model without any view has one, with the id `overview`, the title "Overview", no
  `show` line and the kind `runtime`. It is not written into the canonical model.
- **LANG-507** A view's owner block may hold descriptions (shown in the side panel when nothing is
  selected) and `@level:` rewordings of its title.
- **LANG-508** What a view draws, including the containers around the elements it shows, is defined in
  [model.md](model.md#view-resolution).

```aerie
view services: Services
  show user, suite +2, texas
view engineering: Engineering: code modules
  show [module]
  kind code
  @exec: How the code is organised
```

## 9. Scenarios

- **LANG-601** `scenario <id>: <title>` declares a scenario: how something happens, as ordered steps.
- **LANG-602** Each step is a sentence inside the scenario block, written like a relationship:
  `<subject> <verb phrase> <object>`. The subject acts; the object receives. A step has exactly one
  object (E602) and no kind (E603). Its ends may be elements at any depth.
- **LANG-603** A step's owner block may hold a description (the step's caption when it plays) and
  rewordings of its verb phrase and caption.
- **LANG-604** A scenario has at least one step (E601). Steps are numbered from 1 in the order they
  are written.
- **LANG-605** A reply is written as its own step, such as
  `history-service returns the full history to history-lookup`. Aerie recognises replies from the
  model ([model.md](model.md#scenarios)); there is no reply syntax.
- **LANG-606** A step whose two elements have no relationship in either direction in the model is
  allowed, and gets warning W601. This keeps scenarios honest against the model.
- **LANG-607** At least one view must show every element a scenario names, or a container around it,
  so that the scenario has somewhere to play ([model.md](model.md#scenarios)). A scenario no view can
  hold is E604.

```aerie
scenario results-poll: Results poll
  > How the suite keeps its draw history current.
  updater downloads new results from texas
    > One file per game, a few at a time, with retries.
    @engineer >> 17 games, 4 at a time, at most 4 downloads a second, 3 attempts each.
  texas returns one file per game to updater
```

## 10. Walkthroughs

- **LANG-701** `walkthrough <id>: <title>` declares a walkthrough: a narrated run through views and
  scenarios, presented one step at a time.
- **LANG-702** `step <view>` shows a view. `step <view>: <id>, ...` shows it and focuses on those
  elements, which must be visible in the step's picture (E703).
- **LANG-703** `step <scenario>` plays a whole scenario. `step <scenario>: <n>` plays its step n, and
  `step <scenario>: <n>-<m>` plays steps n to m. The numbers must exist and n must not be after m
  (E706). Element ids after a scenario are E705; a range after a view is E704. A target that is
  neither a view nor a scenario is E702.
- **LANG-704** Inside a step: `open <id>, ...` opens those elements in place and `close <id>, ...`
  closes them, before the step is shown. Each must have children (E707) and be declared (E008).
- **LANG-705** Inside a step: `for <audience>` switches the audience when the step is shown. A step has
  at most one `for` line (E708).
- **LANG-706** A step's descriptions are its narration, the caption the presenter's room reads. They
  may be reworded per audience with `@level >` and `@level >>`.
- **LANG-707** A walkthrough has at least one step (E701). How steps combine into pictures (which view
  a scenario plays on, what carries over from one step to the next) is in
  [model.md](model.md#walkthroughs).

```aerie
walkthrough tour: A tour of the Lotto suite
  step big-picture: engine
    > The **Analysis engine** does the thinking.
    @exec > The **engine** is where the value is.
  step services: pick-generation
    open engine-service
    for engineer
    > Inside the engine, **Pick generation** runs the chosen strategy.
  step generate-picks: 1-4
    > Follow the first four moves of one request.
```

## 11. Checking against the code

Three kinds of line tie a model to the code it describes, so that `aerie drift` can report where the
diagram and the project no longer match. What drift does with them is in [drift.md](drift.md); this
section defines only the lines.

- **LANG-751** `system` blocks, `code` lines and `ignore` lines never change what a reader sees: no
  view, audience, zoom state, scenario, walkthrough, layout or drawing depends on them
  ([model.md](model.md#elements-and-tags), MODEL-006). Only `aerie drift` reads them, and a model
  without them is valid.

### The system root

```aerie
model shop: Corner shop

system
  repo .
  repo ../shop-web
  compose deploy/compose.yaml

web: Storefront
```

- **LANG-752** `system` alone on its line starts the **system root**: the repos and Compose files
  that form the system. Its block holds only `repo` and `compose` lines, and at least one (E803).
  Nothing follows the keyword on its line (E801). A file has at most one `system` block (E802); by
  convention it comes right after the `model` and `audiences` lines.
- **LANG-753** `repo <path>` names a repository that is part of the system, as a path from the
  folder that holds the `.aerie` file, with forward slashes: `repo .` is the repository the file is
  in, `repo ../shop-web` one beside it. A path that is absolute, starts with `~`, is a web address
  or uses backslashes is E804. The path is the rest of the line, kept as written; `.` parts, `..`
  parts and a trailing `/` do not make a different path, so listing the same folder twice is E103.
  Without any `repo` line, the system is the repository that holds the file.
- **LANG-754** `compose <path>` names an authoritative Compose file, a path written as for `repo`
  (E804, E103). Several `compose` lines are read together, in order, as Compose itself reads several
  files. When the block has `repo` lines, each Compose file is inside one of those repos (E805), by
  its path alone: the parser never looks at the file system.

### Code lines

```aerie
shop: Shop [system]
  web: Storefront [service]
    code compose:web npm:shop-web
  api: Orders API [service]
    code compose:api maven:orders-api
    pricing: Pricing rules
      code class:com.shop.orders.pricing.*
```

- **LANG-755** `code <unit> <unit> ...` inside an element names the code that element stands for,
  each unit separated by spaces. An element may have several `code` lines; their units add up, in
  the order written. A `code` line with nothing after the keyword is E010.
- **LANG-756** A **code unit** is a kind, a colon and a name, with no spaces. A word without a colon
  is E806; a kind other than these is E807; a name the kind does not allow is E808 (its rule is in
  the E808 table below):

  | Kind      | Names                                                                                             | Example                   |
  | --------- | ------------------------------------------------------------------------------------------------- | ------------------------- |
  | `compose` | a service of the system's Compose files                                                           | `compose:orders-api`      |
  | `maven`   | a Maven module, by its artifactId                                                                 | `maven:orders-core`       |
  | `npm`     | a Node or Angular app or package, by the `name` in its package.json                               | `npm:@shop/orders-web`    |
  | `class`   | a class, simple or qualified, or with `.*` every class in a package: hints for an element's parts | `class:com.shop.orders.*` |

- **LANG-757** A code unit belongs to one element. Naming it twice for one element is E103; naming
  it for a second element is E809. An element drawn above the level of the code (a service built
  from several modules, say) lists every unit it stands for.

### Ignore lines

```aerie
web: Storefront
api: Orders API
web calls api

ignore drift maven:orders-legacy - retiring with the desktop app
ignore drift web to api - only in local development, through the dev proxy
```

- **LANG-758** `ignore drift <subject> - <reason>` at the top level tells `aerie drift` that a
  difference between the diagram and the code is meant. The reason follows the first `-` that has a
  space on both sides, and is required (E811), so a reviewer reads why. It is plain text to the end
  of the line, in which runs of spaces count as one. A line that does not start `ignore drift` and
  name a subject is E810.
- **LANG-759** The subject is one **end**, an element id or a code unit, or two ends joined by `to`
  (`web to api`, `web to compose:payments`), which is the connection from the first to the second.
  Anything else is E812; an element id must be declared (E008); two ends that are the same are E813.
  A subject is ignored once, written the same way (E814).

## 12. The canonical JSON model

Every valid Lines file parses to one canonical JSON model. Tools, the renderer and any future importer
use this model; nothing reads Lines except the parser and the formatter. The model is a faithful
transcription of the file: selectors, defaults that need the whole model (icons from tags, the default
view) and meaning (lifting, replies) are worked out later, as in [model.md](model.md).

- **LANG-801** The model has exactly the shape below, written as TypeScript types. Every field is
  always present; there are no other fields.

```ts
type Id = string; // LANG-008

interface Words {
  base: string | null; // the unmarked wording, or null when there is none
  set: Record<Id, string>; // replacements, keyed by audience id (LANG-301)
}

interface Prose {
  base: string | null; // paragraphs joined by "\n\n", or null
  set: Record<Id, string>; // replacing paragraphs per audience (LANG-302)
  add: Record<Id, string>; // added paragraphs per audience (LANG-303)
}

interface Model {
  format: 'aerie-model/1';
  id: Id | null;
  title: Words;
  about: Prose;
  audiences: Audience[];
  defaultAudience: Id;
  system: System | null; // null without a system block
  elements: Element[];
  relationships: Relationship[];
  views: View[];
  scenarios: Scenario[];
  walkthroughs: Walkthrough[];
  ignores: Ignore[];
}

interface Audience {
  id: Id;
  name: string;
  code: boolean;
}

interface Element {
  id: Id;
  parent: Id | null;
  name: Words; // base is never null
  tagline: Words;
  tags: Id[];
  icon: string | null; // only what an icon line says
  code: CodeUnit[]; // what its code lines name
  about: Prose;
}

interface System {
  repos: string[]; // paths as written
  compose: string[];
}

interface CodeUnit {
  kind: 'compose' | 'maven' | 'npm' | 'class';
  name: string;
}

interface Relationship {
  subject: Id;
  verb: Words; // base is never null
  object: Id;
  kind: Id;
  about: Prose;
}

interface View {
  id: Id;
  title: Words;
  about: Prose;
  show: ShowItem[];
  kinds: Id[];
}

type ShowItem = { element: Id; depth: number } | { tag: Id };

interface Scenario {
  id: Id;
  title: Words;
  about: Prose;
  steps: Step[];
}

interface Step {
  subject: Id;
  verb: Words;
  object: Id;
  about: Prose;
}

interface Walkthrough {
  id: Id;
  title: Words;
  about: Prose;
  steps: WalkStep[];
}

interface WalkStep {
  target: Id; // a view id or a scenario id
  focus: Id[];
  range: { from: number; to: number } | null; // "n" alone gives from = to = n
  open: Id[];
  close: Id[];
  audience: Id | null;
  about: Prose;
}

interface Ignore {
  subject: Subject;
  reason: string;
}

type Subject = End | { from: End; to: End };
type End = { element: Id } | { unit: CodeUnit };
```

- **LANG-802** `audiences` always lists the model's audiences, including the three of LANG-103 when
  the file has no `audiences` line. `defaultAudience` is always set.
- **LANG-803** Elements are listed depth first in the order they are written, each parent before its
  children. Relationships, views, scenarios, steps and walkthroughs are listed in the order they are
  written; a multi-object relationship becomes one entry per object (LANG-403).
- **LANG-804** Text is normalised as LANG-010 and LANG-011 say. Empty `Words` are
  `{ "base": null, "set": {} }`; empty `Prose` are `{ "base": null, "set": {}, "add": {} }`. `set`
  and `add` keys follow the order of the audiences.
- **LANG-805** A `show` item with no depth has depth 0. A view with no `kind` line has
  `"kinds": ["runtime"]`. `kinds` keeps the order written, each kind once.
- **LANG-806** The canonical serialisation is the model written with keys in the order of LANG-801,
  indented by two spaces, with a final newline (what `JSON.stringify(model, null, 2) + "\n"` produces
  from an object built in that key order). Two equal models serialise to the same bytes. The example
  [examples/shop.json](examples/shop.json) is exact.
- **LANG-807** Positions in the source are not part of the model. The parser also returns a source
  map from each model location (a JSON Pointer such as `/elements/2/tagline`) to the line and column
  span it came from, for the editor and for diagnostics.
- **LANG-808** A file with errors has no canonical model. The parser still returns every diagnostic it
  found (LANG-902).
- **LANG-809** Code units, repos, Compose files and ignore lines are listed in the order they are
  written. Paths are kept as written (LANG-753); in reasons, runs of spaces become one (LANG-758). A model
  with no `system` block has `"system": null`, an element with no `code` line `"code": []`, and a
  file with no `ignore` line `"ignores": []`. These fields were added after 1.0 and keep the format
  `aerie-model/1`: a reader of 1.0 models finds every field it knows, unchanged.

## 13. Diagnostics

### Rules

- **LANG-901** A diagnostic has an id from the catalogue below, a severity (`error` or `warning`), a
  message, and a span: a start line and column, and an end line and column just after the last
  character of the span. Lines and columns count from 1, and columns count Unicode code points. An
  error means the file has no model (LANG-808); a warning does not.
- **LANG-902** The parser reads the whole file and reports every problem it finds, sorted by line, then
  column, then id. After a statement it cannot read, it skips that statement's indented block and
  carries on, so one mistake does not cause a cascade.
- **LANG-903** Every message comes from this catalogue, word for word, with the placeholders filled.
  Messages are plain English: they say what is wrong and how to fix it, use the author's own ids in
  backticks, and never use the words "token", "parse", "syntax", "unexpected", "EOF", "null" or
  "undefined".
- **LANG-904** A suggestion "Did you mean ...?" is added when a declared id of the right sort is within
  two edits (insertions, deletions, substitutions or swaps of neighbours) of the unknown one and closer
  than half its length. The closest wins; ties go to the one declared first. When the unknown word is
  within two edits of a keyword and is not an element id, E008 suggests the keyword instead, and it is
  the only diagnostic reported for that line.
- **LANG-905** Placeholders: `{id}`, `{word}` and similar are the author's text, with runs of spaces
  written as one; `{line}` is a line number; `{list}` is a comma-separated list in declaration
  order; `{suggestion}` is the whole sentence " Did you mean `x`?" or nothing.

### Catalogue

| Id   | Severity | Message                                                                                                                                                                                     | Points at               |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| E001 | error    | This line is indented with a tab. Indent with spaces instead.                                                                                                                               | the first tab           |
| E002 | error    | This line's indent does not line up with the lines above it. Indent it by the same amount as the other lines in its block.                                                                  | the indent              |
| E003 | error    | One of the out-of-place messages below.                                                                                                                                                     | the first word          |
| E004 | error    | Aerie cannot read this line. A line starts with an element id and a colon, a keyword such as `view`, `>` for a description, `@` for an audience's wording, or an element id for a sentence. | the first character     |
| E005 | error    | `{text}` cannot be an id. Ids use lowercase letters, digits and single hyphens, start with a letter, and do not end with a hyphen.                                                          | the id                  |
| E006 | error    | `{id}` is a word Lines uses for itself, so it cannot be an id. Choose another id.                                                                                                           | the id                  |
| E007 | error    | `{id}` is already used on line {line}. Every element, view, scenario and walkthrough needs its own id.                                                                                      | the second id           |
| E008 | error    | There is no element called `{id}`.{suggestion}                                                                                                                                              | the id                  |
| E009 | error    | This `[` has no closing `]`.                                                                                                                                                                | the `[`                 |
| E010 | error    | There is no text after `{marker}`. Add the wording, or remove the line.                                                                                                                     | the marker              |
| E011 | error    | Give `{id}` a {name or title} after the colon, as in `{example}`.                                                                                                                           | the end of the line     |
| E012 | error    | The tags in brackets end the line, so `{text}` cannot come after them. Move it before the `[`, or write `\[` and `\]` to use brackets in the wording.                                       | the text after the `]`  |
| E013 | error    | These brackets are empty. Put a tag inside, such as `[service]`, or remove them.                                                                                                            | the brackets            |
| E014 | error    | This list has an empty item. Remove the extra comma.                                                                                                                                        | the comma               |
| E101 | error    | There is already a `model` line on line {line}. A file describes one model.                                                                                                                 | the keyword             |
| E102 | error    | There is already an `audiences` line on line {line}. List every audience on one line.                                                                                                       | the keyword             |
| E103 | error    | `{id}` is listed twice.                                                                                                                                                                     | the second one          |
| E104 | error    | Only one audience can be the default, but `{first}` and `{second}` are both marked `(default)`.                                                                                             | the second flag         |
| E105 | error    | A model can have at most 6 audiences, and this line lists {count}.                                                                                                                          | the seventh audience    |
| E106 | error    | `({flag})` is not something an audience can be. Use `(default)`, `(code)`, or both, as in `(default, code)`.                                                                                | the flag                |
| E107 | error    | Aerie cannot read the audience `{text}`. Write an id, then an optional name in double quotes and optional flags in parentheses, as in `dev "Developer" (code)`.                             | the audience            |
| E201 | error    | There is no icon called `{name}`.{suggestion} The icons are: {list}.                                                                                                                        | the name                |
| E202 | error    | `{id}` already has an icon, on line {line}. Keep one `icon` line.                                                                                                                           | the keyword             |
| E301 | error    | There is no audience called `{id}`.{suggestion} The audiences are {list}.                                                                                                                   | the audience id         |
| E302 | error    | There is already `@{audience}:` wording for this on line {line}. Keep one.                                                                                                                  | the `@`                 |
| E303 | error    | One of the rewording messages below.                                                                                                                                                        | the `@`                 |
| E304 | error    | `>>` adds a paragraph for one audience. Name the audience, as in `@{audience} >> {text}`.                                                                                                   | the `>>`                |
| E401 | error    | A sentence must end with the element it points to, and `{word}` is not an element.{suggestion}{moved}                                                                                       | the last word           |
| E402 | error    | A sentence needs an element, a verb phrase and another element, as in `web calls api`.                                                                                                      | the line                |
| E403 | error    | A relationship joins two different elements, but this one starts and ends at `{id}`.                                                                                                        | the line                |
| E404 | error    | `{inner}` is inside `{outer}`, so a relationship between them would never be drawn. The nesting already shows that `{outer}` holds `{inner}`.                                               | the line                |
| E405 | error    | This relationship is already declared on line {line}.                                                                                                                                       | the line                |
| E406 | error    | A relationship has one kind in brackets, such as `[code]`, and this one has {count}.                                                                                                        | the bracket group       |
| E501 | error    | `{item}` is not something a view can show. Use an element id, an id with a depth such as `{id} +1`, or a tag in brackets such as `[service]`.                                               | the item                |
| E502 | error    | No element has the tag `[{tag}]`.{suggestion}                                                                                                                                               | the tag                 |
| E503 | error    | No relationship has the kind `{kind}`.{suggestion}                                                                                                                                          | the kind                |
| E601 | error    | The scenario `{id}` has no steps yet. Add sentences under it, such as `{example}`.                                                                                                          | the keyword             |
| E602 | error    | A scenario step goes to one element, and this one lists {count}. Write one step for each.                                                                                                   | the second object       |
| E603 | error    | A scenario step has no kind. Remove `[{kind}]`.                                                                                                                                             | the bracket group       |
| E604 | error    | No view can show every step of `{id}`, because none shows `{element}` or anything around it. Add `{top}` to a view's `show` line.                                                           | the id                  |
| W601 | warning  | No relationship joins `{subject}` and `{object}` in the model. Add one, such as `{subject} {verb} {object}`, or check this step.                                                            | the line                |
| E701 | error    | The walkthrough `{id}` has no steps yet. Add a line such as `step {view}`.                                                                                                                  | the keyword             |
| E702 | error    | There is no view or scenario called `{id}`.{suggestion}                                                                                                                                     | the id                  |
| E703 | error    | `{id}` is not visible in this step's picture of `{view}`, so the step cannot focus on it. Open its container with `open {container}`, or choose a view that shows it.                       | the id                  |
| E704 | error    | `{view}` is a view, so this step takes element ids after the colon, not step numbers.                                                                                                       | the range               |
| E705 | error    | `{scenario}` is a scenario, so this step takes step numbers after the colon, such as `{scenario}: 1-3`, not element ids.                                                                    | the first id            |
| E706 | error    | The steps of `{scenario}` run from 1 to {count}, so `{range}` cannot be played.                                                                                                             | the range               |
| E707 | error    | `{id}` has nothing inside it to open or close.                                                                                                                                              | the id                  |
| E708 | error    | This step already switches the audience, on line {line}. Keep one `for` line.                                                                                                               | the keyword             |
| E801 | error    | Nothing goes after `system` on its line. Put each repo and Compose file on its own line under it, such as `repo ../orders-api`.                                                             | the text after `system` |
| E802 | error    | There is already a `system` block on line {line}. Declare the system once, with all its repos and Compose files.                                                                            | the keyword             |
| E803 | error    | The `system` block lists nothing yet. Add a `repo` or `compose` line under it, such as `repo ../orders-api`.                                                                                | the keyword             |
| E804 | error    | `{path}` is not a path from this file's folder. Write it relative to the folder that holds this file, with forward slashes, such as `../orders-api`.                                        | the path                |
| E805 | error    | `{path}` is not inside any repo of the system. Add a `repo` line for the repo that holds it, or correct the path.                                                                           | the path                |
| E806 | error    | `{text}` does not say what kind of code it is. Write the kind and a colon first, as in `compose:{text}`.                                                                                    | the word                |
| E807 | error    | There is no kind of code called `{kind}`.{suggestion} The kinds are {list}.                                                                                                                 | the kind                |
| E808 | error    | `{unit}` does not name {what}. {how}                                                                                                                                                        | the unit                |
| E809 | error    | `{unit}` is already the code of `{id}`, on line {line}. A code unit belongs to one element.                                                                                                 | the second unit         |
| E810 | error    | An `ignore` line says `ignore drift`, what to ignore, a hyphen with a space on each side, and why, as in `ignore drift maven:legacy - retiring with the desktop app`.                       | the line                |
| E811 | error    | Say why this drift is ignored: end the line with a hyphen, a space and the reason, as in `ignore drift {subject} - retiring next year`.                                                     | the end of the line     |
| E812 | error    | `{subject}` is not something drift can ignore. Write an element id, a code unit such as `maven:legacy`, or two of them joined by `to`, such as `web to api`.                                | the subject             |
| E813 | error    | `{subject}` joins `{end}` to itself. Ignore drift between two different things.                                                                                                             | the subject             |
| E814 | error    | Drift for `{subject}` is already ignored on line {line}. Keep one `ignore` line.                                                                                                            | the subject             |
| W001 | warning  | This file has no elements yet. Start with a line such as `web: Website`.                                                                                                                    | line 1, column 1        |

E003 messages, chosen by the line and its owner:

| When                                                                                         | Message                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `model`, `audiences`, `system`, `view`, `scenario`, `walkthrough` or `ignore` with an indent | `{keyword}` lines go at the top level, with no indent.                                                                  |
| `show` or `kind` outside a view                                                              | `{keyword}` lines go inside a view.                                                                                     |
| `icon` or `code` outside an element                                                          | `{keyword}` lines go inside an element.                                                                                 |
| `repo` or `compose` outside a `system` block                                                 | `{keyword}` lines go inside the `system` block.                                                                         |
| `step` outside a walkthrough                                                                 | `step` lines go inside a walkthrough.                                                                                   |
| `open`, `close` or `for` outside a walkthrough step                                          | `{keyword}` lines go inside a walkthrough step.                                                                         |
| an element under anything but the top level or an element                                    | An element goes at the top level or inside another element.                                                             |
| a sentence under anything but the top level or a scenario                                    | A sentence goes at the top level, as a relationship, or inside a scenario, as a step.                                   |
| a description at the top level                                                               | A `>` description needs something to describe. Indent it under the element, relationship, view or scenario it is about. |
| a rewording at the top level                                                                 | A `@{audience}` line rewords the line it is indented under. Indent it under the line it rewords.                        |
| anything under a line that holds nothing                                                     | Nothing can go inside a `{kind}` line. Remove the extra indent.                                                         |

E303 messages:

| When                                   | Message                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@level:` under a walkthrough step     | A walkthrough step has no title to reword. Reword its narration with `@{audience} >` or `@{audience} >>`. |
| a `\|` in a rewording of a non-element | Only an element has a tagline after `\|`. Here `@{audience}:` rewords the {verb phrase or title} alone.   |

E808 wording, by the kind of the unit (LANG-756):

| Kind      | `{what}`          | `{how}`                                                                                                                                         |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `compose` | a Compose service | A service name uses letters, digits, `.`, `_` and `-`, as in `compose:orders-api`.                                                              |
| `maven`   | a Maven module    | Write the module's artifactId, which uses letters, digits, `.`, `_` and `-`, as in `maven:orders-core`.                                         |
| `npm`     | an npm package    | Write the `name` from its package.json, in lower case, as in `npm:orders-web` or `npm:@shop/orders-web`.                                        |
| `class`   | a class           | Write a class name, as in `class:OrderService` or `class:com.shop.orders.OrderService`, or a package and `.*`, as in `class:com.shop.orders.*`. |

Placeholders that need a rule:

- `{marker}` in E010 is what has nothing after it: `>`, `|`, a rewording's `@level:`, `@level >` or
  `@level >>`, a keyword such as `show`, `code` or `repo`, or a walkthrough step's `step <target>:`.
- `{id}` in E103 is what is listed twice: an audience id, a path as written in the `system` block,
  or a code unit as `kind:name`. `{text}` in E806 is the word without a colon it starts with (`:web`
  gives `web`). `{list}` in E807 is the kinds of LANG-756, in order.
- `{subject}` in E811 to E814 is the subject as written, with runs of spaces written as one; `{end}`
  in E813 is the end named twice.
- `{example}` in E011 is the line with a name or title made from the id: hyphens become spaces and the
  first letter is upper case (`screen-api` gives `screen-api: Screen api`; `view big-picture` gives
  `view big-picture: Big picture`). In E601 it is `{first element id} uses {second element id}` from
  the model, or `web calls api` when the model has fewer than two elements. E011, E601 and E701 are
  not reported when the line's id is itself in error (E005, E006).
- `{moved}` in E401 is, when a declared element id appears inside the verb phrase, the sentence " If
  you meant `{that id}`, reword the line so `{that id}` comes last." and otherwise nothing.
- `{container}` in E703 is the outermost closed ancestor of the element in that picture. In general it
  is the first container that revealing the element would open (MODEL-207), which also covers a
  container open only partly; when nothing around the element is drawn, it is the element's top-level
  ancestor (or the element itself when it is top level).
- `{audience}` in E304 is the last declared audience; in E303 it is the audience of the line.
- `{verb}` in W601 is the step's own verb phrase.
- `{element}` in E604 is the first participant, in step order, that no view can hold, and `{top}` is
  its top-level ancestor (or itself when it is top level). When every participant fits some view but
  no view fits them all, `{element}` is the first participant missing from the view that holds the
  most participants (the first such view in declaration order).

Two examples as the command line prints them (LANG-962), from the Lotto sample with `screen-api`
misspelled `screen-apu` on line 168:

```text
lotto.aerie:168:31: error E008: There is no element called `screen-apu`. Did you mean `screen-api`?
lotto.aerie:281:3: warning W601: No relationship joins `updater` and `saved-draws` in the model. Add one, such as `updater saves draws into saved-draws`, or check this step.
```

## 14. The formatter and the printer

The **formatter** rewrites a Lines file in one stable style and keeps everything the author wrote,
comments included. The **printer** writes a canonical model as Lines; it is used by tools that make
models, such as a future importer.

- **LANG-931** The formatter changes only spacing: it never reorders, adds or removes statements or
  comments, and never changes words.
- **LANG-932** Indentation is two spaces per level of ownership. A description's continuation lines
  are indented two spaces deeper than the line they continue, and the author's line breaks inside a
  description are kept.
- **LANG-933** Inside a statement, runs of spaces become one space, except inside description text,
  quoted audience names and the paths of `repo` and `compose` lines, which are kept as written. The
  formatter writes: `id: Name | tagline [a b]`, `> text`, `@level: words`, `@level > text`,
  `@level >> text`, `subject verb object, object [kind]`, `show a, b +2, [tag]`, `kind a, b`,
  `step target: a, b`, `step target: 3-6`, `open a, b`, `audiences a "A" (default, code), b "B"`,
  `code kind:name kind:name`, `repo path`, `ignore drift a to b - reason`.
- **LANG-934** A comment line is indented like the next statement after it, or not at all at the end
  of the file. Its text after `//` is kept as written.
- **LANG-935** Runs of blank lines become one blank line. The file starts with its first non-blank
  line, has no trailing spaces, uses LF line endings, has no byte order mark, and ends with exactly one
  newline.
- **LANG-936** The formatter formats any file whose lines and blocks can be read, even one with other
  errors. If a file has E001, E002 or E004, the formatter leaves it unchanged and reports those
  diagnostics.
- **LANG-937** The printer writes, in order: the `model` line and its description; the `audiences`
  line (always); the `system` block, when there is one, with its `repo` lines and then its `compose`
  lines; the elements, depth first, each followed by its `icon` line, one `code` line with all its
  units, descriptions, then for each audience in order its `@level:` line, `@level >` lines and
  `@level >>` lines; the relationships, one per line; the views; the scenarios; the walkthroughs;
  the `ignore` lines. Top-level blocks are separated by one blank line; the relationships are one
  block, and so are the `ignore` lines. Each paragraph is printed on one line. Kinds are printed only
  when not `runtime`; depths only when not 0.
- **LANG-938** Formatting is idempotent: formatting a formatted file changes nothing.
- **LANG-939** Formatting keeps the meaning: a file and its formatted version have equal canonical
  models, and the same diagnostics apart from positions.
- **LANG-940** Every committed sample (`samples/*.aerie`) and every example in this spec is already
  formatted: formatting it changes nothing.
- **LANG-941** Printing round-trips: for every valid model, parsing the printed text gives an equal
  model, and formatting the printed text changes nothing.

## 15. Command-line tools

The parser, checker and formatter run from the command line, for authors, CI and the Aerie skill for
Claude ([claude-skill.md](claude-skill.md)). Checking a model against the code, `aerie drift`, is
specified in [drift.md](drift.md). The command is `aerie`, run inside the repository as
`npx aerie`. Watch mode is in [interaction.md](interaction.md#watch-mode).

- **LANG-961** `aerie check <file>...` reads each file and reports every diagnostic, including the
  ones that need the model's meaning (such as E604 and E703), sorted as LANG-902 says.
- **LANG-962** By default it prints one line per diagnostic,
  `<path>:<line>:<column>: <severity> <id>: <message>`, then a summary line: `No problems found.` when
  there are none, otherwise the counts, such as `2 errors and 1 warning.` or `1 warning.`
- **LANG-963** `aerie check --format json` prints one JSON document instead:

  ```json
  {
    "files": [
      {
        "path": "samples/lotto.aerie",
        "diagnostics": [
          {
            "id": "W601",
            "severity": "warning",
            "line": 281,
            "column": 3,
            "endLine": 281,
            "endColumn": 39,
            "message": "No relationship joins `updater` and `saved-draws` in the model. Add one, such as `updater saves draws into saved-draws`, or check this step."
          }
        ]
      }
    ],
    "errors": 0,
    "warnings": 1
  }
  ```

- **LANG-964** `aerie format <file>...` formats each file in place. With `--check` it changes nothing
  and lists the files that would change. With `--stdout` it prints the formatted text of one file.
  `aerie fmt` is a short form of `aerie format`.
- **LANG-965** `aerie model <file>` prints the canonical model (LANG-806) of a valid file.
- **LANG-966** Exit codes: 0 when there are no errors (warnings are allowed) and, for `--check`, no
  file would change; 1 when there are errors or a file would change; 2 when the command cannot run (a
  missing file, an unknown option). Messages for exit code 2 are plain English too, such as
  `There is no file called lotto.aere.`

## 16. Worked example: the Lotto suite

[examples/lotto.aerie](examples/lotto.aerie) describes a lottery number service in about 300 lines:
18 elements nested up to four deep, 16 relationship lines that declare 18 relationships (six of them
build-time `code` dependencies), three views, two scenarios with 20 steps between them, and a
walkthrough of 8 steps. It has wording for three audiences. It was the first committed sample (slice
A2); slice A11 refined `samples/lotto.aerie` from it against the Lotto code, and this file stays as
the spec's worked example.

Highlights:

- **Relationships are written once, at the finest grain.** The line
  `screen-api requests analysis from request-handling` names a part three levels deep. The Big
  picture view never mentions it, yet draws "Screen API requests analysis from Analysis engine",
  because Request handling is inside the engine ([model.md](model.md#worked-example-lotto)).
- **Audience wording is sparse.** Of about 150 pieces of wording, 11 have executive wording, 54 have
  engineer wording and none have manager wording: the manager is the default audience, so the unmarked
  text is written in the manager's voice. Most engineer wording adds a paragraph with `@engineer >>`.
- **Views are short.** `show user, suite +1, texas` gives the Big picture; `show [module]` with
  `kind code` gives the code modules.
- **Scenarios are checked.** The Results poll step `updater saves draws into saved-draws` has no
  matching relationship (the model says the reader saves the draws), so `aerie check` reports W601. The
  sample keeps this on purpose until its author settles which part saves the draws.
- **The walkthrough mixes views and a scenario**, opens the engine service in place for one step, and
  rewords its narration for executives and engineers.

The canonical model of this file is produced by slice A2 and kept as a golden; it is not repeated
here. The small example in section 1 has its full canonical model in
[examples/shop.json](examples/shop.json).
