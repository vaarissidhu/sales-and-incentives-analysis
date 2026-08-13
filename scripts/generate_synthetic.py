import os
import csv
import random
from datetime import datetime, timedelta

def generate_synthetic_data(output_dir="raw_data"):
    os.makedirs(output_dir, exist_ok=True)
    
    # Configuration
    regions = ["East", "West", "Midwest", "South"]
    districts = {
        "East": ["New England", "Mid-Atlantic"],
        "West": ["Pacific Northwest", "California"],
        "Midwest": ["Great Lakes", "Plains"],
        "South": ["Southeast", "Texas"]
    }
    
    products = [
        {"id": "PROD001", "name": "CardioVasq (Cardiology)", "price": 120.0},
        {"id": "PROD002", "name": "NeuroMax (Neurology)", "price": 250.0},
        {"id": "PROD003", "name": "OncoShield (Oncology)", "price": 950.0},
        {"id": "PROD004", "name": "PulmoPure (Pulmonology)", "price": 85.0}
    ]
    
    specialties = ["Cardiology", "Neurology", "Oncology", "Pulmonology", "General Practice"]
    
    # 1. Generate Territories
    territories = []
    t_id = 1
    for region, dists in districts.items():
        for dist in dists:
            for i in range(1, 3): # 2 territories per district
                territories.append({
                    "TerritoryID": f"TERR{t_id:03d}",
                    "Name": f"{dist} - Sector {chr(64 + i)}",
                    "Region": region,
                    "District": dist
                })
                t_id += 1
                
    with open(os.path.join(output_dir, "territories.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["TerritoryID", "Name", "Region", "District"])
        writer.writeheader()
        writer.writerows(territories)
        
    # 2. Generate Reps
    rep_names = [
        ("Sarah", "Conner"), ("John", "Smith"), ("David", "Miller"), ("Emma", "Davis"),
        ("James", "Wilson"), ("Olivia", "Taylor"), ("Robert", "Anderson"), ("Sophia", "Thomas"),
        ("Michael", "White"), ("Isabella", "Martin"), ("William", "Jackson"), ("Mia", "Thompson"),
        ("Charles", "Garcia"), ("Emily", "Martinez"), ("Thomas", "Robinson"), ("Ava", "Clark")
    ]
    
    reps = []
    for i, (first, last) in enumerate(rep_names):
        rep_id = f"REP{i+1:03d}"
        hire_date = datetime(2024, 1, 15) + timedelta(days=random.randint(0, 300))
        reps.append({
            "RepID": rep_id,
            "FirstName": first,
            "LastName": last,
            "Title": "Territory Sales Representative" if i < 12 else "Senior Executive Sales Representative",
            "Email": f"{first.lower()}.{last.lower()}@pharmapipe.com",
            "Phone": f"555-{random.randint(100, 999):03d}-{random.randint(1000, 9999):04d}",
            "HireDate": hire_date.strftime("%Y-%m-%d"),
            "Active": "1" if random.random() > 0.08 else "0"
        })
        
    with open(os.path.join(output_dir, "reps.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["RepID", "FirstName", "LastName", "Title", "Email", "Phone", "HireDate", "Active"])
        writer.writeheader()
        writer.writerows(reps)

    # 3. Assign Reps to Territories
    assignments = []
    a_id = 1
    # Assign each rep to one territory
    for i, rep in enumerate(reps):
        terr = territories[i % len(territories)]
        assignments.append({
            "AssignmentID": f"ASGN{a_id:04d}",
            "RepID": rep["RepID"],
            "TerritoryID": terr["TerritoryID"],
            "StartDate": rep["HireDate"],
            "EndDate": "" if rep["Active"] == "1" else (datetime.strptime(rep["HireDate"], "%Y-%m-%d") + timedelta(days=180)).strftime("%Y-%m-%d")
        })
        a_id += 1
        
    with open(os.path.join(output_dir, "rep_assignments.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["AssignmentID", "RepID", "TerritoryID", "StartDate", "EndDate"])
        writer.writeheader()
        writer.writerows(assignments)

    # 4. Generate Physicians
    physicians = []
    p_id = 1
    last_names = ["Jones", "Williams", "Brown", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen"]
    first_names = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra"]

    for terr in territories:
        # Create 5-8 physicians in each territory
        num_physicians = random.randint(5, 8)
        for _ in range(num_physicians):
            spec = random.choice(specialties)
            physicians.append({
                "PhysicianID": f"PHY{p_id:04d}",
                "FirstName": random.choice(first_names),
                "LastName": random.choice(last_names),
                "Specialty": spec,
                "TerritoryID": terr["TerritoryID"]
            })
            p_id += 1
            
    with open(os.path.join(output_dir, "physicians.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["PhysicianID", "FirstName", "LastName", "Specialty", "TerritoryID"])
        writer.writeheader()
        writer.writerows(physicians)

    # 5. Generate Call Plans and Calls for a month (June 2026)
    month_str = "2026-06"
    call_plans = []
    calls = []
    cp_id = 1
    c_id = 1
    
    # Establish assignments map for lookup
    active_assignments = {asg["RepID"]: asg["TerritoryID"] for asg in assignments if asg["EndDate"] == ""}
    
    for rep in reps:
        if rep["Active"] == "0":
            continue
        rep_id = rep["RepID"]
        terr_id = active_assignments.get(rep_id)
        if not terr_id:
            continue
            
        # Get physicians in this rep's territory
        rep_physicians = [p for p in physicians if p["TerritoryID"] == terr_id]
        
        # Create call plans for 80% of these physicians
        plan_physicians = random.sample(rep_physicians, k=int(len(rep_physicians) * 0.8))
        
        for phy in plan_physicians:
            target_calls = random.choice([2, 3, 4])
            call_plans.append({
                "PlanID": f"PLAN{cp_id:05d}",
                "RepID": rep_id,
                "PhysicianID": phy["PhysicianID"],
                "TargetCalls": target_calls,
                "MonthYear": month_str
            })
            cp_id += 1
            
            # Generate actual calls
            rep_perf_factor = random.choice([0.7, 0.9, 1.0, 1.1])
            actual_calls_count = min(6, round(target_calls * rep_perf_factor + random.choice([-1, 0, 1])))
            actual_calls_count = max(0, actual_calls_count)
            
            for call_num in range(actual_calls_count):
                day = random.randint(1, 30)
                call_date = f"2026-06-{day:02d}"
                status = "Completed" if random.random() > 0.05 else "No Show"
                calls.append({
                    "CallID": f"CALL{c_id:06d}",
                    "RepID": rep_id,
                    "PhysicianID": phy["PhysicianID"],
                    "CallDate": call_date,
                    "Status": status
                })
                c_id += 1
                
    with open(os.path.join(output_dir, "call_plans.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["PlanID", "RepID", "PhysicianID", "TargetCalls", "MonthYear"])
        writer.writeheader()
        writer.writerows(call_plans)

    with open(os.path.join(output_dir, "calls.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["CallID", "RepID", "PhysicianID", "CallDate", "Status"])
        writer.writeheader()
        writer.writerows(calls)

    # 6. Generate Sales Transactions & Quotas for June 2026
    sales = []
    quotas = []
    sales_id = 1
    quota_id = 1
    
    for rep in reps:
        if rep["Active"] == "0":
            continue
        rep_id = rep["RepID"]
        terr_id = active_assignments.get(rep_id)
        if not terr_id:
            continue
            
        # Define Quota based on rep experience/title
        base_quota = 150000.0 if "Senior" in rep["Title"] else 95000.0
        quota_amount = base_quota * random.choice([0.9, 1.0, 1.1])
        quotas.append({
            "QuotaID": f"QTA{quota_id:05d}",
            "RepID": rep_id,
            "MonthYear": month_str,
            "QuotaAmount": round(quota_amount, 2)
        })
        quota_id += 1
        
        # Generate Sales Transactions
        rep_attainment = random.gauss(0.92, 0.15)
        rep_attainment = max(0.4, min(1.5, rep_attainment)) # boundary limits
        target_sales_total = quota_amount * rep_attainment
        
        current_sales_total = 0.0
        while current_sales_total < target_sales_total:
            prod = random.choice(products)
            units = random.choice([5, 10, 20, 50, 100])
            amount = prod["price"] * units
            day = random.randint(1, 30)
            sale_date = f"2026-06-{day:02d}"
            
            sales.append({
                "SalesID": f"SALE{sales_id:06d}",
                "RepID": rep_id,
                "ProductID": prod["id"],
                "Amount": round(amount, 2),
                "Date": sale_date
            })
            sales_id += 1
            current_sales_total += amount
            
    with open(os.path.join(output_dir, "sales.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["SalesID", "RepID", "ProductID", "Amount", "Date"])
        writer.writeheader()
        writer.writerows(sales)

    with open(os.path.join(output_dir, "quotas.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["QuotaID", "RepID", "MonthYear", "QuotaAmount"])
        writer.writeheader()
        writer.writerows(quotas)

    # 7. Write to synthetic_data.js for direct frontend ingestion
    js_content = f"""// Auto-generated synthetic sales-operations data for June 2026
const PRESET_DATA = {{
  territories: {repr(territories)},
  reps: {repr(reps)},
  assignments: {repr(assignments)},
  physicians: {repr(physicians)},
  call_plans: {repr(call_plans)},
  calls: {repr(calls)},
  sales: {repr(sales)},
  quotas: {repr(quotas)}
}};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = PRESET_DATA;
}} else {{
  window.PRESET_DATA = PRESET_DATA;
}}
"""
    # Replace single quotes with double quotes for JS compatibility if needed, or simply write raw repr (python repr is valid JS object literal in most cases, but lets ensure booleans are lowercase and empty strings are fine)
    # Python repr uses True/False. Let's convert to JS-friendly format by JSON dump
    import json
    js_data = {
        "territories": territories,
        "reps": reps,
        "assignments": assignments,
        "physicians": physicians,
        "call_plans": call_plans,
        "calls": calls,
        "sales": sales,
        "quotas": quotas
    }
    
    js_content_json = f"""// Auto-generated synthetic sales-operations data for June 2026
const PRESET_DATA = {json.dumps(js_data, indent=2)};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = PRESET_DATA;
}} else {{
  window.PRESET_DATA = PRESET_DATA;
}}
"""

    with open(os.path.join(os.path.dirname(output_dir), "synthetic_data.js"), "w") as f:
        f.write(js_content_json)

    print("Synthetic CSV and JS preset data generation completed successfully.")

if __name__ == "__main__":
    generate_synthetic_data()
