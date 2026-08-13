// Sales Territory & Incentive Compensation Analytics ETL Engine (JS Database Simulator)

class AnalyticsETL {
  constructor() {
    this.raw = {}; // Holds raw OLTP data
    this.olap = {
      dimReps: [],
      dimTerritories: [],
      dimPhysicians: [],
      dimDates: [],
      factSales: [],
      factCallActivity: [],
      factIncentives: []
    };
  }

  // Parse CSV helper function
  static parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        row.push("");
      } else if ((c === "\r" || c === "\n") && !inQuotes) {
        if (c === "\r" && next === "\n") {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.trim());
    return lines.slice(1).map(line => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = line[index] ? line[index].trim() : "";
      });
      return obj;
    });
  }

  // Ingest raw JSON or CSV datasets
  loadRawData(datasets) {
    // datasets: { reps: [...], territories: [...], assignments: [...], physicians: [...], call_plans: [...], calls: [...], sales: [...], quotas: [...] }
    this.raw = {
      reps: datasets.reps || [],
      territories: datasets.territories || [],
      assignments: datasets.assignments || [],
      physicians: datasets.physicians || [],
      call_plans: datasets.call_plans || [],
      calls: datasets.calls || [],
      sales: datasets.sales || [],
      quotas: datasets.quotas || []
    };
  }

  // Run the full ETL pipeline (Transforms OLTP raw files to OLAP Star Schema)
  runPipeline() {
    console.time("ETL Pipeline Run");
    this.buildDimDates();
    this.buildDimTerritories();
    this.buildDimReps();
    this.buildDimPhysicians();
    this.buildFactSales();
    this.buildFactCallActivity();
    this.buildFactIncentives();
    console.timeEnd("ETL Pipeline Run");
    return this.olap;
  }

  // Helper: Format Date key as YYYYMMDD
  getDateKey(dateStr) {
    if (!dateStr) return null;
    const clean = dateStr.split(" ")[0]; // Strip time if present
    const parts = clean.split("-");
    if (parts.length !== 3) return null;
    return parseInt(parts[0] + parts[1] + parts[2]);
  }

  // Helper: Get active assignment for a rep on a specific date
  getRepAssignment(repId, dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    
    const active = this.raw.assignments.find(asg => {
      if (asg.RepID !== repId) return false;
      const start = new Date(asg.StartDate);
      const end = asg.EndDate ? new Date(asg.EndDate) : new Date("9999-12-31");
      return date >= start && date <= end;
    });

    return active ? active.TerritoryID : null;
  }

  // Dimension 1: DimDates
  buildDimDates() {
    // Generate dates dynamically based on sales and calls dates
    const dateStrings = new Set();
    
    // Default range for June 2026 if nothing else exists
    dateStrings.add("2026-06-01");
    
    this.raw.sales.forEach(s => s.Date && dateStrings.add(s.Date));
    this.raw.calls.forEach(c => c.CallDate && dateStrings.add(c.CallDate));

    this.olap.dimDates = Array.from(dateStrings).map(dateStr => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const quarters = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4];
      const quarter = quarters[date.getMonth()];

      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      return {
        DateKey: this.getDateKey(dateStr),
        Date: dateStr,
        Day: day,
        Month: month,
        MonthName: monthNames[date.getMonth()],
        Quarter: quarter,
        Year: year
      };
    }).sort((a, b) => a.DateKey - b.DateKey);
  }

  // Dimension 2: DimTerritories
  buildDimTerritories() {
    this.olap.dimTerritories = this.raw.territories.map((t, idx) => ({
      TerritoryKey: idx + 1,
      TerritoryID: t.TerritoryID,
      Name: t.Name,
      Region: t.Region,
      District: t.District
    }));
  }

  // Dimension 3: DimReps
  buildDimReps() {
    this.olap.dimReps = this.raw.reps.map((r, idx) => {
      // Find district/region based on current assignment
      const activeTerrID = this.raw.assignments.find(asg => asg.RepID === r.RepID && !asg.EndDate)?.TerritoryID;
      const terrObj = this.raw.territories.find(t => t.TerritoryID === activeTerrID);

      return {
        RepKey: idx + 1,
        RepID: r.RepID,
        Name: `${r.FirstName} ${r.LastName}`,
        Title: r.Title,
        Email: r.Email,
        Phone: r.Phone,
        HireDate: r.HireDate,
        ActiveStatus: r.Active === "1" ? "Active" : "Terminated",
        District: terrObj ? terrObj.District : "Unassigned",
        Region: terrObj ? terrObj.Region : "Unassigned"
      };
    });
  }

  // Dimension 4: DimPhysicians
  buildDimPhysicians() {
    this.olap.dimPhysicians = this.raw.physicians.map((p, idx) => ({
      PhysicianKey: idx + 1,
      PhysicianID: p.PhysicianID,
      Name: `Dr. ${p.FirstName} ${p.LastName}`,
      Specialty: p.Specialty,
      TerritoryID: p.TerritoryID
    }));
  }

  // Fact 1: FactSales
  buildFactSales() {
    let salesKeySeq = 1;
    this.olap.factSales = this.raw.sales.map(s => {
      const repObj = this.olap.dimReps.find(r => r.RepID === s.RepID);
      const terrID = this.getRepAssignment(s.RepID, s.Date);
      const terrObj = this.olap.dimTerritories.find(t => t.TerritoryID === terrID);
      const dateKey = this.getDateKey(s.Date);

      return {
        SalesKey: salesKeySeq++,
        DateKey: dateKey,
        RepKey: repObj ? repObj.RepKey : -1,
        TerritoryKey: terrObj ? terrObj.TerritoryKey : -1,
        SalesAmount: parseFloat(s.Amount) || 0.0
      };
    });
  }

  // Fact 2: FactCallActivity
  buildFactCallActivity() {
    // Group target call plans
    const callPlanMap = {};
    this.raw.call_plans.forEach(cp => {
      const key = `${cp.RepID}|${cp.PhysicianID}`;
      callPlanMap[key] = (callPlanMap[key] || 0) + parseInt(cp.TargetCalls || 0);
    });

    // Group actual completed calls
    const completedCallsMap = {};
    this.raw.calls.forEach(c => {
      if (c.Status === "Completed") {
        const key = `${c.RepID}|${c.PhysicianID}`;
        completedCallsMap[key] = (completedCallsMap[key] || 0) + 1;
      }
    });

    // We build the fact records for June 2026 based on all physicians that had call plans or actual calls
    const repPhysicianPairs = new Set([
      ...Object.keys(callPlanMap),
      ...Object.keys(completedCallsMap)
    ]);

    let callKeySeq = 1;
    this.olap.factCallActivity = Array.from(repPhysicianPairs).map(pair => {
      const [repId, phyId] = pair.split("|");
      
      const repObj = this.olap.dimReps.find(r => r.RepID === repId);
      const phyObj = this.olap.dimPhysicians.find(p => p.PhysicianID === phyId);
      
      // Territory is mapped from physician's territory or rep's assignment
      const terrID = phyObj ? phyObj.TerritoryID : this.getRepAssignment(repId, "2026-06-15");
      const terrObj = this.olap.dimTerritories.find(t => t.TerritoryID === terrID);

      const targetCalls = callPlanMap[pair] || 0;
      const completedCalls = completedCallsMap[pair] || 0;
      const coverage = targetCalls > 0 ? (completedCalls / targetCalls) * 100 : 100.0;

      return {
        CallKey: callKeySeq++,
        DateKey: 20260615, // Mid-month June 2026 default key
        RepKey: repObj ? repObj.RepKey : -1,
        TerritoryKey: terrObj ? terrObj.TerritoryKey : -1,
        PhysicianKey: phyObj ? phyObj.PhysicianKey : -1,
        TargetCalls: targetCalls,
        CompletedCalls: completedCalls,
        CallPlanCoveragePct: parseFloat(coverage.toFixed(2))
      };
    });
  }

  // Fact 3: FactIncentiveCompensation (Stored Procedure calculation simulation)
  buildFactIncentives() {
    let incentiveKeySeq = 1;

    this.olap.factIncentives = this.olap.dimReps.map(rep => {
      if (rep.ActiveStatus === "Terminated") return null;

      // 1. Calculate Actual Sales (sum from FactSales)
      const actualSales = this.olap.factSales
        .filter(s => s.RepKey === rep.RepKey)
        .reduce((sum, s) => sum + s.SalesAmount, 0.0);

      // 2. Fetch Quota for June 2026
      const quotaObj = this.raw.quotas.find(q => q.RepID === rep.RepID);
      const quotaAmount = quotaObj ? parseFloat(quotaObj.QuotaAmount) : 0.0;

      // 3. Compute Quota Attainment Pct
      const attainmentPct = quotaAmount > 0 ? (actualSales / quotaAmount) * 100 : 0.0;

      // 4. Calculate Base Commission: 2.0% of Sales
      const baseCommission = actualSales * 0.02;

      // 5. Calculate Bonus via Accelerator Curve
      // - Attainment < 80%: No bonus.
      // - 80% to 100%: 1% bonus on sales above 80% quota.
      // - 100% to 120%: Tier 1 max + 2.5% bonus on sales above 100% quota.
      // - > 120%: Tier 1 max + Tier 2 max + 5% bonus on sales above 120% quota.
      let bonusPayout = 0.0;
      
      if (quotaAmount > 0) {
        const t80 = 0.8 * quotaAmount;
        const t100 = 1.0 * quotaAmount;
        const t120 = 1.2 * quotaAmount;

        const maxTier1Bonus = (t100 - t80) * 0.01;
        const maxTier2Bonus = (t120 - t100) * 0.025;

        if (actualSales > t80 && actualSales <= t100) {
          bonusPayout = (actualSales - t80) * 0.01;
        } else if (actualSales > t100 && actualSales <= t120) {
          bonusPayout = maxTier1Bonus + (actualSales - t100) * 0.025;
        } else if (actualSales > t120) {
          bonusPayout = maxTier1Bonus + maxTier2Bonus + (actualSales - t120) * 0.05;
        }
      }

      const totalPayout = baseCommission + bonusPayout;

      return {
        IncentiveKey: incentiveKeySeq++,
        MonthKey: 20260630, // End of June 2026 key
        RepKey: rep.RepKey,
        QuotaAmount: parseFloat(quotaAmount.toFixed(2)),
        ActualSales: parseFloat(actualSales.toFixed(2)),
        QuotaAttainmentPct: parseFloat(attainmentPct.toFixed(2)),
        BaseCommission: parseFloat(baseCommission.toFixed(2)),
        BonusPayout: parseFloat(bonusPayout.toFixed(2)),
        TotalPayout: parseFloat(totalPayout.toFixed(2))
      };
    }).filter(Boolean);
  }
}

// Export for usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsETL;
} else {
  window.AnalyticsETL = AnalyticsETL;
}
