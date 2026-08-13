# Sales Territory & Incentive Analytics Pipeline

This repository hosts the code and design artifacts for a high-performance **Sales Territory & Incentive Compensation (IC) Analytics Pipeline** designed for simulated pharmaceutical sales operations. 

It showcases a complete, client-side, interactive Business Intelligence (BI) dashboard (resembling a Power BI environment) powered by an ETL pipeline running directly in the browser. Users can load synthetic preset data, generate new randomized data loads on the fly, or upload custom transactional CSV datasets to see the ETL execute and reports update in real-time.

---

## 🏗️ Architecture & Data Model

The application models a real-world enterprise architecture, transitioning data from a normalized relational operational source to a denormalized dimensional analytics warehouse.

### 1. Operational OLTP Schema (Source System)
Designed in third normal form (3NF) to ensure transactional integrity, historical consistency, and quick record updates.
* **`Reps`**: Registry of sales executives (status, email, hire date).
* **`Territories`**: Regional alignments (Region, District, sectors).
* **`RepTerritoryAssignments`**: Handles historical transitions and movements of representatives between territories over time.
* **`Physicians`**: Database of medical practitioners targets with territory assignments.
* **`CallPlans`**: Monthly target visit metrics per representative per physician.
* **`Calls`**: Logging details of actual visits completed (completed vs. no-shows).
* **`Sales`**: Transactional sales invoice ledger.
* **`Quotas`**: Monthly individual representative sales target quotas.

### 2. Analytical OLAP Star Schema (Data Warehouse)
Designed for fast slicing, aggregation, and report rendering, utilizing surrogate keys and pre-aggregated coverage metrics.
* **`DimRep`**: Denormalized sales representative dim (district/region resolved historically).
* **`DimTerritory`**: Geographic layout dimension.
* **`DimPhysician`**: Target physician specialty dimension.
* **`DimDate`**: Date dimension supporting standard calendars, quarters, and months.
* **`FactSales`**: Relational sales fact table detailing invoice amounts.
* **`FactCallActivity`**: Aggregates target calls, completed calls, and calculates call-plan coverage percentages.
* **`FactIncentiveCompensation`**: Computes monthly quota achievements, base commissions, bonus accelerators, and total payouts.

---

## 📈 Stored Procedure Logic & Business Rules

### Incentive Compensation (IC) Accelerator Curve
Pharmaceutical sales organizations utilize non-linear commissions to motivate top-performers. The pipeline simulates this operational logic via SQL stored procedures (and client-side JS equivalents):
1. **Base Commission**: **2.0%** of actual sales.
2. **Quota Attainment**: $\text{Attainment \%} = (\text{Actual Sales} / \text{Quota}) \times 100$.
3. **Tiered Bonus Accelerators**:
   * **Attainment < 80%**: No bonus.
   * **80% to 100%**: **1.0%** bonus on sales above 80% quota threshold.
   * **100% to 120%**: Tier 1 max bonus + **2.5%** bonus on sales above 100% quota.
   * **Above 120% (Uncapped)**: Tier 1 max + Tier 2 max + **5.0%** accelerator bonus on sales above 120% quota.

---

## ⚡ Performance Tuning & Deadlock Resolution

In concurrent high-volume transaction environments (e.g. administrative portals updating alignments while nightly ETL tasks write facts), databases often run into slow queries and deadlocks. This showcase documents the resolution of these scenarios:

### 1. Slow Query Tuning
* **Symptom**: Call activity aggregations took several seconds due to expensive **Index Scan** operations (92% execution plan cost) on the operational `Calls` table.
* **Resolution**: Created a non-clustered covering index:
  ```sql
  CREATE NONCLUSTERED INDEX IX_Calls_Tuning_Date_Rep_Phy 
  ON Calls (CallDate) 
  INCLUDE (RepID, PhysicianID, Status);
  ```
  This converted the operator to an **Index Seek**, optimizing lookup complexity from $O(N)$ to $O(\log N)$.

### 2. Deadlock Mitigation
* **Symptom**: Concurrent writes by administrators to `RepTerritoryAssignments` and ETL transactions to `FactCallActivity` caused SQL Server Error 1205 (Deadlocks).
* **Resolution**:
  1. Enabled **Read Committed Snapshot Isolation (RCSI)** on the database to prevent analytics reads from blocking operational writes:
     ```sql
     ALTER DATABASE SalesWarehouse SET READ_COMMITTED_SNAPSHOT ON;
     ```
  2. Refactored stored procedures to always lock records in a standard top-down order (Dimensions first, then Fact writes).
  3. Implemented query locking hints (`ROWLOCK` during updates, `TABLOCK` for bulk loads, and `NOLOCK` for staging queries) to prevent lock escalations.

---

## 🚀 How to Run the Project Locally

The workspace is fully self-contained. Since the ETL engine runs directly in the client-side JavaScript, you do not need active servers or databases to test:

1. **Clone or Open the Workspace**:
   Open `index.html` directly in any web browser (Chrome, Firefox, Edge, Safari).
2. **Generate New Synthetic Datasets**:
   If you have Python installed, you can re-generate the CSV sheets and re-compile the preset javascript:
   ```bash
   python scripts/generate_synthetic.py
   ```
   This will output:
   * A set of raw CSV files in `raw_data/` (usable for upload testing).
   * An updated `synthetic_data.js` containing pre-populated JSON payloads for the site.
3. **Test custom imports**:
   * Navigate to the **Data Uploader** tab.
   * Download the import templates.
   * Drag and drop your own modified CSV files (e.g. increase sales in `sales_template.csv` and rename to `sales.csv`, then upload) to watch the metrics recompute dynamically!
