<!-- aerie-drift: tests/unit/drift/fixtures/angular/shop-drift.aerie -->
### 🔴 Aerie drift: `tests/unit/drift/fixtures/angular/shop-drift.aerie`

**2 drift** (fails this check), **2 likely**, 2 not checked. 4 of 5 elements and 0 of 2 lines confirmed against `web`, `deploy`.

| | Finding | Diagram |
| --- | --- | --- |
| 🔴 D01 | The code line of Storefront names `npm:shop-site`, which the code no longer has; it has `npm:shop-web` instead, which no element names. | `tests/unit/drift/fixtures/angular/shop-drift.aerie:17` |
| 🔴 D02 | Storefront calls Orders API in the code, but no line in the diagram joins them. | not drawn |
| 🟡 L01 | The diagram says Orders API notifies Storefront, but the code shows no call from Orders API to Storefront. | `tests/unit/drift/fixtures/angular/shop-drift.aerie:25` |
| 🟡 L02 | Storefront calls Payment provider in the code, but no line in the diagram joins them. | not drawn |

<details><summary><b>D01</b> The code line of Storefront names <code>npm:shop-site</code>, which the code no longer has; it has <code>npm:shop-web</code> instead, which no element names.</summary>

Diagram: `tests/unit/drift/fixtures/angular/shop-drift.aerie:17`

An exact check: the code has no npm package of that name, and `npm:shop-web` is the closest one no element names.

Evidence:

- `web/package.json:2` package.json name: npm:shop-web

Suggested edit:

```diff
@@ -14,7 +14,7 @@
 shopper: Shopper [person]
 
 storefront: Storefront [service]
-  code compose:web npm:shop-site
+  code compose:web npm:shop-web
 ui-kit: UI kit [module]
   code npm:@shop/ui-kit
 api: Orders API [service]
```

Or, if it is meant to differ:

```
ignore drift npm:shop-site - why this difference is meant
```

</details>

<details><summary><b>D02</b> Storefront calls Orders API in the code, but no line in the diagram joins them.</summary>

4 techniques found it: nginx proxy_pass, Angular dev-server proxy, Angular HttpClient through nginx and Angular HttpClient through the dev proxy.

Evidence:

- `web/nginx/templates/default.conf.template:5` nginx proxy_pass: compose:web to compose:api (/api/=http://api:8080)
- `web/proxy.conf.json:2` Angular dev-server proxy: npm:shop-web to compose:api (/api=http://localhost:8080)
- `web/src/app/orders.service.ts:9` Angular HttpClient through nginx: npm:shop-web to compose:api (GET /api/orders)
- `web/src/app/orders.service.ts:9` Angular HttpClient through the dev proxy: npm:shop-web to compose:api (GET /api/orders)

Suggested edit:

```diff
@@ -23,3 +23,4 @@
 
 shopper uses storefront
 api notifies storefront
+storefront calls api
```

Or, if it is meant to differ:

```
ignore drift storefront to api - why this difference is meant
```

</details>

<details><summary><b>L01</b> The diagram says Orders API notifies Storefront, but the code shows no call from Orders API to Storefront.</summary>

Diagram: `tests/unit/drift/fixtures/angular/shop-drift.aerie:25`

No technique found a call between them, and reading the code cannot rule one out, so this is only likely.

Suggested edit:

```diff
@@ -22,4 +22,3 @@
 pay: Payment provider [external]
 
 shopper uses storefront
-api notifies storefront
```

Or, if it is meant to differ:

```
ignore drift api to storefront - why this difference is meant
```

</details>

<details><summary><b>L02</b> Storefront calls Payment provider in the code, but no line in the diagram joins them.</summary>

One technique found it: Angular HttpClient.

Evidence:

- `web/src/app/orders.service.ts:13` Angular HttpClient: npm:shop-web to host pay.example.com (POST https://pay.example.com/v1/charges)

Suggested edit:

```diff
@@ -23,3 +23,4 @@
 
 shopper uses storefront
 api notifies storefront
+storefront calls pay
```

Or, if it is meant to differ:

```
ignore drift storefront to pay - why this difference is meant
```

</details>

<details><summary>Not checked (2), suggestions (0), ignored (0)</summary>

- `tests/unit/drift/fixtures/angular/shop-drift.aerie:14` Shopper is a person, which code cannot show. The line “Shopper uses Storefront” (line 24) is not checked either.
- The wording (names, taglines and descriptions) is not checked: wrong details are checked in phase 2.

</details>

Run `npx aerie drift tests/unit/drift/fixtures/angular/shop-drift.aerie` locally, or add `--format diff` for every suggested edit as a patch. Aerie never edits the diagram itself.
