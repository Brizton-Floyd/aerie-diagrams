<!-- aerie-drift: tests/unit/drift/fixtures/compose/shop-drift.aerie -->
### 🔴 Aerie drift: `tests/unit/drift/fixtures/compose/shop-drift.aerie`

**4 drift** (fails this check), **3 likely**, 2 not checked, 1 ignored. 6 of 9 elements and 3 of 5 lines confirmed against `stack`.

| | Finding | Diagram |
| --- | --- | --- |
| 🔴 D01 | The code line of Payments names `compose:payment`, which the code no longer has; it has `compose:payments` instead, which no element names. | `tests/unit/drift/fixtures/compose/shop-drift.aerie:24` |
| 🔴 D02 | The code line of Search names `compose:search`, which the code does not have. | `tests/unit/drift/fixtures/compose/shop-drift.aerie:30` |
| 🔴 D03 | The code has the Compose service `compose:cache`, but no element stands for it. | not drawn |
| 🔴 D04 | Worker calls Orders API in the code, but no line in the diagram joins them. | not drawn |
| 🟡 L01 | The diagram says Storefront calls Payments, but the code shows no call from Storefront to Payments. | `tests/unit/drift/fixtures/compose/shop-drift.aerie:36` |
| 🟡 L02 | The ignore line for `web to db` excuses nothing: the diagram and the code agree there. | `tests/unit/drift/fixtures/compose/shop-drift.aerie:41` |
| 🟡 L03 | Orders API calls Database in the code, but no line in the diagram joins them. | not drawn |

<details><summary><b>D01</b> The code line of Payments names <code>compose:payment</code>, which the code no longer has; it has <code>compose:payments</code> instead, which no element names.</summary>

Diagram: `tests/unit/drift/fixtures/compose/shop-drift.aerie:24`

An exact check: the code has no Compose service of that name, and `compose:payments` is the closest one no element names.

Evidence:

- `stack/compose.yaml:19` Compose service: compose:payments

Suggested edit:

```diff
@@ -21,7 +21,7 @@
   api: Orders API [service]
     code compose:api
   payments: Payments [service]
-    code compose:payment
+    code compose:payments
   worker: Worker [service]
     code compose:worker
   db: Database [store]
```

Or, if it is meant to differ:

```
ignore drift compose:payment - why this difference is meant
```

</details>

<details><summary><b>D02</b> The code line of Search names <code>compose:search</code>, which the code does not have.</summary>

Diagram: `tests/unit/drift/fixtures/compose/shop-drift.aerie:30`

An exact check: the code has no Compose service of that name.

Suggested edit:

```diff
@@ -26,8 +26,6 @@
     code compose:worker
   db: Database [store]
     code compose:db
-  search: Search [service]
-    code compose:search
 
 bank: Bank | Takes card payments [external]
```

Or, if it is meant to differ:

```
ignore drift compose:search - why this difference is meant
```

</details>

<details><summary><b>D03</b> The code has the Compose service <code>compose:cache</code>, but no element stands for it.</summary>

2 techniques found it: Compose service and Compose environment host name. Compose depends_on agrees too, but only corroborates.

Evidence:

- `stack/compose.yaml:34` Compose service: compose:cache
- `stack/compose.yaml:17` Compose environment host name: compose:api to compose:cache (CACHE_HOST=cache:6379)
- `stack/compose.yaml:18` Compose depends_on: compose:api to compose:cache

Suggested edit:

```diff
@@ -28,6 +28,8 @@
     code compose:db
   search: Search [service]
     code compose:search
+  cache: cache [service]
+    code compose:cache
 
 bank: Bank | Takes card payments [external]
 
@@ -36,6 +38,7 @@
 web calls payments
 api charges cards through payments
 payments charges cards at bank
+api calls cache
 
 ignore drift compose:queue - run by the platform team, outside this diagram
 ignore drift web to db - the storefront read the database before the API existed
```

Or, if it is meant to differ:

```
ignore drift compose:cache - why this difference is meant
```

</details>

<details><summary><b>D04</b> Worker calls Orders API in the code, but no line in the diagram joins them.</summary>

2 techniques found it: Compose environment URL and Compose environment host name. Compose depends_on agrees too, but only corroborates.

Evidence:

- `stack/compose.yaml:26` Compose environment URL: compose:worker to compose:api (API_URL=http://api:3000)
- `stack/compose.yaml:27` Compose environment host name: compose:worker to compose:api (API_HOST=api)
- `stack/compose.yaml:29` Compose depends_on: compose:worker to compose:api

Suggested edit:

```diff
@@ -36,6 +36,7 @@
 web calls payments
 api charges cards through payments
 payments charges cards at bank
+worker calls api
 
 ignore drift compose:queue - run by the platform team, outside this diagram
 ignore drift web to db - the storefront read the database before the API existed
```

Or, if it is meant to differ:

```
ignore drift worker to api - why this difference is meant
```

</details>

<details><summary><b>L01</b> The diagram says Storefront calls Payments, but the code shows no call from Storefront to Payments.</summary>

Diagram: `tests/unit/drift/fixtures/compose/shop-drift.aerie:36`

No technique found a call between them, and reading the code cannot rule one out, so this is only likely.

Suggested edit:

```diff
@@ -33,7 +33,6 @@
 
 customer uses web
 web calls api
-web calls payments
 api charges cards through payments
 payments charges cards at bank
```

Or, if it is meant to differ:

```
ignore drift web to payments - why this difference is meant
```

</details>

<details><summary><b>L02</b> The ignore line for <code>web to db</code> excuses nothing: the diagram and the code agree there.</summary>

Diagram: `tests/unit/drift/fixtures/compose/shop-drift.aerie:41`

Nothing it names differs any more, so it can go.

Suggested edit:

```diff
@@ -38,4 +38,3 @@
 payments charges cards at bank
 
 ignore drift compose:queue - run by the platform team, outside this diagram
-ignore drift web to db - the storefront read the database before the API existed
```

</details>

<details><summary><b>L03</b> Orders API calls Database in the code, but no line in the diagram joins them.</summary>

One technique found it: Compose environment JDBC URL. Compose depends_on agrees too, but only corroborates.

Evidence:

- `stack/compose.yaml:15` Compose environment JDBC URL: compose:api to compose:db (DATABASE_URL=jdbc:postgresql://db:5432/shop)
- `stack/compose.yaml:18` Compose depends_on: compose:api to compose:db

Suggested edit:

```diff
@@ -36,6 +36,7 @@
 web calls payments
 api charges cards through payments
 payments charges cards at bank
+api calls db
 
 ignore drift compose:queue - run by the platform team, outside this diagram
 ignore drift web to db - the storefront read the database before the API existed
```

Or, if it is meant to differ:

```
ignore drift api to db - why this difference is meant
```

</details>

<details><summary>Not checked (2), suggestions (0), ignored (1)</summary>

- `tests/unit/drift/fixtures/compose/shop-drift.aerie:16` Customer is a person, which code cannot show. The line “Customer uses Storefront” (line 34) is not checked either.
- The wording (names, taglines and descriptions) is not checked: wrong details are checked in phase 2.
- Ignored `compose:queue` (`tests/unit/drift/fixtures/compose/shop-drift.aerie:40`): run by the platform team, outside this diagram (excused 1 difference)

</details>

Run `npx aerie drift tests/unit/drift/fixtures/compose/shop-drift.aerie` locally, or add `--format diff` for every suggested edit as a patch. Aerie never edits the diagram itself.
