// Main Application logic, Charting, Filters, and ETL UI bindings

let etlEngine = null;
let starSchema = null;

// Chart references
let chartSalesTerritory = null;
let chartCoverageSpecialty = null;
let chartRepPerformance = null;
let chartPayoutBreakdown = null;

// Active filters
let currentFilters = {
  region: "All",
  district: "All",
  rep: "All",
  specialty: "All",
  search: ""
};

// Sort state for the table
let tableSort = {
  key: "sales",
  direction: "desc"
};

// =========================================================================
// Initialization
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  etlEngine = new AnalyticsETL();
  
  // Load preset data initially
  loadPresetDataset();

  // Initialize UI components
  setupNavigation();
  setupFilterHandlers();
  setupActionHandlers();
  setupUploader();
  setupCodeViewer();
  
  // Render Schema Diagrams (one-time build, hover highlights handled internally)
  buildSchemaDiagram("schema-canvas-oltp", "oltp");
  buildSchemaDiagram("schema-canvas-olap", "olap");

  // Write initial log
  logToConsole("System initialized. Relational OLTP tables loaded with June 2026 synthetic records.", "success");
  logToConsole("ETL compilation completed: DimRep, DimTerritory, DimPhysician, DimDate, FactSales, FactCallActivity, FactIncentives successfully materialized.", "success");
});

// =========================================================================
// Navigation & Tab Swapping
// =========================================================================

function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const panes = document.querySelectorAll(".tab-pane");
  const titleDisplay = document.getElementById("page-title-display");
  const subtitleDisplay = document.getElementById("page-subtitle-display");

  const paneDetails = {
    dashboard: {
      title: "Interactive BI Dashboard",
      subtitle: "Pharma Sales Representative Alignment & Incentive Compensation Analysis"
    },
    schemas: {
      title: "Database Schemas & Data Model",
      subtitle: "Comparison of Normalized OLTP Source Tables vs Denormalized OLAP Star Schema"
    },
    uploader: {
      title: "Data Pipeline Uploader",
      subtitle: "Ingest CSV Files and Execute Client-Side ETL Stored Procedures"
    },
    code: {
      title: "SQL Stored Procedures & Python Scripts",
      subtitle: "Showcase of Database Code, Covered Indexes, and Deadlock Mitigation Strategies"
    }
  };

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.getAttribute("data-tab");
      
      // Update active nav button
      navItems.forEach(ni => ni.classList.remove("active"));
      item.classList.add("active");

      // Swap panes
      panes.forEach(pane => pane.classList.remove("active"));
      document.getElementById(`tab-${tabId}`).classList.add("active");

      // Update titles
      const details = paneDetails[tabId];
      if (details) {
        titleDisplay.innerText = details.title;
        subtitleDisplay.innerText = details.subtitle;
      }

      // Resize charts on showing dashboard tab to avoid canvas rendering size glitches
      if (tabId === "dashboard") {
        updateDashboard();
      }
    });
  });
}

// =========================================================================
// Data Loading & ETL Runners
// =========================================================================

function loadPresetDataset() {
  if (typeof window.PRESET_DATA !== "undefined") {
    // Clone preset data to allow modification
    const dataClone = JSON.parse(JSON.stringify(window.PRESET_DATA));
    etlEngine.loadRawData(dataClone);
    starSchema = etlEngine.runPipeline();
    
    // Hydrate options and redraw
    hydrateFilterOptions();
    updateDashboard();
  } else {
    logToConsole("Preset dataset not found. Please upload custom CSV data.", "error");
  }
}

// Custom log printout to the pipeline console
function logToConsole(message, type = "info") {
  const consoleEl = document.getElementById("pipeline-console");
  if (!consoleEl) return;

  const timestamp = new Date().toLocaleTimeString();
  let prefix = `[INFO]`;
  if (type === "error") prefix = `[ERROR]`;
  if (type === "warning") prefix = `[WARN]`;
  if (type === "success") prefix = `[SUCCESS]`;

  const newLog = document.createElement("div");
  newLog.innerHTML = `<span style="color: var(--text-muted)">${timestamp}</span> <span style="color: ${getLogColor(type)}">${prefix} ${message}</span>`;
  consoleEl.appendChild(newLog);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function getLogColor(type) {
  switch (type) {
    case "error": return "var(--color-danger)";
    case "warning": return "var(--color-warning)";
    case "success": return "var(--color-accent)";
    default: return "#38bdf8";
  }
}

// =========================================================================
// Filters & State Management
// =========================================================================

function hydrateFilterOptions() {
  const regSel = document.getElementById("filter-region");
  const distSel = document.getElementById("filter-district");
  const repSel = document.getElementById("filter-rep");

  const activeRegion = regSel.value;
  const activeDistrict = distSel.value;

  // 1. Districts options based on Region choice
  const uniqueDistricts = new Set();
  const uniqueReps = new Set();

  etlEngine.raw.territories.forEach(t => {
    if (activeRegion === "All" || t.Region === activeRegion) {
      uniqueDistricts.add(t.District);
    }
  });

  // Re-hydrate District Dropdown
  distSel.innerHTML = '<option value="All">All Districts</option>';
  Array.from(uniqueDistricts).sort().forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.innerText = d;
    distSel.appendChild(opt);
  });
  
  // Set back value if still valid
  if (uniqueDistricts.has(activeDistrict)) {
    distSel.value = activeDistrict;
  } else {
    distSel.value = "All";
  }

  // 2. Reps options based on Region/District choice
  const selectedDistrict = distSel.value;
  
  // Find territories fitting filters
  const filterTerrIDs = etlEngine.raw.territories
    .filter(t => (activeRegion === "All" || t.Region === activeRegion) && (selectedDistrict === "All" || t.District === selectedDistrict))
    .map(t => t.TerritoryID);

  const matchedRepIDs = new Set(
    etlEngine.raw.assignments
      .filter(asg => filterTerrIDs.includes(asg.TerritoryID) && asg.EndDate === "")
      .map(asg => asg.RepID)
  );

  repSel.innerHTML = '<option value="All">All Representatives</option>';
  etlEngine.raw.reps.forEach(r => {
    if (r.Active === "1" && matchedRepIDs.has(r.RepID)) {
      const opt = document.createElement("option");
      opt.value = r.RepID;
      opt.innerText = `${r.FirstName} ${r.LastName}`;
      repSel.appendChild(opt);
    }
  });

  // Re-sync filter values
  currentFilters.region = regSel.value;
  currentFilters.district = distSel.value;
  currentFilters.rep = repSel.value;
}

function setupFilterHandlers() {
  const regSel = document.getElementById("filter-region");
  const distSel = document.getElementById("filter-district");
  const repSel = document.getElementById("filter-rep");
  const specSel = document.getElementById("filter-specialty");
  const searchInput = document.getElementById("rep-table-search");
  const clearBtn = document.getElementById("btn-clear-filters");

  regSel.addEventListener("change", () => {
    hydrateFilterOptions();
    updateDashboard();
  });

  distSel.addEventListener("change", () => {
    hydrateFilterOptions();
    updateDashboard();
  });

  repSel.addEventListener("change", () => {
    currentFilters.rep = repSel.value;
    updateDashboard();
  });

  specSel.addEventListener("change", () => {
    currentFilters.specialty = specSel.value;
    updateDashboard();
  });

  searchInput.addEventListener("input", () => {
    currentFilters.search = searchInput.value.toLowerCase().trim();
    renderRepTable();
  });

  clearBtn.addEventListener("click", () => {
    regSel.value = "All";
    distSel.value = "All";
    repSel.value = "All";
    specSel.value = "All";
    searchInput.value = "";
    currentFilters = { region: "All", district: "All", rep: "All", specialty: "All", search: "" };
    
    hydrateFilterOptions();
    updateDashboard();
  });

  // Data Table sorting click handlers
  const headers = document.querySelectorAll("#rep-data-table th");
  headers.forEach(h => {
    h.addEventListener("click", () => {
      const key = h.getAttribute("data-sort");
      if (tableSort.key === key) {
        tableSort.direction = tableSort.direction === "asc" ? "desc" : "asc";
      } else {
        tableSort.key = key;
        tableSort.direction = "desc"; // Default descending for metrics
      }
      renderRepTable();
    });
  });
}

// =========================================================================
// Calculations & Dashboard Refreshes
// =========================================================================

function getFilteredKeys() {
  // Get matching DimRep keys
  const filteredReps = starSchema.dimReps.filter(r => {
    if (currentFilters.region !== "All" && r.Region !== currentFilters.region) return false;
    if (currentFilters.district !== "All" && r.District !== currentFilters.district) return false;
    if (currentFilters.rep !== "All" && r.RepID !== currentFilters.rep) return false;
    return true;
  });
  const repKeys = filteredReps.map(r => r.RepKey);

  // Get matching DimTerritory keys
  const filteredTerrs = starSchema.dimTerritories.filter(t => {
    if (currentFilters.region !== "All" && t.Region !== currentFilters.region) return false;
    if (currentFilters.district !== "All" && t.District !== currentFilters.district) return false;
    return true;
  });
  const terrKeys = filteredTerrs.map(t => t.TerritoryKey);

  // Get matching DimPhysicians
  const filteredPhys = starSchema.dimPhysicians.filter(p => {
    if (currentFilters.specialty !== "All" && p.Specialty !== currentFilters.specialty) return false;
    return true;
  });
  const physicianKeys = filteredPhys.map(p => p.PhysicianKey);

  return { repKeys, terrKeys, physicianKeys, reps: filteredReps, terrs: filteredTerrs };
}

function updateDashboard() {
  const keys = getFilteredKeys();

  // 1. Calculate and update KPI displays
  // Sales
  const filteredSalesFacts = starSchema.factSales.filter(s => keys.repKeys.includes(s.RepKey) && keys.terrKeys.includes(s.TerritoryKey));
  const totalSales = filteredSalesFacts.reduce((sum, s) => sum + s.SalesAmount, 0.0);

  // Incentive Comp
  const filteredIncentiveFacts = starSchema.factIncentives.filter(i => keys.repKeys.includes(i.RepKey));
  const totalIncentives = filteredIncentiveFacts.reduce((sum, i) => sum + i.TotalPayout, 0.0);
  const totalQuota = filteredIncentiveFacts.reduce((sum, i) => sum + i.QuotaAmount, 0.0);
  const attainment = totalQuota > 0 ? (totalSales / totalQuota) * 100 : 0;

  // Call Activity
  const filteredCallFacts = starSchema.factCallActivity.filter(c => keys.repKeys.includes(c.RepKey) && keys.terrKeys.includes(c.TerritoryKey) && keys.physicianKeys.includes(c.PhysicianKey));
  const totalTargets = filteredCallFacts.reduce((sum, c) => sum + c.TargetCalls, 0);
  const totalCompleted = filteredCallFacts.reduce((sum, c) => sum + c.CompletedCalls, 0);
  const callCoverage = totalTargets > 0 ? (totalCompleted / totalTargets) * 100 : 0.0;

  // Counts
  const activeRepsCount = keys.reps.length;
  const avgPayout = activeRepsCount > 0 ? totalIncentives / activeRepsCount : 0.0;
  const avgSales = activeRepsCount > 0 ? totalSales / activeRepsCount : 0.0;

  // Hydrate Text
  document.getElementById("val-total-sales").innerText = totalSales.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const attainmentEl = document.getElementById("val-quota-attainment");
  attainmentEl.innerText = `${attainment.toFixed(1)}%`;
  attainmentEl.className = attainment >= 90 ? "trend-up" : "trend-down";

  document.getElementById("val-call-coverage").innerText = `${callCoverage.toFixed(1)}%`;
  document.getElementById("val-total-targets").innerText = totalTargets.toLocaleString();
  document.getElementById("val-total-completed").innerText = totalCompleted.toLocaleString();

  document.getElementById("val-total-incentives").innerText = totalIncentives.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  document.getElementById("val-avg-payout").innerText = avgPayout.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  document.getElementById("val-active-reps").innerText = activeRepsCount;
  document.getElementById("val-avg-sales").innerText = avgSales.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  // 2. Refresh Tables
  renderRepTable();

  // 3. Refresh Chart Visualizations
  renderCharts(keys, filteredSalesFacts, filteredCallFacts, filteredIncentiveFacts);
}

// =========================================================================
// Data Table Rendering
// =========================================================================

function renderRepTable() {
  const tbody = document.getElementById("rep-table-body");
  tbody.innerHTML = "";

  const keys = getFilteredKeys();
  const rowData = [];

  // Assemble dataset
  keys.reps.forEach(rep => {
    // Check search criteria
    if (currentFilters.search && !rep.Name.toLowerCase().includes(currentFilters.search) && !rep.Title.toLowerCase().includes(currentFilters.search)) {
      return;
    }

    const salesFact = starSchema.factSales.filter(s => s.RepKey === rep.RepKey);
    const actualSales = salesFact.reduce((sum, s) => sum + s.SalesAmount, 0.0);

    const incFact = starSchema.factIncentives.find(i => i.RepKey === rep.RepKey);
    const quota = incFact ? incFact.QuotaAmount : 0.0;
    const attainment = quota > 0 ? (actualSales / quota) * 100 : 0.0;

    const callFact = starSchema.factCallActivity.filter(c => c.RepKey === rep.RepKey && keys.physicianKeys.includes(c.PhysicianKey));
    const targetCalls = callFact.reduce((sum, c) => sum + c.TargetCalls, 0);
    const completedCalls = callFact.reduce((sum, c) => sum + c.CompletedCalls, 0);
    const callCoverage = targetCalls > 0 ? (completedCalls / targetCalls) * 100 : 100.0;

    const comm = incFact ? incFact.BaseCommission : 0.0;
    const bonus = incFact ? incFact.BonusPayout : 0.0;
    const payout = incFact ? incFact.TotalPayout : 0.0;

    rowData.push({
      repKey: rep.RepKey,
      name: rep.Name,
      region: rep.Region,
      district: rep.District,
      sales: actualSales,
      quota: quota,
      attainment: attainment,
      coverage: callCoverage,
      commission: comm,
      bonus: bonus,
      payout: payout
    });
  });

  // Sort dataset
  rowData.sort((a, b) => {
    let valA = a[tableSort.key];
    let valB = b[tableSort.key];

    if (typeof valA === "string") {
      return tableSort.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return tableSort.direction === "asc" ? valA - valB : valB - valA;
  });

  // Draw rows
  rowData.forEach(row => {
    const tr = document.createElement("tr");

    let attainmentClass = "badge-alert";
    if (row.attainment >= 110) attainmentClass = "badge-excellent";
    else if (row.attainment >= 95) attainmentClass = "badge-good";
    else if (row.attainment >= 80) attainmentClass = "badge-warning";

    tr.innerHTML = `
      <td style="font-weight:600; color: #fff;">${row.name}</td>
      <td>${row.region}</td>
      <td>${row.district}</td>
      <td>${row.sales.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
      <td>${row.quota.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
      <td>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${Math.min(100, row.attainment)}%"></div>
        </div>
        <span class="attainment-badge ${attainmentClass}">${row.attainment.toFixed(1)}%</span>
      </td>
      <td>${row.coverage.toFixed(1)}%</td>
      <td>${row.commission.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
      <td>${row.bonus.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
      <td style="font-weight:700; color: var(--color-secondary);">${row.payout.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================================================================
// Charts Renderings (Chart.js Configs)
// =========================================================================

function renderCharts(keys, salesFacts, callFacts, incentiveFacts) {
  // Chart.js Default styling tweaks
  Chart.defaults.color = "#94a3b8";
  Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

  // 1. SALES VS QUOTA BY TERRITORY
  const terrSalesMap = {};
  const terrQuotaMap = {};

  keys.terrs.forEach(t => {
    terrSalesMap[t.Name] = 0;
    terrQuotaMap[t.Name] = 0;
  });

  salesFacts.forEach(sf => {
    const terrObj = starSchema.dimTerritories.find(t => t.TerritoryKey === sf.TerritoryKey);
    if (terrObj && terrSalesMap[terrObj.Name] !== undefined) {
      terrSalesMap[terrObj.Name] += sf.SalesAmount;
    }
  });

  incentiveFacts.forEach(inf => {
    const repObj = starSchema.dimReps.find(r => r.RepKey === inf.RepKey);
    // Lookup which territory the rep is assigned to
    const terrID = etlEngine.getRepAssignment(repObj.RepID, "2026-06-15");
    const terrObj = starSchema.dimTerritories.find(t => t.TerritoryID === terrID);
    if (terrObj && terrQuotaMap[terrObj.Name] !== undefined) {
      terrQuotaMap[terrObj.Name] += inf.QuotaAmount;
    }
  });

  const terrLabels = Object.keys(terrSalesMap);
  const terrSales = Object.values(terrSalesMap);
  const terrQuotas = Object.values(terrQuotaMap);

  if (chartSalesTerritory) chartSalesTerritory.destroy();
  chartSalesTerritory = new Chart(document.getElementById("chart-sales-territory"), {
    type: "bar",
    data: {
      labels: terrLabels,
      datasets: [
        {
          label: "Actual Sales",
          data: terrSales,
          backgroundColor: "#3b82f6",
          borderRadius: 4
        },
        {
          label: "Quota Target",
          data: terrQuotas,
          backgroundColor: "#1e293b",
          borderColor: "#06b6d4",
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: val => "$" + (val / 1000) + "k" }
        }
      },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12 } }
      }
    }
  });

  // 2. CALL PLAN COVERAGE BY PHYSICIAN SPECIALTY
  const specialtyTarget = {};
  const specialtyDone = {};

  callFacts.forEach(cf => {
    const phyObj = starSchema.dimPhysicians.find(p => p.PhysicianKey === cf.PhysicianKey);
    if (phyObj) {
      const spec = phyObj.Specialty;
      specialtyTarget[spec] = (specialtyTarget[spec] || 0) + cf.TargetCalls;
      specialtyDone[spec] = (specialtyDone[spec] || 0) + cf.CompletedCalls;
    }
  });

  const specLabels = Object.keys(specialtyTarget);
  const specTargets = Object.values(specialtyTarget);
  const specDone = Object.values(specialtyDone);

  if (chartCoverageSpecialty) chartCoverageSpecialty.destroy();
  chartCoverageSpecialty = new Chart(document.getElementById("chart-coverage-specialty"), {
    type: "bar",
    data: {
      labels: specLabels,
      datasets: [
        {
          label: "Target Visits",
          data: specTargets,
          backgroundColor: "rgba(245, 158, 11, 0.15)",
          borderColor: "#f59e0b",
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: "Completed Visits",
          data: specDone,
          backgroundColor: "#10b981",
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: { beginAtZero: true }
      },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12 } }
      }
    }
  });

  // 3. REPRESENTATIVE PERFORMANCE GRID (SCATTER PLOT)
  const scatterPoints = incentiveFacts.map(inf => {
    const repObj = starSchema.dimReps.find(r => r.RepKey === inf.RepKey);
    
    // Calculate Call plan coverage for this specific rep
    const repCalls = callFacts.filter(c => c.RepKey === inf.RepKey);
    const targetCalls = repCalls.reduce((sum, c) => sum + c.TargetCalls, 0);
    const completedCalls = repCalls.reduce((sum, c) => sum + c.CompletedCalls, 0);
    const coverage = targetCalls > 0 ? (completedCalls / targetCalls) * 100 : 100.0;

    return {
      x: coverage,
      y: inf.QuotaAttainmentPct,
      repName: repObj ? repObj.Name : "Rep"
    };
  });

  if (chartRepPerformance) chartRepPerformance.destroy();
  chartRepPerformance = new Chart(document.getElementById("chart-rep-performance"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Representatives",
        data: scatterPoints,
        backgroundColor: "#06b6d4",
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Call Plan Coverage %", color: "#f8fafc" },
          min: 50,
          max: 120
        },
        y: {
          title: { display: true, text: "Quota Attainment %", color: "#f8fafc" },
          min: 40,
          max: 160
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const pt = ctx.raw;
              return `${pt.repName}: Coverage=${pt.x.toFixed(1)}%, Attainment=${pt.y.toFixed(1)}%`;
            }
          }
        }
      }
    }
  });

  // 4. INCENTIVE PAYOUT BREAKDOWN (Stacked columns)
  const repNames = [];
  const baseComms = [];
  const bonusPayouts = [];

  incentiveFacts.slice(0, 10).forEach(inf => { // Top 10 reps to keep it clean
    const repObj = starSchema.dimReps.find(r => r.RepKey === inf.RepKey);
    repNames.push(repObj ? repObj.Name : "Rep");
    baseComms.push(inf.BaseCommission);
    bonusPayouts.push(inf.BonusPayout);
  });

  if (chartPayoutBreakdown) chartPayoutBreakdown.destroy();
  chartPayoutBreakdown = new Chart(document.getElementById("chart-payout-breakdown"), {
    type: "bar",
    data: {
      labels: repNames,
      datasets: [
        {
          label: "Base Commission (2.0%)",
          data: baseComms,
          backgroundColor: "#3b82f6",
          stack: "Stack 0"
        },
        {
          label: "Incentive Bonus (Accelerated Tiers)",
          data: bonusPayouts,
          backgroundColor: "#10b981",
          stack: "Stack 0",
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          stacked: true,
          ticks: { callback: val => "$" + val }
        },
        x: { stacked: true }
      },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12 } }
      }
    }
  });
}

// =========================================================================
// Top Action Handlers (Presets & Random Loader)
// =========================================================================

function setupActionHandlers() {
  const restoreBtn = document.getElementById("btn-restore-preset");
  const randomBtn = document.getElementById("btn-random-load");

  restoreBtn.addEventListener("click", () => {
    loadPresetDataset();
    logToConsole("Preset dataset successfully restored.", "success");
  });

  randomBtn.addEventListener("click", () => {
    generateAndLoadRandomData();
  });
}

function generateAndLoadRandomData() {
  logToConsole("Initiating transaction generation algorithm...", "info");
  
  // Clone baseline entities
  const baseData = JSON.parse(JSON.stringify(window.PRESET_DATA));
  
  // Scramble sales invoices with randomized amounts and assignment mappings
  baseData.sales.forEach(s => {
    const scale = 0.5 + Math.random() * 1.1; // sales variations
    s.Amount = (parseFloat(s.Amount) * scale).toFixed(2);
  });

  // Scramble completed calls counts
  baseData.calls = [];
  let callIdSeq = 1;
  const month_str = "2026-06";
  const activeAssignments = {};
  baseData.assignments.forEach(asg => {
    if (asg.EndDate === "") activeAssignments[asg.RepID] = asg.TerritoryID;
  });

  baseData.reps.forEach(rep => {
    if (rep.Active === "0") return;
    const terrID = activeAssignments[rep.RepID];
    const repPhysicians = baseData.physicians.filter(p => p.TerritoryID === terrID);
    
    // Filter down to the planned physician profiles
    const plans = baseData.call_plans.filter(cp => cp.RepID === rep.RepID);
    
    plans.forEach(cp => {
      const target = parseInt(cp.TargetCalls);
      // random success rate: underperforming, target hits, accelerators
      const factor = Math.random() > 0.85 ? 0.6 : (Math.random() > 0.40 ? 1.0 : 1.2);
      const actualCount = Math.round(target * factor);
      
      for (let c = 0; c < actualCount; c++) {
        const day = 1 + Math.floor(Math.random() * 30);
        baseData.calls.push({
          CallID: `CALL${callIdSeq++}`,
          RepID: rep.RepID,
          PhysicianID: cp.PhysicianID,
          CallDate: `2026-06-${day < 10 ? "0" + day : day}`,
          Status: Math.random() > 0.05 ? "Completed" : "No Show"
        });
      }
    });
  });

  logToConsole(`Generated ${baseData.sales.length} invoices and ${baseData.calls.length} physician call logs.`, "info");
  
  // Load raw data and trigger pipelines
  etlEngine.loadRawData(baseData);
  starSchema = etlEngine.runPipeline();

  // Update BI reports
  hydrateFilterOptions();
  updateDashboard();

  logToConsole("Database reload and BI aggregates sync completed. Charts updated successfully.", "success");
}

// =========================================================================
// Data CSV Uploader Component
// =========================================================================

function setupUploader() {
  const dropzone = document.getElementById("upload-dropzone");
  const fileInput = document.getElementById("upload-file-input");
  const etlManualBtn = document.getElementById("btn-run-manual-etl");
  const clearLogBtn = document.getElementById("btn-clear-logs");

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", e => {
    e.preventDefault();
    dropzone.style.borderColor = "var(--color-secondary)";
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.style.borderColor = "var(--card-border)";
  });

  dropzone.addEventListener("drop", e => {
    e.preventDefault();
    dropzone.style.borderColor = "var(--card-border)";
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUploadedFiles(files);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      handleUploadedFiles(fileInput.files);
    }
  });

  etlManualBtn.addEventListener("click", () => {
    logToConsole("Manual request received: Running transform steps...", "info");
    starSchema = etlEngine.runPipeline();
    updateDashboard();
    logToConsole("Stored procedures complete. Star schema refresh is successful.", "success");
  });

  clearLogBtn.addEventListener("click", () => {
    document.getElementById("pipeline-console").innerHTML = "";
  });
}

function handleUploadedFiles(files) {
  let loadedCount = 0;
  const rawDataCopy = JSON.parse(JSON.stringify(etlEngine.raw));

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    const name = file.name.toLowerCase();

    reader.onload = e => {
      const csvText = e.target.result;
      const parsedData = AnalyticsETL.parseCSV(csvText);

      if (parsedData.length === 0) {
        logToConsole(`Failed to parse file '${file.name}'. Empty rows or header mismatch.`, "error");
        return;
      }

      // Map file to correct raw table
      if (name.includes("reps")) {
        rawDataCopy.reps = parsedData;
        logToConsole(`Loaded reps CSV: ${parsedData.length} records.`, "success");
        loadedCount++;
      } else if (name.includes("territor")) {
        rawDataCopy.territories = parsedData;
        logToConsole(`Loaded territories CSV: ${parsedData.length} records.`, "success");
        loadedCount++;
      } else if (name.includes("assign")) {
        rawDataCopy.assignments = parsedData;
        logToConsole(`Loaded assignments CSV: ${parsedData.length} records.`, "success");
        loadedCount++;
      } else if (name.includes("physician")) {
        rawDataCopy.physicians = parsedData;
        logToConsole(`Loaded physicians CSV: ${parsedData.length} records.`, "success");
        loadedCount++;
      } else if (name.includes("plan")) {
        rawDataCopy.call_plans = parsedData;
        logToConsole(`Loaded call plans CSV: ${parsedData.length} records.`, "success");
        loadedCount++;
      } else if (name.includes("call")) { // make sure it matches 'calls.csv' not 'call_plans' again
        if (!name.includes("plan")) {
          rawDataCopy.calls = parsedData;
          logToConsole(`Loaded completed calls CSV: ${parsedData.length} records.`, "success");
          loadedCount++;
        }
      } else if (name.includes("sale")) {
        rawDataCopy.sales = parsedData;
        logToConsole(`Loaded sales ledger CSV: ${parsedData.length} records.`, "success");
        loadedCount++;
      } else if (name.includes("quota")) {
        rawDataCopy.quotas = parsedData;
        logToConsole(`Loaded quotas CSV: ${parsedData.length} records.`, "success");
        loadedCount++;
      } else {
        logToConsole(`Warning: Ignored unknown file mapping '${file.name}'.`, "warning");
      }

      // If all files parsed, reload engine and run ETL pipeline
      if (loadedCount > 0) {
        etlEngine.loadRawData(rawDataCopy);
        starSchema = etlEngine.runPipeline();
        hydrateFilterOptions();
        updateDashboard();
      }
    };

    reader.readAsText(file);
  });
}

// Generate sample templates for CSV uploader downloads
function downloadTemplate(type) {
  let csvContent = "";
  let filename = "";

  if (type === "reps") {
    csvContent = "RepID,FirstName,LastName,Title,Email,Phone,HireDate,Active\nREP001,John,Smith,Sales Representative,john.smith@pharma.com,555-0100,2025-01-01,1\nREP002,Jane,Doe,Senior Specialist,jane.doe@pharma.com,555-0200,2024-03-12,1";
    filename = "reps_template.csv";
  } else if (type === "sales") {
    csvContent = "SalesID,RepID,ProductID,Amount,Date\nSALE001,REP001,PROD001,12000.00,2026-06-05\nSALE002,REP002,PROD003,47500.00,2026-06-12";
    filename = "sales_template.csv";
  } else if (type === "quotas") {
    csvContent = "QuotaID,RepID,MonthYear,QuotaAmount\nQTA001,REP001,2026-06,95000.00\nQTA002,REP002,2026-06,150000.00";
    filename = "quotas_template.csv";
  } else if (type === "calls") {
    csvContent = "CallID,RepID,PhysicianID,CallDate,Status\nCALL001,REP001,PHY0001,2026-06-02,Completed\nCALL002,REP001,PHY0002,2026-06-03,No Show";
    filename = "calls_template.csv";
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================================
// SQL SQL Scripts Code Viewer Panel
// =========================================================================

function setupCodeViewer() {
  const menuItems = document.querySelectorAll(".code-menu-item");
  const codeBlock = document.getElementById("code-display-block");
  const titleHeader = document.getElementById("code-script-title");
  const copyBtn = document.getElementById("btn-copy-code");

  let activeScriptKey = "ddl_oltp";

  function loadActiveScript() {
    if (typeof window.SQL_SCRIPTS === "undefined") return;
    const script = window.SQL_SCRIPTS[activeScriptKey];
    if (!script) return;

    titleHeader.innerText = script.title;
    
    // Basic syntax highlighting on load
    codeBlock.innerHTML = highlightSQLSyntax(script.code);
  }

  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      menuItems.forEach(mi => mi.classList.remove("active"));
      item.classList.add("active");
      activeScriptKey = item.getAttribute("data-script");
      loadActiveScript();
    });
  });

  copyBtn.addEventListener("click", () => {
    const rawCode = window.SQL_SCRIPTS[activeScriptKey].code;
    navigator.clipboard.writeText(rawCode).then(() => {
      const originalText = copyBtn.innerText;
      copyBtn.innerText = "Copied!";
      copyBtn.style.background = "var(--color-accent)";
      setTimeout(() => {
        copyBtn.innerText = originalText;
        copyBtn.style.background = "";
      }, 1500);
    });
  });

  // Initial code load
  loadActiveScript();
}

function highlightSQLSyntax(sql) {
  // Simple regex parser to wrap SQL tags in classes
  let escaped = sql
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight Comments
  escaped = escaped.replace(/(--.*)/g, '<span class="code-comment">$1</span>');
  escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="code-comment">$1</span>');

  // Highlight SQL keywords
  const keywords = [
    "CREATE TABLE", "PRIMARY KEY", "FOREIGN KEY", "REFERENCES", "IDENTITY", "UNIQUE", "NOT NULL", "NULL", "CHECK", "CONSTRAINT", "BIT", "DATE", "INT", "VARCHAR", "DECIMAL", "COLUMNSTORE INDEX", "CREATE INDEX", "PROCEDURE", "CREATE PROCEDURE", "ALTER PROCEDURE", "BEGIN", "END", "SET NOCOUNT", "ON", "DECLARE", "SELECT", "INSERT INTO", "UPDATE", "DELETE FROM", "FROM", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "ON", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "CASE", "WHEN", "THEN", "ELSE", "END AS", "WITH", "AS", "BEGIN TRY", "END TRY", "BEGIN CATCH", "END CATCH", "BEGIN TRANSACTION", "COMMIT TRANSACTION", "ROLLBACK TRANSACTION", "PRINT", "RAISERROR", "EOMONTH", "CAST", "FORMAT", "ISNULL", "SUM", "COUNT", "MAX", "MIN", "AVG", "SET TRANSACTION ISOLATION LEVEL", "SNAPSHOT", "READ COMMITTED", "TABLOCK", "NOLOCK", "ROWLOCK"
  ];

  // Regex boundaries around words
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b(${kw})\\b`, "gi");
    escaped = escaped.replace(regex, '<span class="code-keyword">$1</span>');
  });

  // Highlight string literals
  escaped = escaped.replace(/('[^']*')/g, '<span class="code-string">$1</span>');

  return escaped;
}
