// ============================================================================
// JBM GROUP — AUTO COMPONENTS DIVISION (JBM AUTO LTD / JAY BHARAT MARUTI)
// Outbound Logistics & Supply Chain Master Data (Manesar, Gurugram, Faridabad, Sanand, Pune)
// ============================================================================

// Indian Commercial Vehicle Fleet configured for Automotive Logistics
export const vehicleTypes = [
  {
    id: 'EICHER-PRO-2049',
    name: 'Eicher Pro 2049 (14ft)',
    category: 'LCV Shuttle',
    payloadKg: 3500,
    maxWeight: 3500,
    volumeCuM: 14.2,
    maxVolume: 14.2,
    dimensions: { lengthMm: 4260, widthMm: 2000, heightMm: 1900 },
    axleConfig: '4x2 Single Rear',
    frontAxleLimitKg: 1500,
    rearAxleLimitKg: 3200,
    gvwKg: 4995,
    icon: '🚚',
    typicalUsage: 'Intra-city JIT / Emergency OEM Line-Feed Shuttle'
  },
  {
    id: 'EICHER-PRO-3019',
    name: 'Eicher Pro 3019 (19ft)',
    category: 'ICV Truck',
    payloadKg: 7800,
    maxWeight: 7800,
    volumeCuM: 28.5,
    maxVolume: 28.5,
    dimensions: { lengthMm: 5800, widthMm: 2300, heightMm: 2200 },
    axleConfig: '4x2 Dual Rear',
    frontAxleLimitKg: 3500,
    rearAxleLimitKg: 7500,
    gvwKg: 11990,
    icon: '🚛',
    typicalUsage: 'Tier-1 to OEM Plant Direct Stillage Delivery'
  },
  {
    id: 'TATA-ULTRA-24',
    name: 'Tata Ultra 28ft Container',
    category: 'MCV High-Cube',
    payloadKg: 13500,
    maxWeight: 13500,
    volumeCuM: 52.0,
    maxVolume: 52.0,
    dimensions: { lengthMm: 8500, widthMm: 2450, heightMm: 2500 },
    axleConfig: '6x2 Twin Steer / Rear Axle',
    frontAxleLimitKg: 6000,
    rearAxleLimitKg: 11500,
    gvwKg: 18500,
    icon: '📦',
    typicalUsage: 'High-Volume Sheet Metal & BIW Skin Panel Stacking'
  },
  {
    id: 'BHARATBENZ-32FT',
    name: 'BharatBenz 32ft MX High-Cube',
    category: 'Heavy Commercial Milk-Run',
    payloadKg: 18500,
    maxWeight: 18500,
    volumeCuM: 68.0,
    maxVolume: 68.0,
    dimensions: { lengthMm: 9750, widthMm: 2500, heightMm: 2750 },
    axleConfig: '6x4 Multi-Axle Heavy',
    frontAxleLimitKg: 7000,
    rearAxleLimitKg: 19000,
    gvwKg: 28000,
    icon: '🚛',
    typicalUsage: 'Dedicated JBM-MSIL Round-the-Clock Milk Run Trailer'
  },
  {
    id: 'VOLVO-40FT-TRAILER',
    name: 'Volvo FM 40ft Multi-Axle Semi-Trailer',
    category: 'Heavy Articulated Trailer',
    payloadKg: 28000,
    maxWeight: 28000,
    volumeCuM: 84.0,
    maxVolume: 84.0,
    dimensions: { lengthMm: 12200, widthMm: 2500, heightMm: 2800 },
    axleConfig: 'Tridem Semi-Trailer',
    frontAxleLimitKg: 6500,
    rearAxleLimitKg: 24000,
    gvwKg: 40000,
    icon: '🚛',
    typicalUsage: 'Inter-State Hub Trunk Line (Gurugram ⇄ Sanand / Pune)'
  }
];

// Active Fleet Registry with GPS telematics, FASTag & VAHAN compliance status
export const fleet = [
  {
    id: 'VH-001',
    regNo: 'HR-26-EE-4521',
    typeId: 'BHARATBENZ-32FT',
    driver: 'Rajeshwar Sharma',
    driverPhone: '+91 98112-45201',
    transporter: 'JBM Dedicated Logistics Fleet',
    status: 'available',
    fitnessExpiry: '2027-04-15',
    fastagBalance: 4250,
    gpsSignal: 'Strong (AIS-140)',
    currentLocation: 'JBM Plant 2 - Bay 3 Staging Area',
    lastService: '2026-10-15'
  },
  {
    id: 'VH-002',
    regNo: 'HR-55-CK-7832',
    typeId: 'TATA-ULTRA-24',
    driver: 'Sunil Gurjar',
    driverPhone: '+91 98711-33214',
    transporter: 'TCI Freight Auto Div',
    status: 'available',
    fitnessExpiry: '2027-02-28',
    fastagBalance: 2800,
    gpsSignal: 'Strong (AIS-140)',
    currentLocation: 'JBM Plant 2 - Outbound Yard A',
    lastService: '2026-10-20'
  },
  {
    id: 'VH-003',
    regNo: 'HR-55-DM-1290',
    typeId: 'EICHER-PRO-3019',
    driver: 'Amitav Singh',
    driverPhone: '+91 94160-88129',
    transporter: 'JBM Logistics Ltd',
    status: 'loading',
    fitnessExpiry: '2027-06-10',
    fastagBalance: 1950,
    gpsSignal: 'Active (Dock 2)',
    currentLocation: 'Loading Dock 2 - MSIL Bay',
    lastService: '2026-10-12'
  },
  {
    id: 'VH-004',
    regNo: 'HR-26-FN-5567',
    typeId: 'EICHER-PRO-2049',
    driver: 'Pradeep Yadav',
    driverPhone: '+91 98120-77402',
    transporter: 'Express Auto Logistix',
    status: 'dispatched',
    fitnessExpiry: '2026-12-14',
    fastagBalance: 3400,
    gpsSignal: 'In-Transit (NH-48 Kherki Daula)',
    currentLocation: 'En-route to MSIL Manesar Gate 4',
    lastService: '2026-10-18'
  },
  {
    id: 'VH-005',
    regNo: 'DL-01-LC-9034',
    typeId: 'VOLVO-40FT-TRAILER',
    driver: 'Vikramjit Singh',
    driverPhone: '+91 99990-21345',
    transporter: 'Container Corp of India / JBM JV',
    status: 'available',
    fitnessExpiry: '2027-08-30',
    fastagBalance: 8500,
    gpsSignal: 'Strong',
    currentLocation: 'Faridabad Central Hub Parking',
    lastService: '2026-10-22'
  },
  {
    id: 'VH-006',
    regNo: 'HR-55-BQ-6789',
    typeId: 'BHARATBENZ-32FT',
    driver: 'Manoj Kumar Tiwari',
    driverPhone: '+91 97170-44910',
    transporter: 'JBM Dedicated Fleet',
    status: 'available',
    fitnessExpiry: '2027-01-19',
    fastagBalance: 5100,
    gpsSignal: 'Strong (AIS-140)',
    currentLocation: 'JBM Plant 2 - Outbound Yard B',
    lastService: '2026-10-25'
  },
  {
    id: 'VH-007',
    regNo: 'HR-26-GZ-3456',
    typeId: 'EICHER-PRO-3019',
    driver: 'Deepak Verma',
    driverPhone: '+91 98910-66231',
    transporter: 'Green Express Logistics',
    status: 'maintenance',
    fitnessExpiry: '2027-05-22',
    fastagBalance: 1200,
    gpsSignal: 'In-Workshop',
    currentLocation: 'Eicher Authorized Service Center, IMT Manesar',
    lastService: '2026-09-30'
  },
  {
    id: 'VH-008',
    regNo: 'GJ-01-BV-4412',
    typeId: 'VOLVO-40FT-TRAILER',
    driver: 'Sanjaybhai Patel',
    driverPhone: '+91 98250-99412',
    transporter: 'Western Auto Logistics',
    status: 'available',
    fitnessExpiry: '2027-03-12',
    fastagBalance: 12400,
    gpsSignal: 'Strong',
    currentLocation: 'Sanand Hub Transit Yard',
    lastService: '2026-10-28'
  }
];

// Major OEM Customer Plants serviced by JBM Auto Components Division
export const customers = [
  {
    id: 'CUST-001',
    name: 'Maruti Suzuki India Ltd. (MSIL)',
    code: 'MSIL-MNSR',
    division: 'Powertrain & Body Plant',
    plant: 'Manesar Plant 1 & 2',
    address: 'Plot No. 1, Phase 3A, IMT Manesar, Gurugram, HR',
    distance: 14,
    transitTime: '35 mins',
    priority: 'critical',
    sla: 'JIT 2-Hour Slot',
    gate: 'Gate No. 4 (Vendor Direct Feed)',
    lineStoppagePenalty: '₹25,000 / min',
    logo: '🚗'
  },
  {
    id: 'CUST-002',
    name: 'Maruti Suzuki India Ltd. (MSIL)',
    code: 'MSIL-GGN',
    division: 'Car Assembly Complex',
    plant: 'Gurgaon Old Delhi Road Plant',
    address: 'Palam Gurgaon Road, Gurugram, HR',
    distance: 28,
    transitTime: '55 mins',
    priority: 'critical',
    sla: 'JIT 3-Hour Slot',
    gate: 'Gate No. 2 (Press Shop Stillage Inward)',
    lineStoppagePenalty: '₹25,000 / min',
    logo: '🚗'
  },
  {
    id: 'CUST-003',
    name: 'Tata Motors Passenger Vehicles Ltd.',
    code: 'TML-PUNE',
    division: 'Body & Chassis Division',
    plant: 'Pimpri / Chakan Plant',
    address: 'Sector 15, PCMC Industrial Area, Pune, MH',
    distance: 1380,
    transitTime: '26 hrs',
    priority: 'high',
    sla: '48-Hour Release',
    gate: 'Central Receiving Dock 7',
    lineStoppagePenalty: '₹15,000 / min',
    logo: '🚙'
  },
  {
    id: 'CUST-004',
    name: 'Tata Motors Electric Mobility (TPEM)',
    code: 'TML-SND',
    division: 'EV Battery & Body Assembly',
    plant: 'Sanand Plant (Gujarat)',
    address: 'GIDC Industrial Estate, Sanand, Ahmedabad, GJ',
    distance: 920,
    transitTime: '18 hrs',
    priority: 'critical',
    sla: '24-Hour Release',
    gate: 'EV Body Shop Dock E1',
    lineStoppagePenalty: '₹30,000 / min',
    logo: '⚡'
  },
  {
    id: 'CUST-005',
    name: 'Mahindra & Mahindra Ltd. (Auto Div)',
    code: 'M&M-CHK',
    division: 'SUV Assembly Division',
    plant: 'Chakan Plant 2',
    address: 'Phase 2, MIDC Chakan, Pune, MH',
    distance: 1410,
    transitTime: '28 hrs',
    priority: 'high',
    sla: '48-Hour Release',
    gate: 'Press & BIW Gate 3',
    lineStoppagePenalty: '₹20,000 / min',
    logo: '🚙'
  },
  {
    id: 'CUST-006',
    name: 'Honda Cars India Ltd.',
    code: 'HCIL-TPK',
    division: 'Press & Stamping Section',
    plant: 'Tapukara Plant',
    address: 'Industrial Area Phase 3, Tapukara, Alwar, RJ',
    distance: 65,
    transitTime: '1 hr 45 mins',
    priority: 'high',
    sla: 'Same-day JIS Window',
    gate: 'Inward Logistics Gate 1',
    lineStoppagePenalty: '₹18,000 / min',
    logo: '🚘'
  },
  {
    id: 'CUST-007',
    name: 'JBM Inter-Plant Logistics (JBM Auto)',
    code: 'JBM-J1-FBD',
    division: 'Faridabad Heavy Press Shop',
    plant: 'JBM Faridabad Plant 3',
    address: 'Sector 24, Industrial Area, Faridabad, HR',
    distance: 42,
    transitTime: '1 hr 15 mins',
    priority: 'internal',
    sla: 'Hourly Line Balancing',
    gate: 'Internal Transfer Bay',
    lineStoppagePenalty: 'Internal Sub-assembly feed',
    logo: '🏭'
  }
];

// Authentic JBM Auto Components Division Parts Catalog
export const parts = [
  {
    id: 'PART-001',
    name: 'BIW Front Subframe Engine Cradle Assembly',
    partNo: 'JBM-BIW-2042-M',
    category: 'Chassis & Subframe',
    oemModel: 'Maruti Brezza / Grand Vitara',
    weight: 28.5,
    volume: 0.145,
    containerType: 'Steel Stillage (ST-1200)',
    unitsPerContainer: 8,
    containerTareKg: 68,
    containerDimensions: { lengthMm: 1200, widthMm: 1000, heightMm: 950 },
    maxStackTiers: 2,
    colorCode: '#1d4ed8',
    fragility: 'Low (Heavy Welded Steel)'
  },
  {
    id: 'PART-002',
    name: 'Lower Control Arm Cross-Member Assembly',
    partNo: 'JBM-BIW-2041-A',
    category: 'Suspension Welded Assembly',
    oemModel: 'Maruti Swift / Baleno / Dzire',
    weight: 18.2,
    volume: 0.092,
    containerType: 'Steel Stillage (ST-1200)',
    unitsPerContainer: 12,
    containerTareKg: 68,
    containerDimensions: { lengthMm: 1200, widthMm: 1000, heightMm: 950 },
    maxStackTiers: 2,
    colorCode: '#2563eb',
    fragility: 'Low (Forged / Welded)'
  },
  {
    id: 'PART-003',
    name: 'Roof Outer Class-A Skin Panel (Stamped)',
    partNo: 'JBM-PNL-3011-R',
    category: 'Class-A Sheet Metal Skin Panel',
    oemModel: 'Maruti Swift 2026 Facelift',
    weight: 8.6,
    volume: 0.22,
    containerType: 'Panel Trolley (TR-1800)',
    unitsPerContainer: 14,
    containerTareKg: 85,
    containerDimensions: { lengthMm: 1800, widthMm: 1000, heightMm: 1200 },
    maxStackTiers: 1, // Strictly Non-stackable!
    colorCode: '#eab308',
    fragility: 'High (Class-A Surface, Rubber Cushion Padded)'
  },
  {
    id: 'PART-004',
    name: 'Door Inner & Outer Stamped Assembly RH',
    partNo: 'JBM-DR-3044-RH',
    category: 'Door BIW Module',
    oemModel: 'Tata Nexon / Punch EV',
    weight: 12.8,
    volume: 0.16,
    containerType: 'Panel Trolley (TR-1800)',
    unitsPerContainer: 10,
    containerTareKg: 85,
    containerDimensions: { lengthMm: 1800, widthMm: 1000, heightMm: 1200 },
    maxStackTiers: 1,
    colorCode: '#ca8a04',
    fragility: 'Medium (Interleaved Foam Spacers)'
  },
  {
    id: 'PART-005',
    name: 'Rear Floor Longitudinal Cross-Member Stamping',
    partNo: 'JBM-BIW-2044-F',
    category: 'Structural Underbody Stamping',
    oemModel: 'Maruti Fronx / Baleno',
    weight: 9.4,
    volume: 0.058,
    containerType: 'Foldable Plastic FLC (FLC-1140)',
    unitsPerContainer: 16,
    containerTareKg: 42,
    containerDimensions: { lengthMm: 1140, widthMm: 980, heightMm: 1000 },
    maxStackTiers: 3,
    colorCode: '#475569',
    fragility: 'Low (Deep Drawn High Tensile Steel)'
  },
  {
    id: 'PART-006',
    name: 'EV High-Voltage Aluminum Battery Enclosure Tray',
    partNo: 'JBM-EV-5001-BT',
    category: 'EV Battery Casings',
    oemModel: 'Tata Curvv EV / Punch EV Platform',
    weight: 38.0,
    volume: 0.38,
    containerType: 'ESD Anti-Static Crate (EV-CRATE)',
    unitsPerContainer: 4,
    containerTareKg: 55,
    containerDimensions: { lengthMm: 1400, widthMm: 1200, heightMm: 600 },
    maxStackTiers: 1,
    colorCode: '#ea580c',
    fragility: 'Critical (Clean-Room Certified, Zero-Contamination)'
  },
  {
    id: 'PART-007',
    name: 'Exhaust System Hot-End Catalytic Converter & Manifold',
    partNo: 'JBM-EXH-4015-SS',
    category: 'Exhaust & Emission Systems',
    oemModel: 'Mahindra XUV700 / Scorpio-N',
    weight: 14.2,
    volume: 0.082,
    containerType: 'Steel Stillage (ST-1200)',
    unitsPerContainer: 10,
    containerTareKg: 68,
    containerDimensions: { lengthMm: 1200, widthMm: 1000, heightMm: 950 },
    maxStackTiers: 2,
    colorCode: '#059669',
    fragility: 'Medium (Ceramic Substrate Inside)'
  },
  {
    id: 'PART-008',
    name: 'Instrument Panel Cross-Car Cockpit Beam (CCB)',
    partNo: 'JBM-CCB-1088-W',
    category: 'Cockpit Tubular Welded Assembly',
    oemModel: 'Honda Elevate / City',
    weight: 11.5,
    volume: 0.11,
    containerType: 'Steel Stillage (ST-1200)',
    unitsPerContainer: 12,
    containerTareKg: 68,
    containerDimensions: { lengthMm: 1200, widthMm: 1000, heightMm: 950 },
    maxStackTiers: 2,
    colorCode: '#0284c7',
    fragility: 'Medium (Precision Steering Column Bosses)'
  },
  {
    id: 'PART-009',
    name: 'Rear Twist Beam Suspension Axle Assembly',
    partNo: 'JBM-CHAS-102-TB',
    category: 'Heavy Chassis Tubular Assembly',
    oemModel: 'Maruti Brezza Platform',
    weight: 24.8,
    volume: 0.175,
    containerType: 'Steel Stillage (ST-1200)',
    unitsPerContainer: 6,
    containerTareKg: 68,
    containerDimensions: { lengthMm: 1200, widthMm: 1000, heightMm: 950 },
    maxStackTiers: 2,
    colorCode: '#3b82f6',
    fragility: 'Low (Heavy Welded Beam)'
  },
  {
    id: 'PART-010',
    name: 'Chassis Gusset Brackets & Reinforcements (Assorted)',
    partNo: 'JBM-STMP-8820-K',
    category: 'Stamped Small Brackets',
    oemModel: 'Universal Platform Parts',
    weight: 1.4,
    volume: 0.012,
    containerType: 'Euro KLT Stacking Bins (KLT-4314)',
    unitsPerContainer: 60,
    containerTareKg: 3.5,
    containerDimensions: { lengthMm: 600, widthMm: 400, heightMm: 280 },
    maxStackTiers: 5,
    colorCode: '#10b981',
    fragility: 'Low'
  },
  {
    id: 'PART-011',
    name: 'Returnable Empty Collapsed Stillages (ST-1200 Empty)',
    partNo: 'JBM-RET-ST1200',
    category: 'Reverse Logistics Asset',
    oemModel: 'Universal JBM-MSIL Fleet',
    weight: 68.0,
    volume: 0.28,
    containerType: 'Folded Steel Stillage',
    unitsPerContainer: 1,
    containerTareKg: 0,
    containerDimensions: { lengthMm: 1200, widthMm: 1000, heightMm: 300 },
    maxStackTiers: 4,
    colorCode: '#94a3b8',
    fragility: 'Indestructible (Empty Steel)'
  }
];

// Active Orders backlog from OEM JIT portals
export const pendingOrders = [
  {
    id: 'ORD-20261031-001',
    customerId: 'CUST-001',
    partId: 'PART-001',
    quantity: 64,
    weight: 2368,
    volume: 9.12,
    bins: 8,
    containerType: 'Steel Stillage (ST-1200)',
    priority: 'critical',
    status: 'qa-passed',
    dueTime: '13:30',
    poNumber: 'MSIL-PO-2026-9921',
    sapRef: 'SAP-4500188201',
    lineInfo: 'MSIL Plant 2 Line 2 — Assembly Takt: 62 sec',
    notes: 'JIT 2-Hour Window. Front axle sequence required.'
  },
  {
    id: 'ORD-20261031-002',
    customerId: 'CUST-001',
    partId: 'PART-002',
    quantity: 96,
    weight: 2291,
    volume: 9.12,
    bins: 8,
    containerType: 'Steel Stillage (ST-1200)',
    priority: 'critical',
    status: 'qa-passed',
    dueTime: '13:30',
    poNumber: 'MSIL-PO-2026-9922',
    sapRef: 'SAP-4500188202',
    lineInfo: 'MSIL Plant 2 Line 1 — Swift/Dzire Line',
    notes: 'Pair with ORD-001 in 32ft BharatBenz milk run trailer.'
  },
  {
    id: 'ORD-20261031-003',
    customerId: 'CUST-001',
    partId: 'PART-009',
    quantity: 36,
    weight: 1301,
    volume: 6.84,
    bins: 6,
    containerType: 'Steel Stillage (ST-1200)',
    priority: 'critical',
    status: 'qa-passed',
    dueTime: '14:00',
    poNumber: 'MSIL-PO-2026-9925',
    sapRef: 'SAP-4500188203',
    lineInfo: 'MSIL Plant 1 Line 2 — Suspension Module Drop',
    notes: 'Direct unload to Bay 4 overhead crane.'
  },
  {
    id: 'ORD-20261031-004',
    customerId: 'CUST-002',
    partId: 'PART-003',
    quantity: 42,
    weight: 616,
    volume: 6.48,
    bins: 3,
    containerType: 'Panel Trolley (TR-1800)',
    priority: 'critical',
    status: 'qa-passed',
    dueTime: '14:45',
    poNumber: 'MSIL-GGN-PO-4412',
    sapRef: 'SAP-4500188204',
    lineInfo: 'Gurgaon Press & Weld Shop C',
    notes: 'Non-stackable skin panels. Strict Class-A surface clearance.'
  },
  {
    id: 'ORD-20261031-005',
    customerId: 'CUST-004',
    partId: 'PART-006',
    quantity: 16,
    weight: 828,
    volume: 4.03,
    bins: 4,
    containerType: 'ESD Anti-Static Crate (EV-CRATE)',
    priority: 'critical',
    status: 'qa-passed',
    dueTime: '16:00',
    poNumber: 'TPEM-PO-2026-7781',
    sapRef: 'SAP-4500188205',
    lineInfo: 'Sanand EV Line 1 — Battery Pack Marriage Dock',
    notes: 'AIS-038 Rev 2 verified. Clean room sealed packaging.'
  },
  {
    id: 'ORD-20261031-006',
    customerId: 'CUST-003',
    partId: 'PART-004',
    quantity: 40,
    weight: 852,
    volume: 8.64,
    bins: 4,
    containerType: 'Panel Trolley (TR-1800)',
    priority: 'high',
    status: 'qa-passed',
    dueTime: '17:30',
    poNumber: 'TML-PO-2026-3819',
    sapRef: 'SAP-4500188206',
    lineInfo: 'Pune Car Plant 1 Body Shop',
    notes: 'Long haul shipment. Ensure tarpaulin and edge corner guards.'
  },
  {
    id: 'ORD-20261031-007',
    customerId: 'CUST-005',
    partId: 'PART-007',
    quantity: 60,
    weight: 1260,
    volume: 6.84,
    bins: 6,
    containerType: 'Steel Stillage (ST-1200)',
    priority: 'high',
    status: 'qa-passed',
    dueTime: '18:00',
    poNumber: 'MM-PO-2026-8802',
    sapRef: 'SAP-4500188207',
    lineInfo: 'Chakan Exhaust Fitment Bay 2',
    notes: 'BS-VI Stage II OBD compliant exhaust assemblies.'
  },
  {
    id: 'ORD-20261031-008',
    customerId: 'CUST-006',
    partId: 'PART-008',
    quantity: 48,
    weight: 824,
    volume: 4.56,
    bins: 4,
    containerType: 'Steel Stillage (ST-1200)',
    priority: 'high',
    status: 'qa-passed',
    dueTime: '15:15',
    poNumber: 'HCIL-PO-2026-1144',
    sapRef: 'SAP-4500188208',
    lineInfo: 'Tapukara Cockpit Sub-Assembly Module',
    notes: 'JIS sequencing by chassis VIN schedule.'
  },
  {
    id: 'ORD-20261031-009',
    customerId: 'CUST-001',
    partId: 'PART-005',
    quantity: 128,
    weight: 1539,
    volume: 8.94,
    bins: 8,
    containerType: 'Foldable Plastic FLC (FLC-1140)',
    priority: 'high',
    status: 'qa-passed',
    dueTime: '14:15',
    poNumber: 'MSIL-PO-2026-9928',
    sapRef: 'SAP-4500188209',
    lineInfo: 'MSIL Plant 2 Underbody Welder Robot Cell 4',
    notes: 'Stackable 2-high inside container.'
  },
  {
    id: 'ORD-20261031-010',
    customerId: 'CUST-007',
    partId: 'PART-010',
    quantity: 600,
    weight: 875,
    volume: 0.67,
    bins: 10,
    containerType: 'Euro KLT Stacking Bins (KLT-4314)',
    priority: 'internal',
    status: 'packed',
    dueTime: '13:00',
    poNumber: 'JBM-INT-TRF-0912',
    sapRef: 'SAP-4500188210',
    lineInfo: 'Faridabad Exhaust Welding Shop',
    notes: 'Internal transfer from Manesar stamping cell.'
  },
  {
    id: 'ORD-20261031-RET',
    customerId: 'CUST-001',
    partId: 'PART-011',
    quantity: 12,
    weight: 816,
    volume: 3.36,
    bins: 12,
    containerType: 'Folded Steel Stillage',
    priority: 'internal',
    status: 'qa-passed',
    dueTime: '14:30',
    poNumber: 'JBM-RET-LOG-01',
    sapRef: 'SAP-RET-9901',
    lineInfo: 'Reverse Logistics: Empty Stillages Return',
    notes: 'Backhaul nested returnable stillages.'
  }
];

// Returnable Packaging Inventory Status
export const containerInventory = {
  'Steel Stillage (ST-1200)': {
    total: 480,
    availableAtPlant: 142,
    inCirculationAtOEM: 218,
    inTransitLoading: 96,
    maintenanceInspection: 24,
    turnaroundDays: 2.1,
    unitValueInr: 18500
  },
  'Panel Trolley (TR-1800)': {
    total: 210,
    availableAtPlant: 64,
    inCirculationAtOEM: 112,
    inTransitLoading: 28,
    maintenanceInspection: 6,
    turnaroundDays: 1.8,
    unitValueInr: 34000
  },
  'Foldable Plastic FLC (FLC-1140)': {
    total: 350,
    availableAtPlant: 118,
    inCirculationAtOEM: 165,
    inTransitLoading: 52,
    maintenanceInspection: 15,
    turnaroundDays: 3.0,
    unitValueInr: 8200
  },
  'ESD Anti-Static Crate (EV-CRATE)': {
    total: 90,
    availableAtPlant: 32,
    inCirculationAtOEM: 44,
    inTransitLoading: 12,
    maintenanceInspection: 2,
    turnaroundDays: 1.5,
    unitValueInr: 45000
  },
  'Euro KLT Stacking Bins (KLT-4314)': {
    total: 1200,
    availableAtPlant: 480,
    inCirculationAtOEM: 580,
    inTransitLoading: 110,
    maintenanceInspection: 30,
    turnaroundDays: 2.4,
    unitValueInr: 1200
  }
};

// Docks at Plant 2
export const dockSlots = [
  {
    id: 'DS-001',
    dock: 'Dock 1 (Direct MSIL Dedicated Bay)',
    vehicleId: 'VH-003',
    vehicleReg: 'HR-55-DM-1290',
    customer: 'Maruti Suzuki (Manesar Plant 2)',
    startTime: '08:00',
    endTime: '09:15',
    type: 'loading',
    orderId: 'ORD-20261031-001',
    status: 'in-progress',
    loadingProgress: 75,
    tareWeightKg: 4200,
    grossWeightKg: 10450
  },
  {
    id: 'DS-002',
    dock: 'Dock 2 (MSIL Gurgaon Milk-Run Bay)',
    vehicleId: 'VH-001',
    vehicleReg: 'HR-26-EE-4521',
    customer: 'Maruti Suzuki (Gurgaon Plant)',
    startTime: '09:30',
    endTime: '10:45',
    type: 'loading',
    orderId: 'ORD-20261031-004',
    status: 'scheduled',
    loadingProgress: 0,
    tareWeightKg: 9500,
    grossWeightKg: 19800
  },
  {
    id: 'DS-003',
    dock: 'Dock 3 (Long-Haul Multi-Axle Bay)',
    vehicleId: 'VH-002',
    vehicleReg: 'HR-55-CK-7832',
    customer: 'Tata Motors (Sanand & Pune)',
    startTime: '11:00',
    endTime: '12:30',
    type: 'loading',
    orderId: 'ORD-20261031-005',
    status: 'scheduled',
    loadingProgress: 0,
    tareWeightKg: 7800,
    grossWeightKg: 16400
  },
  {
    id: 'DS-004',
    dock: 'Dock 4 (Empty Stillages Return Bay)',
    vehicleId: null,
    vehicleReg: 'HR-26-DN-3321',
    customer: 'Maruti Suzuki Manesar (Empty Return)',
    startTime: '08:30',
    endTime: '09:45',
    type: 'unloading',
    orderId: null,
    status: 'completed',
    loadingProgress: 100,
    tareWeightKg: 4200,
    grossWeightKg: 6100
  },
  {
    id: 'DS-005',
    dock: 'Dock 5 (Honda & M&M Outbound)',
    vehicleId: 'VH-006',
    vehicleReg: 'HR-55-BQ-6789',
    customer: 'Honda Cars Tapukara',
    startTime: '12:45',
    endTime: '14:00',
    type: 'loading',
    orderId: 'ORD-20261031-008',
    status: 'scheduled',
    loadingProgress: 0,
    tareWeightKg: 9400,
    grossWeightKg: 18200
  },
  {
    id: 'DS-006',
    dock: 'Dock 6 (Inter-Plant Faridabad Shuttle)',
    vehicleId: 'VH-004',
    vehicleReg: 'HR-26-FN-5567',
    customer: 'JBM Faridabad Plant 3 Transfer',
    startTime: '10:00',
    endTime: '11:00',
    type: 'loading',
    orderId: 'ORD-20261031-010',
    status: 'in-progress',
    loadingProgress: 40,
    tareWeightKg: 2800,
    grossWeightKg: 5200
  }
];

// Today's Dispatch Log
export const dispatchLog = [
  {
    id: 'DIS-261031-01',
    vehicleId: 'VH-004',
    vehicleReg: 'HR-26-FN-5567',
    orderId: 'ORD-20261031-PRE1',
    customer: 'Maruti Suzuki India Ltd',
    destination: 'MSIL Manesar Plant 2 Gate 4',
    driver: 'Pradeep Yadav',
    departedAt: '06:15',
    eta: '06:50',
    status: 'delivered',
    weightKg: 3150,
    ewayBill: '281489028812',
    irnNo: 'a7b8c9d0e1f2...',
    invoiceNo: 'JBM/MNSR/26/0891'
  },
  {
    id: 'DIS-261031-02',
    vehicleId: 'VH-001',
    vehicleReg: 'HR-26-EE-4521',
    orderId: 'ORD-20261031-PRE2',
    customer: 'Maruti Suzuki India Ltd',
    destination: 'MSIL Gurgaon Old Delhi Road',
    driver: 'Rajeshwar Sharma',
    departedAt: '07:30',
    eta: '08:25',
    status: 'delivered',
    weightKg: 14200,
    ewayBill: '281489028813',
    irnNo: 'b8c9d0e1f2a3...',
    invoiceNo: 'JBM/MNSR/26/0892'
  },
  {
    id: 'DIS-261031-03',
    vehicleId: 'VH-008',
    vehicleReg: 'GJ-01-BV-4412',
    orderId: 'ORD-20261031-PRE3',
    customer: 'Tata Motors Electric (TPEM)',
    destination: 'Sanand GIDC Plant, Gujarat',
    driver: 'Sanjaybhai Patel',
    departedAt: '08:45',
    eta: 'Tomorrow 03:00',
    status: 'in-transit',
    weightKg: 22800,
    ewayBill: '281489028814',
    irnNo: 'c9d0e1f2a3b4...',
    invoiceNo: 'JBM/MNSR/26/0893'
  }
];

// Manufacturing Plants
export const plants = [
  {
    id: 'PLANT-MNSR-2',
    code: 'PLANT-2',
    name: 'JBM Plant 2 – IMT Manesar (Main Outbound Hub)',
    division: 'Welded Assemblies & Chassis Components',
    address: 'Sector 8, IMT Manesar, Gurugram, Haryana 122050',
    activeDocks: 6,
    fleetStationed: 18,
    dailyShipmentsAvg: 38,
    status: 'operational',
    sapPlantCode: '1020'
  },
  {
    id: 'PLANT-GGN-1',
    code: 'PLANT-1',
    name: 'JBM Plant 1 – Sector 37 Gurugram',
    division: 'Heavy Sheet Metal Stampings & BIW Skin Panels',
    address: 'Pace City II, Sector 37, Gurugram, Haryana',
    activeDocks: 4,
    fleetStationed: 12,
    dailyShipmentsAvg: 26,
    status: 'operational',
    sapPlantCode: '1010'
  },
  {
    id: 'PLANT-FBD-3',
    code: 'PLANT-3',
    name: 'JBM Plant 3 – Sector 24 Faridabad',
    division: 'Exhaust Systems, Catalytic Converters & Fuel Tanks',
    address: 'Sector 24, Industrial Area, Faridabad, Haryana',
    activeDocks: 5,
    fleetStationed: 14,
    dailyShipmentsAvg: 30,
    status: 'operational',
    sapPlantCode: '1030'
  },
  {
    id: 'PLANT-SND-4',
    code: 'PLANT-4',
    name: 'JBM Plant 4 – Sanand (Gujarat)',
    division: 'Tata Motors Dedicated BIW Stampings & EV Trays',
    address: 'GIDC Industrial Area, Sanand, Gujarat',
    activeDocks: 4,
    fleetStationed: 10,
    dailyShipmentsAvg: 18,
    status: 'operational',
    sapPlantCode: '1040'
  },
  {
    id: 'PLANT-PUNE-5',
    code: 'PLANT-5',
    name: 'JBM Plant 5 – Chakan (Pune)',
    division: 'Mahindra & Tata Motors Chassis Sub-Assemblies',
    address: 'Phase 2, MIDC Chakan, Pune, Maharashtra',
    activeDocks: 4,
    fleetStationed: 11,
    dailyShipmentsAvg: 22,
    status: 'operational',
    sapPlantCode: '1050'
  }
];

// Helper Functions
export function getCustomer(id) {
  return customers.find(c => c.id === id);
}

export function getPart(id) {
  return parts.find(p => p.id === id);
}

export function getVehicleType(id) {
  return vehicleTypes.find(v => v.id === id);
}

export function getVehicle(id) {
  return fleet.find(v => v.id === id);
}

export function getOrdersForCustomer(customerId) {
  return pendingOrders.filter(o => o.customerId === customerId);
}

export function getPriorityColor(priority) {
  switch (priority) {
    case 'critical': return 'danger';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'internal': return 'primary';
    default: return 'neutral';
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case 'qa-passed': return { label: 'QA Passed (Ready)', color: 'success' };
    case 'qa-pending': return { label: 'QA Inspection', color: 'warning' };
    case 'packed': return { label: 'Staged in Stillage', color: 'info' };
    case 'loading': return { label: 'At Dock Bay', color: 'primary' };
    case 'dispatched': return { label: 'En-Route to OEM', color: 'success' };
    default: return { label: status, color: 'neutral' };
  }
}

// ============================================================================
// REAL-WORLD LOGISTICS EDGE CASES & BEFORE-VS-AFTER OPTIMIZATION SCENARIOS
// ============================================================================
export const optimizationScenarios = {
  AI_OPTIMAL: {
    id: 'AI_OPTIMAL',
    label: '✨ JBM LoadIQ AI 3D Optimal Plan',
    badge: 'AI RECOMMENDED',
    badgeColor: 'success',
    description: 'Autonomous counterbalancing, LIFO takt sequence, Class-A protection, and reverse stillage recovery.',
    isCompliant: true,
    riskLevel: 'LOW',
    challanRiskInr: 0,
    lineStoppageRiskInr: 0,
    trucksRequired: 1,
    emptyStillagesReturned: 12,
    cogPct: 45.2,
    volumetricUtil: 89.4,
    weightUtil: 82.6,
    frontAxleUtil: 68.4,
    rearAxleUtil: 72.8,
    costPerTripInr: 8450,
    co2SavedKg: 182,
    rehandlingEvents: 0
  },
  MANUAL_BASELINE: {
    id: 'MANUAL_BASELINE',
    label: '⚠️ Manual Dispatcher Plan (Baseline / Sub-Optimal)',
    badge: 'DISPATCHER GUT-FEEL',
    badgeColor: 'danger',
    description: 'Heavy stampings loaded at rear door. Rear axle overload (108%). 45% empty air. Zero return stillages.',
    isCompliant: false,
    riskLevel: 'CRITICAL',
    challanRiskInr: 28000,
    lineStoppageRiskInr: 550000,
    trucksRequired: 2,
    emptyStillagesReturned: 0,
    cogPct: 59.8, // severe rear weight bias
    volumetricUtil: 53.2,
    weightUtil: 48.6,
    frontAxleUtil: 38.0, // front steer axle dangerously light
    rearAxleUtil: 108.5, // CMVR violation!
    costPerTripInr: 24800, // 2 trucks needed
    co2SavedKg: 0,
    rehandlingEvents: 4
  },
  EDGE_CASE_AXLE_OVERLOAD: {
    id: 'EDGE_CASE_AXLE_OVERLOAD',
    label: '🛑 Edge Case: Severe Rear Axle Overload & CoG Instability',
    badge: 'CMVR OVERLOAD VIOLATION',
    badgeColor: 'danger',
    description: 'Heavy BIW cradles (2.4T each) stacked at rear overhang. Vehicle loses front steering traction.',
    isCompliant: false,
    riskLevel: 'CRITICAL',
    challanRiskInr: 34000,
    lineStoppageRiskInr: 120000,
    trucksRequired: 1,
    emptyStillagesReturned: 0,
    cogPct: 63.4,
    volumetricUtil: 62.0,
    weightUtil: 91.2,
    frontAxleUtil: 32.1,
    rearAxleUtil: 114.2, // severe violation
    costPerTripInr: 14200,
    co2SavedKg: 0,
    rehandlingEvents: 2
  },
  EDGE_CASE_FRAGILE_CRUSHING: {
    id: 'EDGE_CASE_FRAGILE_CRUSHING',
    label: '💥 Edge Case: Packaging Incompatibility & Crushing Risk',
    badge: 'SCRAP DAMAGE RISK',
    badgeColor: 'danger',
    description: 'Heavy welded stillages stacked directly above Class-A skin panels. Potential ₹4.2 Lakhs scrap dent.',
    isCompliant: false,
    riskLevel: 'HIGH',
    challanRiskInr: 0,
    lineStoppageRiskInr: 420000,
    trucksRequired: 1,
    emptyStillagesReturned: 0,
    cogPct: 48.5,
    volumetricUtil: 76.4,
    weightUtil: 78.0,
    frontAxleUtil: 70.2,
    rearAxleUtil: 76.5,
    costPerTripInr: 11200,
    co2SavedKg: 0,
    rehandlingEvents: 3
  }
};

// Generates optimization result tailored to active scenario and real-world inputs
export function generateOptimizationResult(selectedOrders, vehicleType, activeScenarioKey = 'AI_OPTIMAL') {
  const scenario = optimizationScenarios[activeScenarioKey] || optimizationScenarios.AI_OPTIMAL;
  const isOptimal = activeScenarioKey === 'AI_OPTIMAL';

  const totalWeight = selectedOrders.reduce((sum, o) => sum + o.weight, 0);
  const totalVolume = selectedOrders.reduce((sum, o) => sum + o.volume, 0);
  const maxWeight = vehicleType.maxWeight || vehicleType.payloadKg;
  const maxVolume = vehicleType.maxVolume || vehicleType.volumeCuM;

  const weightUtil = isOptimal
    ? Math.min((totalWeight / maxWeight) * 100, 100)
    : scenario.weightUtil;
  const volumeUtil = isOptimal
    ? Math.min((totalVolume / maxVolume) * 100 + (scenario.emptyStillagesReturned * 1.8), 100)
    : scenario.volumetricUtil;
  const overallUtil = Math.max(weightUtil, volumeUtil);

  // Axle distribution calculation
  const tareWeight = (vehicleType.gvwKg || 12000) - maxWeight;
  const grossLoadedWeight = tareWeight + totalWeight;

  const cogPercentage = scenario.cogPct;
  const frontAxleLimit = vehicleType.frontAxleLimitKg || 7000;
  const rearAxleLimit = vehicleType.rearAxleLimitKg || 19000;

  // Front & rear axle weights derived from CoG
  const frontAxleWeight = Math.round(grossLoadedWeight * (1 - cogPercentage / 100));
  const rearAxleWeight = Math.round(grossLoadedWeight * (cogPercentage / 100));

  const frontAxleOk = frontAxleWeight <= frontAxleLimit;
  const rearAxleOk = rearAxleWeight <= rearAxleLimit && scenario.rearAxleUtil <= 100;
  const isAxleCompliant = frontAxleOk && rearAxleOk;

  // Real-world monetary savings
  // Savings = (Manual trips cost - AI trip cost) + Stillage recovery value + Avoided RTO fine + Avoided delay penalty
  const tripFuelSaving = Math.max(optimizationScenarios.MANUAL_BASELINE.costPerTripInr - scenario.costPerTripInr, 0);
  const stillageRecoverySaving = scenario.emptyStillagesReturned * 1200; // ₹1,200 asset value recovery per turnaround
  const penaltyAvoided = isOptimal ? 28000 : 0;
  const totalTripSaving = tripFuelSaving + stillageRecoverySaving + penaltyAvoided;
  const annualizedSaving = totalTripSaving * 300; // 300 working days per year

  // 3D Pallet Arrangement Engine
  const truckDim = vehicleType.dimensions || { lengthMm: 9750, widthMm: 2500, heightMm: 2750 };
  const L = truckDim.lengthMm / 1000;
  const W = truckDim.widthMm / 1000;
  const H = truckDim.heightMm / 1000;

  const packedUnits3D = [];
  let unitIndex = 0;

  // In AI_OPTIMAL: Counterbalanced layout (Heavier at front, fragile skin panels on floor, empty return stillages nested on top/rear)
  // In MANUAL_BASELINE or AXLE_OVERLOAD: Heavy parts packed at rear door, causing rear overload and crushing
  let currentX = isOptimal ? -L / 2 + 0.65 : L / 2 - 1.2; // manual starts at rear door!
  let currentZ = -W / 2 + 0.55;
  let currentY = 0;

  selectedOrders.forEach(order => {
    const part = getPart(order.partId);
    const binsCount = order.bins || 4;
    const dim = part?.containerDimensions || { lengthMm: 1200, widthMm: 1000, heightMm: 950 };
    const bL = dim.lengthMm / 1000;
    const bW = dim.widthMm / 1000;
    const bH = dim.heightMm / 1000;

    const isFragileSkin = part?.category?.includes('Skin Panel');
    const isHeavyBIW = part?.weight > 20;

    for (let b = 0; b < binsCount; b++) {
      if (isOptimal) {
        if (currentX + bL > L / 2 - 0.2) {
          currentX = -L / 2 + 0.65;
          currentZ += bW + 0.08;
        }
        if (currentZ + bW > W / 2) {
          currentX = -L / 2 + 0.65;
          currentZ = -W / 2 + 0.55;
          currentY += bH + 0.05;
        }
      } else {
        // Sub-optimal manual packing: stacks toward rear overhang
        if (currentX - bL < -L / 2 + 0.5) {
          currentX = L / 2 - 1.2;
          currentZ += bW + 0.08;
        }
        if (currentZ + bW > W / 2) {
          currentX = L / 2 - 1.2;
          currentZ = -W / 2 + 0.55;
          currentY += bH + 0.05;
        }
      }

      // Check if this box has a crushing conflict in sub-optimal scenario
      const hasConflict = !isOptimal && isFragileSkin && currentY > 0;

      packedUnits3D.push({
        id: `${order.id}-U${b + 1}`,
        orderId: order.id,
        partName: part?.name || 'Automotive Component',
        partNo: part?.partNo || 'JBM-PART',
        containerType: order.containerType,
        color: hasConflict ? '#dc2626' : (part?.colorCode || '#2563eb'),
        weight: Math.round(order.weight / binsCount),
        position: [
          Number(currentX.toFixed(2)),
          Number((currentY + bH / 2).toFixed(2)),
          Number(currentZ.toFixed(2))
        ],
        size: [bL, bH, bW],
        tier: currentY === 0 ? 1 : currentY < bH * 1.5 ? 2 : 3,
        stackable: (part?.maxStackTiers || 1) > 1,
        fragility: part?.fragility,
        hasConflict,
        conflictMsg: hasConflict ? 'CRUSHING RISK: Heavy load stacked on Class-A Skin Panel!' : null,
        sequenceNum: ++unitIndex
      });

      if (isOptimal) {
        currentX += bL + 0.08;
      } else {
        currentX -= (bL + 0.08);
      }
    }
  });

  // If AI_OPTIMAL, inject nested returnable stillages into upper void space!
  if (isOptimal && scenario.emptyStillagesReturned > 0) {
    let retX = 0.5;
    let retZ = -W / 2 + 0.55;
    for (let r = 0; r < 6; r++) {
      packedUnits3D.push({
        id: `JBM-RET-ST1200-R${r + 1}`,
        orderId: 'ORD-20261031-RET',
        partName: 'Returnable Empty Collapsed Stillages (ST-1200)',
        partNo: 'JBM-RET-ST1200',
        containerType: 'Folded Steel Stillage',
        color: '#64748b',
        weight: 68,
        position: [Number(retX.toFixed(2)), Number((H * 0.75).toFixed(2)), Number(retZ.toFixed(2))],
        size: [1.2, 0.35, 1.0],
        tier: 3,
        stackable: true,
        isReturnAsset: true,
        sequenceNum: ++unitIndex
      });
      retX += 1.25;
      if (retX > L / 2 - 0.5) {
        retX = 0.5;
        retZ += 1.05;
      }
    }
  }

  return {
    scenario,
    activeScenarioKey,
    weightUtilization: Number(weightUtil).toFixed(1),
    volumeUtilization: Number(volumeUtil).toFixed(1),
    overallUtilization: Number(overallUtil).toFixed(1),
    totalWeight,
    totalVolume: Number(totalVolume).toFixed(1),
    maxWeight,
    maxVolume,
    isOverweight: totalWeight > maxWeight,
    isOvervolume: totalVolume > maxVolume,
    timeSaved: isOptimal ? 24 : 0,
    financialImpact: {
      tripFuelSaving,
      stillageRecoverySaving,
      penaltyAvoided,
      totalTripSaving,
      annualizedSaving,
      costPerTripInr: scenario.costPerTripInr,
      co2SavedKg: scenario.co2SavedKg,
      trucksRequired: scenario.trucksRequired,
      rehandlingEvents: scenario.rehandlingEvents
    },
    axleAnalysis: {
      grossWeightKg: grossLoadedWeight,
      frontAxleWeightKg: frontAxleWeight,
      rearAxleWeightKg: rearAxleWeight,
      frontAxleLimitKg: frontAxleLimit,
      rearAxleLimitKg: rearAxleLimit,
      frontAxleUtil: Number(scenario.frontAxleUtil).toFixed(1),
      rearAxleUtil: Number(scenario.rearAxleUtil).toFixed(1),
      cogPercentage: Number(cogPercentage).toFixed(1),
      isCompliant: isAxleCompliant,
      challanFineRisk: scenario.challanRiskInr,
      cmvrRegulation: 'MoRTH CMVR Section 93 - Axle Weight Limits'
    },
    packedUnits3D,
    compliance: {
      invoice: true,
      ewayBill: true,
      materialSummary: true,
      tripDetails: true,
      weightCheck: totalWeight <= maxWeight,
      volumeCheck: totalVolume <= maxVolume,
      axleCheck: isAxleCompliant,
      ais140Gps: true,
      oemJitWindowPass: isOptimal,
      fragilityPass: !packedUnits3D.some(u => u.hasConflict)
    }
  };
}
