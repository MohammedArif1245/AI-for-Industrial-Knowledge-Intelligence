import os
import json
from datetime import datetime
from sqlalchemy.orm import Session
from database import Document, Chunk, KnowledgeNode, KnowledgeEdge, ComplianceGap
from rag_engine import add_document_to_vector_store

SYNTHETIC_DOCS = [
    # 1. Regulations
    {
        "filename": "regulation_factory_act_1948_boiler.txt",
        "category": "Regulation",
        "tags": "boiler, statutory, safety",
        "content": """FACTORY ACT 1948 - SECTION 31: SAFETY OF PRESSURE PLANT AND BOILERS
1. Every steam boiler or other vessel used for generating steam under pressure greater than atmospheric pressure shall be:
   (a) provided with a safety valve, pressure gauge, and water level indicator.
   (b) maintained in a safe condition and operated by qualified engineers.
2. STATUTORY INSPECTION FREQUENCY: Every steam boiler shall be thoroughly examined by a certified inspector at least once in every period of twelve (12) months. 
3. No steam boiler shall be operated or kept in use unless it has been certified by the State Inspector of Boilers within the preceding 12 months.
4. Any operation of a steam boiler beyond the 12-month inspection certificate period is a Class-A safety violation subject to immediate shutdown and penalty.
5. Minimum test pressure for inspection certification shall be 1.5 times the maximum allowable working pressure (MAWP)."""
    },
    {
        "filename": "regulation_oisd_116_fire_safety.txt",
        "category": "Regulation",
        "tags": "fire, safety, hydrant, standard",
        "content": """OISD-STD-116: FIRE PROTECTION FACILITIES FOR PETROLEUM DEPOTS AND TERMINALS
CLAUSE 6.2: RUNNING AND TESTING OF FIRE WATER PUMPS AND HYDRANT SYSTEM
1. The fire water pumps shall be test run daily for at least 10 minutes.
2. The fire water piping network and hydrant valves shall be physically checked for leaks and operational readiness.
3. INSPECTION FREQUENCY: The entire hydrant system, including water header pressure (minimum 7.0 kg/cm2 at the remotest point) and hydrant valve operation, shall be tested and flushed once every three (3) months (Quarterly).
4. Water spray systems (deluge valves) in high-risk zones (tank farms, pump houses) must be tested every six (6) months (Semi-annually).
5. All fire hoses must be pressure tested at 10.5 kg/cm2 once every twelve (12) months."""
    },
    
    # 2. Inspection Reports
    {
        "filename": "inspection_report_boiler_203.txt",
        "category": "Inspection Report",
        "tags": "boiler, inspection, boiler-203",
        "content": """STATUTORY STEAM BOILER INSPECTION REPORT
EQUIPMENT ID: BOILER-203 (High-Pressure Utility Boiler)
LOCATION: Utilities Section, Block-D
LAST INSPECTION DATE: February 15, 2025
INSPECTOR: Mr. R. Verma (Lead Statutory Inspector, State Boiler Directorate)
FINDINGS:
1. Shell and drum thickness measurements show normal wear with minimal corrosion allowance used (0.2mm out of 3.0mm allowance).
2. Water level indicators and gauge glasses are clear and functional.
3. Safety relief valves (SRV-203A and SRV-203B) were popped and reseated at the design pressure of 42.0 kg/cm2.
4. Hydrostatic test was successfully performed at 63.0 kg/cm2 (1.5x MAWP) and held for 30 minutes with no visible leaks or pressure drop.
CERTIFICATION STATUS: Certified fit for operation up to 42.0 kg/cm2 working pressure.
CERTIFICATE VALID UNTIL: February 14, 2026.
RECOMMENDATION: Next statutory inspection must be scheduled prior to February 14, 2026 to ensure continuous operation."""
    },
    {
        "filename": "inspection_report_hydrant_sys.txt",
        "category": "Inspection Report",
        "tags": "fire, hydrant, inspection, safety",
        "content": """QUARTERLY FIRE HYDRANT SYSTEM INSPECTION LOG
FACILITY: Main Petroleum Storage Depot, Zone-1
DATE OF TESTING: January 10, 2026
TESTED BY: Fire & Safety Team (Led by Officer Amit Shah)
TEST RESULTS:
1. Header Pressure: Main ring header pressure stabilized at 7.2 kg/cm2 with jockey pump in automatic start mode.
2. Hydrant Valves: Checked 14 hydrant valves in Zone-1. All valves are operational. Valve Hydrant-12 was stiff but lubricated and freed.
3. Monitor Operation: Water monitors WM-01 and WM-02 tested. Rotation is smooth, nozzle settings functional.
4. Fire Water Pumps: Pump FP-501 (Diesel Engine driven) started manually within 15 seconds. Pump FP-502 (Electric Motor driven) started automatically on header pressure drop.
STATUS: Fully functional and compliant with OISD pressure standards.
NEXT CHECK DUE: April 10, 2026."""
    },
    {
        "filename": "inspection_report_compressor_102.txt",
        "category": "Inspection Report",
        "tags": "compressor, instrument air, compressor-102",
        "content": """PREVENTIVE MAINTENANCE INSPECTION - COMPRESSOR-102
EQUIPMENT ID: COMP-102 (Instrument Air Compressor)
DATE: June 22, 2026
PERFORMED BY: Mechanical Maintenance Crew (Lead: John Doe)
INSPECTION LOG:
1. Oil level checked: Normal (Mobil Rarus 427).
2. Discharge temperature: 84 deg C (Normal limit < 90 deg C).
3. Belt tension and coupling alignment check: Visual alignment is satisfactory.
4. Safety Valve Inspection: The safety relief valve (SRV-102) was found to be slightly rusted and failed to pop during manual pull-test. It was immediately dismantled, cleaned, internal spring lubricated, re-assembled, and tested. It now pops correctly at 8.5 kg/cm2.
STATUS: Safety valve repaired. Compressor returned to service.
RECOMMENDATION: Schedule replacement of safety valve SRV-102 spring during the next shutdown due to minor fatigue."""
    },

    # 3. Maintenance Logs
    {
        "filename": "maintenance_log_pump_101.txt",
        "category": "Maintenance Log",
        "tags": "pump, maintenance, pump-101",
        "content": """EQUIPMENT MAINTENANCE HISTORY LOG: PUMP-101
EQUIPMENT TAG: PUMP-101 (Centrifugal Cooling Water Pump)
DEPARTMENT: Utility Operations
HISTORY DETAILS:
- 2026-03-12: Preventive Maintenance (PM) check. Noticed increased vibration (7.5 mm/s) on the motor side bearing. Bearing replaced (SKF 6312) and coupling aligned using laser tool. Vibration reduced to 1.8 mm/s. Oil changed to Castrol Hyspin VG 68.
- 2026-06-15: Operational report. Gland packing seal leak observed (15 drops/min). Adjusted gland follower nuts. Leak rate reduced to acceptable level (3 drops/min).
- 2026-07-05: Bearing temperature spike (68 deg C). Greased motor bearings. Temperature stabilized at 54 deg C."""
    },
    {
        "filename": "maintenance_log_boiler_203.txt",
        "category": "Maintenance Log",
        "tags": "boiler, maintenance, boiler-203",
        "content": """EQUIPMENT MAINTENANCE HISTORY LOG: BOILER-203
EQUIPMENT TAG: BOILER-203 (High-Pressure Utility Boiler)
DEPARTMENT: Power & Steam Block
HISTORY DETAILS:
- 2025-08-10: Tube cleaning and soot blowing completed. Internal inspection showed light slag scaling on superheater tubes. Slag removed using water washing.
- 2025-11-04: Burner nozzle replaced. Realigned fuel oil supply nozzles. Chimney gas oxygen level adjusted to 3.2% to optimize combustion efficiency.
- 2026-01-20: ID Fan (Induced Draft Fan) coupling pins replaced due to shear wear. Refitted safety guard."""
    },
    {
        "filename": "maintenance_log_turbine_301.txt",
        "category": "Maintenance Log",
        "tags": "turbine, maintenance, turbine-301",
        "content": """EQUIPMENT MAINTENANCE HISTORY LOG: TURBINE-301
EQUIPMENT TAG: TURBINE-301 (Steam Turbine Generator)
DEPARTMENT: Power Generation Block
HISTORY DETAILS:
- 2025-10-15: Annual Overhaul. Turbine rotor balanced dynamically. Condenser tube cleaning performed to improve vacuum from 0.82 to 0.89 bar. Governor valves inspected; stem packing replaced.
- 2026-04-18: Vibration analysis report. Vibration at bearing #2 recorded at 4.2 mm/s (Warning limit 4.5 mm/s). Recommended monitoring frequency increased to weekly. Oil sample sent for analysis.
- 2026-05-02: Oil analysis results: Viscosity normal, copper content trace. Weekly vibration checks show steady levels (4.0 - 4.3 mm/s). No immediate action needed."""
    },

    # 4. Standard Operating Procedures (SOPs)
    {
        "filename": "sop_pump_startup_procedure.txt",
        "category": "SOP",
        "tags": "pump, startup, sop, operational",
        "content": """STANDARD OPERATING PROCEDURE: CENTRIFUGAL PUMP STARTUP
SOP ID: SOP-OPS-PUMP-01 | REVISION: 03 | DATE: January 15, 2025
EQUIPMENT COVERED: Centrifugal pumps (PUMP-101, PUMP-102, PUMP-201)
PRE-START CHECKS:
1. Verify oil level in the bearing housing is at the center of the sight glass.
2. Turn the shaft manually to ensure it rotates freely without binding.
3. Ensure the suction valve is 100% open and the discharge valve is fully closed.
4. Prime the pump (if not flooded suction) to vent air. Open suction vent valve until fluid flows out, then close it.
5. Open cooling water line valves to gland seal jackets (if equipped).
STARTUP SEQUENCE:
1. Push START button on the local control panel or DCS.
2. Monitor discharge pressure gauge immediately. It should rise above suction pressure.
3. Once the pump runs smoothly and discharge pressure stabilizes, SLOWLY open the discharge control valve to the desired flow rate. Do not operate pump with a closed discharge valve for more than 2 minutes.
4. Verify motor current (Amperes) is within nameplate limits.
5. Check for bearing heating or abnormal vibration."""
    },
    {
        "filename": "sop_boiler_emergency_shutdown.txt",
        "category": "SOP",
        "tags": "boiler, shutdown, safety, emergency",
        "content": """STANDARD OPERATING PROCEDURE: BOILER EMERGENCY SHUTDOWN
SOP ID: SOP-OPS-BOILER-05 | REVISION: 02 | DATE: September 30, 2024
EQUIPMENT COVERED: BOILER-203, BOILER-204
CRITICAL TRIGGER CONDITIONS FOR EMERGENCY SHUTDOWN:
- Low-Low Water Level (below the bottom of the gauge glass / -150mm on DCS indicator).
- Complete failure of feedwater supply.
- Steam header overpressure beyond 46.0 kg/cm2 with safety valves failing to open.
- Fuel gas leak or furnace explosion/flue fire.
EMERGENCY SHUTDOWN ACTION PLAN:
1. Trip the Fuel Trip Valve (FDV-203) immediately via manual push button on DCS or field panel. This cuts fuel gas/oil flow to burners.
2. Shut down FD (Forced Draft) and ID (Induced Draft) fans to stop air flow.
3. Close the main steam stop valve (MSSV) to isolate the boiler from the steam header.
4. Keep the feedwater pump running (if water level is low but visible) to cool down the drum. WARNING: If drum water level is completely empty and drum is red hot, DO NOT inject cold water to avoid thermal shock and explosion. Isolate boiler and allow natural cooling.
5. Open superheater vents to release steam pressure."""
    },
    {
        "filename": "sop_confined_space_entry.txt",
        "category": "SOP",
        "tags": "safety, confined space, permit, sop",
        "content": """STANDARD OPERATING PROCEDURE: CONFINED SPACE ENTRY & SAFETY
SOP ID: SOP-SAF-08 | REVISION: 04 | DATE: May 12, 2025
1. PURPOSE: To define safety guidelines for entry into vessels, tanks, boilers, and sumps.
2. DEFINITION: A confined space is any space not designed for continuous human occupancy with limited access/egress.
3. MANDATORY ENTRY REQUIREMENTS:
   (a) WORK PERMIT: A valid Cold Work / Confined Space Entry Permit must be approved by the Area Manager.
   (b) ISOLATION: Double block and bleed or physical blanking/blinding of all process lines connected to the vessel.
   (c) ATMOSPHERE TESTING: Test oxygen level (must be 19.5% to 23.5%), flammable gases (0% LEL), and toxic gases (CO < 25 ppm, H2S < 10 ppm) prior to entry and record on the permit.
   (d) VENTILATION: Continuous positive air ventilation using air blowers. Oxygen bottles or pure oxygen enrichment is strictly prohibited.
   (e) STANDBY PERSON: A standby person must be stationed at the entry manhole with a communication radio and rescue tripod.
   (f) ILLUMINATION: Use only 24V flameproof hand lamps inside vessels."""
    },

    # 5. P&ID Excerpts
    {
        "filename": "drawing_pid_cooling_water_system.txt",
        "category": "P&ID Excerpt",
        "tags": "drawing, pid, cooling water, pump-101",
        "content": """PROCESS & INSTRUMENTATION DIAGRAM (P&ID) EXCERPT: COOLING WATER SYSTEM
DRAWING NUMBER: PID-CW-01-REV2
SYSTEM DESCRIPTION:
The cooling water circuit pumps water from the main cooling tower basin to the process area heat exchangers.
TAG DETAILS:
- PUMP-101 (Cooling Water Pump A) takes suction from 24\" line CW-S-01 via butterfly valve BV-101.
- Pump discharge is 18\" line CW-D-01, fitted with check valve CV-101 and motorized gate valve MV-101.
- The discharge line splits to supply:
  (a) Heat Exchanger HX-105 (Cooling water supply line 8\" CW-S-HX105, governed by flow control valve FCV-105).
  (b) Compressor Cooling jacket (line 3\" CW-S-COMP, governed by globe valve GV-112).
- Return line CW-R-01 (24\" line) aggregates heated cooling water and returns it to the top of the Cooling Tower cells.
- Bypass Line: A 6\" pressure control bypass line with valve PCV-101 connects discharge header to suction header to maintain system pressure at 3.5 kg/cm2."""
    },
    {
        "filename": "drawing_pid_steam_generation.txt",
        "category": "P&ID Excerpt",
        "tags": "drawing, steam, pid, boiler-203",
        "content": """PROCESS & INSTRUMENTATION DIAGRAM (P&ID) EXCERPT: UTILITY STEAM LOOP
DRAWING NUMBER: PID-ST-05-REV1
SYSTEM DESCRIPTION:
Steam generation and distribution loop connecting Utility Boiler-203 to Steam Turbine Generator Turbine-301.
TAG DETAILS:
- BOILER-203 superheater outlet line (12\" High-Pressure Steam Line HPS-01) connects to Steam Header SH-100.
- Safety Relief Valves SRV-203A and SRV-203B are mounted directly on the superheater outlet manifold, venting to atmosphere at 45.0 kg/cm2.
- Feedwater enters Boiler-203 drum via 6\" line BFW-03, controlled by level control valve LCV-203 (governed by 3-element drum level control loop LIC-203).
- Steam Header SH-100 supplies Steam Turbine TURBINE-301 via 10\" line HPS-TB01, which features emergency trip valve ESV-301.
- Condensate line COND-01 (8\" line) exits Turbine-301 condenser and is pumped back to the Deaerator tank DA-101 by Condensate Extraction Pump CEP-301."""
    }
]

def generate_synthetic_data(db: Session):
    # Check if documents already exist in the DB
    if db.query(Document).count() > 0:
        print("Database already contains documents. Skipping synthetic data generation.")
        return
        
    print("Generating synthetic document files and indexing them...")
    
    # Create uploads directory
    os.makedirs("./uploads", exist_ok=True)
    
    # 1. Write files and add to Document DB & Vector Store
    for doc in SYNTHETIC_DOCS:
        filename = doc["filename"]
        file_path = os.path.join("./uploads", filename)
        
        # Write to disk
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(doc["content"])
            
        # Create DB record
        db_doc = Document(
            filename=filename,
            file_path=file_path,
            category=doc["category"],
            tags=doc["tags"],
            status="Processing"
        )
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        try:
            # Process & index document
            num_chunks = add_document_to_vector_store(
                doc_id=db_doc.id,
                file_path=file_path,
                filename=filename,
                category=doc["category"]
            )
            db_doc.status = "Success"
            db.commit()
        except Exception as e:
            print(f"Failed to index synthetic doc {filename}: {e}")
            db_doc.status = "Error"
            db.commit()

    # 2. Populate Knowledge Graph
    print("Populating synthetic Knowledge Graph...")
    nodes = [
        # Equipment
        KnowledgeNode(id="PUMP-101", name="Centrifugal Cooling Water Pump A", type="Equipment", 
                      properties=json.dumps({"location": "Pump House 1", "fluid": "Cooling Water", "flow_rate": "150 m3/h"})),
        KnowledgeNode(id="BOILER-203", name="High-Pressure Utility Boiler", type="Equipment", 
                      properties=json.dumps({"location": "Steam Block Block-D", "capacity": "50 TPH", "pressure": "42 kg/cm2"})),
        KnowledgeNode(id="TURBINE-301", name="Steam Turbine Generator", type="Equipment", 
                      properties=json.dumps({"location": "Power House 2", "power": "12 MW", "steam_pressure": "40 kg/cm2"})),
        KnowledgeNode(id="HX-105", name="Process Heat Exchanger", type="Equipment", 
                      properties=json.dumps({"location": "Process Area A", "duty": "2.5 GCal/h"})),
        KnowledgeNode(id="COMP-102", name="Instrument Air Compressor", type="Equipment", 
                      properties=json.dumps({"location": "Utility House 2", "pressure": "8.0 kg/cm2", "capacity": "500 CFM"})),
                      
        # Departments
        KnowledgeNode(id="UTILITIES-DEPT", name="Utilities Operations Department", type="Department", 
                      properties=json.dumps({"manager": "S. K. Bose", "staff": "14 Engineers"})),
        KnowledgeNode(id="POWER-DEPT", name="Power Generation Block", type="Department", 
                      properties=json.dumps({"manager": "V. Anand", "staff": "8 Operators"})),
        KnowledgeNode(id="SAFETY-DEPT", name="Environment Health & Safety (EHS)", type="Department", 
                      properties=json.dumps({"lead": "Amit Shah", "patrols": "Shift-wise"})),
                      
        # Standards
        KnowledgeNode(id="FACTORY-ACT-1948", name="Factory Act 1948", type="Standard", 
                      properties=json.dumps({"scope": "Statutory Safety", "applicable_to": "Pressure Plants"})),
        KnowledgeNode(id="OISD-STD-116", name="OISD-STD-116 Standard", type="Standard", 
                      properties=json.dumps({"scope": "Fire Safety Facilities", "applicable_to": "Depots & Terminals"})),
                      
        # Incident
        KnowledgeNode(id="INCIDENT-2026-06", name="Pump-101 Gland packing Leak", type="Incident", 
                      properties=json.dumps({"date": "2026-06-15", "severity": "Minor", "status": "Repaired"}))
    ]
    
    edges = [
        # Equipment to Department
        KnowledgeEdge(source="PUMP-101", target="UTILITIES-DEPT", relation="MAINTAINED_BY"),
        KnowledgeEdge(source="COMP-102", target="UTILITIES-DEPT", relation="MAINTAINED_BY"),
        KnowledgeEdge(source="BOILER-203", target="POWER-DEPT", relation="OPERATED_BY"),
        KnowledgeEdge(source="TURBINE-301", target="POWER-DEPT", relation="OPERATED_BY"),
        
        # Equipment connections (topology)
        KnowledgeEdge(source="PUMP-101", target="HX-105", relation="SUPPLIES_WATER_TO"),
        KnowledgeEdge(source="BOILER-203", target="TURBINE-301", relation="SUPPLIES_STEAM_TO"),
        
        # Equipment governed by Standards
        KnowledgeEdge(source="BOILER-203", target="FACTORY-ACT-1948", relation="GOVERNED_BY"),
        KnowledgeEdge(source="PUMP-101", target="OISD-STD-116", relation="GOVERNED_BY"),
        KnowledgeEdge(source="SAFETY-DEPT", target="OISD-STD-116", relation="MONITORS"),
        
        # Incidents
        KnowledgeEdge(source="PUMP-101", target="INCIDENT-2026-06", relation="INVOLVED_IN"),
        KnowledgeEdge(source="UTILITIES-DEPT", target="INCIDENT-2026-06", relation="RESPONDED_TO")
    ]
    
    # Add nodes & edges
    for n in nodes:
        db.merge(n) # merge handles already existing primary keys gracefully
    for e in edges:
        db.add(e)
    db.commit()

    # 3. Populate Compliance Gaps
    print("Populating synthetic Compliance Gaps...")
    gaps = [
        ComplianceGap(
            title="Boiler Annual Statutory Inspection Overdue",
            severity="High",
            category="Inspection",
            regulation="Factory Act 1948, Section 31",
            offending_doc="inspection_report_boiler_203.txt",
            description="The Factory Act 1948 mandates that high-pressure steam boilers must be inspected and certified by a government inspector at least once every 12 months. The last inspection for Boiler-203 was conducted on February 15, 2025, which is overdue as of July 2026 (last valid date: February 14, 2026).",
            recommendation="Schedule an immediate statutory inspection with the government boiler inspector and limit operating steam pressure to 50% MAWP until the certification is officially renewed.",
            status="Open"
        ),
        ComplianceGap(
            title="Fire Hydrant Quarterly Check Overdue",
            severity="Medium",
            category="Safety Check",
            regulation="OISD-STD-116, Clause 6.2",
            offending_doc="inspection_report_hydrant_sys.txt",
            description="OISD-STD-116 requires that the entire hydrant piping system, including water header pressure and hydrant valves, be tested and flushed once every 3 months. The last inspection was on January 10, 2026, which is overdue since April 10, 2026.",
            recommendation="Organize immediate line flushing, test all hydrant monitor rotations, record pressure readings at the furthest zone points, and file a formal compliance sheet.",
            status="Open"
        )
    ]
    
    for g in gaps:
        db.add(g)
    db.commit()
    print("Synthetic data generation and database seeding complete!")
