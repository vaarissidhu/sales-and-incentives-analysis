// SQL Stored Procedures and Query Optimization Scripts for UI Showcase

const SQL_SCRIPTS = {
  ddl_oltp: {
    title: "1. OLTP Database Schema (Source)",
    description: "DDL statements for creating the core transactional relational tables with primary keys, foreign keys, and indexes.",
    code: `-- ==========================================
-- OLTP RELATIONAL SCHEMA (Source System)
-- ==========================================

-- 1. Territories Table
CREATE TABLE Territories (
    TerritoryID VARCHAR(10) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Region VARCHAR(50) NOT NULL,
    District VARCHAR(50) NOT NULL
);

-- 2. Sales Representatives Table
CREATE TABLE Reps (
    RepID VARCHAR(10) PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Title VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE,
    Phone VARCHAR(20),
    HireDate DATE NOT NULL,
    Active BIT DEFAULT 1
);

-- 3. Rep Territory Assignments (Handles rep movement, historical tracking)
CREATE TABLE RepTerritoryAssignments (
    AssignmentID VARCHAR(10) PRIMARY KEY,
    RepID VARCHAR(10) NOT NULL,
    TerritoryID VARCHAR(10) NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NULL,
    FOREIGN KEY (RepID) REFERENCES Reps(RepID),
    FOREIGN KEY (TerritoryID) REFERENCES Territories(TerritoryID),
    CONSTRAINT CK_AssignmentDates CHECK (EndDate IS NULL OR EndDate >= StartDate)
);

-- 4. Physicians Table
CREATE TABLE Physicians (
    PhysicianID VARCHAR(10) PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Specialty VARCHAR(50) NOT NULL,
    TerritoryID VARCHAR(10) NOT NULL,
    FOREIGN KEY (TerritoryID) REFERENCES Territories(TerritoryID)
);

-- 5. Call Plans (Monthly targeted calls)
CREATE TABLE CallPlans (
    PlanID VARCHAR(10) PRIMARY KEY,
    RepID VARCHAR(10) NOT NULL,
    PhysicianID VARCHAR(10) NOT NULL,
    TargetCalls INT NOT NULL DEFAULT 0,
    MonthYear VARCHAR(7) NOT NULL, -- e.g., '2026-06'
    FOREIGN KEY (RepID) REFERENCES Reps(RepID),
    FOREIGN KEY (PhysicianID) REFERENCES Physicians(PhysicianID)
);

-- 6. Call Logs (Actual visits made)
CREATE TABLE Calls (
    CallID INT IDENTITY(1,1) PRIMARY KEY,
    RepID VARCHAR(10) NOT NULL,
    PhysicianID VARCHAR(10) NOT NULL,
    CallDate DATE NOT NULL,
    Status VARCHAR(20) NOT NULL CHECK (Status IN ('Completed', 'No Show')),
    FOREIGN KEY (RepID) REFERENCES Reps(RepID),
    FOREIGN KEY (PhysicianID) REFERENCES Physicians(PhysicianID)
);

-- 7. Sales Transactions (Invoices/Orders)
CREATE TABLE Sales (
    SalesID INT IDENTITY(1,1) PRIMARY KEY,
    RepID VARCHAR(10) NOT NULL,
    ProductID VARCHAR(10) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL CHECK (Amount >= 0),
    Date DATE NOT NULL,
    FOREIGN KEY (RepID) REFERENCES Reps(RepID)
);

-- 8. Sales Quotas (Monthly targets)
CREATE TABLE Quotas (
    QuotaID VARCHAR(10) PRIMARY KEY,
    RepID VARCHAR(10) NOT NULL,
    MonthYear VARCHAR(7) NOT NULL, -- e.g., '2026-06'
    QuotaAmount DECIMAL(18,2) NOT NULL,
    FOREIGN KEY (RepID) REFERENCES Reps(RepID)
);

-- Indexing raw OLTP tables to speed up operational updates and ETL extracts
CREATE INDEX IX_Sales_Rep_Date ON Sales(RepID, Date) INCLUDE (Amount);
CREATE INDEX IX_Calls_Rep_Physician ON Calls(RepID, PhysicianID, CallDate) INCLUDE (Status);
`
  },

  ddl_olap: {
    title: "2. OLAP Star Schema (Destination)",
    description: "DDL statements for creating the data warehouse Star Schema tables, containing central facts and linked dimensions.",
    code: `-- ==========================================
-- OLAP STAR SCHEMA (Data Warehouse)
-- ==========================================

-- 1. Date Dimension
CREATE TABLE DimDate (
    DateKey INT PRIMARY KEY, -- YYYYMMDD
    FullDate DATE NOT NULL,
    Day INT NOT NULL,
    Month INT NOT NULL,
    MonthName VARCHAR(15) NOT NULL,
    Quarter INT NOT NULL,
    Year INT NOT NULL
);

-- 2. Sales Rep Dimension (SCD Type 1/2)
CREATE TABLE DimRep (
    RepKey INT IDENTITY(1,1) PRIMARY KEY,
    RepID VARCHAR(10) NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Title VARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    Phone VARCHAR(20),
    HireDate DATE NOT NULL,
    ActiveStatus VARCHAR(15) NOT NULL, -- Active/Terminated
    District VARCHAR(50) NOT NULL,
    Region VARCHAR(50) NOT NULL,
    IsCurrent BIT DEFAULT 1
);

-- 3. Territory Dimension
CREATE TABLE DimTerritory (
    TerritoryKey INT IDENTITY(1,1) PRIMARY KEY,
    TerritoryID VARCHAR(10) NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Region VARCHAR(50) NOT NULL,
    District VARCHAR(50) NOT NULL
);

-- 4. Physician Dimension
CREATE TABLE DimPhysician (
    PhysicianKey INT IDENTITY(1,1) PRIMARY KEY,
    PhysicianID VARCHAR(10) NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Specialty VARCHAR(50) NOT NULL
);

-- 5. Fact Sales (Sales transactions)
CREATE TABLE FactSales (
    SalesKey INT IDENTITY(1,1) PRIMARY KEY,
    DateKey INT NOT NULL,
    RepKey INT NOT NULL,
    TerritoryKey INT NOT NULL,
    SalesAmount DECIMAL(18,2) NOT NULL,
    FOREIGN KEY (DateKey) REFERENCES DimDate(DateKey),
    FOREIGN KEY (RepKey) REFERENCES DimRep(RepKey),
    FOREIGN KEY (TerritoryKey) REFERENCES DimTerritory(TerritoryKey)
);

-- 6. Fact Call Activity (Aggregated call-plan coverage metrics)
CREATE TABLE FactCallActivity (
    CallKey INT IDENTITY(1,1) PRIMARY KEY,
    DateKey INT NOT NULL, -- Typical Month-End or reporting date key
    RepKey INT NOT NULL,
    TerritoryKey INT NOT NULL,
    PhysicianKey INT NOT NULL,
    TargetCalls INT NOT NULL DEFAULT 0,
    CompletedCalls INT NOT NULL DEFAULT 0,
    CallPlanCoveragePct DECIMAL(5,2) NOT NULL,
    FOREIGN KEY (DateKey) REFERENCES DimDate(DateKey),
    FOREIGN KEY (RepKey) REFERENCES DimRep(RepKey),
    FOREIGN KEY (TerritoryKey) REFERENCES DimTerritory(TerritoryKey),
    FOREIGN KEY (PhysicianKey) REFERENCES DimPhysician(PhysicianKey)
);

-- 7. Fact Incentive Compensation (Payouts and target achievements)
CREATE TABLE FactIncentiveCompensation (
    IncentiveKey INT IDENTITY(1,1) PRIMARY KEY,
    MonthKey INT NOT NULL, -- Month ending DateKey
    RepKey INT NOT NULL,
    QuotaAmount DECIMAL(18,2) NOT NULL,
    ActualSales DECIMAL(18,2) NOT NULL,
    QuotaAttainmentPct DECIMAL(6,2) NOT NULL,
    BaseCommission DECIMAL(18,2) NOT NULL,
    BonusPayout DECIMAL(18,2) NOT NULL,
    TotalPayout DECIMAL(18,2) NOT NULL,
    FOREIGN KEY (MonthKey) REFERENCES DimDate(DateKey),
    FOREIGN KEY (RepKey) REFERENCES DimRep(RepKey)
);

-- Columnstore Index for OLAP Fact tables to accelerate heavy analytical queries
CREATE COLUMNSTORE INDEX CSI_FactSales ON FactSales (DateKey, RepKey, TerritoryKey, SalesAmount);
CREATE COLUMNSTORE INDEX CSI_FactCallActivity ON FactCallActivity (DateKey, RepKey, TerritoryKey, TargetCalls, CompletedCalls);
`
  },

  etl_procedures: {
    title: "3. ETL Stored Procedures",
    description: "The core ETL pipeline SQL stored procedures. Example includes the complex Incentive Compensation Stored Procedure that calculates monthly commissions and tiered accelerators.",
    code: `-- =========================================================================
-- ETL STORED PROCEDURE: CALCULATE INCENTIVE COMPENSATION
-- =========================================================================

CREATE PROCEDURE sp_ETL_CalculateIncentiveCompensation
    @ReportingMonth VARCHAR(7) -- Format: 'YYYY-MM'
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @MonthEndKey INT;
    DECLARE @MonthEndDate DATE;

    -- Resolve Month Ending Date keys
    SELECT @MonthEndDate = EOMONTH(CAST(@ReportingMonth + '-01' AS DATE));
    SET @MonthEndKey = CAST(FORMAT(@MonthEndDate, 'yyyyMMdd') AS INT);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Clear existing facts for the reporting month to allow re-runs
        DELETE FROM FactIncentiveCompensation
        WHERE MonthKey = @MonthEndKey;

        -- 2. Build staging CTE to aggregate Sales and link Quotas
        WITH RepSales AS (
            -- Aggregate sales from FactSales
            SELECT 
                fs.RepKey,
                SUM(fs.SalesAmount) AS TotalSales
            FROM FactSales fs
            INNER JOIN DimDate dd ON fs.DateKey = dd.DateKey
            WHERE dd.Year = LEFT(@ReportingMonth, 4) 
              AND dd.Month = RIGHT(@ReportingMonth, 2)
            GROUP BY fs.RepKey
        ),
        RepQuota AS (
            -- Get quota from OLTP source mapped to current DimRep keys
            SELECT 
                dr.RepKey,
                q.QuotaAmount
            FROM Quotas q
            INNER JOIN DimRep dr ON q.RepID = dr.RepID
            WHERE q.MonthYear = @ReportingMonth
              AND dr.IsCurrent = 1
        ),
        StagedMetrics AS (
            -- Combine sales, quotas, and compute core percentages
            SELECT
                rq.RepKey,
                rq.QuotaAmount,
                ISNULL(rs.TotalSales, 0.0) AS ActualSales,
                CASE 
                    WHEN rq.QuotaAmount > 0 THEN (ISNULL(rs.TotalSales, 0.0) / rq.QuotaAmount) * 100 
                    ELSE 0.0 
                END AS AttainmentPct
            FROM RepQuota rq
            LEFT JOIN RepSales rs ON rq.RepKey = rs.RepKey
        ),
        CalculatedPayouts AS (
            -- Compute base commission and tiered accelerators
            -- - Base Commission: 2.0% of Sales
            -- - Tier 1: 80% to 100% Attainment -> 1.0% bonus on sales above 80% quota
            -- - Tier 2: 100% to 120% Attainment -> Tier 1 max + 2.5% bonus on sales above 100% quota
            -- - Tier 3: > 120% Attainment -> Tier 1 max + Tier 2 max + 5.0% bonus on sales above 120% quota
            SELECT
                RepKey,
                QuotaAmount,
                ActualSales,
                AttainmentPct,
                
                -- Base Commission
                (ActualSales * 0.02) AS BaseCommission,
                
                -- Tiered Accelerators
                CASE 
                    -- Below 80% quota: No bonus
                    WHEN AttainmentPct < 80 THEN 0.0
                    
                    -- 80% - 100%: 1% on sales in this tier
                    WHEN AttainmentPct >= 80 AND AttainmentPct <= 100 THEN 
                        (ActualSales - (0.80 * QuotaAmount)) * 0.01
                        
                    -- 100% - 120%: Max of Tier 1 + 2.5% on sales in this tier
                    WHEN AttainmentPct > 100 AND AttainmentPct <= 120 THEN 
                        ((0.20 * QuotaAmount) * 0.01) + 
                        ((ActualSales - QuotaAmount) * 0.025)
                        
                    -- Above 120%: Max of Tier 1 + Max of Tier 2 + 5% on sales in this tier (Uncapped Accelerator)
                    WHEN AttainmentPct > 120 THEN 
                        ((0.20 * QuotaAmount) * 0.01) + 
                        ((0.20 * QuotaAmount) * 0.025) + 
                        ((ActualSales - (1.20 * QuotaAmount)) * 0.05)
                    ELSE 0.0
                END AS BonusPayout
            FROM StagedMetrics
        )
        
        -- 3. Load facts table
        INSERT INTO FactIncentiveCompensation (
            MonthKey,
            RepKey,
            QuotaAmount,
            ActualSales,
            QuotaAttainmentPct,
            BaseCommission,
            BonusPayout,
            TotalPayout
        )
        SELECT
            @MonthEndKey,
            RepKey,
            QuotaAmount,
            ActualSales,
            CAST(AttainmentPct AS DECIMAL(6,2)),
            CAST(BaseCommission AS DECIMAL(18,2)),
            CAST(BonusPayout AS DECIMAL(18,2)),
            CAST((BaseCommission + BonusPayout) AS DECIMAL(18,2))
        FROM CalculatedPayouts;

        COMMIT TRANSACTION;
        PRINT 'ETL Compensation successfully calculated and loaded for ' + @ReportingMonth;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
            
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();
        
        RAISERROR(@ErrMsg, @ErrSeverity, @ErrState);
    END CATCH
END;
`
  },

  query_tuning: {
    title: "4. Deadlock Tuning & Performance Resolves",
    description: "A showcase of how database performance tuning, index alignment, and transaction reordering resolved major deadlock bottlenecks in concurrent pipelines.",
    code: `-- =========================================================================
-- CASE STUDY: PERFORMANCE TUNING AND DEADLOCK RESOLUTION
-- =========================================================================

/*
PROBLEM:
Under high concurrency, execution of 'sp_ETL_LoadFactCallActivity' and
updates to 'RepTerritoryAssignments' caused frequent Deadlocks (SQL Server Error 1205).
The transaction logs showed:
- Transaction A (ETL Job): Held Shared Lock (S) on 'RepTerritoryAssignments'
  and requested Exclusive Lock (X) on 'FactCallActivity'.
- Transaction B (Admin Portal): Held Exclusive Lock (X) on 'RepTerritoryAssignments'
  and requested Shared Lock (S) on 'FactCallActivity' via a validation trigger.

SLOW QUERY IN ETL AGGREGATION:
SELECT RepID, PhysicianID, COUNT(1) 
FROM Calls 
WHERE CallDate BETWEEN '2026-06-01' AND '2026-06-30'
GROUP BY RepID, PhysicianID;
-- Execution plan showed an Expensive Index Scan (92% Cost) on Calls.
*/

-- ----------------------------------------------------
-- SOLUTION 1: COVERING INDEXES (Eliminates Table Scan)
-- ----------------------------------------------------

-- Before optimization: The query performed a full table scan.
-- After optimization: Created a composite covering index that includes 
-- the CallDate range and the projected columns.

CREATE NONCLUSTERED INDEX IX_Calls_Tuning_Date_Rep_Phy 
ON Calls (CallDate) 
INCLUDE (RepID, PhysicianID, Status)
WITH (FILLFACTOR = 90, ONLINE = ON);

-- ----------------------------------------------------
-- SOLUTION 2: DEALIGNING LOCKS & QUERY REFACTORING
-- ----------------------------------------------------

-- Steps taken to eliminate deadlocks:
-- 1. Enabled Read Committed Snapshot Isolation (RCSI) on the data warehouse.
--    This prevents readers (analytical queries) from blocking writers.
ALTER DATABASE SalesWarehouse 
SET READ_COMMITTED_SNAPSHOT ON;

-- 2. Standardized update ordering. Stored procedures were modified to always
--    lock parent dimension records BEFORE fact modifications.
-- 3. Implemented Query Hints (ROWLOCK) to prevent lock escalation 
--    (escalating row locks to page/table locks).

-- Optimized ETL procedure query:
ALTER PROCEDURE sp_ETL_LoadFactCallActivity
    @StartDate DATE,
    @EndDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Use SNAPSHOT isolation for this session to eliminate read-write blocking
    SET TRANSACTION ISOLATION LEVEL SNAPSHOT;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- We extract data using a CTE with ROWLOCK hints on staging tables
        -- and load using bulk inserts with TABLOCK, avoiding deadlocking individual rows
        
        INSERT INTO FactCallActivity WITH (TABLOCK) (
            DateKey,
            RepKey,
            TerritoryKey,
            PhysicianKey,
            TargetCalls,
            CompletedCalls,
            CallPlanCoveragePct
        )
        SELECT 
            CAST(FORMAT(@EndDate, 'yyyyMMdd') AS INT),
            dr.RepKey,
            dt.TerritoryKey,
            dp.PhysicianKey,
            MAX(cp.TargetCalls),
            COUNT(c.CallID),
            CASE 
                WHEN MAX(cp.TargetCalls) > 0 
                THEN (CAST(COUNT(c.CallID) AS DECIMAL(5,2)) / MAX(cp.TargetCalls)) * 100 
                ELSE 100.00 
            END
        FROM CallPlans cp WITH (NOLOCK) -- Read uncommitted for source call plans
        LEFT JOIN Calls c ON cp.RepID = c.RepID 
             AND cp.PhysicianID = c.PhysicianID
             AND c.CallDate BETWEEN @StartDate AND @EndDate
             AND c.Status = 'Completed'
        INNER JOIN DimRep dr ON cp.RepID = dr.RepID AND dr.IsCurrent = 1
        INNER JOIN DimPhysician dp ON cp.PhysicianID = dp.PhysicianID
        -- Retrieve territory directly from assignment at call-plan date
        INNER JOIN DimTerritory dt ON dt.TerritoryID = dp.TerritoryID
        GROUP BY dr.RepKey, dt.TerritoryKey, dp.PhysicianKey;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
*/
`
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SQL_SCRIPTS;
} else {
  window.SQL_SCRIPTS = SQL_SCRIPTS;
}
