# Writing for each audience

An Aerie model is read by people who want different things from the same picture. The default
audiences are an executive, a manager and an engineer. They all see the same elements and the same
relationships; only the words change. **Audience changes wording, never depth.** Never leave
something out for one audience or add an element only engineers would want: put it in the model,
and let each audience read it in its own words.

## The three voices

| Audience          | Wants to know                          | Writes like                                         | How much                                  |
| ----------------- | -------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| manager (default) | what each part does and why it matters | plain English, whole words, no jargon               | everything: this is the unmarked text     |
| exec              | what it is worth and what it risks     | short names, a tagline of value, one sentence       | a few lines, top levels only              |
| engineer          | how it works and where to find it      | code-like: package names, ports, endpoints, classes | most elements and the important sentences |

The unmarked text is written in the **default audience's** voice. With the default audiences that is
the manager, so most of the file needs no `@` lines at all. If the user chose other audiences, the
same idea holds: write the unmarked text for whichever audience is `(default)`.

## Manager: the unmarked text

- **Names** are what the team calls the part in conversation: "Recipe API", "Notifier", "Orders
  database". Not the repository name, unless that is what people say.
- **Taglines** say what the part does, in four to eight words, with no full stop: "Keeps every past
  draw", "Texts recipients".
- **Descriptions** are one or two sentences: what it does, and anything a manager would ask next
  ("Only the web app calls it", "Refreshes every two hours").
- **Verb phrases** are plain, present tense and lower case, and read aloud as a sentence with the
  names in place: "Web app sends weekly plans to Meal planner".

| Instead of                       | Write                                                   |
| -------------------------------- | ------------------------------------------------------- |
| "calls" or "uses"                | "sends weekly plans to"                                 |
| "HTTP POST /api/plans"           | "saves the week's plan in" (engineers get the endpoint) |
| "Interacts with"                 | say what actually happens: "reads recipes from"         |
| "Persistence layer"              | "Recipe database"                                       |
| "Leverages the queue to fan out" | "publishes scan events to"                              |

## Executive: sparse

- Reword only the top levels: the model title, the system, the two or three services that carry
  the value, the first view's title. Leave modules, stores and most relationships alone; the
  manager's wording serves executives well there.
- Say what the part is worth to the business, not how it works: `@exec: | Our meal planning
product`, `@exec: Tracking service | Knows where every parcel is`.
- At most one sentence of description, with `@exec >` replacing the manager's paragraph:
  `@exec > Scans and texts are decoupled, so a slow text service never slows couriers down.`
- A good test: an executive file of wording is shorter than the manager's, never longer.

## Engineer: added detail

- Most engineer wording **adds** a paragraph after the manager's, with `@engineer >>`. The manager's
  paragraph is still true for engineers; they just want more.
- Taglines become code-like: the package or deployable name and the stack, with the port:
  `@engineer: | recipe-api, FastAPI :8000`. Keep the unmarked name unless engineers really call the
  part something else.
- Added paragraphs name what an engineer would search for: files, classes, endpoints, environment
  variables, queues, tables. Put names in `` `code` ``.
- Reword the verb phrase of a relationship when the protocol matters: `@engineer: POSTs /scans to`,
  `@engineer: consumes parcel.scanned from`. The rewording must still read as a sentence ending at
  the object.
- Every detail comes from a file you read. If you cannot name the file, leave the detail out.

## One element in three voices

```aerie
audiences exec "Executive", manager "Manager" (default), engineer "Engineer" (code)

notifier: Notifier | Texts recipients [service]
  > Turns each scan into a short text message for the recipient.
  @exec: | Keeps customers informed
  @engineer: | packages/notifier, Node worker
  @engineer >> A durable consumer of `parcel.scanned`. Message wording lives in
    `src/templates/`.
```

- The executive reads "Notifier", "Keeps customers informed" and the manager's sentence.
- The manager reads "Notifier", "Texts recipients" and the sentence.
- The engineer reads "Notifier", "packages/notifier, Node worker", the sentence, then the added
  paragraph.

## Views, scenarios and walkthroughs

- **View titles** are short nouns: "Big picture", "Services", "Engineering: packages". An executive
  title is worth adding to a technical view: `@exec: How the code is organised`.
- **Scenario steps** are written like relationships, in the manager's voice. Add a step description
  only when it tells the reader something the sentence does not ("Usually within a minute"), and
  engineer wording only where the protocol or the code is the point.
- **Walkthrough narration** is what a presenter would say aloud: one or two short sentences per
  step, with the element being shown in **bold**. Reword it for executives where the value story
  differs, and add an engineer paragraph where the room will be technical.
