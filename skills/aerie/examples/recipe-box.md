# Worked example 1: Recipe box

A made-up project, small enough to read in full, taken through every step of the workflow, and then
through a change to its code. The finished model is
[recipe-box/architecture.aerie](recipe-box/architecture.aerie), at the project's root as the skill
writes it. The folder holds the project's deployment and build files, the ones drift reads; its
Python code is only described below.

## 1. Scope

The user asked: "Describe this repo as an Aerie diagram." One system, the default three audiences,
and the file goes to `architecture.aerie` at the project root. Nothing was unclear, so nothing was
asked.

## 2. What the project showed

Read in the workflow's order. Each line says what it gave the model.

| File                                         | What it showed                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                  | "Save recipes, plan your week, get your shopping list by email." The user is a home cook.                                     |
| `compose.yaml`                               | Three services: `web` (port 3000 published), `api` (8000, not published), `db` (postgres:16, volume `pgdata`).                |
| `compose.yaml`, again                        | A fourth, `mailpit`, "for development only: catches the email the API sends". `api` sends mail to it through `MAIL_API_URL`.  |
| `web/Dockerfile`, `web/nginx.conf`           | nginx serves the built app and passes `/api/*` to `api:8000`. So the web app calls the API, and the browser never does.       |
| `web/package.json`                           | The package `recipe-web`, React 19 and Vite.                                                                                  |
| `api/pyproject.toml`                         | FastAPI. One package, so one deployable service.                                                                              |
| `api/routes/recipes.py`                      | `GET` and `POST /api/recipes`, `GET /api/recipes/search`. Writes the `recipes` table.                                         |
| `api/routes/plans.py`, `api/routes/lists.py` | `PUT /api/plans/{week}` saves a plan; `POST /api/lists/send` reads the week's recipes, builds the list and calls `send_list`. |
| `api/mail.py`                                | `send_list` posts the message to an outside email API, using `MAIL_API_KEY` and `MAIL_FROM`. No provider is named.            |
| `api/migrations/`                            | Tables `recipes`, `ingredients`, `plans`.                                                                                     |
| `tests/test_lists.py`                        | `test_send_list_emails_the_cook`: the one flow the tests care about.                                                          |

## 3. Inventory

Written out before any Lines, so the structure can be judged on its own.

**Elements** (indent shows nesting):

- `cook` Home cook `[person]` (README)
- `recipe-box` Recipe box `[system]` (compose.yaml)
  - `web` Web app `[service]` (compose.yaml, web/)
  - `api` Recipe API `[service]` (compose.yaml, api/)
    - `recipes` Recipe handling `[module]` (routes/recipes.py)
    - `planner` Meal planner `[module]` (routes/plans.py, routes/lists.py)
    - `mailer` Mailer `[module]` (mail.py)
  - `db` Recipe database `[store]` (compose.yaml, migrations/)
- `mail` Email service `[external]` (mail.py; provider unknown, so an `// Unsure:` line)

`mailpit` is left out: it is a development tool, not part of the running system the README
describes.

**Code lines**, from the names the deployment and build files use: `web` stands for
`compose:web npm:recipe-web`, `api` for `compose:api`, `db` for `compose:db`. The three modules are
Python, which drift does not read, so they get no `class:` hints; the email service is outside and
no file names its host, so it gets none either. The system root is `repo .` (the file sits at the
project's root) and `compose compose.yaml`, the file the README tells people to start.

The three modules are worth a level because an engineer asking "where does the email get sent?"
needs to see them; the manager reading the Big picture never opens them.

**Relationships**, each at the finest grain the code shows: the web app calls two route modules,
not "the API"; the planner, not the API, reads the database.

- cook plans meals in web
- web sends recipes to recipes; web sends weekly plans to planner; web asks for the shopping list
  from planner
- recipes saves recipes in db; planner reads recipes from db; planner saves meal plans in db
- planner hands the shopping list to mailer; mailer sends the shopping list through mail
- mail emails the shopping list to cook

**Flows**: one, "Sending the shopping list", from `tests/test_lists.py` and `routes/lists.py`.

**Views**: Big picture (the system opened one level), and Inside the recipe API (the API opened).
There are no build-time dependencies between separate packages, so no engineering view.

## 4. Writing

The file follows the fixed order: `model`, `audiences`, the system root, elements, relationships,
views, scenario, walkthrough, ignore lines. Unmarked wording is the manager's voice; `@exec` lines are few and only on the top
levels; `@engineer` lines add file names, ports and endpoints.

## 5. Check rounds

**Round 1.** `aerie check architecture.aerie --format json` exited with 1. The diagnostics, as the
text form prints them:

```text
architecture.aerie:85:29: error E008: There is no element called `mial`. Did you mean `mail`?
architecture.aerie:96:34: error E401: A sentence must end with the element it points to, and `list` is not an element. If you meant `web`, reword the line so `web` comes last.
architecture.aerie:102:3: warning W601: No relationship joins `planner` and `mail` in the model. Add one, such as `planner sends the shopping list through mail`, or check this step.
2 errors and 1 warning.
```

Fixes, one per diagnostic:

- E008: a typo in the Big picture's `show` line. Took the suggestion: `mail`.
- E401: the step `cook asks web for the shopping list` had its object in the middle. Reworded so
  the element comes last: `cook asks for the shopping list from web`.
- W601: the step said the planner sends the list through the email service. `api/mail.py` shows
  that the Mailer does that, and the model already says so. The step was wrong, not the model, so
  the step became `mailer sends the shopping list through mail`. Adding a relationship from
  `planner` to `mail` would have silenced the warning and made the model untrue.

**Round 2.** `No problems found.`, exit code 0.

## 6. Drift rounds

**Drift round 1.** `aerie drift architecture.aerie --format json` exited with 1, with one finding.
The report, as the text form prints it:

```text
aerie drift architecture.aerie
Checked against recipe-box (4 Compose services, 1 npm package) in 0.0 s.

Drift (1): the diagram and the code disagree: several techniques agree, or an exact check failed

D01 The code has the Compose service `compose:mailpit`, but no element stands for it.
    2 techniques found it: Compose service and Compose environment URL.
    Code:
      recipe-box/compose.yaml:20  Compose service: compose:mailpit
      recipe-box/compose.yaml:11  Compose environment URL: compose:api to compose:mailpit (MAIL_API_URL=http://mailpit:8025/api/v1/send)
    Suggested edit:
      architecture.aerie, after line 59
      +
      +   mailpit: mailpit [service]
      +     code compose:mailpit
      architecture.aerie, after line 80
      + api calls mailpit
    Or, if it is meant to differ:
      architecture.aerie, after line 121
      +
      + ignore drift compose:mailpit - why this difference is meant

Not checked (8): code cannot show these, or drift could not read them
  architecture.aerie:77  The line “Meal planner hands the shopping list to Mailer” is not checked:
    both ends are checked as Recipe API, so drift cannot tell them apart.
  architecture.aerie:17  Home cook is a person, which code cannot show. The line “Home cook plans
    meals in Web app” (line 67) is not checked either.
  architecture.aerie:42  Recipe handling has no `class:` hints, so it is not checked, and its lines
    are checked as Recipe API's.
  architecture.aerie:46  Meal planner has no `class:` hints, so it is not checked, and its lines are
    checked as Recipe API's.
  architecture.aerie:50  Mailer has no `class:` hints, so it is not checked, and its lines are
    checked as Recipe API's. The line “Mailer sends the shopping list through Email service” (line
    78) is not checked either.
  architecture.aerie:62  Email service has no code line, and its name matches no code drift reads.
    The line “Email service emails the shopping list to Home cook” (line 80) is not checked either.
  architecture.aerie:94  Scenario `send-list` is not checked: scenarios are checked against real
    call paths in phase 2.
  The wording (names, taglines and descriptions) is not checked: wrong details are checked in phase
    2.

3 of 9 elements and 6 of 10 lines confirmed by the code.
1 drift. Exit code 1. `aerie drift --format diff` prints every suggested edit as a patch.
```

The finding is the service the inventory left out on purpose. Drawing it would put a development
tool in the picture of the running system, so the difference is meant, and the fix is the ignore
line drift offers, with the reason from the compose file's own comment:
`ignore drift compose:mailpit - a mail catcher for development only; the real email service is outside`.

What is not checked needs no fix: the cook, the three Python modules, the email service, the
scenario and the wording are things this code cannot show. The report mentions them.

**Drift round 2.** No findings, exit code 0. The footer:

```text
3 of 9 elements and 6 of 10 lines confirmed by the code.
No drift. Exit code 0.
```

Then `aerie format architecture.aerie`, which changed nothing.

## 7. The report

> Wrote `architecture.aerie`: a draft for your review. 9 elements, 11 relationships, 2 views,
> 1 scenario and a walkthrough of 5 steps. The checker's last word: "No problems found." (2
> rounds). Drift's last word: "No drift." (2 rounds); 3 of 9 elements and 6 of 10 lines are
> confirmed by the code.
>
> One point I could not settle from the code: `// Unsure: the project names no email provider;
MAIL_API_KEY suggests a hosted one.`
>
> One difference from the code is marked as meant: `mailpit` is not drawn, since it is for
> development only.
>
> Drift cannot check the cook, the three modules inside the API (they are Python), the email
> service, the scenario or the wording; read those yourself.
>
> To see the diagram, run `aerie watch architecture.aerie`.

## 8. Later: a change to the code

The user asked: "Cache recipe searches in Redis." The change adds a Redis service, gives the API its
address and makes the search handler use it. The deployment part of the change:

**The code change.**

```diff
diff --git a/compose.yaml b/compose.yaml
--- a/compose.yaml
+++ b/compose.yaml
@@ -9,6 +9,7 @@ services:
     environment:
       DATABASE_URL: postgresql://recipes@db:5432/recipes
       MAIL_API_URL: http://mailpit:8025/api/v1/send
+      REDIS_URL: redis://cache:6379/0
   db:
     image: postgres:16
     environment:
@@ -16,6 +17,8 @@ services:
       POSTGRES_DB: recipes
     volumes:
       - pgdata:/var/lib/postgresql/data
+  cache:
+    image: redis:8
   # For development only: catches the email the API sends.
   mailpit:
     image: axllent/mailpit:v1.27
```

The project has a model with a system root, and the change adds a service, so it changes the
architecture. Drift runs before the change is done:

**Drift after the change.**

```text
aerie drift architecture.aerie
Checked against recipe-box (5 Compose services, 1 npm package) in 0.0 s.

Drift (1): the diagram and the code disagree: several techniques agree, or an exact check failed

D01 The code has the Compose service `compose:cache`, but no element stands for it.
    2 techniques found it: Compose service and Compose environment URL.
    Code:
      recipe-box/compose.yaml:20  Compose service: compose:cache
      recipe-box/compose.yaml:12  Compose environment URL: compose:api to compose:cache (REDIS_URL=redis://cache:6379/0)
    Suggested edit:
      architecture.aerie, after line 59
      +
      +   cache: cache [service]
      +     code compose:cache
      architecture.aerie, after line 80
      + api calls cache
    Or, if it is meant to differ:
      architecture.aerie, after line 125
      + ignore drift compose:cache - why this difference is meant
```

The suggested element is only a placeholder. The update words it like the rest of the model: a
store, at the finest grain the code shows (the search handler, `recipes`, uses the cache), and the
system's description and the views brought up to date. It goes in the same change as the code:

**The diagram's update.**

```diff
diff --git a/architecture.aerie b/architecture.aerie
--- a/architecture.aerie
+++ b/architecture.aerie
@@ -18,10 +18,10 @@ cook: Home cook | Plans meals in a browser [person]
   > Saves recipes, plans the week and asks for a shopping list.

 recipe-box: Recipe box | Recipes, meal plans and shopping lists [system]
-  > Three parts that start together: the web app, the recipe API and the database.
+  > Four parts that start together: the web app, the recipe API, the database and a search cache.
   @exec: | Our meal planning product
-  @engineer >> `compose.yaml` starts `web`, `api` and `db`. Only `web` is published, on port
-    3000. In development it also starts `mailpit`, which catches the email the API sends.
+  @engineer >> `compose.yaml` starts `web`, `api`, `db` and `cache`. Only `web` is published,
+    on port 3000. In development it also starts `mailpit`, which catches the email the API sends.

   web: Web app | The screens cooks use [service]
     icon web
@@ -58,6 +58,12 @@ recipe-box: Recipe box | Recipes, meal plans and shopping lists [system]
     @engineer >> The `db` service in `compose.yaml`, with the volume `pgdata`. Tables come from
       `api/migrations/`.

+  cache: Search cache | Recent search results [store]
+    code compose:cache
+    > Keeps recent recipe searches, so asking again is quick.
+    @engineer: | Redis 8
+    @engineer >> The `cache` service in `compose.yaml`; the API reaches it at `REDIS_URL`.
+
 // Unsure: the project names no email provider; `MAIL_API_KEY` suggests a hosted one.
 mail: Email service | Delivers email [external]
   > An outside email provider.
@@ -72,6 +78,7 @@ web sends weekly plans to planner
 web asks for the shopping list from planner
   @engineer: POSTs /api/lists/send to
 recipes saves recipes in db
+recipes keeps search results in cache
 planner reads recipes from db
 planner saves meal plans in db
 planner hands the shopping list to mailer
@@ -83,10 +90,10 @@ mail emails the shopping list to cook

 view big-picture: Big picture
   show cook, recipe-box +1, mail
-  > Who uses Recipe box, its three parts, and the one outside service it needs.
+  > Who uses Recipe box, its four parts, and the one outside service it needs.

 view inside-api: Inside the recipe API
-  show cook, web, api +1, db, mail
+  show cook, web, api +1, db, cache, mail
   @exec: How planning works

 // ---------------------------------------------------------------- scenarios
```

`aerie check` and `aerie format` are clean, and drift again:

```text
4 of 10 elements and 7 of 11 lines confirmed by the code.
No drift. Exit code 0.
```
