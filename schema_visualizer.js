// Schema Visualizer Logic - Renders OLTP & OLAP schemas with hover highlights

const SCHEMA_DATA = {
  oltp: [
    {
      id: "oltp_reps",
      name: "Reps",
      type: "table",
      description: "Sales representatives raw operational record table.",
      columns: [
        { name: "RepID", type: "VARCHAR(10)", key: "PK" },
        { name: "FirstName", type: "VARCHAR(50)", key: "" },
        { name: "LastName", type: "VARCHAR(50)", key: "" },
        { name: "Title", type: "VARCHAR(100)", key: "" },
        { name: "Email", type: "VARCHAR(100)", key: "UQ" },
        { name: "Phone", type: "VARCHAR(20)", key: "" },
        { name: "HireDate", type: "DATE", key: "" },
        { name: "Active", type: "BIT", key: "" }
      ],
      references: [
        { from: "RepID", to: "oltp_assignments.RepID" },
        { from: "RepID", to: "oltp_callplans.RepID" },
        { from: "RepID", to: "oltp_calls.RepID" },
        { from: "RepID", to: "oltp_sales.RepID" },
        { from: "RepID", to: "oltp_quotas.RepID" }
      ]
    },
    {
      id: "oltp_territories",
      name: "Territories",
      type: "table",
      description: "Geographic territory alignment definitions.",
      columns: [
        { name: "TerritoryID", type: "VARCHAR(10)", key: "PK" },
        { name: "Name", type: "VARCHAR(100)", key: "" },
        { name: "Region", type: "VARCHAR(50)", key: "" },
        { name: "District", type: "VARCHAR(50)", key: "" }
      ],
      references: [
        { from: "TerritoryID", to: "oltp_assignments.TerritoryID" },
        { from: "TerritoryID", to: "oltp_physicians.TerritoryID" }
      ]
    },
    {
      id: "oltp_assignments",
      name: "RepTerritoryAssignments",
      type: "table",
      description: "Rep-to-territory mappings with history support.",
      columns: [
        { name: "AssignmentID", type: "VARCHAR(10)", key: "PK" },
        { name: "RepID", type: "VARCHAR(10)", key: "FK", ref: "oltp_reps" },
        { name: "TerritoryID", type: "VARCHAR(10)", key: "FK", ref: "oltp_territories" },
        { name: "StartDate", type: "DATE", key: "" },
        { name: "EndDate", type: "DATE", key: "" }
      ]
    },
    {
      id: "oltp_physicians",
      name: "Physicians",
      type: "table",
      description: "Target physician demographic listing.",
      columns: [
        { name: "PhysicianID", type: "VARCHAR(10)", key: "PK" },
        { name: "FirstName", type: "VARCHAR(50)", key: "" },
        { name: "LastName", type: "VARCHAR(50)", key: "" },
        { name: "Specialty", type: "VARCHAR(50)", key: "" },
        { name: "TerritoryID", type: "VARCHAR(10)", key: "FK", ref: "oltp_territories" }
      ],
      references: [
        { from: "PhysicianID", to: "oltp_callplans.PhysicianID" },
        { from: "PhysicianID", to: "oltp_calls.PhysicianID" }
      ]
    },
    {
      id: "oltp_callplans",
      name: "CallPlans",
      type: "table",
      description: "Planned visit activities per rep per physician monthly.",
      columns: [
        { name: "PlanID", type: "VARCHAR(10)", key: "PK" },
        { name: "RepID", type: "VARCHAR(10)", key: "FK", ref: "oltp_reps" },
        { name: "PhysicianID", type: "VARCHAR(10)", key: "FK", ref: "oltp_physicians" },
        { name: "TargetCalls", type: "INT", key: "" },
        { name: "MonthYear", type: "VARCHAR(7)", key: "" }
      ]
    },
    {
      id: "oltp_calls",
      name: "Calls",
      type: "table",
      description: "Activity journal logging actual completed rep interactions.",
      columns: [
        { name: "CallID", type: "INT", key: "PK" },
        { name: "RepID", type: "VARCHAR(10)", key: "FK", ref: "oltp_reps" },
        { name: "PhysicianID", type: "VARCHAR(10)", key: "FK", ref: "oltp_physicians" },
        { name: "CallDate", type: "DATE", key: "" },
        { name: "Status", type: "VARCHAR(20)", key: "" }
      ]
    },
    {
      id: "oltp_sales",
      name: "Sales",
      type: "table",
      description: "Relational invoice transactional ledger.",
      columns: [
        { name: "SalesID", type: "INT", key: "PK" },
        { name: "RepID", type: "VARCHAR(10)", key: "FK", ref: "oltp_reps" },
        { name: "ProductID", type: "VARCHAR(10)", key: "" },
        { name: "Amount", type: "DECIMAL(18,2)", key: "" },
        { name: "Date", type: "DATE", key: "" }
      ]
    },
    {
      id: "oltp_quotas",
      name: "Quotas",
      type: "table",
      description: "Target quotas per representative monthly.",
      columns: [
        { name: "QuotaID", type: "VARCHAR(10)", key: "PK" },
        { name: "RepID", type: "VARCHAR(10)", key: "FK", ref: "oltp_reps" },
        { name: "MonthYear", type: "VARCHAR(7)", key: "" },
        { name: "QuotaAmount", type: "DECIMAL(18,2)", key: "" }
      ]
    }
  ],

  olap: [
    {
      id: "olap_fact_sales",
      name: "FactSales",
      type: "fact",
      description: "Sales transactions mapped to dimensional tables.",
      columns: [
        { name: "SalesKey", type: "INT", key: "PK" },
        { name: "DateKey", type: "INT", key: "FK", ref: "olap_dim_date" },
        { name: "RepKey", type: "INT", key: "FK", ref: "olap_dim_rep" },
        { name: "TerritoryKey", type: "INT", key: "FK", ref: "olap_dim_territory" },
        { name: "SalesAmount", type: "DECIMAL(18,2)", key: "" }
      ]
    },
    {
      id: "olap_fact_call_activity",
      name: "FactCallActivity",
      type: "fact",
      description: "Aggregated call coverage percentages per physician target.",
      columns: [
        { name: "CallKey", type: "INT", key: "PK" },
        { name: "DateKey", type: "INT", key: "FK", ref: "olap_dim_date" },
        { name: "RepKey", type: "INT", key: "FK", ref: "olap_dim_rep" },
        { name: "TerritoryKey", type: "INT", key: "FK", ref: "olap_dim_territory" },
        { name: "PhysicianKey", type: "INT", key: "FK", ref: "olap_dim_physician" },
        { name: "TargetCalls", type: "INT", key: "" },
        { name: "CompletedCalls", type: "INT", key: "" },
        { name: "CallPlanCoveragePct", type: "DECIMAL(5,2)", key: "" }
      ]
    },
    {
      id: "olap_fact_incentives",
      name: "FactIncentiveCompensation",
      type: "fact",
      description: "Stores evaluated incentive comp metrics and payouts.",
      columns: [
        { name: "IncentiveKey", type: "INT", key: "PK" },
        { name: "MonthKey", type: "INT", key: "FK", ref: "olap_dim_date" },
        { name: "RepKey", type: "INT", key: "FK", ref: "olap_dim_rep" },
        { name: "QuotaAmount", type: "DECIMAL(18,2)", key: "" },
        { name: "ActualSales", type: "DECIMAL(18,2)", key: "" },
        { name: "QuotaAttainmentPct", type: "DECIMAL(6,2)", key: "" },
        { name: "BaseCommission", type: "DECIMAL(18,2)", key: "" },
        { name: "BonusPayout", type: "DECIMAL(18,2)", key: "" },
        { name: "TotalPayout", type: "DECIMAL(18,2)", key: "" }
      ]
    },
    {
      id: "olap_dim_rep",
      name: "DimRep",
      type: "dimension",
      description: "Representative attributes (historically correct via ETL).",
      columns: [
        { name: "RepKey", type: "INT", key: "PK" },
        { name: "RepID", type: "VARCHAR(10)", key: "" },
        { name: "Name", type: "VARCHAR(100)", key: "" },
        { name: "Title", type: "VARCHAR(100)", key: "" },
        { name: "Email", type: "VARCHAR(100)", key: "" },
        { name: "Phone", type: "VARCHAR(20)", key: "" },
        { name: "HireDate", type: "DATE", key: "" },
        { name: "ActiveStatus", type: "VARCHAR(15)", key: "" },
        { name: "District", type: "VARCHAR(50)", key: "" },
        { name: "Region", type: "VARCHAR(50)", key: "" },
        { name: "IsCurrent", type: "BIT", key: "" }
      ],
      references: [
        { from: "RepKey", to: "olap_fact_sales.RepKey" },
        { from: "RepKey", to: "olap_fact_call_activity.RepKey" },
        { from: "RepKey", to: "olap_fact_incentives.RepKey" }
      ]
    },
    {
      id: "olap_dim_territory",
      name: "DimTerritory",
      type: "dimension",
      description: "Territory attributes lookup for slicing region metrics.",
      columns: [
        { name: "TerritoryKey", type: "INT", key: "PK" },
        { name: "TerritoryID", type: "VARCHAR(10)", key: "" },
        { name: "Name", type: "VARCHAR(100)", key: "" },
        { name: "Region", type: "VARCHAR(50)", key: "" },
        { name: "District", type: "VARCHAR(50)", key: "" }
      ],
      references: [
        { from: "TerritoryKey", to: "olap_fact_sales.TerritoryKey" },
        { from: "TerritoryKey", to: "olap_fact_call_activity.TerritoryKey" }
      ]
    },
    {
      id: "olap_dim_physician",
      name: "DimPhysician",
      type: "dimension",
      description: "Physician registry including targets.",
      columns: [
        { name: "PhysicianKey", type: "INT", key: "PK" },
        { name: "PhysicianID", type: "VARCHAR(10)", key: "" },
        { name: "Name", type: "VARCHAR(100)", key: "" },
        { name: "Specialty", type: "VARCHAR(50)", key: "" }
      ],
      references: [
        { from: "PhysicianKey", to: "olap_fact_call_activity.PhysicianKey" }
      ]
    },
    {
      id: "olap_dim_date",
      name: "DimDate",
      type: "dimension",
      description: "Expanded date details for aggregations.",
      columns: [
        { name: "DateKey", type: "INT", key: "PK" },
        { name: "FullDate", type: "DATE", key: "" },
        { name: "Day", type: "INT", key: "" },
        { name: "Month", type: "INT", key: "" },
        { name: "MonthName", type: "VARCHAR(15)", key: "" },
        { name: "Quarter", type: "INT", key: "" },
        { name: "Year", type: "INT", key: "" }
      ],
      references: [
        { from: "DateKey", to: "olap_fact_sales.DateKey" },
        { from: "DateKey", to: "olap_fact_call_activity.DateKey" },
        { from: "DateKey", to: "olap_fact_incentives.MonthKey" }
      ]
    }
  ]
};

// Main schema builder function
function buildSchemaDiagram(containerId, schemaType) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const tables = SCHEMA_DATA[schemaType];

  tables.forEach(tbl => {
    const tableEl = document.createElement("div");
    tableEl.className = `schema-table ${tbl.type}-node`;
    tableEl.id = tbl.id;
    tableEl.setAttribute("data-description", tbl.description);

    const header = document.createElement("div");
    header.className = "table-header";
    header.innerHTML = `
      <span class="table-type">${tbl.type.toUpperCase()}</span>
      <span class="table-name">${tbl.name}</span>
    `;
    tableEl.appendChild(header);

    const body = document.createElement("div");
    body.className = "table-body";

    tbl.columns.forEach(col => {
      const colEl = document.createElement("div");
      colEl.className = "table-column";
      if (col.key) {
        colEl.classList.add(`col-${col.key.toLowerCase()}`);
      }
      if (col.ref) {
        colEl.setAttribute("data-ref", col.ref);
      }

      colEl.innerHTML = `
        <span class="col-key">${col.key ? col.key : ""}</span>
        <span class="col-name">${col.name}</span>
        <span class="col-type">${col.type}</span>
      `;

      // Hover bindings to trace relationships
      colEl.addEventListener("mouseenter", () => {
        highlightRelations(tbl.id, col.name, col.ref, tbl.references);
      });
      colEl.addEventListener("mouseleave", () => {
        clearHighlights();
      });

      body.appendChild(colEl);
    });

    tableEl.appendChild(body);
    
    // Add hover binding to the table card as a whole
    tableEl.addEventListener("mouseenter", (e) => {
      document.getElementById("schema-info-box").innerHTML = `
        <h3>${tbl.name}</h3>
        <p class="node-type-label ${tbl.type}">${tbl.type.toUpperCase()}</p>
        <p>${tbl.description}</p>
      `;
    });

    container.appendChild(tableEl);
  });
}

function highlightRelations(sourceTableId, columnName, refTableId, tableReferences) {
  clearHighlights();

  // 1. Highlight source column
  const sourceTable = document.getElementById(sourceTableId);
  if (sourceTable) {
    sourceTable.classList.add("highlight-source");
    const cols = sourceTable.querySelectorAll(".table-column");
    cols.forEach(col => {
      if (col.querySelector(".col-name").innerText === columnName) {
        col.classList.add("highlight-active-col");
      }
    });
  }

  // 2. If it is an FK column pointing elsewhere
  if (refTableId) {
    const destTable = document.getElementById(refTableId);
    if (destTable) {
      destTable.classList.add("highlight-target");
      // Highlight matching PK in target table
      const cols = destTable.querySelectorAll(".table-column");
      cols.forEach(col => {
        if (col.classList.contains("col-pk")) {
          col.classList.add("highlight-active-col");
        }
      });
    }
  }

  // 3. Check table-level references (outgoing connections for dimensions)
  if (tableReferences) {
    tableReferences.forEach(ref => {
      if (ref.from === columnName) {
        const [targetTblId, targetColName] = ref.to.split(".");
        const targetTable = document.getElementById(targetTblId);
        if (targetTable) {
          targetTable.classList.add("highlight-target");
          const cols = targetTable.querySelectorAll(".table-column");
          cols.forEach(col => {
            if (col.querySelector(".col-name").innerText === targetColName) {
              col.classList.add("highlight-active-col");
            }
          });
        }
      }
    });
  }
}

function clearHighlights() {
  document.querySelectorAll(".schema-table").forEach(el => {
    el.classList.remove("highlight-source", "highlight-target");
  });
  document.querySelectorAll(".table-column").forEach(el => {
    el.classList.remove("highlight-active-col");
  });
}

// Export for usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCHEMA_DATA, buildSchemaDiagram };
} else {
  window.SCHEMA_DATA = SCHEMA_DATA;
  window.buildSchemaDiagram = buildSchemaDiagram;
}
