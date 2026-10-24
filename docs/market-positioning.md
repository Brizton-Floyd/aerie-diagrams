# Aerie market and positioning assessment

Research date: 2026-10-24. This is a commercial assessment, not an implementation reference.
Competitor product, pricing and customer research was explicitly authorized for this task.
The sources prohibited by the clean-room decision remain excluded. The complete source inventory
is in the [read log](clean-room/read-log/market-positioning.md).

## Recommendation

Aerie addresses a demonstrated problem in an existing commercial category. There is enough evidence
to justify paid pilots, but not enough to claim product-market fit, a defensible market size, or
proven willingness to pay for Aerie specifically.

The strongest initial position is **architecture documentation that stays understandable and checked
against the code**. The likely market is professional software teams rather than general consumers.
Keep "One model. Every audience." as the memorable promise and explain the practical outcome:
engineers, managers and leaders can discuss the same system without maintaining separate diagrams.

The present checkout supports a credible product core. It does not yet deliver the private publishing
and access workflow needed for a broadly useful paid team SaaS. A paid, assisted pilot or private
local deployment is a plausible earlier commercial offering.

## What the evidence establishes

Stack Overflow's 2026 survey reports outdated information as a context barrier for 56.5% of the
12,374 respondents to that question; 60.9% say important context lives in people's heads. Separately,
75% of 12,006 respondents spend at least five hours a week looking for work information. That time
covers all information seeking, not just architecture, and cannot be attributed to Aerie's use case.
The survey had 30,903 valid responses overall, recruited through Stack Overflow channels. This is
evidence of pain, not a representative estimate of paying customers.
[Knowledge data](https://survey.stackoverflow.co/2026/knowledge/data),
[methodology](https://survey.stackoverflow.co/2026/methodology).

Architecture-specific evidence points in the same direction. IcePanel's survey of 75 people,
published January 22, 2026 and titled its 2025 report, identifies keeping documentation current as
the biggest challenge, alongside consistency and choosing the right amount of detail for different
audiences. This is a small, vendor-sponsored community sample, useful as corroboration rather than
a market-size estimate.
[Architecture survey](https://icepanel.io/blog/state-of-software-architecture-survey-2025/).

DORA reports an association between internal documentation quality and organizational performance.
Its evidence concerns documentation broadly and does not demonstrate that purchasing diagramming
software causes a particular return.
[DORA documentation research](https://dora.dev/capabilities/documentation-quality/).

There is a commercial category: competing vendors publish paid plans and customer stories.
IcePanel lists named customer examples and Eraser charges for team capabilities. These are useful
signals of commercial activity, but public list prices and vendor testimonials do not reveal
conversion, retention, revenue, or Aerie's attainable share.
[IcePanel customers](https://icepanel.io/customers),
[Eraser pricing](https://www.eraser.io/pricing).

## Competitive landscape

These are important alternatives by use case, not a market-share ranking or an exhaustive list.
Prices were observed on the research date; annual plans below show monthly equivalents before tax.

| Alternative                                                                                                           | Why buyers consider it                                                                                                                                                                                                                                                               | Implication for Aerie                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [IcePanel](https://icepanel.io/pricing)                                                                               | Shared architecture models, multiple diagrams, flows, collaboration and protected sharing. Growth lists USD 40/editor/month billed annually, with unlimited viewers.                                                                                                                 | Strong overlap with the one-model and flow story. Audience-specific wording and evidence-backed checks need to prove additional value. Aerie currently trails its hosted collaboration workflow.                                                      |
| [Structurizr](https://docs.structurizr.com/)                                                                          | Architecture modeling with a DSL, multiple diagram types, documentation and publishing workflows. Prebuilt server licensing starts at GBP 300/month for 1-20 unique annual users, billed annually, including readers. [Server pricing](https://docs.structurizr.com/server/pricing). | Strong alternative for teams already using architecture-as-code. Aerie must win on communication and maintenance outcomes rather than merely having a text language. This server price is not an editor-seat SaaS comparison.                         |
| [Eraser](https://docs.eraser.io/codebase-diagrams)                                                                    | AI diagrams from repositories and [Eraserbot CI updates](https://docs.eraser.io/eraserbot). Business lists USD 45/member/month annually or USD 60 monthly, with free guests; CI automation requires usage-based pricing. [Pricing](https://www.eraser.io/pricing).                   | Direct competition for code-connected documentation. "AI-generated diagrams" and "kept up to date" are already offered. Aerie's specific checking semantics, explicit uncertainty, and audience wording are better comparison points.                 |
| [LikeC4](https://likec4.dev/)                                                                                         | An MIT-licensed architecture DSL, interactive exploration, Git workflows and embedding/static publishing. Its current homepage also markets validation and drift capabilities.                                                                                                       | A close substitute for developers comfortable with models in Git. Do not claim interactive architecture-as-code or all drift checking is exclusive to Aerie; do not assume its advertised drift means the same extraction/checking behavior as Aerie. |
| [Mermaid and its commercial platform](https://mermaid.js.org/)                                                        | Text diagrams and an established integration ecosystem. The commercial pricing URL now redirects to Mermaid.ai; Plus lists USD 10/user/month annually and Premium USD 20, with free viewer seats on Premium. [Pricing](https://mermaid.ai/pricing).                                  | A strong inexpensive alternative for individual diagrams. Aerie's proposed advantage is a maintained system model with audience wording and linked interactive explanations. Keep the open-source library distinct from the commercial service.       |
| [Lucidchart](https://help.lucid.co/hc/en-us/articles/360056903132-Lucid-Plans) and [draw.io](https://www.drawio.com/) | General visual diagramming, sharing and collaboration. draw.io offers a free tool, local storage and a desktop app.                                                                                                                                                                  | Buyers may already have an adequate tool. Aerie needs to show an avoided maintenance task or better system understanding, not simply a more attractive drawing.                                                                                       |

There are adjacent alternatives too. Swimm's current site positions it around agentic modernization,
verified system understanding and services. It belongs in enterprise knowledge/modernization
conversations, but its current positioning should not be described from old assumptions about it
being just a documentation subscription.
[Swimm current offering](https://swimm.io/).

Vendor descriptions were reviewed, not hands-on product tests. Absence of a feature from these pages
is not evidence that a competitor lacks it. No claim of market-wide uniqueness is established.

## What Aerie has today

The [README](../README.md), [product scope](spec/overview.md),
[viewer](../src/app/viewer.ts), [editor](../src/app/split.ts),
[extractor](../src/extract/index.ts) and [drift specification](spec/drift.md) support these findings:

- A single Lines model supports audience wording separately from depth. Switching wording reserves
  space so the diagram need not rearrange. This is a precise, demonstrable communication benefit.
- Interactive opening in place, scenarios and narrated tours support onboarding and architecture
  discussions. The combination matters more than any individual feature being novel.
- Static drift checks read Docker Compose, Maven/Spring Boot/Java, and Node/Angular. Findings carry
  evidence and suggested edits, with uncertainty distinguished from more confident drift. The
  model owner reviews changes; the checker does not automatically rewrite the model.
- The Claude skill can draft and maintain the model using the checker. It is not a hosted universal
  architecture-discovery service.
- The local/Git/CI workflow offers a path to deployment without uploading source code to an Aerie
  SaaS. That is a packaging option rather than a claim that every future AI-assisted workflow keeps
  code on the device.

The [Lotto benchmark](../tests/unit/drift/lotto/benchmark.json) records nine findings, precision and
recall of 0.889, and four of four planted changes found without inventions. That is promising internal
evidence from a small benchmark, not independently measured accuracy across customer systems.
Kubernetes/Terraform extraction and validation of scenario call paths remain outside current scope.

The important product gap is distribution to readers. Picture links serialize the chosen view state;
they do not upload a custom local model. The viewer explicitly distinguishes bundled samples from
local files without an address of their own. Accounts, hosting and real-time collaboration are
outside v1 scope; drafts use browser storage and file downloads. The package is private and currently
requires a checkout and Node 24. The inspected tree also contains pending work, so this assessment
does not certify a released build or CI status.

## Positioning and initial buyers

Suggested message:

> Architecture your whole team can understand, with checks against the code.
> Describe your system once, explain it at each reader's level, and see when the code and model differ.

Use "checks against the code" rather than "always accurate" or "automatically understands any
codebase." Wording is authored, not proof that the software verifies business meaning.

The best first-buyer hypothesis is an engineering manager, technical lead or architect responsible
for a multi-service system on the supported stacks. Look for a current trigger: onboarding new
engineers, a handover, a redesign, or a repeated failure of architecture documents to stay current.
Start with teams using Spring/Maven, Angular/Node and Compose because Aerie can demonstrate more of
its maintenance value there. Team size is a discovery variable, not a validated segment boundary.

Consultancies are a useful second hypothesis: audience wording and tours fit customer presentations
and handovers, while private publishing, export and client access become particularly important.
General consumers and enterprise-wide portfolio governance are weaker initial targets for the
current workflow and scope.

The audience feature can attract attention, while drift checks supply a recurring reason to use and
renew. Validate that pairing: some teams may value technical maintenance without audience wording,
while others may value communication but rarely run drift. A feature bundle is not yet a moat.
Reliability across real projects, low false alarms, a fast first useful model, and habitual use are
more defensible than syntax or appearance alone.

## Commercial path and validation

Preserve authoring in Git and offer a hosted private reader experience, initially accepting a built
model artifact rather than requiring all source repositories to be uploaded. This is a proposed
direction, not an existing capability. A practical first release needs simple installation,
onboarding, persistent model publishing, authentication, authorization, revocable links, repository
updates and version context. Billing, backups and basic support complete the paid operation.
Comments and simultaneous editing can follow observed need.

Charge for authors or a team workspace and allow broad reader access. Reader-seat friction works
against the every-audience promise; competing paid products already offer free viewers/guests.
Test USD 99-199/month per small team with a defined number of authors and CI runs as a pricing
hypothesis, not an inferred market-clearing price. An assisted initial model can reduce adoption
friction, but account for the labor separately to avoid mistaking consulting revenue for software
demand. A local/private licensed package is also viable to test before investing in full SaaS.

Run a six-week discovery and pilot cycle before broadening platform scope:

1. Interview 12-15 target teams about a recent onboarding, handover or stale-diagram incident. Ask
   them to show the current workflow, existing spend, lost time and actual decision maker.
2. Put a real supported system into Aerie with five teams. Observe setup time, manual corrections,
   model ownership, reader usage, and noise from checks. Avoid a demo-only evaluation.
3. Ask at least three teams to pay for a time-limited pilot with explicit success criteria. Payment
   tests willingness to pay better than enthusiastic interviews.
4. Track weekly reuse by authors and readers, checks on real changes, false alarms, useful findings,
   and a measurable workflow outcome such as time to complete an onboarding exercise.
5. Seek renewals at the proposed ongoing price. Three paid pilots and two renewals would justify
   another investment step, not establish statistical product-market fit. Reposition if use stays
   confined to a one-time presentation or requires ongoing founder work to remain useful.

No credible total addressable market estimate follows from these sources. A simple planning
scenario, not a forecast: 100 teams at USD 149/month is USD 178,800 annual recurring revenue;
1,000 teams is USD 1,788,000 before churn, discounts, support and operating costs. The research
justifies testing whether that repeatable buyer exists; it does not establish how many can be won.
