# Worked example 1: Recipe box

A made-up project, small enough to read in full, taken through every step of the workflow. The
finished model is [recipe-box.aerie](recipe-box.aerie).

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
| `web/Dockerfile`, `web/nginx.conf`           | nginx serves the built app and passes `/api/*` to `api:8000`. So the web app calls the API, and the browser never does.       |
| `web/package.json`                           | React 19 and Vite.                                                                                                            |
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

The file follows the fixed order: `model`, `audiences`, elements, relationships, views, scenario,
walkthrough. Unmarked wording is the manager's voice; `@exec` lines are few and only on the top
levels; `@engineer` lines add file names, ports and endpoints.

## 5. Check rounds

**Round 1.** `aerie check architecture.aerie --format json` exited with 1. The diagnostics, as the
text form prints them:

```text
architecture.aerie:77:29: error E008: There is no element called `mial`. Did you mean `mail`?
architecture.aerie:88:34: error E401: A sentence must end with the element it points to, and `list` is not an element. If you meant `web`, reword the line so `web` comes last.
architecture.aerie:94:3: warning W601: No relationship joins `planner` and `mail` in the model. Add one, such as `planner sends the shopping list through mail`, or check this step.
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

**Round 2.** `No problems found.`, exit code 0. Then `aerie format architecture.aerie`, which
changed nothing.

## 6. The report

> Wrote `architecture.aerie`: a draft for your review. 9 elements, 11 relationships, 2 views,
> 1 scenario and a walkthrough of 5 steps. The checker's last word: "No problems found." (2
> rounds).
>
> One point I could not settle from the code: `// Unsure: the project names no email provider;
MAIL_API_KEY suggests a hosted one.`
>
> To see the diagram, run `aerie watch architecture.aerie`.
