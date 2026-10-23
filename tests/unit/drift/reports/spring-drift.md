<!-- aerie-drift: tests/unit/drift/fixtures/spring/shop-drift.aerie -->
### 🔴 Aerie drift: `tests/unit/drift/fixtures/spring/shop-drift.aerie`

**5 drift** (fails this check), **1 likely**, 4 not checked, 1 ignored. 9 of 10 elements and 4 of 6 lines confirmed against `shop`.

| | Finding | Diagram |
| --- | --- | --- |
| 🔴 D01 | The code line of Ledger names `class:com.shop.billing.Ledger`, which the code no longer has; it has `class:com.shop.billing.ledger.Ledger` instead, which no element names. | `tests/unit/drift/fixtures/spring/shop-drift.aerie:32` |
| 🔴 D02 | The diagram says Billing depends on Catalog, but in the code Billing does not depend on Catalog. | `tests/unit/drift/fixtures/spring/shop-drift.aerie:44` |
| 🔴 D03 | Orders depends on the Maven module `maven:shop-common`, but no element stands for it. | not drawn |
| 🔴 D04 | Billing client calls Invoices in the code, but no line in the diagram joins them. | not drawn |
| 🔴 D05 | Orders depends on Catalog in the code, but no `[code]` line in the diagram joins them. | not drawn |
| 🟡 L01 | Order API uses the code of Ordering in the code, but no line in the diagram joins them. | not drawn |

<details><summary><b>D01</b> The code line of Ledger names <code>class:com.shop.billing.Ledger</code>, which the code no longer has; it has <code>class:com.shop.billing.ledger.Ledger</code> instead, which no element names.</summary>

Diagram: `tests/unit/drift/fixtures/spring/shop-drift.aerie:32`

An exact check: the code has no Java type of that name, and `class:com.shop.billing.ledger.Ledger` is the closest one no element names.

Evidence:

- `shop/billing/src/main/java/com/shop/billing/ledger/Ledger.java:7` Java type: maven:shop-billing declares class com.shop.billing.ledger.Ledger, a subtype of com.shop.common.LedgerPort

Suggested edit:

```diff
@@ -29,7 +29,7 @@
   listener: Order listener
     code class:com.shop.billing.events.OrderListener
   ledger: Ledger
-    code class:com.shop.billing.Ledger
+    code class:com.shop.billing.ledger.Ledger
   audit: Audit trail
 
 catalog: Catalog [module]
```

Or, if it is meant to differ:

```
ignore drift class:com.shop.billing.Ledger - why this difference is meant
```

</details>

<details><summary><b>D02</b> The diagram says Billing depends on Catalog, but in the code Billing does not depend on Catalog.</summary>

Diagram: `tests/unit/drift/fixtures/spring/shop-drift.aerie:44`

An exact check: the Maven poms list every dependency between modules, and none runs this way.

Suggested edit:

```diff
@@ -41,6 +41,5 @@
 invoices records charges in ledger
 listener writes orders to audit
 
-billing depends on catalog [code]
 
 ignore drift maven:shop-legacy - retiring with the old reports
```

Or, if it is meant to differ:

```
ignore drift billing to catalog - why this difference is meant
```

</details>

<details><summary><b>D03</b> Orders depends on the Maven module <code>maven:shop-common</code>, but no element stands for it.</summary>

An exact check: a drawn module depends on it, and the Maven poms list every dependency.

Evidence:

- `shop/common/pom.xml:9` Maven module: maven:shop-common
- `shop/billing/pom.xml:12` Maven dependency: maven:shop-billing depends on maven:shop-common (compile)
- `shop/catalog/pom.xml:12` Maven dependency: maven:shop-catalog depends on maven:shop-common (compile)
- `shop/orders/pom.xml:16` Maven dependency: maven:shop-orders depends on maven:shop-common (compile)
- `shop/testkit/pom.xml:12` Maven dependency: maven:shop-testkit depends on maven:shop-common (compile)

Suggested edit:

```diff
@@ -34,6 +34,9 @@
 
 catalog: Catalog [module]
   code maven:shop-catalog
+
+shop-common: shop-common [module]
+  code maven:shop-common
 
 service prices items with catalog
 service asks for invoices through billing-client
@@ -42,5 +45,8 @@
 listener writes orders to audit
 
 billing depends on catalog [code]
+billing depends on shop-common [code]
+catalog depends on shop-common [code]
+orders depends on shop-common [code]
 
 ignore drift maven:shop-legacy - retiring with the old reports
```

Or, if it is meant to differ:

```
ignore drift maven:shop-common - why this difference is meant
```

</details>

<details><summary><b>D04</b> Billing client calls Invoices in the code, but no line in the diagram joins them.</summary>

2 techniques found it: HTTP call matched to an endpoint and WebClient call.

Evidence:

- `shop/orders/src/main/java/com/shop/orders/billing/BillingClient.java:17` HTTP call matched to an endpoint: maven:shop-orders calls POST http://localhost:8082/invoices, which maven:shop-billing answers (InvoiceController.invoice) at shop/billing/src/main/java/com/shop/billing/web/InvoiceController.java:16
- `shop/orders/src/main/java/com/shop/orders/billing/BillingClient.java:17` WebClient call: maven:shop-orders calls POST http://localhost:8082/invoices on maven:shop-billing (BillingClient.invoice)

Suggested edit:

```diff
@@ -40,6 +40,7 @@
 service announces orders to listener
 invoices records charges in ledger
 listener writes orders to audit
+billing-client calls invoices
 
 billing depends on catalog [code]
```

Or, if it is meant to differ:

```
ignore drift billing-client to invoices - why this difference is meant
```

</details>

<details><summary><b>D05</b> Orders depends on Catalog in the code, but no <code>[code]</code> line in the diagram joins them.</summary>

An exact check: the Maven poms list every dependency between modules.

Evidence:

- `shop/orders/pom.xml:12` Maven dependency: maven:shop-orders depends on maven:shop-catalog (compile)

Suggested edit:

```diff
@@ -42,5 +42,6 @@
 listener writes orders to audit
 
 billing depends on catalog [code]
+orders depends on catalog [code]
 
 ignore drift maven:shop-legacy - retiring with the old reports
```

Or, if it is meant to differ:

```
ignore drift orders to catalog - why this difference is meant
```

</details>

<details><summary><b>L01</b> Order API uses the code of Ordering in the code, but no line in the diagram joins them.</summary>

One technique found it: Java type reference.

Evidence:

- `shop/orders/src/main/java/com/shop/orders/web/OrderController.java:12` Java type reference: maven:shop-orders com.shop.orders.web.OrderController uses com.shop.orders.service.OrderService

Suggested edit:

```diff
@@ -40,6 +40,7 @@
 service announces orders to listener
 invoices records charges in ledger
 listener writes orders to audit
+web calls service
 
 billing depends on catalog [code]
```

Or, if it is meant to differ:

```
ignore drift web to service - why this difference is meant
```

</details>

<details><summary>Not checked (4), suggestions (0), ignored (1)</summary>

- `tests/unit/drift/fixtures/spring/shop-drift.aerie:42` The line “Order listener writes orders to Audit trail” is not checked: its ends are checked as Order listener and Billing, which holds it, so drift cannot tell them apart.
- The Maven module `maven:shop-testkit` is used only by tests, so it is not checked.
- `tests/unit/drift/fixtures/spring/shop-drift.aerie:33` Audit trail has no `class:` hints, so it is not checked, and its lines are checked as Billing's.
- The wording (names, taglines and descriptions) is not checked: wrong details are checked in phase 2.
- Ignored `maven:shop-legacy` (`tests/unit/drift/fixtures/spring/shop-drift.aerie:46`): retiring with the old reports (excused 1 difference)

</details>

Run `npx aerie drift tests/unit/drift/fixtures/spring/shop-drift.aerie` locally, or add `--format diff` for every suggested edit as a patch. Aerie never edits the diagram itself.
