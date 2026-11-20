# TECHNICAL MANUAL AND BUSINESS CASE SPECIFICATION
## SYSTEM: JBM LOADIQ (LOGISTICS OPTIMIZATION PLATFORM)
### SPECIFICATION COMPLIANCE: ASD-STE100 (SIMPLIFIED TECHNICAL ENGLISH)

---

## DOCUMENT CONTROL INFORMATION

| Parameter | Specification |
|---|---|
| **Document Identification Number** | TM-JBM-LOADIQ-STE-001 |
| **Issue Number** | 1.0 |
| **Issue Date** | 2026-11-20 |
| **Classification** | JBM Group Internal — Technical Specification |
| **Language Standard** | ASD-STE100 Issue 8 (Controlled English) |
| **System Owner** | Sahil Sharma, Head of R&D AI Engineering |
| **Organization** | ThirdEye AI / JBM Group |

---

# SECTION 1: SYSTEM DESCRIPTION AND IDENTIFICATION

### 1.1 General
This manual describes the JBM LoadIQ Logistics Optimization Platform.
JBM LoadIQ is a software system for automotive logistics operations.
The software calculates 3D volumetric packaging plans.
The software calculates vehicle axle load distributions.
The software schedules loading docks and tracks transport containers.

### 1.2 System Purpose
The system controls outbound dispatch operations for automotive parts.
The system connects manufacturing plants J1, J2, and J3 to customer assembly plants.
The primary customer plant is Maruti Suzuki India Limited (MSIL) Manesar Plant 2 Gate 4.
The system calculates legal load plans that obey Indian road transport laws.
The system prevents vehicle axle overloads.
The system increases vehicle volume utilization.
The system decreases manual data entry in SAP systems.

---

# SECTION 2: OPERATIONAL PROBLEM STATEMENT

### 2.1 Current Operational Conditions
JBM Group operates three manufacturing plants in the National Capital Region:
1. Plant J1 produces stamped panels and heavy blanking parts.
2. Plant J2 produces welded Body-in-White (BIW) assemblies.
3. Plant J3 produces modular chassis components and exhaust systems.

More than 100 commercial vehicles depart from these plants each day.
These vehicles carry more than 250 storage bins and 200 specialized trolleys.
Current operations use manual procedures, paper logs, and isolated spreadsheets.

### 2.2 Operational Deficiencies

```
+-------------------------------------------------------------------------+
|                  CURRENT OPERATIONAL DEFICIENCIES                       |
+-----------------------------+-------------------------------------------+
| Deficient Area              | Quantified Operational Effect             |
+-----------------------------+-------------------------------------------+
| Manual Data Transcription   | 8 to 12 labor hours lost each day         |
| Container Shortage Rate     | 4 to 5 shortages each week                |
| Container Utilization Rate  | 70 to 75 percent only                     |
| Dock Loading Delay          | 60 to 75 minutes per commercial vehicle   |
| Dock Peak Congestion        | 20 to 30 percent throughput loss          |
| Quality Data Delay to SAP   | 2 to 4 hours latency                      |
| Inventory Difference        | 8 to 12 percent difference to physical    |
| Transport Law Violations    | Overload fines under MV Act Section 194   |
+-----------------------------+-------------------------------------------+
```

#### 2.2.1 Data Entry and Administrative Labor
Workers write raw material issuances in paper registers and in SAP.
Workers record container movements in manual spreadsheets.
Spreadsheet data is not synchronized with SAP Inventory Management.
Operators spend 8 to 12 labor hours each day on duplicate manual data entry.
SAP inventory records lag physical factory stock by 2 to 4 hours.

#### 2.2.2 Container Shortages and Capital Loss
Automotive skin panels require specialized steel stillages.
Workers cannot use generic wooden pallets for Class-A painted surfaces.
Four to five types of steel trolleys have frequent shortages.
Current container utilization is 70 to 75 percent.
Trolleys remain idle at customer unloading yards without tracking.
JBM spends capital to buy emergency replacement containers and wooden pallets.

#### 2.2.3 Dock Bay Congestion and Loading Delays
Each factory operates loading docks with limited vehicle bays.
Dock supervisors schedule trucks manually without predictive software.
During shift handovers, up to 25 commercial vehicles wait outside the plant.
Forklift operators do not know the required loading sequence.
Loading one 32-foot commercial vehicle takes 60 to 75 minutes.
Loading throughput decreases by 20 to 30 percent during peak hours.

#### 2.2.4 Vehicle Axle Overload and Road Transport Hazards
Forklift operators stack dense structural stampings at the front bulkhead.
This practice overloads the steering axle of the truck.
Total cargo mass is often legal, but the front axle exceeds statutory limits.
The Indian Motor Vehicles (Amendment) Act 2019 Section 194(1) imposes severe fines:
- Base fine: 20,000 Indian Rupees (INR).
- Additional fine: 2,000 INR per metric tonne of excess load.
- Law enforcement officers impound the vehicle until cargo is offloaded.
Incorrect load placement also moves the center of gravity.
High center of gravity increases the risk of vehicle rollover on road corners.

---

# SECTION 3: SYSTEM CAPABILITIES AND FUNCTIONAL ARCHITECTURE

### 3.1 Functional Architecture Overview
The system contains six software modules:

```
+-------------------------------------------------------------------------+
|                         JBM LOADIQ SYSTEM MODULES                       |
+-------------------------------------------------------------------------+
| [MODULE 1] 3D Volumetric Packing Engine                                 |
|            - Builds multi-layer handling columns                        |
|            - Applies maximal rectangles algorithm                       |
|            - Enforces Last-In-First-Out (LIFO) drop sequence            |
+-------------------------------------------------------------------------+
| [MODULE 2] Axle Load Physics and Vehicle Dynamics                       |
|            - Solves static moment balance equations                     |
|            - Calculates steer, drive, and trailer reactions             |
|            - Computes Static Rollover Threshold (SRT) in g-force        |
+-------------------------------------------------------------------------+
| [MODULE 3] Cargo Securing Engine (EN 12195-1 Standard)                  |
|            - Calculates friction force shortfalls                       |
|            - Specifies web lashing tension forces                       |
|            - Defines required dunnage and blocking bars                 |
+-------------------------------------------------------------------------+
| [MODULE 4] Dock Bay Gantt Scheduler                                     |
|            - Schedules 6 plant loading bays                             |
|            - Forecasts queue congestion 4 hours in advance              |
|            - Balances crane and forklift assignments                    |
+-------------------------------------------------------------------------+
| [MODULE 5] Digital Compliance and Gate Security                         |
|            - Reconciles SAP Invoice, E-Way Bill, and Weighbridge slip   |
|            - Generates digital QR-coded Gate Pass                       |
|            - Reduces gate clearance time to less than 30 seconds        |
+-------------------------------------------------------------------------+
| [MODULE 6] Returnable Container Lifecycle Tracking                      |
|            - Tracks 450+ bins and trolleys via serial identification    |
|            - Alerts plant managers before container shortages occur     |
|            - Manages inter-plant empty stillage transfers               |
+-------------------------------------------------------------------------+
```

### 3.2 Detailed Module Descriptions

#### 3.2.1 Module 1: 3D Volumetric Packing Engine
The module groups automotive parts into standardized handling units.
The algorithm stacks identical containers into vertical columns.
The algorithm checks the allowable top-load rating of each container.
Containers with zero top-load capacity remain on the vehicle floor (Tier 1).
The algorithm partitions the vehicle deck with maximal rectangles logic.
The algorithm groups cargo by customer delivery stop.
The first customer delivery stop is loaded at the rear doors (LIFO order).
Volume efficiency increases from 68 percent to 88-94 percent.

#### 3.2.2 Module 2: Axle Load Physics Engine
The module calculates the 3D center of gravity ($X, Y, Z$) of all cargo.
The datum point ($X=0, Y=0, Z=0$) is the front bulkhead at deck level.
The algorithm solves static equilibrium equations:
- Sum of vertical forces equals zero.
- Sum of moments about the steer axle equals zero.
The module verifies loads against MoRTH Notification S.O. 2641(E) limits:
- Single steer axle (2 tyres): 7,500 kg maximum.
- Single drive axle (4 tyres): 11,500 kg maximum.
- Tandem drive bogie (8 tyres): 19,000 kg maximum.
- Tridem trailer bogie (12 tyres): 24,000 kg maximum.
The module also checks the vehicle manufacturer plate limit.
The governing limit is the lower of statutory limit or manufacturer limit.

#### 3.2.3 Module 3: Dynamic Stability and Cargo Securing
The module computes the Static Rollover Threshold (SRT).
Minimum acceptable SRT is 0.38 g for highway operation.
The module implements European Standard EN 12195-1 calculation rules.
The algorithm determines friction coefficients between cargo and deck:
- Steel container on plywood floor: $\mu = 0.45$.
- Plastic container on plywood floor: $\mu = 0.30$.
- Anti-slip rubber mat: $\mu = 0.55$.
- Wheeled stillage castors: $\mu = 0.00$ (zero friction credit).
The module calculates the required quantity of 500 daN ratchet straps.
The module requires wheel chocks and direct lashings for all wheeled stillages.

#### 3.2.4 Module 4: Dock Scheduler and Staging Cockpit
The module manages loading bays across plants J1, J2, and J3.
The module calculates loading completion times from handling unit counts.
The module assigns vehicles to dock bays with minimum forklift travel distance.
The system displays real-time Gantt charts to dock foremen.
The module alerts supervisors when dock queues exceed three vehicles.

#### 3.2.5 Module 5: Compliance and Automated Gate Clearance
The module integrates with SAP ECC and SAP S/4HANA systems.
The software reads sales orders and delivery notes through an API gateway.
The software validates the E-Way bill number and vehicle registration.
When the vehicle completes weighbridge measurement, the system issues a QR code.
Gate security officers scan the QR code with a rugged handheld device.
SAP automatically executes Goods Issue (Movement Type 601).
Vehicle gate exit time decreases to less than 30 seconds.

---

# SECTION 4: ENGINEERING FORMULAS AND MATHEMATICAL MODELS

### 4.1 Coordinate Datum Definitions
All linear dimensions use millimetres (mm).
All mass measurements use kilograms (kg).
The coordinate axes are right-handed and deck-local:
- $+X$-axis: Starts at inner face of front bulkhead and points to rear doors.
- $+Y$-axis: Starts at deck surface and points vertically upward.
- $+Z$-axis: Starts at left (driver) side wall and points to kerb side wall.

### 4.2 Rigid Vehicle Axle Load Equations

For a rigid commercial vehicle with one steer axle and one drive axle group:

$$\text{Total Cargo Mass } M_c = \sum_{i=1}^{n} m_i$$

$$\text{Longitudinal Moment } M_x = \sum_{i=1}^{n} m_i \cdot (x_i + \frac{l_i}{2})$$

$$\text{Cargo Center of Gravity } X_{\text{cog}} = \frac{M_x}{M_c}$$

$$\text{Drive Axle Reaction } R_{\text{drive}} = \frac{M_c \cdot (X_{\text{deck\_offset}} + X_{\text{cog}}) + M_{\text{tare}} \cdot X_{\text{tare\_cog}}}{\text{Wheelbase}}$$

$$\text{Steer Axle Reaction } R_{\text{steer}} = (M_c + M_{\text{tare}}) - R_{\text{drive}}$$

### 4.3 Articulated Semi-Trailer Axle Load Equations

For an articulated tractor and semi-trailer combination:

$$\text{Trailer Bogie Reaction } R_{\text{bogie}} = \frac{M_c \cdot (X_{\text{cog}} - X_{\text{kingpin}}) + M_{\text{trailer\_tare}} \cdot (X_{\text{tt\_cog}} - X_{\text{kingpin}})}{X_{\text{bogie}} - X_{\text{kingpin}}}$$

$$\text{Kingpin Load } R_{\text{kingpin}} = (M_c + M_{\text{trailer\_tare}}) - R_{\text{bogie}}$$

$$\text{Tractor Steer Load } R_{\text{steer}} = \frac{R_{\text{kingpin}} \cdot a}{\text{Wheelbase}_{\text{tractor}}} + M_{\text{tractor\_steer\_tare}}$$

$$\text{Tractor Drive Load } R_{\text{drive}} = R_{\text{kingpin}} - \frac{R_{\text{kingpin}} \cdot a}{\text{Wheelbase}_{\text{tractor}}} + M_{\text{tractor\_drive\_tare}}$$

Where:
- $a$ is the forward distance of the kingpin ahead of the drive axle center.
- $X_{\text{kingpin}}$ is the longitudinal position of the kingpin pivot.

### 4.4 Static Rollover Threshold Equation

$$\text{SRT} = \frac{\frac{T}{2} - |Z_{\text{cog}} - \frac{W_{\text{deck}}}{2}|}{H_{\text{combined\_cog}}} \quad [g]$$

Where:
- $T$ is the vehicle track width in millimetres.
- $W_{\text{deck}}$ is the cargo deck internal width.
- $Z_{\text{cog}}$ is the lateral center of gravity of the combined cargo.
- $H_{\text{combined\_cog}}$ is the vertical center of gravity above road surface.

---

# SECTION 5: BUSINESS CASE AND FINANCIAL BENEFIT ANALYSIS

### 5.1 Financial Loss in Current State Operations
Current operational inefficiencies cost JBM Group 2.0 to 2.5 Crore INR each year.

```
+-------------------------------------------------------------------------+
|                  ANNUAL COST OF OPERATIONAL DEFICIENCIES                |
+---------------------------------------------------+---------------------+
| Expense Category                                  | Annual Cost (INR)   |
+---------------------------------------------------+---------------------+
| 1. Labor Overhead and Delay Penalties             | 1.80 Crore          |
|    - 8 to 12 labor hours daily on data entry      |                     |
|    - Vehicle detention fees paid to transporters  |                     |
|    - Subcontracted transport due to low load cube |                     |
| 2. Container Inefficiency and Emergency Pallets   | 0.60 Crore          |
|    - Lost stillages at customer sites             |                     |
|    - Procurement of emergency replacement bins    |                     |
|    - Purchase of single-use wooden pallets        |                     |
| 3. Quality Rework and Regulatory Fines            | 0.40 Crore          |
|    - Part transit damage and scrap loss           |                     |
|    - Police overload fines under MV Act 194(1)    |                     |
+---------------------------------------------------+---------------------+
| TOTAL ANNUAL OPPORTUNITY                          | 2.00 to 2.50 Crore  |
+---------------------------------------------------+---------------------+
```

### 5.2 Three-Year Return on Investment Projection

| Financial Parameter | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Direct Labor Savings | 60 to 80 Lakh INR | 1.20 to 1.50 Crore INR | 1.50 to 1.80 Crore INR |
| Container Optimization Savings | 15 to 20 Lakh INR | 40 to 50 Lakh INR | 50 to 60 Lakh INR |
| Part Scrap and Rework Savings | 20 to 25 Lakh INR | 30 to 40 Lakh INR | 40 to 50 Lakh INR |
| Overload Fine Avoidance | 10 to 15 Lakh INR | 15 to 20 Lakh INR | 15 to 20 Lakh INR |
| **Gross Financial Return** | **1.05 to 1.40 Crore INR** | **2.15 to 2.60 Crore INR** | **2.55 to 3.10 Crore INR** |
| Platform Operating Cost | 30 to 40 Lakh INR | 40 to 50 Lakh INR | 50 to 60 Lakh INR |
| **NET ANNUAL PROFIT** | **65 to 100 Lakh INR** | **1.65 to 2.10 Crore INR** | **1.95 to 2.50 Crore INR** |
| **Return on Investment (ROI)** | **75 to 150 %** | **260 to 320 %** | **300 to 380 %** |
| **Payback Duration** | **Less than 6.5 Months** | Immediate | Sustained |

### 5.3 Make or Buy Software Decision Analysis

#### 5.3.1 Option A: Purchase Commercial TMS Software
- Initial acquisition cost: 1.20 to 1.50 Crore INR.
- Annual software recurring license: 80 to 100 Lakh INR.
- Disadvantage: Commercial TMS software supports generic freight only.
- Disadvantage: Commercial TMS software cannot calculate Indian statutory axle laws.
- Disadvantage: Commercial TMS software cannot optimize custom BIW steel stillages.

#### 5.3.2 Option B: Custom Build JBM LoadIQ (Selected Approach)
- Initial development cost: 60 to 80 Lakh INR.
- Annual maintenance cost: 30 to 40 Lakh INR.
- Advantage: Software matches JBM plant operations and stillage dimensions.
- Advantage: Software calculates exact MoRTH 2018 axle limit equations.
- Advantage: Software integrates natively with JBM SAP systems.
- Advantage: JBM Group retains 100 percent of the intellectual property.
- Advantage: JBM Group can sell the software to other automotive suppliers.

---

# SECTION 6: TARGET OPERATIONAL PERFORMANCE METRICS

```
+-------------------------------------------------------------------------+
|                    OPERATIONAL TARGET BENCHMARKS                        |
+-----------------------------------+------------------+------------------+
| Metric Description                | Current State    | JBM LoadIQ Target|
+-----------------------------------+------------------+------------------+
| Manual data entry labor per day   | 8 to 12 Hours    | Less than 2 Hours|
| Stillage availability percentage  | 70 to 75 %       | Greater than 95 %|
| Weekly container shortage events  | 4 to 5 events    | Less than 1 event|
| Commercial vehicles loaded / hour | 4 to 5 vehicles  | 6 to 7 vehicles  |
| Single truck loading duration     | 60 to 75 minutes | 28 to 35 minutes |
| Quality PDI data latency to SAP   | 2 to 4 Hours     | Less than 3 mins |
| SAP to physical stock discrepancy | 8 to 12 %        | Less than 0.5 %  |
| On-Time In-Full (OTIF) dispatch   | 85.4 %           | 98.6 %           |
| Regulatory axle overload fines    | 3 to 6 per month | Zero             |
+-----------------------------------+------------------+------------------+
```

---

# SECTION 7: SYSTEM LIMITATIONS AND CORRECTIVE ACTIONS

### 7.1 Harsh Factory Environment
- **Condition**: Factory floors have metal dust, vibration, oil, and heat.
- **Effect**: Standard barcode labels and commercial tablets fail.
- **Corrective Action**: Install IP67 industrial mobile terminals. Attach metal-mount vulcanized RFID transponders to steel stillages. Print secondary backup QR codes directly on stillage identification plates.

### 7.2 Human Operator Resistance
- **Condition**: Forklift drivers and dock foremen are accustomed to manual habits.
- **Effect**: Operators ignore computer-generated loading sequences.
- **Corrective Action**: Deploy 3D interactive color visual displays on dock floor screens. Use visual color coding (Green = Drop 1, Blue = Drop 2). Conduct practical shopfloor training during shift briefings.

### 7.3 Non-Standard Market Vehicles
- **Condition**: Transporters provide market trucks with non-standard body dimensions.
- **Effect**: Planned cargo does not fit the physical truck deck.
- **Corrective Action**: Gate security measures internal deck dimensions with laser rangefinders. The operator enters measured dimensions into the Vehicle Override menu (`specs.js`). The software recalculates the packing plan in four seconds.

### 7.4 SAP System Disconnection
- **Condition**: Corporate network connection to SAP S/4HANA fails.
- **Effect**: Vehicles cannot print shipping papers or exit the factory gate.
- **Corrective Action**: The system operates on an edge server architecture. The edge server saves gate dispatch transactions locally. The edge server synchronizes queued records to SAP when network connection returns.

---

# SECTION 8: IMPLEMENTATION ROADMAP (18 MONTHS)

```
Months 1 to 4           Months 5 to 8           Months 9 to 12          Months 13 to 18
[ PHASE 1 ]             [ PHASE 2 ]             [ PHASE 3 ]             [ PHASE 4 ]
Foundation              Automation              Intelligence            Autonomous Scale
- Stillage tagging      - 3D Packing engine     - Predictive models     - Computer Vision
- SAP IM gateway sync   - Digital PDI flow      - Mobile driver app     - AGV loading tests
- Pilot at Plant J2     - Dock Gantt tool       - Dynamic routing       - Sanand & Durg rollout
- 100% asset audit      - Multi-plant dispatch  - 85% forecast accuracy - Touchless yard ops
```

### 8.1 Phase 1: Foundation and Asset Visibility (Months 1 to 4)
- Install barcodes and RFID tags on all 450 bins and trolleys.
- Deploy the central container tracking database.
- Complete bi-directional interface with SAP Inventory Management.
- Execute trial deployment at Plant J2.

### 8.2 Phase 2: Packing Engine and Dock Automation (Months 5 to 8)
- Deploy 3D Packing Optimizer across Plants J1, J2, and J3.
- Integrate digital Pre-Delivery Inspection (PDI) records into dispatch queue.
- Implement the Dock Scheduler Gantt tool at all loading docks.
- Enforce MoRTH 2018 axle limit calculations on all outbound trucks.

### 8.3 Phase 3: Predictive Analytics and Mobile Applications (Months 9 to 12)
- Deploy Machine Learning models for dock queue forecasting.
- Deploy container shortage prediction engine.
- Launch mobile application for commercial truck drivers.
- Automate empty container replenishment transfers between J1 and J3.

### 8.4 Phase 4: Autonomous Operations and Facility Expansion (Months 13 to 18)
- Install Computer Vision cameras at plant gates to inspect stillage weld integrity.
- Connect software to autonomous factory tuggers and Automated Guided Vehicles (AGV).
- Deploy JBM LoadIQ at JBM Group facilities in Sanand, Jamshedpur, and Durg.

---

# SECTION 9: STANDARD OPERATING PROCEDURES (SOP)
## SPECIFICATION: ASD-STE100 PROCEDURAL INSTRUCTIONS

### 9.1 SOP-001: Outbound Load Plan Creation and Optimization

#### A. Personnel Requirements
- Role: Logistics Planning Specialist
- Training: JBM LoadIQ Certification Level 1

#### B. Preliminary Operations
1. Log in to JBM LoadIQ with your employee credentials.
2. Verify that the SAP customer order synchronization indicator is green.
3. Select the target production facility (Plant J1, J2, or J3).

#### C. Procedure Steps

1. Open the **Load Planner** module.
2. Select the customer delivery destination (Example: MSIL Manesar Plant 2).
3. Select the vehicle type assigned by the transport provider:
   - For 32-foot Multi-Axle Truck, select `32ft_mx`.
   - For 24-foot Taurus Rigid, select `24ft_taurus`.
   - For 40-foot Articulated Trailer, select `40ft_semi`.
4. If the truck has non-standard dimensions, enter measured length, width, and height.
5. Select the pending customer orders from the order list.
6. Click the **Generate 3D Load Plan** button.
7. Examine the 3D digital twin viewport:
   - Make sure that containers with skin panels stay on Tier 1 (deck floor).
   - Make sure that cargo for the first delivery stop is at the rear doors.
8. Examine the **Axle Weight Dial**:
   - Make sure that the steer axle load does not exceed 7,500 kg.
   - Make sure that the drive axle load does not exceed 19,000 kg.

> **WARNING**: DO NOT APPROVE A LOAD PLAN IF THE STEER AXLE REACTION EXCEEDS 7,500 KG. AN OVERLOADED STEER AXLE DECREASES VEHICLE BRAKING CONTROL AND VIOLATES MOTOR VEHICLE LAWS.

9. If an axle indicates an overload condition, click the **Auto-Correct Axle Balance** button.
10. Examine the **Static Rollover Threshold (SRT)**:
    - Make sure that the SRT value is equal to or greater than 0.38 g.
11. Click the **Approve and Release Load Plan** button.
12. Transmit the load plan to the assigned loading dock.

---

### 9.2 SOP-002: Physical Vehicle Loading and Cargo Securing

#### A. Personnel Requirements
- Role: Dock Bay Supervisor and Forklift Operator
- Protective Equipment: High-visibility vest, steel-toe boots, safety helmet

#### B. Preliminary Operations
1. Make sure that the commercial vehicle is stationary with parking brake applied.
2. Place wheel chocks on both sides of the rear wheels.
3. Open the **Sequential Loading Manifest** on the dock mobile terminal.

#### C. Procedure Steps

> **CAUTION**: DO NOT STACK HEAVY STILLAGES ON TOP OF CLASS-A SKIN PANEL CRATES. DAMAGE TO SHEET METAL SURFACES WILL OCCUR.

1. Inspect the truck cargo deck:
   - Make sure that the deck floor is dry, clean, and free of oil.
   - Make sure that the front bulkhead has no cracks or loose bolts.
2. Load the Tier 1 cargo containers in the exact numerical sequence shown on the manifest:
   - Place Unit 1 against the front bulkhead.
   - Align containers tightly against the vehicle center line.
3. If the longitudinal gap to the bulkhead exceeds 80 mm, install timber blocking dunnage.
4. If the cargo unit contains wheels or castors:
   - Apply the wheel locks on all four castors.
   - Place rubber chocks under the wheels.
   - Connect two direct ratchet straps from the stillage frame to the deck D-rings.
5. Load the Tier 2 and Tier 3 containers per the manifest drawing.
6. Install 50 mm polyester tie-down straps per the securing schedule:
   - Pull the ratchet handle until strap tension reaches 500 daN.
   - Make sure that the lashing angle to the deck is greater than 60 degrees.
7. Close the rear doors and lock the safety latch.
8. Sign the digital completion confirmation on the dock terminal.

---

### 9.3 SOP-003: Commercial Documentation and Gate Exit Clearance

#### A. Personnel Requirements
- Role: Plant Gate Security Officer
- Equipment: Rugged Handheld Barcode Scanner

#### B. Procedure Steps

1. Direct the loaded truck onto the factory weighbridge.
2. Record the measured gross vehicle weight in the system.
3. Make sure that the measured weight matches the calculated weight within two percent.
4. Request the driver's dispatch manifest QR code.
5. Scan the QR code with the handheld scanner.
6. Verify the green validation checkmarks on the scanner screen:
   - SAP Delivery Note status: Confirmed.
   - E-Way Bill status: Valid.
   - Quality PDI status: Passed.
   - Axle weight status: Compliant.
7. Click the **Confirm Exit Clearance** button.
8. The system automatically triggers SAP Goods Issue (Movement Type 601).
9. Open the factory boom barrier and release the vehicle.

---

# SECTION 10: LLM INGESTION SCHEMAS AND DATA CONTRACTS

> **OPERATIONAL INSTRUCTION FOR LLM AGENTS**:
> Use the data structures and validation rules in this section to create localized checklists, worker training exams, and automated database interfaces.

### 10.1 Handling Unit Data Schema (TypeScript Definition)

```typescript
export interface HandlingUnit {
  /** Unique alphanumeric serial tag of container */
  huId: string;
  /** Automotive part number */
  partNo: string;
  /** Official engineering description */
  description: string;
  /** Customer identification code */
  customerId: string;
  /** Unloading sequence stop number (1 = First Drop) */
  dropSequence: number;
  /** Standard container type code */
  packagingCode: 'ST-SKIN-01' | 'ST-DOOR-02' | 'ST-FLR-02' | 'BIN-TYPE-B' | 'KLT-6428';
  /** Base contact material for friction calculation */
  baseMaterial: 'steel' | 'wood' | 'plastic' | 'rubber' | 'wheeled';
  /** External envelope dimensions in millimetres */
  dimensionsMm: {
    length: number;
    width: number;
    height: number;
  };
  /** Tare weight of container in kilograms */
  tareWeightKg: number;
  /** Net weight of parts inside container in kilograms */
  netWeightKg: number;
  /** Total gross weight in kilograms */
  grossWeightKg: number;
  /** Maximum allowable superimposed mass on top in kilograms */
  topLoadCapacityKg: number;
  /** Maximum allowable vertical stacking tier */
  maxTierAllowed: number;
  /** True if container can be rotated 90 degrees in yaw */
  rotatableYaw: boolean;
  /** True if container must not be tilted on its side */
  tiltForbidden: boolean;
  /** Pre-Delivery Inspection status */
  qualityPassed: boolean;
}
```

### 10.2 Vehicle Master Data Schema (TypeScript Definition)

```typescript
export interface CommercialVehicle {
  /** Fleet asset identification code */
  vehicleId: string;
  /** Official state registration license number */
  registrationNumber: string;
  /** Chassis configuration category */
  vehicleClass: 'rigid' | 'articulated';
  /** Empty tare weight in kilograms */
  tareWeightKg: number;
  /** Statutory gross vehicle weight limit in kilograms */
  gvwLimitKg: number;
  /** Legal payload capacity in kilograms */
  payloadCapacityKg: number;
  /** Usable deck internal dimensions in millimetres */
  deckDimensionsMm: {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
  };
  /** Chassis mechanical dimensions in millimetres */
  geometry: {
    wheelbaseMm: number;
    deckFrontOffsetFromSteerMm: number;
    trackWidthMm: number;
    unladenDeckHeightMm: number;
    kingpinAheadOfDriveMm?: number;
    kingpinXFromDeckFrontMm?: number;
  };
  /** Individual axle group statutory and mechanical limits */
  axleGroups: Array<{
    id: 'steer' | 'drive' | 'trailer';
    label: string;
    tyreCount: 2 | 4 | 8 | 12;
    statutoryCeilingKg: number;
    manufacturerRatingKg: number;
  }>;
  /** Body strength rating */
  bodyCode: 'EN_12642_L' | 'EN_12642_XL';
}
```

### 10.3 Axle Load Calculation API Output Contract

```json
{
  "calculationId": "CALC-20261120-0089",
  "vehicleRegistration": "HR 55 AM 8812",
  "timestampUtc": "2026-11-20T10:30:00Z",
  "summary": {
    "totalCargoMassKg": 14250,
    "grossVehicleMassKg": 23450,
    "gvwLimitKg": 28000,
    "gvwCompliant": true,
    "combinedCogCoordinatesMm": {
      "x": 4850,
      "y": 1420,
      "z": 1220
    },
    "staticRolloverThresholdG": 0.44,
    "stabilityCompliant": true
  },
  "axleReactions": [
    {
      "axleGroup": "steer",
      "measuredKg": 6820,
      "legalCapKg": 7500,
      "utilizationPct": 90.9,
      "compliant": true
    },
    {
      "axleGroup": "drive",
      "measuredKg": 16630,
      "legalCapKg": 19000,
      "utilizationPct": 87.5,
      "compliant": true
    }
  ],
  "cargoSecuringSchedule": {
    "totalRatchetStraps500daN": 8,
    "antiSlipMatsRequired": 12,
    "forwardBlockingBarsRequired": 2,
    "standardCompliance": "EN 12195-1:2010"
  }
}
```

---

# SECTION 11: TECHNICAL AUDIT CHECKLIST FOR FACTORY AUDITORS

| Item | Inspection Requirement | Verification Method | Acceptance Standard | Pass / Fail |
|---|---|---|---|---|
| 01 | Steer axle load under legal limit | System calculation | Load $\le$ 7,500 kg | [  ] |
| 02 | Drive axle load under legal limit | System calculation | Load $\le$ 19,000 kg | [  ] |
| 03 | Static rollover threshold safety margin | System calculation | SRT $\ge$ 0.38 g | [  ] |
| 04 | Class-A skin panels on floor level | Visual check / Manifest | Tier = 1 only | [  ] |
| 05 | First customer drop accessible at doors | Physical check | LIFO sequence confirmed | [  ] |
| 06 | Wheeled stillages chocked and lashed | Physical inspection | 4 chocks + 2 direct straps | [  ] |
| 07 | Bulkhead gap blocked with timber/steel | Physical measurement | No gap $>$ 80 mm unblocked | [  ] |
| 08 | SAP Goods Issue posted automatically | SAP transaction check | Movement 601 logged | [  ] |
| 09 | Digital E-Way Bill registered | System scan | Active QR code verified | [  ] |
| 10 | Container RFID tag verified in inventory | RFID gate scanner | Tag ID = Inventory match | [  ] |

---

# SECTION 12: CONCLUSION AND MANAGEMENT DIRECTIVE

The JBM LoadIQ Logistics Optimization Platform complies with modern automotive supply chain requirements.
The system provides mathematical optimization, regulatory compliance, and ERP automation.
The platform removes manual bottleneck operations and prevents severe road transport fines.
The platform delivers 2.0 to 2.5 Crore INR in net financial benefit each year.
All personnel must execute operations according to the standard operating procedures in this manual.
