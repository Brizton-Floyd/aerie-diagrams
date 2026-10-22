# Worked example 2: Parcel tracker

A made-up monorepo with a mobile app, two back-end services, an event queue and a shared package.
It shows the choices the first example did not need: two kinds of people, a queue, build-time
dependencies with their own view, and two scenarios. The finished model is
[parcel-tracker.aerie](parcel-tracker.aerie).

## What the project showed

| File                                             | What it showed                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                      | Couriers scan parcels; recipients get "a text at every step, sent through our SMS partner" with a tracking link.     |
| `package.json` (root)                            | npm workspaces: `packages/scan-app`, `packages/tracking-api`, `packages/notifier`, `packages/shared-events`.         |
| `deploy/compose.yaml`                            | `tracking-api` (8080), `notifier`, `nats` (run with `-js`), `postgres:16` (database `tracking`). No courier app.     |
| `packages/scan-app/package.json`                 | React Native; `TRACKING_API_URL` in its config. Ships through the app stores, so it is not in the compose file.      |
| `packages/tracking-api/package.json`             | Fastify; depends on `@parcels/shared-events`.                                                                        |
| `packages/tracking-api/src/routes/scans.ts`      | `POST /scans`: inserts the scan, then publishes `parcel.scanned`.                                                    |
| `packages/tracking-api/src/routes/status.ts`     | `GET /parcels/:code`: reads the parcel's scans and renders the tracking page.                                        |
| `packages/notifier/package.json`, `src/index.ts` | Depends on `@parcels/shared-events`; a durable consumer of `parcel.scanned`; posts to an SMS API with `SMS_API_KEY`. |
| `packages/shared-events/src/index.ts`            | Zod schemas for the scan event.                                                                                      |
| `e2e/scan-to-text.test.ts`, `e2e/status.test.ts` | The two flows the team tests end to end.                                                                             |

## Decisions worth copying

- **Two people.** The courier and the recipient do different things with different parts, so each
  is its own `[person]` element at the top level.
- **The queue is an element.** NATS is part of the system (it is in the compose file), so it sits
  inside `tracker` with the author's own tag `[queue]` and `icon refresh`. Only `person`,
  `external` and `store` change how Aerie draws an element; every other tag is yours to choose.
- **Publish and consume are two relationships.** `scan-intake publishes scan events to events` and
  `notifier takes scan events from events`. Never write one relationship that skips the queue.
- **Build dependencies.** The two `package.json` files name `@parcels/shared-events`, so there are
  two `[code]` relationships. Every workspace package gets the tag `package`, and the Engineering
  view is `show [package]` with `kind code`. The other views draw only runtime relationships, so
  the build dependencies never clutter them.
- **Two scenarios**, one per end-to-end test file. In the second, `db returns the history to
status-lookup` is a reply: the model only has `status-lookup reads parcel history from db`, and
  Aerie draws the step as an answer.
- **One `// Unsure:` line**: the README never names the SMS partner, so the element is called "SMS
  gateway" and the comment says why.

## Check rounds

Round 1 found one error: the Services view first said `show courier, recipient, tracker +1, sms`,
and the walkthrough step `step services: status-lookup` could not focus on Status lookup, because
it sits inside the closed Tracking API. The checker's advice was to open the container or choose
another view; the view became `tracker +2`, which is what a Services view is for. Round 2 was
clean, and formatting changed nothing.
