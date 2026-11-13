# Ordering and inventory: requirement catalogue

```
type: ordering
title: Ordering and inventory
keys: catalogue, promos, inventory, orders, purchasing, approvals, portal, invoicing, checkout, reports, automations
published: false
```

66 requirements in 10 groups for tools that manage products, stock, customer orders, purchasing from suppliers and delivery. Each requirement is one level below the module: a behaviour a client recognises and a developer can turn into a screen or a rule.

- **Baseline** yes means every product in this category covers it fully. It is what the category has in common, so a replacement must match it and the builder ticks it by default.
- **Size** is build effort: S 1 to 2 days, M 3 to 5 days, L 6 to 10 days.
- **Key** is the capability key the requirement sits under. Connections and admin requirements have none; the builder holds them as connections and guardrails.

## Groups and requirements

### Products and pricing

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| C1 | One record per product, with variants, units of measure and pack sizes. | yes | M | catalogue |
| C2 | Barcodes and supplier codes held against each product and pack size. | yes | S | catalogue |
| C3 | Price lists per customer or customer group, with dated changes. | no | M | catalogue |
| C4 | Volume breaks, discounts and promotions with clear rules. | no | M | promos |
| C5 | Bundles, kits and bills of materials built from other products. | no | L | catalogue |
| C6 | Product images, descriptions and attributes customers can search and filter. | no | M | catalogue |
| C7 | Substitutes and discontinued products, with the replacement offered on the order. | no | S | catalogue |
| C8 | Each product linked to its suppliers, with cost, lead time and minimum order. | yes | M | purchasing |

### Stock

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| S1 | Stock held by location and bin, with available, reserved and on order shown separately. | yes | M | inventory |
| S2 | Every stock movement logged with who, when and why. | yes | M | inventory |
| S3 | Batch or lot numbers and expiry dates, with first expired first out picking. | no | L | inventory |
| S4 | Serial numbers tracked from receipt to sale. | no | M | inventory |
| S5 | Stock takes and cycle counts, with variances reviewed before they post. | yes | M | inventory |
| S6 | Adjustments and write-offs with a reason code, and an approval above a set value. | no | S | inventory |
| S7 | Transfers between locations, with stock in transit shown. | no | M | inventory |
| S8 | Reorder points per product and location, with a low stock alert. | yes | S | inventory |
| S9 | Stock valued by average cost or first in first out, by location. | no | M | inventory |

### Sales orders

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| O1 | Staff enter orders against a customer account, with that customer's prices and terms applied. | yes | M | orders |
| O2 | Customers place orders online from their own catalogue and prices. | no | L | portal |
| O3 | Orders move through stages from received to delivered, with the status visible to the customer. | yes | M | orders |
| O4 | Stock allocated to an order when it is confirmed and released if it is cancelled. | yes | M | orders |
| O5 | Back orders and part shipments, with the customer told what is outstanding. | no | M | orders |
| O6 | Repeat orders from a template, a past order or a standing schedule. | no | M | orders |
| O7 | Credit limits and account holds checked before an order is accepted. | no | S | orders |
| O8 | Order changes and cancellations allowed up to a cut-off, with a record of what changed. | no | M | orders |
| O9 | Returns authorised, received and credited, with stock put back or written off. | no | L | orders |

### Purchasing and suppliers

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| P1 | Purchase orders raised from reorder suggestions or by hand, per supplier. | yes | M | purchasing |
| P2 | Approval of purchase orders over a set value before they are sent. | no | S | approvals |
| P3 | Purchase orders sent to the supplier, with acknowledgement and confirmed dates recorded. | yes | M | purchasing |
| P4 | Suppliers sign in to confirm, amend or decline an order line by line. | no | L | portal |
| P5 | Amendments from either side shown as a difference and accepted or rejected. | no | M | purchasing |
| P6 | Goods received against the purchase order, with shortages, overs and damages recorded. | yes | M | purchasing |
| P7 | Supplier invoice matched to the purchase order and the receipt before it is approved for payment. | no | M | invoicing |
| P8 | Landed costs such as freight and duty spread across the products received. | no | M | purchasing |
| P9 | Supplier performance: fill rate, on time delivery and lead time against promise. | no | M | reports |

### Fulfilment and delivery

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| F1 | Pick lists by order, batch or zone, in walking order. | yes | M | orders |
| F2 | Picking and receiving confirmed by scanning on a phone or handheld. | no | L | orders |
| F3 | Packing with labels and a delivery note or packing slip. | yes | S | orders |
| F4 | Carrier labels booked and tracking numbers written back to the order. | no | L | orders |
| F5 | Proof of delivery captured with a signature or photo. | no | M | orders |
| F6 | Orders sent straight from the supplier to the customer, tracked as one order. | no | M | orders |
| F7 | Delivery slots or routes chosen at order time, with a cut-off per slot. | no | M | orders |

### Invoicing and finance

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| I1 | Invoice raised from what was shipped, with tax worked out. | yes | M | invoicing |
| I2 | Payment terms, statements and overdue reminders per customer. | no | M | invoicing |
| I3 | Sales invoices, credits and purchase invoices passed to the accounts system. | yes | L | invoicing |
| I4 | More than one currency, with rates held by date. | no | M | invoicing |
| I5 | Online payment by card or bank transfer against an order or invoice. | no | M | checkout |

### Planning and reporting

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| R1 | Stock cover in days, and slow moving or ageing stock, by product. | no | M | reports |
| R2 | Demand forecast from sales history, with seasonality, feeding the reorder suggestions. | no | L | reports |
| R3 | Sales and margin by product, customer and period. | yes | M | reports |
| R4 | Open orders, late purchase orders and shortages on one exceptions screen. | no | M | reports |
| R5 | Dashboards per role, with filters by location and period. | yes | M | reports |
| R6 | Any list exported, or scheduled as a report. | yes | S | reports |

### Alerts and rules

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| W1 | Customers told by email or text when an order is confirmed, shipped or delayed. | yes | M | automations |
| W2 | Staff alerted to low stock, late deliveries and orders on hold. | yes | S | automations |
| W3 | Rules that route, hold or approve orders by value, customer or product. | no | M | automations |
| W4 | A full history on every order and purchase order of who changed what. | yes | S | automations |

### Connections

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| X1 | Orders and stock levels kept in step with an online shop or marketplace. | no | L | none |
| X2 | Orders, acknowledgements and invoices exchanged with large customers or suppliers by EDI. | no | L | none |
| X3 | Open API and webhooks for other systems to read and write orders and stock. | yes | L | none |
| X4 | Import of products, prices, stock and open orders from spreadsheets. | yes | M | none |

### Admin and platform

| Id | Requirement | Baseline | Size | Key |
|---|---|---|---|---|
| A1 | Roles and permissions by location and by function, so a buyer and a picker see different things. | yes | M | none |
| A2 | Single sign-on and two factor sign in. | no | M | none |
| A3 | Several companies, brands or warehouses in one system, each with its own settings. | no | L | none |
| A4 | Works on phones and handhelds in the warehouse, including with poor signal. | no | L | none |
| A5 | Data residency choice and GDPR tools for customer data. | no | M | none |

### Totals

66 requirements: 10 small, 42 medium, 14 large. 26 baseline. The whole list is 220 to 370 build days; the baseline alone is 72 to 122 days.

## Screen patterns

The screens every tool of this type has, each naming the requirements it serves. The prototype planner starts from these.

| Screen | Serves |
|---|---|
| Stock overview | S1, S8, R1, R4 |
| Product record | C1, C2, C3, C8, S2 |
| Sales orders and order detail | O1, O3, O4, O5, O8, W4 |
| Customer ordering | O2, O6, C6, F7 |
| Purchase orders and order detail | P1, P2, P3, P5, P9 |
| Supplier sign in | P3, P4, P5 |
| Goods in and picking | P6, F1, F2, F3 |
| Reports and exceptions | R3, R4, R5 |

## Products

No product is marked yet. Coverage marks are added by the catalogue scripts.

Still to mark:

- NetSuite
- SAP Business One
- Unleashed
- Cin7
- Brightpearl
- Shopify (orders and stock)
