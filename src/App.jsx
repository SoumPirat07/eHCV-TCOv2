import React, { useState, useMemo } from "react";
import {
  Truck, Zap, Fuel, BatteryCharging, TrendingUp, TrendingDown,
  Flag, Package, Info, RotateCcw, PlugZap, ShieldCheck, Layers,
  Plus, Trash2, MapPin, DollarSign, Settings, Eye, Sun, Moon
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceDot,
} from "recharts";

// 1. Precise Lookup Matrix for Duty Cycle Efficiency (km/kWh)
const EFFICIENCY_MATRIX = {
  "6 lane highway/Expressway": {
    "High":   { 0: 1.10, 20: 0.90, 40: 0.70, 60: 0.60 },
    "Medium": { 0: 1.21, 20: 0.97, 40: 0.74, 60: 0.62 },
    "Low":    { 0: 1.33, 20: 1.05, 40: 0.77, 60: 0.64 }
  },
  "4 lane highway": {
    "High":   { 0: 0.99, 20: 0.81, 40: 0.63, 60: 0.54 },
    "Medium": { 0: 1.09, 20: 0.87, 40: 0.66, 60: 0.56 },
    "Low":    { 0: 1.20, 20: 0.94, 40: 0.69, 60: 0.57 }
  },
  "2 lane state highway": {
    "High":   { 0: 0.84, 20: 0.69, 40: 0.54, 60: 0.46 },
    "Medium": { 0: 0.93, 20: 0.74, 40: 0.56, 60: 0.47 },
    "Low":    { 0: 1.02, 20: 0.80, 40: 0.59, 60: 0.49 }
  },
  "City road": {
    "High":   { 0: 0.76, 20: 0.62, 40: 0.48, 60: 0.41 },
    "Medium": { 0: 0.83, 20: 0.67, 40: 0.51, 60: 0.43 },
    "Low":    { 0: 0.92, 20: 0.72, 40: 0.53, 60: 0.44 }
  },
  "Broken road": {
    "High":   { 0: 0.68, 20: 0.56, 40: 0.43, 60: 0.37 },
    "Medium": { 0: 0.75, 20: 0.60, 40: 0.46, 60: 0.38 },
    "Low":    { 0: 0.82, 20: 0.65, 40: 0.48, 60: 0.39 }
  }
};

// Interpolation Helper
function interpolateEfficiency(roadType, traffic, payload) {
  const road = EFFICIENCY_MATRIX[roadType] || EFFICIENCY_MATRIX["6 lane highway/Expressway"];
  const cond = road[traffic] || road["Medium"];
  const keys = [0, 20, 40, 60];
  
  if (payload <= 0) return cond[0];
  if (payload >= 60) return cond[60];
  
  let lowerKey = 0;
  let upperKey = 60;
  for (let i = 0; i < keys.length - 1; i++) {
    if (payload >= keys[i] && payload <= keys[i+1]) {
      lowerKey = keys[i];
      upperKey = keys[i+1];
      break;
    }
  }
  
  const lowerVal = cond[lowerKey];
  const upperVal = cond[upperKey];
  const ratio = (payload - lowerKey) / (upperKey - lowerKey);
  return lowerVal + ratio * (upperVal - lowerVal);
}

const DEFAULT_ROUTE_SEGMENTS = [
  { id: "1", from: "Point A", to: "Point B", distance: 150, roadType: "6 lane highway/Expressway", traffic: "Medium", payload: 35, avgSpeed: 60 },
  { id: "2", from: "Point B", to: "Point C", distance: 120, roadType: "4 lane highway", traffic: "High", payload: 35, avgSpeed: 50 },
  { id: "3", from: "Point C", to: "Point D", distance: 130, roadType: "4 lane highway", traffic: "Low", payload: 35, avgSpeed: 55 },
  { id: "4", from: "Point D", to: "Point A", distance: 400, roadType: "6 lane highway/Expressway", traffic: "Medium", payload: 0, avgSpeed: 65 }
];

const DEFAULTS = {
  // General Logistics
  monthlyCargoVolume: 12000, // Tonnes
  workingDaysPerMonth: 25,
  dailyOperatingLimitHrs: 18,
  loadingUnloadingTimePerTrip: 3.5, // hours

  // Route Planning
  routeSegments: DEFAULT_ROUTE_SEGMENTS,

  // Global / Financial Settings
  analysisPeriod: 8,
  discountRate: 9,
  escGeneral: 4,
  escFuel: 5,
  escElectricity: 3,
  escWages: 6,
  escInfrastructure: 4,

  // Operational Expenses Breakdown
  driverMonthlySalary: 35000,
  tollCostPerTrip: 3500,
  tyreCostPerSet: 180000,
  tyreLifeKm: 90000,
  depotLandLeaseMonthly: 120000,
  depotDemandChargesMonthly: 80000,

  // 1. Diesel Tractor-Trailer
  dieselPurchasePrice: 4200000,
  gstDiesel: 18,
  baseFuelEconomy: 4.0, // km/l base configuration
  dieselPrice: 94,
  dieselMaintCostPerKm: 3.5,
  dieselInsuranceRate: 2.5,
  dieselResidualValue: 15,
  dieselFinancing: "emi",
  dieselDownPaymentPct: 15,
  dieselLoanInterestRate: 9.5,
  dieselLoanTenure: 7,
  dieselTractorWeight: 8500,
  dieselTrailerWeight: 9000,
  dieselGVWR: 55000,

  // 2. Electric Tractor-Trailer (BEV)
  bevPurchasePrice: 9500000,
  gstBEV: 5,
  batteryCapacity: 450, // kWh
  batteryReplacementCost: 3500000,
  batteryDegradationPerCycle: 0.006,
  batterySOHThreshold: 75,
  bevMaintCostPerKm: 2.2,
  bevInsurancePremiumDiff: 15, // % higher than diesel
  bevResidualValue: 8,
  bevFinancing: "emi",
  bevDownPaymentPct: 15,
  bevLoanInterestRate: 10.0,
  bevLoanTenure: 7,
  bevTractorWeight: 11000,
  bevTrailerWeight: 9000,
  bevGVWR: 55000,
  bevSafeSoCThreshold: 20, // Min reserve percentage

  // 3. Competition / Alternative Fuel Vehicle (e.g. Rival BEV / LNG)
  compName: "Competitor BEV",
  compPurchasePrice: 11000000,
  gstComp: 5,
  compBatteryCapacity: 500,
  compBatteryReplacementCost: 4000000,
  compBatteryDegradationPerCycle: 0.005,
  compBatterySOHThreshold: 75,
  compMaintCostPerKm: 2.4,
  compInsurancePremiumDiff: 15,
  compResidualValue: 10,
  compFinancing: "emi",
  compDownPaymentPct: 15,
  compLoanInterestRate: 10.0,
  compLoanTenure: 7,
  compTractorWeight: 11500,
  compTrailerWeight: 9000,
  compGVWR: 55000,
  compSafeSoCThreshold: 20,

  // Charging Infrastructure Capital & Maintenance Costs
  stationCost: 4500000,        // Capital setup per depot/location
  stationMaintenance: 180000,  // Annual upkeep per depot
  chargerCost: 1800000,        // Fast charger capital unit cost
  chargerMaintenance: 60000,   // Annual maintenance per fast charger
  infrastructureTaxCredit: 5,  // % subsidy deduction
  chargingTimePerCycle: 1.25,  // hours
  depotElectricityRate: 8.5,
  publicChargingRate: 15.0,
  chargingType: "private",     // private/depot or public
};

function inr(n) {
  const v = Math.round(n || 0);
  return "₹" + v.toLocaleString("en-IN");
}
function inrCompact(n) {
  const abs = Math.abs(n || 0);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return sign + "₹" + (abs / 1e7).toFixed(2) + " Cr";
  if (abs >= 1e5) return sign + "₹" + (abs / 1e5).toFixed(2) + " L";
  return sign + inr(abs);
}

export default function ComprehensiveTCOCalculator() {
  const [inp, setInp] = useState(DEFAULTS);
  const [darkMode, setDarkMode] = useState(true);

  const set = (k) => (v) => setInp((s) => ({ ...s, [k]: v }));

  // Helper to append a dynamic segment
  const addSegment = () => {
    const nextId = String(inp.routeSegments.length + 1);
    const newSeg = {
      id: nextId,
      from: `Point ${String.fromCharCode(65 + inp.routeSegments.length)}`,
      to: `Point ${String.fromCharCode(66 + inp.routeSegments.length)}`,
      distance: 100,
      roadType: "4 lane highway",
      traffic: "Medium",
      payload: 30,
      avgSpeed: 50
    };
    set("routeSegments")([...inp.routeSegments, newSeg]);
  };

  const removeSegment = (id) => {
    if (inp.routeSegments.length <= 1) return;
    set("routeSegments")(inp.routeSegments.filter(s => s.id !== id));
  };

  const updateSegment = (id, key, value) => {
    const updated = inp.routeSegments.map(s => {
      if (s.id === id) {
        return { ...s, [key]: value };
      }
      return s;
    });
    set("routeSegments")(updated);
  };

  // Run Calculations
  const results = useMemo(() => {
    const n = Math.max(1, Math.round(inp.analysisPeriod));
    const disc = inp.discountRate / 100;

    // Escalations
    const escGen = inp.escGeneral / 100;
    const escFuel = inp.escFuel / 100;
    const escElec = inp.escElectricity / 100;
    const escWag = inp.escWages / 100;
    const escInfra = inp.escInfrastructure / 100;

    // Carrying capacities
    const dieselPayloadCap = Math.max(0, inp.dieselGVWR - inp.dieselTractorWeight - inp.dieselTrailerWeight) / 1000; // Tonnes
    const bevPayloadCap = Math.max(0, inp.bevGVWR - inp.bevTractorWeight - inp.bevTrailerWeight) / 1000;
    const compPayloadCap = Math.max(0, inp.compGVWR - inp.compTractorWeight - inp.compTrailerWeight) / 1000;

    // Determine Bottleneck Load per trip (Max configured payload across the segments)
    const tripMaxPayload = inp.routeSegments.reduce((acc, s) => Math.max(acc, s.payload), 0);
    
    // Check constraints and alerts
    const dieselPayloadAlert = tripMaxPayload > dieselPayloadCap;
    const bevPayloadAlert = tripMaxPayload > bevPayloadCap;
    const compPayloadAlert = tripMaxPayload > compPayloadCap;

    const actualDieselCargoPerTrip = Math.min(tripMaxPayload, dieselPayloadCap);
    const actualBEVCargoPerTrip = Math.min(tripMaxPayload, bevPayloadCap);
    const actualCompCargoPerTrip = Math.min(tripMaxPayload, compPayloadCap);

    // Calculate Total round trip distance, driving duration, and segment efficiency
    let totalTripDistance = 0;
    let totalTripDrivingHrs = 0;
    let bevTotalEnergyNeeded = 0;
    let compTotalEnergyNeeded = 0;

    // Normalizing diesel fuel economy factor relative to a nominal medium expressway route state
    let routeWeightedBaseEfficiency = 0;

    inp.routeSegments.forEach(seg => {
      totalTripDistance += seg.distance;
      totalTripDrivingHrs += seg.distance / Math.max(1, seg.avgSpeed);
      
      // Look up custom route-based electric efficiencies
      const segBEVEff = interpolateEfficiency(seg.roadType, seg.traffic, seg.payload);
      bevTotalEnergyNeeded += seg.distance / Math.max(0.1, segBEVEff);

      const segCompEff = interpolateEfficiency(seg.roadType, seg.traffic, seg.payload);
      compTotalEnergyNeeded += seg.distance / Math.max(0.1, segCompEff);

      routeWeightedBaseEfficiency += segBEVEff * (seg.distance);
    });

    const avgBEVEfficiency = bevTotalEnergyNeeded > 0 ? totalTripDistance / bevTotalEnergyNeeded : 1.0;
    const avgCompEfficiency = compTotalEnergyNeeded > 0 ? totalTripDistance / compTotalEnergyNeeded : 1.0;

    // Scale Diesel Economy by calculated efficiency baseline relative ratio
    const baselineMediumEff = 1.21; // Baseline model constant
    const avgRouteEfficiencyRatio = (avgBEVEfficiency / baselineMediumEff);
    const actualDieselEconomy = Math.max(1.0, inp.baseFuelEconomy * avgRouteEfficiencyRatio);

    // Charge cycle placement & Sizing along route
    const traceChargingStops = (capacity, efficiency, safeLimit, efficiencyPerKm) => {
      let currentSoC = 100;
      let chargingStopsCount = 0;
      const minCapacitySoC = safeLimit;

      inp.routeSegments.forEach(seg => {
        const segBEVEff = interpolateEfficiency(seg.roadType, seg.traffic, seg.payload);
        const energyRequired = seg.distance / Math.max(0.1, segBEVEff);
        const energySoCPct = (energyRequired / capacity) * 100;

        if (currentSoC - energySoCPct < minCapacitySoC) {
          chargingStopsCount++;
          // Charge to 85% fast limit
          currentSoC = 85; 
        }
        currentSoC -= energySoCPct;
      });
      return chargingStopsCount;
    };

    const bevStopsPerTrip = traceChargingStops(inp.batteryCapacity, avgBEVEfficiency, inp.bevSafeSoCThreshold);
    const compStopsPerTrip = traceChargingStops(inp.compBatteryCapacity, avgCompEfficiency, inp.compSafeSoCThreshold);

    const bevChargingDowntimeHrs = bevStopsPerTrip * inp.chargingTimePerCycle;
    const compChargingDowntimeHrs = compStopsPerTrip * inp.chargingTimePerCycle;

    // Complete logistics turnaround durations
    const turnaroundDiesel = totalTripDrivingHrs + inp.loadingUnloadingTimePerTrip;
    const turnaroundBEV = totalTripDrivingHrs + bevChargingDowntimeHrs + inp.loadingUnloadingTimePerTrip;
    const turnaroundComp = totalTripDrivingHrs + compChargingDowntimeHrs + inp.loadingUnloadingTimePerTrip;

    // Operating hours limit capacity
    const monthlyAvailableHrs = inp.workingDaysPerMonth * inp.dailyOperatingLimitHrs;
    const tripsPerMonthDiesel = turnaroundDiesel > 0 ? monthlyAvailableHrs / turnaroundDiesel : 0;
    const tripsPerMonthBEV = turnaroundBEV > 0 ? monthlyAvailableHrs / turnaroundBEV : 0;
    const tripsPerMonthComp = turnaroundComp > 0 ? monthlyAvailableHrs / turnaroundComp : 0;

    const monthlyCargoDiesel = tripsPerMonthDiesel * actualDieselCargoPerTrip;
    const monthlyCargoBEV = tripsPerMonthBEV * actualBEVCargoPerTrip;
    const monthlyCargoComp = tripsPerMonthComp * actualCompCargoPerTrip;

    // Required fleet sizing scaled to deliver exact cargo monthly target
    const fleetSizeDiesel = Math.max(1, Math.ceil(inp.monthlyCargoVolume / Math.max(1, monthlyCargoDiesel)));
    const fleetSizeBEV = Math.max(1, Math.ceil(inp.monthlyCargoVolume / Math.max(1, monthlyCargoBEV)));
    const fleetSizeComp = Math.max(1, Math.ceil(inp.monthlyCargoVolume / Math.max(1, monthlyCargoComp)));

    // Total annual operating mileage across fleet configurations
    const tripsPerYearDiesel = tripsPerMonthDiesel * 12 * fleetSizeDiesel;
    const tripsPerYearBEV = tripsPerMonthBEV * 12 * fleetSizeBEV;
    const tripsPerYearComp = tripsPerMonthComp * 12 * fleetSizeComp;

    const annualDistanceDiesel = tripsPerYearDiesel * totalTripDistance / fleetSizeDiesel;
    const annualDistanceBEV = tripsPerYearBEV * totalTripDistance / fleetSizeBEV;
    const annualDistanceComp = tripsPerYearComp * totalTripDistance / fleetSizeComp;

    // Depot infrastructure sizing calculations
    const activeChargingRate = inp.chargingType === "private" ? inp.depotElectricityRate : inp.publicChargingRate;
    const activeChargingRateComp = inp.chargingType === "private" ? inp.depotElectricityRate : inp.publicChargingRate;

    // Station counts & capital outlays
    // Sizing charging dispensaries dynamically to handle required fast-charging cycles
    const totalBEVChargesPerYear = tripsPerYearBEV * bevStopsPerTrip;
    const chargersNeededBEV = Math.max(1, Math.ceil(totalBEVChargesPerYear / (inp.workingDaysPerMonth * 12 * (inp.dailyOperatingLimitHrs / Math.max(0.5, inp.chargingTimePerCycle)))));
    const stationsNeededBEV = Math.max(1, Math.ceil(chargersNeededBEV / 3)); // Average 3 charging dispensers per depot setup

    const totalCompChargesPerYear = tripsPerYearComp * compStopsPerTrip;
    const chargersNeededComp = Math.max(1, Math.ceil(totalCompChargesPerYear / (inp.workingDaysPerMonth * 12 * (inp.dailyOperatingLimitHrs / Math.max(0.5, inp.chargingTimePerCycle)))));
    const stationsNeededComp = Math.max(1, Math.ceil(chargersNeededComp / 3));

    // Amortize Financing Terms (Cash or EMI options)
    function buildLoanProfile(rawPrice, gst, subsidyPct, type, downPct, ratePct, tenure) {
      const basePrice = rawPrice * (1 + gst / 100);
      const afterSubsidy = basePrice * (1 - subsidyPct / 100);
      if (type !== "emi" || tenure <= 0) {
        return { upfront: afterSubsidy, annualPayment: 0, tenure, principal: 0, interestTotal: 0, priceWithGST: basePrice };
      }
      const downPayment = afterSubsidy * (downPct / 100);
      const principal = Math.max(0, afterSubsidy - downPayment);
      const monthlyRate = ratePct / 1200;
      const nMonths = tenure * 12;
      const emi = monthlyRate > 0
        ? (principal * monthlyRate * Math.pow(1 + monthlyRate, nMonths)) / (Math.pow(1 + monthlyRate, nMonths) - 1)
        : principal / nMonths;
      return {
        upfront: downPayment,
        annualPayment: emi * 12,
        tenure,
        principal,
        interestTotal: Math.max(0, emi * 12 * tenure - principal),
        priceWithGST: basePrice
      };
    }

    const loanDiesel = buildLoanProfile(inp.dieselPurchasePrice, inp.gstDiesel, 0, inp.dieselFinancing, inp.dieselDownPaymentPct, inp.dieselLoanInterestRate, inp.dieselLoanTenure);
    const loanBEV = buildLoanProfile(inp.bevPurchasePrice, inp.gstBEV, 0, inp.bevFinancing, inp.bevDownPaymentPct, inp.bevLoanInterestRate, inp.bevLoanTenure);
    const loanComp = buildLoanProfile(inp.compPurchasePrice, inp.gstComp, 0, inp.compFinancing, inp.compDownPaymentPct, inp.compLoanInterestRate, inp.compLoanTenure);

    // Initial Capital Outlay (Infrastructure + down payments for entire sized fleet)
    const capExInfraBEV = (stationsNeededBEV * inp.stationCost + chargersNeededBEV * inp.chargerCost) * (1 - inp.infrastructureTaxCredit / 100);
    const capExInfraComp = (stationsNeededComp * inp.stationCost + chargersNeededComp * inp.chargerCost) * (1 - inp.infrastructureTaxCredit / 100);

    let npvDiesel = loanDiesel.upfront * fleetSizeDiesel;
    let npvBEV = (loanBEV.upfront * fleetSizeBEV) + capExInfraBEV;
    let npvComp = (loanComp.upfront * fleetSizeComp) + capExInfraComp;

    const breakDiesel = { upfront: loanDiesel.upfront * fleetSizeDiesel, fuel: 0, maint: 0, ins: 0, driver: 0, emi: 0, tolls: 0, tyres: 0, infrastructure: 0, residual: 0 };
    const breakBEV = { upfront: (loanBEV.upfront * fleetSizeBEV) + capExInfraBEV, energy: 0, maint: 0, ins: 0, driver: 0, emi: 0, tolls: 0, tyres: 0, battery: 0, infrastructure: 0, residual: 0 };
    const breakComp = { upfront: (loanComp.upfront * fleetSizeComp) + capExInfraComp, energy: 0, maint: 0, ins: 0, driver: 0, emi: 0, tolls: 0, tyres: 0, battery: 0, infrastructure: 0, residual: 0 };

    let dieselCum = [loanDiesel.upfront * fleetSizeDiesel];
    let bevCum = [(loanBEV.upfront * fleetSizeBEV) + capExInfraBEV];
    let compCum = [(loanComp.upfront * fleetSizeComp) + capExInfraComp];

    let balD = loanDiesel.principal * fleetSizeDiesel;
    let balB = loanBEV.principal * fleetSizeBEV;
    let balC = loanComp.principal * fleetSizeComp;

    // Battery degradation tracking parameters
    const usableCapacityBEV = inp.batteryCapacity * 0.85;
    const rangePerChargeBEV = usableCapacityBEV / Math.max(0.01, 1 / avgBEVEfficiency);
    const cyclesPerYearBEV = annualDistanceBEV / rangePerChargeBEV;

    const usableCapacityComp = inp.compBatteryCapacity * 0.85;
    const rangePerChargeComp = usableCapacityComp / Math.max(0.01, 1 / avgCompEfficiency);
    const cyclesPerYearComp = annualDistanceComp / rangePerChargeComp;

    let sohBEV = 100;
    let accumulatedCyclesBEV = 0;
    let replacementsCountBEV = 0;

    let sohComp = 100;
    let accumulatedCyclesComp = 0;
    let replacementsCountComp = 0;

    const rows = [];

    for (let t = 1; t <= n; t++) {
      const df = 1 / Math.pow(1 + disc, t);

      // Annual Escalated Multipliers
      const multGen = Math.pow(1 + escGen, t - 1);
      const multFuel = Math.pow(1 + escFuel, t - 1);
      const multElec = Math.pow(1 + escElec, t - 1);
      const multWages = Math.pow(1 + escWag, t - 1);
      const multInfra = Math.pow(1 + escInfra, t - 1);

      // 1. DIESEL Annual Expenses
      let emiPaidD = 0;
      if (inp.dieselFinancing === "emi" && t <= loanDiesel.tenure) {
        emiPaidD = loanDiesel.annualPayment * fleetSizeDiesel;
        balD = Math.max(0, balD - (loanDiesel.principal * fleetSizeDiesel / loanDiesel.tenure));
      }
      const dFuel = (annualDistanceDiesel / actualDieselEconomy) * inp.dieselPrice * multFuel * fleetSizeDiesel;
      const dMaint = annualDistanceDiesel * inp.dieselMaintCostPerKm * multGen * fleetSizeDiesel;
      const dIns = loanDiesel.priceWithGST * (inp.dieselInsuranceRate / 100) * multGen * fleetSizeDiesel;
      const dDriver = inp.driverMonthlySalary * 12 * multWages * fleetSizeDiesel;
      const dTolls = inp.tollCostPerTrip * (tripsPerYearDiesel / fleetSizeDiesel) * multGen * fleetSizeDiesel;
      const dTyres = (annualDistanceDiesel / inp.tyreLifeKm) * inp.tyreCostPerSet * multGen * fleetSizeDiesel;

      const yearCostD = emiPaidD + dFuel + dMaint + dIns + dDriver + dTolls + dTyres;
      npvDiesel += yearCostD * df;
      dieselCum.push(dieselCum[dieselCum.length - 1] + yearCostD);

      // Save breakdowns
      breakDiesel.fuel += dFuel * df;
      breakDiesel.maint += dMaint * df;
      breakDiesel.ins += dIns * df;
      breakDiesel.driver += dDriver * df;
      breakDiesel.tolls += dTolls * df;
      breakDiesel.tyres += dTyres * df;
      breakDiesel.emi += emiPaidD * df;

      // 2. BEV Annual Expenses
      let emiPaidB = 0;
      if (inp.bevFinancing === "emi" && t <= loanBEV.tenure) {
        emiPaidB = loanBEV.annualPayment * fleetSizeBEV;
        balB = Math.max(0, balB - (loanBEV.principal * fleetSizeBEV / loanBEV.tenure));
      }
      const bEnergy = annualDistanceBEV * (1 / avgBEVEfficiency) * activeChargingRate * multElec * fleetSizeBEV;
      const bMaint = annualDistanceBEV * inp.bevMaintCostPerKm * multGen * fleetSizeBEV;
      const bIns = loanBEV.priceWithGST * (inp.dieselInsuranceRate / 100) * (1 + inp.bevInsurancePremiumDiff / 100) * multGen * fleetSizeBEV;
      const bDriver = inp.driverMonthlySalary * 12 * multWages * fleetSizeBEV;
      const bTolls = inp.tollCostPerTrip * (tripsPerYearBEV / fleetSizeBEV) * multGen * fleetSizeBEV;
      const bTyres = (annualDistanceBEV / inp.tyreLifeKm) * inp.tyreCostPerSet * multGen * fleetSizeBEV;

      // Battery degradation
      accumulatedCyclesBEV += cyclesPerYearBEV;
      const currentSohNowBEV = 100 - (accumulatedCyclesBEV * inp.batteryDegradationPerCycle);
      let batCostThisYearBEV = 0;
      if (currentSohNowBEV <= inp.batterySOHThreshold) {
        batCostThisYearBEV = inp.batteryReplacementCost * fleetSizeBEV * multGen;
        accumulatedCyclesBEV = 0;
        replacementsCountBEV += fleetSizeBEV;
      }
      sohBEV = Math.max(10, currentSohNowBEV);

      // Charger Station Upkeep
      const bInfraMaint = (stationsNeededBEV * inp.stationMaintenance + chargersNeededBEV * inp.chargerMaintenance + inp.depotDemandChargesMonthly * 12 + inp.depotLandLeaseMonthly * 12) * multInfra;

      const yearCostB = emiPaidB + bEnergy + bMaint + bIns + bDriver + bTolls + bTyres + batCostThisYearBEV + bInfraMaint;
      npvBEV += yearCostB * df;
      bevCum.push(bevCum[bevCum.length - 1] + yearCostB);

      breakBEV.energy += bEnergy * df;
      breakBEV.maint += bMaint * df;
      breakBEV.ins += bIns * df;
      breakBEV.driver += bDriver * df;
      breakBEV.tolls += bTolls * df;
      breakBEV.tyres += bTyres * df;
      breakBEV.battery += batCostThisYearBEV * df;
      breakBEV.infrastructure += bInfraMaint * df;
      breakBEV.emi += emiPaidB * df;

      // 3. COMPETITOR Annual Expenses
      let emiPaidC = 0;
      if (inp.compFinancing === "emi" && t <= loanComp.tenure) {
        emiPaidC = loanComp.annualPayment * fleetSizeComp;
        balC = Math.max(0, balC - (loanComp.principal * fleetSizeComp / loanComp.tenure));
      }
      const cEnergy = annualDistanceComp * (1 / avgCompEfficiency) * activeChargingRateComp * multElec * fleetSizeComp;
      const cMaint = annualDistanceComp * inp.compMaintCostPerKm * multGen * fleetSizeComp;
      const cIns = loanComp.priceWithGST * (inp.dieselInsuranceRate / 100) * (1 + inp.compInsurancePremiumDiff / 100) * multGen * fleetSizeComp;
      const cDriver = inp.driverMonthlySalary * 12 * multWages * fleetSizeComp;
      const cTolls = inp.tollCostPerTrip * (tripsPerYearComp / fleetSizeComp) * multGen * fleetSizeComp;
      const cTyres = (annualDistanceComp / inp.tyreLifeKm) * inp.tyreCostPerSet * multGen * fleetSizeComp;

      // Degradation comp
      accumulatedCyclesComp += cyclesPerYearComp;
      const currentSohNowComp = 100 - (accumulatedCyclesComp * inp.compBatteryDegradationPerCycle);
      let batCostThisYearComp = 0;
      if (currentSohNowComp <= inp.compBatterySOHThreshold) {
        batCostThisYearComp = inp.compBatteryReplacementCost * fleetSizeComp * multGen;
        accumulatedCyclesComp = 0;
        replacementsCountComp += fleetSizeComp;
      }
      sohComp = Math.max(10, currentSohNowComp);

      const cInfraMaint = (stationsNeededComp * inp.stationMaintenance + chargersNeededComp * inp.chargerMaintenance + inp.depotDemandChargesMonthly * 12 + inp.depotLandLeaseMonthly * 12) * multInfra;

      const yearCostC = emiPaidC + cEnergy + cMaint + cIns + cDriver + cTolls + cTyres + batCostThisYearComp + cInfraMaint;
      npvComp += yearCostC * df;
      compCum.push(compCum[compCum.length - 1] + yearCostC);

      breakComp.energy += cEnergy * df;
      breakComp.maint += cMaint * df;
      breakComp.ins += cIns * df;
      breakComp.driver += cDriver * df;
      breakComp.tolls += cTolls * df;
      breakComp.tyres += cTyres * df;
      breakComp.battery += batCostThisYearComp * df;
      breakComp.infrastructure += cInfraMaint * df;
      breakComp.emi += emiPaidC * df;

      rows.push({ year: t, diesel: dieselCum[t], bev: bevCum[t], comp: compCum[t] });
    }

    // Residual values discounted back at Year n
    const dfN = 1 / Math.pow(1 + disc, n);
    const resValueD = inp.dieselPurchasePrice * (inp.dieselResidualValue / 100) * fleetSizeDiesel;
    const resValueB = inp.bevPurchasePrice * (inp.bevResidualValue / 100) * fleetSizeBEV;
    const resValueComp = inp.compPurchasePrice * (inp.compResidualValue / 100) * fleetSizeComp;

    npvDiesel -= resValueD * dfN;
    npvBEV -= resValueB * dfN;
    npvComp -= resValueComp * dfN;

    dieselCum[n] -= resValueD;
    bevCum[n] -= resValueB;
    compCum[n] -= resValueComp;

    if (rows.length) {
      rows[rows.length - 1].diesel = dieselCum[n];
      rows[rows.length - 1].bev = bevCum[n];
      rows[rows.length - 1].comp = compCum[n];
    }

    const chartData = [{ year: 0, diesel: dieselCum[0], bev: bevCum[0], comp: compCum[0] }, ...rows];

    // Cargo economics metrics
    const totalCargoMovedOverWindowDiesel = inp.monthlyCargoVolume * 12 * n;
    const totalCargoMovedOverWindowBEV = inp.monthlyCargoVolume * 12 * n;
    const totalCargoMovedOverWindowComp = inp.monthlyCargoVolume * 12 * n;

    const totalCargoTonneKmDiesel = totalCargoMovedOverWindowDiesel * totalTripDistance;
    const totalCargoTonneKmBEV = totalCargoMovedOverWindowBEV * totalTripDistance;
    const totalCargoTonneKmComp = totalCargoMovedOverWindowComp * totalTripDistance;

    const breakEvenYear = (() => {
      for (let t = 1; t <= n; t++) {
        const dDiff = dieselCum[t] - bevCum[t];
        if (dieselCum[0] > bevCum[0]) {
          return 0; // Already cheaper upfront
        }
        if (dieselCum[t] >= bevCum[t]) {
          return t;
        }
      }
      return null;
    })();

    return {
      n,
      npvDiesel,
      npvBEV,
      npvComp,
      chartData,
      breakEvenYear,
      fleetSizeDiesel,
      fleetSizeBEV,
      fleetSizeComp,
      chargersNeededBEV,
      stationsNeededBEV,
      chargersNeededComp,
      stationsNeededComp,
      avgBEVEfficiency,
      avgCompEfficiency,
      actualDieselEconomy,
      totalTripDistance,
      actualDieselCargoPerTrip,
      actualBEVCargoPerTrip,
      actualCompCargoPerTrip,
      bevStopsPerTrip,
      compStopsPerTrip,
      bevChargingDowntimeHrs,
      compChargingDowntimeHrs,
      dieselPayloadAlert,
      bevPayloadAlert,
      compPayloadAlert,
      costPerTonneKmDiesel: npvDiesel / totalCargoTonneKmDiesel,
      costPerTonneKmBEV: npvBEV / totalCargoTonneKmBEV,
      costPerTonneKmComp: npvComp / totalCargoTonneKmComp,
      sohBEV,
      sohComp,
      replacementsCountBEV,
      replacementsCountComp,
      breakdowns: {
        diesel: breakDiesel,
        bev: breakBEV,
        comp: breakComp
      }
    };
  }, [inp]);

  return (
    <div className={`wrap ${darkMode ? "dark-theme" : "light-theme"}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght=600;700&family=Inter:wght=400;500;600;700&family=JetBrains+Mono:wght=500;700&display=swap');

        /* Color palettes dynamically swapped via root classes */
        .wrap.dark-theme {
          --bg: #111416;
          --panel: #1a1f21;
          --panel-alt: #22292c;
          --border: #2e3639;
          --text: #f3f0e8;
          --text-dim: #909d9f;
          --diesel: #e29532;
          --bev: #21bfa9;
          --comp: #b16af0;
          --good: #4eb569;
          --bad: #d94e3c;
          --input-bg: #0d1012;
        }

        .wrap.light-theme {
          --bg: #f5f7f8;
          --panel: #ffffff;
          --panel-alt: #f0f3f5;
          --border: #d4dadc;
          --text: #192124;
          --text-dim: #607276;
          --diesel: #c57613;
          --bev: #149784;
          --comp: #8432cc;
          --good: #2a7e41;
          --bad: #be2e1d;
          --input-bg: #fbfcff;
        }

        .wrap {
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          padding: 24px;
          border-radius: 12px;
          min-height: 100vh;
          max-width: 1300px;
          margin: 0 auto;
          box-sizing: border-box;
          transition: background 0.3s, color 0.3s;
        }

        .wrap * { box-sizing: border-box; }

        h1, h2, h3, .display {
          font-family: 'Barlow Condensed', sans-serif;
          letter-spacing: 0.03em;
        }

        .num { font-family: 'JetBrains Mono', monospace; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 16px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .theme-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--panel-alt);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
        }

        .theme-btn:hover, .reset-btn:hover {
          border-color: var(--bev);
        }

        .reset-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--panel-alt);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
        }

        /* 1. Direct vertical layout stack as requested */
        .vertical-stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        @media(max-width: 900px) {
          .grid-3 { grid-template-columns: 1fr; }
        }

        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          position: relative;
        }

        .panel h2 {
          font-size: 20px;
          margin: 0 0 16px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }

        /* Input Table Styles */
        .table-container {
          overflow-x: auto;
          margin-bottom: 12px;
        }

        .route-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }

        .route-table th {
          background: var(--panel-alt);
          padding: 10px;
          color: var(--text-dim);
          border-bottom: 1px solid var(--border);
          text-transform: uppercase;
          font-size: 11px;
        }

        .route-table td {
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
        }

        .route-table input, .route-table select {
          background: var(--input-bg);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 6px;
          border-radius: 6px;
          width: 100%;
          font-size: 12.5px;
        }

        .add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bev);
          color: #0d1012;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 8px;
        }

        .add-btn:hover {
          opacity: 0.9;
        }

        .remove-btn {
          background: transparent;
          border: none;
          color: var(--bad);
          cursor: pointer;
          padding: 4px;
        }

        .field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .field-label {
          font-size: 12.5px;
          color: var(--text-dim);
          flex: 1;
        }

        .field-input {
          display: flex;
          align-items: center;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
        }

        .field-input input {
          width: 90px;
          background: transparent;
          border: none;
          color: var(--text);
          padding: 6px 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          text-align: right;
        }

        .field-input input:focus { outline: none; }

        .field-suffix {
          font-size: 11px;
          color: var(--text-dim);
          padding-right: 8px;
        }

        .seg {
          display: flex;
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
        }

        .seg button {
          flex: 1;
          background: var(--panel-alt);
          color: var(--text-dim);
          border: none;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }

        .seg button.active {
          background: var(--bev);
          color: #0d1012;
          font-weight: 600;
        }

        /* Dash KPI styling */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-top: 16px;
        }

        @media(max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media(max-width: 600px) {
          .kpi-grid { grid-template-columns: 1fr; }
        }

        .kpi-card {
          background: var(--panel-alt);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px;
          text-align: left;
        }

        .kpi-label {
          font-size: 11.5px;
          color: var(--text-dim);
          text-transform: uppercase;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .kpi-val {
          font-size: 23px;
          font-weight: 700;
        }

        .kpi-val.diesel { color: var(--diesel); }
        .kpi-val.bev { color: var(--bev); }
        .kpi-val.comp { color: var(--comp); }
        .kpi-val.good { color: var(--good); }

        .kpi-sub {
          font-size: 12px;
          color: var(--text-dim);
          margin-top: 4px;
        }

        .warning-strip {
          background: rgba(217, 78, 60, 0.1);
          border: 1px solid var(--bad);
          color: var(--bad);
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-row {
          display: flex;
          gap: 16px;
          font-size: 12.5px;
          margin-bottom: 12px;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
        }

        .tab-section-head {
          font-size: 16px;
          font-weight: 700;
          color: var(--bev);
          margin-top: 18px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
      `}</style>

      {/* Top Header */}
      <div className="header">
        <div>
          <h1>
            <Truck size={28} style={{ display: "inline", verticalAlign: "-5px", marginRight: 10, color: "var(--bev)" }} />
            Enterprise Logistics TCO Calculator
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-dim)", fontSize: "14px" }}>
            Comprehensive route-aware multi-vehicle Total Cost of Ownership simulator with dynamic infrastructure sizing
          </p>
        </div>
        <div className="header-actions">
          <button className="theme-btn" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="reset-btn" onClick={() => setInp(DEFAULTS)}>
            <RotateCcw size={15} /> Reset Simulator
          </button>
        </div>
      </div>

      <div className="vertical-stack">
        
        {/* SECTION 1: Logistics Throughput & Route Matrix Planner */}
        <div className="panel">
          <h2><MapPin size={18} color="var(--bev)" /> 1. Logistics Demand & Route Duty Cycle Planner</h2>
          
          <div className="grid-3" style={{ marginBottom: "20px" }}>
            <div>
              <Field label="Monthly Target Volume" value={inp.monthlyCargoVolume} onChange={set("monthlyCargoVolume")} suffix="Tonnes" step={100} />
              <Field label="Working Days / Month" value={inp.workingDaysPerMonth} onChange={set("workingDaysPerMonth")} suffix="Days" step={1} />
            </div>
            <div>
              <Field label="Daily Operating Limit" value={inp.dailyOperatingLimitHrs} onChange={set("dailyOperatingLimitHrs")} suffix="Hours" step={1} />
              <Field label="Loading / Unloading Time" value={inp.loadingUnloadingTimePerTrip} onChange={set("loadingUnloadingTimePerTrip")} suffix="Hours" step={0.5} />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.5", background: "var(--panel-alt)", padding: "10px", borderRadius: "8px" }}>
                <strong>How it Works:</strong> Input your target monthly volume and map out your route stops below. The simulator calculates the turnaround cycle, evaluates battery degradation, inserts required charging stops, and sizes your fleet dynamically.
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="route-table">
              <thead>
                <tr>
                  <th>From Stop</th>
                  <th>To Stop</th>
                  <th>Distance (km)</th>
                  <th>Road Type Profile</th>
                  <th>Traffic Intensity</th>
                  <th>Payload Carried (T)</th>
                  <th>Avg Speed (km/h)</th>
                  <th style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {inp.routeSegments.map((seg) => (
                  <tr key={seg.id}>
                    <td>
                      <input type="text" value={seg.from} onChange={(e) => updateSegment(seg.id, "from", e.target.value)} />
                    </td>
                    <td>
                      <input type="text" value={seg.to} onChange={(e) => updateSegment(seg.id, "to", e.target.value)} />
                    </td>
                    <td>
                      <input type="number" value={seg.distance} onChange={(e) => updateSegment(seg.id, "distance", parseFloat(e.target.value) || 0)} />
                    </td>
                    <td>
                      <select value={seg.roadType} onChange={(e) => updateSegment(seg.id, "roadType", e.target.value)}>
                        <option value="6 lane highway/Expressway">6-Lane Expressway</option>
                        <option value="4 lane highway">4-Lane Highway</option>
                        <option value="2 lane state highway">2-Lane Highway</option>
                        <option value="City road">Urban / City Road</option>
                        <option value="Broken road">Unpaved / Broken Road</option>
                      </select>
                    </td>
                    <td>
                      <select value={seg.traffic} onChange={(e) => updateSegment(seg.id, "traffic", e.target.value)}>
                        <option value="Low">Low Traffic</option>
                        <option value="Medium">Medium Traffic</option>
                        <option value="High">High Traffic</option>
                      </select>
                    </td>
                    <td>
                      <input type="number" value={seg.payload} onChange={(e) => updateSegment(seg.id, "payload", parseFloat(e.target.value) || 0)} />
                    </td>
                    <td>
                      <input type="number" value={seg.avgSpeed} onChange={(e) => updateSegment(seg.id, "avgSpeed", parseFloat(e.target.value) || 0)} />
                    </td>
                    <td>
                      <button className="remove-btn" onClick={() => removeSegment(seg.id)}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="add-btn" onClick={addSegment}>
            <Plus size={15} /> Add Stop Segment
          </button>
        </div>

        {/* SECTION 2: General Analysis & Escalations */}
        <div className="panel">
          <h2><Settings size={18} color="var(--bev)" /> 2. Global Financing & Multi-Escalation Settings</h2>
          <div className="grid-3">
            <div>
              <div className="tab-section-head">General Parameters</div>
              <Field label="Analysis Window" value={inp.analysisPeriod} onChange={set("analysisPeriod")} suffix="Years" step={1} />
              <Field label="Discount Rate (Cost of Cap)" value={inp.discountRate} onChange={set("discountRate")} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="tab-section-head">Annual Cost Escalations</div>
              <Field label="General Cost Escalation" value={inp.escGeneral} onChange={set("escGeneral")} suffix="%" step={0.5} />
              <Field label="Fuel / Diesel Escalation" value={inp.escFuel} onChange={set("escFuel")} suffix="%" step={0.5} />
              <Field label="Electricity Rate Escalation" value={inp.escElectricity} onChange={set("escElectricity")} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="tab-section-head">Granular Asset Escalations</div>
              <Field label="Driver Salary Escalation" value={inp.escWages} onChange={set("escWages")} suffix="%" step={0.5} />
              <Field label="Infrastructure Upkeep Escalation" value={inp.escInfrastructure} onChange={set("escInfrastructure")} suffix="%" step={0.5} />
            </div>
          </div>
        </div>

        {/* SECTION 3: Detailed Operating Costs Breakdown */}
        <div className="panel">
          <h2><DollarSign size={18} color="var(--bev)" /> 3. Operating Expenses & Maintenance Variables</h2>
          <div className="grid-3">
            <div>
              <div className="tab-section-head">Staff & Road Expenses</div>
              <Field label="Driver Monthly Wage" value={inp.driverMonthlySalary} onChange={set("driverMonthlySalary")} suffix="₹" step={1000} />
              <Field label="Tolls per Round-Trip" value={inp.tollCostPerTrip} onChange={set("tollCostPerTrip")} suffix="₹" step={250} />
            </div>
            <div>
              <div className="tab-section-head">Tyre Lifecycle Expenses</div>
              <Field label="Tyre Cost (Set of 12)" value={inp.tyreCostPerSet} onChange={set("tyreCostPerSet")} suffix="₹" step={5000} />
              <Field label="Expected Tyre Life" value={inp.tyreLifeKm} onChange={set("tyreLifeKm")} suffix="km" step={5000} />
            </div>
            <div>
              <div className="tab-section-head">Fixed Depot Overheads</div>
              <Field label="Monthly Land Lease" value={inp.depotLandLeaseMonthly} onChange={set("depotLandLeaseMonthly")} suffix="₹" step={5000} />
              <Field label="Monthly Utility Demand Fee" value={inp.depotDemandChargesMonthly} onChange={set("depotDemandChargesMonthly")} suffix="₹" step={5000} />
            </div>
          </div>
        </div>

        {/* SECTION 4: Three-Vehicle Profile Configuration Section */}
        <div className="grid-3">
          
          {/* VECHICLE A: Diesel Truck */}
          <div className="panel">
            <h2><Fuel size={18} color="var(--diesel)" /> A. Diesel Tractor Config</h2>
            <Field label="Tractor Base Cost (ex GST)" value={inp.dieselPurchasePrice} onChange={set("dieselPurchasePrice")} suffix="₹" step={50000} />
            <Field label="GST Rate" value={inp.gstDiesel} onChange={set("gstDiesel")} suffix="%" step={1} />
            <Field label="Tractor Curb Weight" value={inp.dieselTractorWeight} onChange={set("dieselTractorWeight")} suffix="kg" step={100} />
            <Field label="Trailer Curb Weight" value={inp.dieselTrailerWeight} onChange={set("dieselTrailerWeight")} suffix="kg" step={100} />
            <Field label="Gross Vehicle Weight (GVWR)" value={inp.dieselGVWR} onChange={set("dieselGVWR")} suffix="kg" step={500} />
            
            <div className="tab-section-head" style={{ marginTop: "14px" }}>Operating Overheads</div>
            <Field label="Base Fuel Economy" value={inp.baseFuelEconomy} onChange={set("baseFuelEconomy")} suffix="km/l" step={0.1} />
            <Field label="Diesel Base Price" value={inp.dieselPrice} onChange={set("dieselPrice")} suffix="₹/l" step={0.5} />
            <Field label="Maintenance Cost" value={inp.dieselMaintCostPerKm} onChange={set("dieselMaintCostPerKm")} suffix="₹/km" step={0.1} />
            <Field label="Insurance Premium" value={inp.dieselInsuranceRate} onChange={set("dieselInsuranceRate")} suffix="%" step={0.25} />
            <Field label="Residual Asset Value" value={inp.dieselResidualValue} onChange={set("dieselResidualValue")} suffix="%" step={1} />

            <div className="tab-section-head">Financing Structures</div>
            <div className="field">
              <span className="field-label">Financing Type</span>
              <div className="seg">
                <button className={inp.dieselFinancing === "cash" ? "active" : ""} onClick={() => set("dieselFinancing")("cash")}>Cash</button>
                <button className={inp.dieselFinancing === "emi" ? "active" : ""} onClick={() => set("dieselFinancing")("emi")}>Loan</button>
              </div>
            </div>
            {inp.dieselFinancing === "emi" && (
              <>
                <Field label="Down Payment" value={inp.dieselDownPaymentPct} onChange={set("dieselDownPaymentPct")} suffix="%" step={5} />
                <Field label="Loan Interest Rate" value={inp.dieselLoanInterestRate} onChange={set("dieselLoanInterestRate")} suffix="%" step={0.25} />
                <Field label="Loan Tenure" value={inp.dieselLoanTenure} onChange={set("dieselLoanTenure")} suffix="Yrs" step={1} />
              </>
            )}
          </div>

          {/* VEHICLE B: Primary Electric Truck */}
          <div className="panel">
            <h2><BatteryCharging size={18} color="var(--bev)" /> B. Electric Tractor Config</h2>
            <Field label="Tractor Base Cost (ex GST)" value={inp.bevPurchasePrice} onChange={set("bevPurchasePrice")} suffix="₹" step={50000} />
            <Field label="GST Rate" value={inp.gstBEV} onChange={set("gstBEV")} suffix="%" step={1} />
            <Field label="Tractor Curb Weight" value={inp.bevTractorWeight} onChange={set("bevTractorWeight")} suffix="kg" step={100} />
            <Field label="Trailer Curb Weight" value={inp.bevTrailerWeight} onChange={set("bevTrailerWeight")} suffix="kg" step={100} />
            <Field label="Gross Vehicle Weight (GVWR)" value={inp.bevGVWR} onChange={set("bevGVWR")} suffix="kg" step={500} />
            
            <div className="tab-section-head" style={{ marginTop: "14px" }}>Battery Pack Overheads</div>
            <Field label="Battery Capacity" value={inp.batteryCapacity} onChange={set("batteryCapacity")} suffix="kWh" step={25} />
            <Field label="Degradation / Cycle" value={inp.batteryDegradationPerCycle} onChange={set("batteryDegradationPerCycle")} suffix="%" step={0.001} />
            <Field label="SOH Limit Threshold" value={inp.batterySOHThreshold} onChange={set("batterySOHThreshold")} suffix="%" step={1} />
            <Field label="Battery Replacement Cost" value={inp.batteryReplacementCost} onChange={set("batteryReplacementCost")} suffix="₹" step={100000} />
            <Field label="Insurance Prem. Markup" value={inp.bevInsurancePremiumDiff} onChange={set("bevInsurancePremiumDiff")} suffix="%" step={1} />
            <Field label="Maintenance Cost" value={inp.bevMaintCostPerKm} onChange={set("bevMaintCostPerKm")} suffix="₹/km" step={0.1} />
            <Field label="Residual Asset Value" value={inp.bevResidualValue} onChange={set("bevResidualValue")} suffix="%" step={1} />
            <Field label="Safe Limit SoC Margin" value={inp.bevSafeSoCThreshold} onChange={set("bevSafeSoCThreshold")} suffix="%" step={1} />

            <div className="tab-section-head">Financing Structures</div>
            <div className="field">
              <span className="field-label">Financing Type</span>
              <div className="seg">
                <button className={inp.bevFinancing === "cash" ? "active" : ""} onClick={() => set("bevFinancing")("cash")}>Cash</button>
                <button className={inp.bevFinancing === "emi" ? "active" : ""} onClick={() => set("bevFinancing")("emi")}>Loan</button>
              </div>
            </div>
            {inp.bevFinancing === "emi" && (
              <>
                <Field label="Down Payment" value={inp.bevDownPaymentPct} onChange={set("bevDownPaymentPct")} suffix="%" step={5} />
                <Field label="Loan Interest Rate" value={inp.bevLoanInterestRate} onChange={set("bevLoanInterestRate")} suffix="%" step={0.25} />
                <Field label="Loan Tenure" value={inp.bevLoanTenure} onChange={set("bevLoanTenure")} suffix="Yrs" step={1} />
              </>
            )}
          </div>

          {/* VEHICLE C: Alternative Competition Config */}
          <div className="panel">
            <h2><Layers size={18} color="var(--comp)" /> C. Alternative / Competitor</h2>
            <div className="field" style={{ marginBottom: "14px" }}>
              <span className="field-label">Model Profile Name</span>
              <input 
                type="text" 
                value={inp.compName} 
                onChange={(e) => set("compName")(e.target.value)} 
                style={{ background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: "6px", width: "130px", fontSize: "12.5px" }} 
              />
            </div>
            <Field label="Tractor Base Cost (ex GST)" value={inp.compPurchasePrice} onChange={set("compPurchasePrice")} suffix="₹" step={50000} />
            <Field label="GST Rate" value={inp.gstComp} onChange={set("gstComp")} suffix="%" step={1} />
            <Field label="Tractor Curb Weight" value={inp.compTractorWeight} onChange={set("compTractorWeight")} suffix="kg" step={100} />
            <Field label="Trailer Curb Weight" value={inp.compTrailerWeight} onChange={set("compTrailerWeight")} suffix="kg" step={100} />
            <Field label="Gross Vehicle Weight (GVWR)" value={inp.compGVWR} onChange={set("compGVWR")} suffix="kg" step={500} />
            
            <div className="tab-section-head" style={{ marginTop: "14px" }}>Degradation & Battery Config</div>
            <Field label="Energy Pack Capacity" value={inp.compBatteryCapacity} onChange={set("compBatteryCapacity")} suffix="kWh" step={25} />
            <Field label="Degradation / Cycle" value={inp.compBatteryDegradationPerCycle} onChange={set("compBatteryDegradationPerCycle")} suffix="%" step={0.001} />
            <Field label="SOH Limit Threshold" value={inp.compBatterySOHThreshold} onChange={set("compBatterySOHThreshold")} suffix="%" step={1} />
            <Field label="Replacement Cost" value={inp.compBatteryReplacementCost} onChange={set("compBatteryReplacementCost")} suffix="₹" step={100000} />
            <Field label="Insurance Prem. Markup" value={inp.compInsurancePremiumDiff} onChange={set("compInsurancePremiumDiff")} suffix="%" step={1} />
            <Field label="Maintenance Cost" value={inp.compMaintCostPerKm} onChange={set("compMaintCostPerKm")} suffix="₹/km" step={0.1} />
            <Field label="Residual Asset Value" value={inp.compResidualValue} onChange={set("compResidualValue")} suffix="%" step={1} />
            <Field label="Safe Limit SoC Margin" value={inp.compSafeSoCThreshold} onChange={set("compSafeSoCThreshold")} suffix="%" step={1} />

            <div className="tab-section-head">Financing Structures</div>
            <div className="field">
              <span className="field-label">Financing Type</span>
              <div className="seg">
                <button className={inp.compFinancing === "cash" ? "active" : ""} onClick={() => set("compFinancing")("cash")}>Cash</button>
                <button className={inp.compFinancing === "emi" ? "active" : ""} onClick={() => set("compFinancing")("emi")}>Loan</button>
              </div>
            </div>
            {inp.compFinancing === "emi" && (
              <>
                <Field label="Down Payment" value={inp.compDownPaymentPct} onChange={set("compDownPaymentPct")} suffix="%" step={5} />
                <Field label="Loan Interest Rate" value={inp.compLoanInterestRate} onChange={set("compLoanInterestRate")} suffix="%" step={0.25} />
                <Field label="Loan Tenure" value={inp.compLoanTenure} onChange={set("compLoanTenure")} suffix="Yrs" step={1} />
              </>
            )}
          </div>
        </div>

        {/* SECTION 5: Infrastructure & Dispenser Configuration */}
        <div className="panel">
          <h2><PlugZap size={18} color="var(--bev)" /> 5. Capital Setup Costs & Charging Infrastructure</h2>
          <div className="grid-3">
            <div>
              <div className="tab-section-head">Infrastructure Setup Overhead</div>
              <Field label="Station Setup Cost (per depot)" value={inp.stationCost} onChange={set("stationCost")} suffix="₹" step={100000} />
              <Field label="Station Annual Upkeep" value={inp.stationMaintenance} onChange={set("stationMaintenance")} suffix="₹/yr" step={10000} />
              <Field label="Charger Dispenser Unit Cost" value={inp.chargerCost} onChange={set("chargerCost")} suffix="₹" step={50000} />
              <Field label="Charger Annual Upkeep" value={inp.chargerMaintenance} onChange={set("chargerMaintenance")} suffix="₹/yr" step={5000} />
            </div>
            <div>
              <div className="tab-section-head">Operating Charges</div>
              <div className="field">
                <span className="field-label">Charging Point Class</span>
                <div className="seg">
                  <button className={inp.chargingType === "private" ? "active" : ""} onClick={() => set("chargingType")("private")}>Depot</button>
                  <button className={inp.chargingType === "public" ? "active" : ""} onClick={() => set("chargingType")("public")}>Public</button>
                </div>
              </div>
              <Field label="Depot Electricity Rate" value={inp.depotElectricityRate} onChange={set("depotElectricityRate")} suffix="₹/kWh" step={0.5} />
              <Field label="Public Grid Rate" value={inp.publicChargingRate} onChange={set("publicChargingRate")} suffix="₹/kWh" step={0.5} />
              <Field label="Setup Tax Credit (Subsidy)" value={inp.infrastructureTaxCredit} onChange={set("infrastructureTaxCredit")} suffix="%" step={1} />
            </div>
            <div>
              <div className="tab-section-head">Cycle Variables</div>
              <Field label="Charging Turnaround Time" value={inp.chargingTimePerCycle} onChange={set("chargingTimePerCycle")} suffix="Hrs" step={0.1} />
              <div style={{ fontSize: "11.5px", color: "var(--text-dim)", lineHeight: "1.4", marginTop: "12px", background: "var(--panel-alt)", padding: "10px", borderRadius: "8px" }}>
                <strong>Charging Layout Strategy:</strong> When configured to private Depot mode, utility demand and land lease overhead configurations configured in operational costs will apply directly to the sized infrastructure network.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 6: Payload Validity Validation Strip */}
        {(results.dieselPayloadAlert || results.bevPayloadAlert || results.compPayloadAlert) && (
          <div className="warning-strip">
            <Info size={16} />
            <span>
              <strong>Payload Target Check:</strong> One or more segments on your planned route exceed the carrying capacity of the vehicle profiles!
              {results.dieselPayloadAlert && ` [Diesel Cap: ${results.actualDieselCargoPerTrip.toFixed(1)}T]`}
              {results.bevPayloadAlert && ` [Electric Cap: ${results.actualBEVCargoPerTrip.toFixed(1)}T]`}
              {results.compPayloadAlert && ` [${inp.compName} Cap: ${results.actualCompCargoPerTrip.toFixed(1)}T]`}
              . The simulator has adjusted and capped payloads to these maximum levels to evaluate trip frequency.
            </span>
          </div>
        )}

        {/* RESULTS SECTION: Executive TCO Dashboard */}
        <div className="panel" style={{ border: "2px solid var(--bev)" }}>
          <h2 style={{ color: "var(--bev)" }}><TrendingUp size={20} /> Executive NPV Total Cost of Ownership (TCO) Dashboard</h2>

          {/* KPI Matrix Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label"><Fuel size={13} color="var(--diesel)" /> Diesel Fleet ({results.fleetSizeDiesel} Trucks)</div>
              <div className="kpi-val diesel num">{inrCompact(results.npvDiesel)}</div>
              <div className="kpi-sub num">{inr(results.costPerTonneKmDiesel)} / tonne-km</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><BatteryCharging size={13} color="var(--bev)" /> Electric Fleet ({results.fleetSizeBEV} Trucks)</div>
              <div className="kpi-val bev num">{inrCompact(results.npvBEV)}</div>
              <div className="kpi-sub num">{inr(results.costPerTonneKmBEV)} / tonne-km</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><Layers size={13} color="var(--comp)" /> {inp.compName} ({results.fleetSizeComp} Trucks)</div>
              <div className="kpi-val comp num">{inrCompact(results.npvComp)}</div>
              <div className="kpi-sub num">{inr(results.costPerTonneKmComp)} / tonne-km</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><Flag size={13} /> Sized Infrastructure</div>
              <div className="kpi-val good num" style={{ fontSize: "18px" }}>
                {results.stationsNeededBEV} Depot / {results.chargersNeededBEV} Charger
              </div>
              <div className="kpi-sub">Sized for {results.fleetSizeBEV} EVs</div>
            </div>
          </div>

          <div className="grid-3" style={{ marginTop: "20px" }}>
            <div className="kpi-card" style={{ background: "var(--panel)" }}>
              <div className="kpi-label">Electric Efficiency Breakdown</div>
              <div style={{ fontSize: "14px", marginTop: "8px" }}>
                Route Efficiency: <strong className="num">{results.avgBEVEfficiency.toFixed(2)} km/kWh</strong><br />
                Turnaround Stops: <strong className="num">{results.bevStopsPerTrip} charges/trip</strong><br />
                Downtime: <strong className="num">{results.bevChargingDowntimeHrs.toFixed(1)} Hrs</strong>
              </div>
            </div>
            <div className="kpi-card" style={{ background: "var(--panel)" }}>
              <div className="kpi-label">Competitor Efficiency Breakdown</div>
              <div style={{ fontSize: "14px", marginTop: "8px" }}>
                Route Efficiency: <strong className="num">{results.avgCompEfficiency.toFixed(2)} km/kWh</strong><br />
                Turnaround Stops: <strong className="num">{results.compStopsPerTrip} charges/trip</strong><br />
                Downtime: <strong className="num">{results.compChargingDowntimeHrs.toFixed(1)} Hrs</strong>
              </div>
            </div>
            <div className="kpi-card" style={{ background: "var(--panel)" }}>
              <div className="kpi-label">Diesel Economy Breakdown</div>
              <div style={{ fontSize: "14px", marginTop: "8px" }}>
                Adjusted Economy: <strong className="num">{results.actualDieselEconomy.toFixed(2)} km/l</strong><br />
                Turnaround Stops: <strong className="num">0 stops/trip</strong><br />
                Downtime: <strong className="num">0.0 Hrs</strong>
              </div>
            </div>
          </div>

          {/* Graph A: Cumulative NPV Trends */}
          <div style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "16px", textTransform: "uppercase", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
              Cumulative Cost Projections (NPV Trends over {results.n} Years)
            </h3>
            <div className="legend-row">
              <span><span className="legend-dot" style={{ background: "var(--diesel)" }} />Diesel</span>
              <span><span className="legend-dot" style={{ background: "var(--bev)" }} />Electric</span>
              <span><span className="legend-dot" style={{ background: "var(--comp)" }} />{inp.compName}</span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={results.chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="var(--text-dim)" label={{ value: "Operating Year", position: "insideBottom", offset: -5, fill: "var(--text-dim)", fontSize: 12 }} />
                <YAxis stroke="var(--text-dim)" tickFormatter={(v) => inrCompact(v)} width={80} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }} formatter={(v) => inr(v)} />
                <Line type="monotone" dataKey="diesel" stroke="var(--diesel)" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="bev" stroke="var(--bev)" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="comp" stroke="var(--comp)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Graph B: Cost Category Breakdown */}
          <div style={{ marginTop: "32px" }}>
            <h3 style={{ fontSize: "16px", textTransform: "uppercase", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
              NPV Cost Category Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={[
                  { category: "Acquisition (Upfront)", Diesel: results.breakdowns.diesel.upfront, BEV: results.breakdowns.bev.upfront, Comp: results.breakdowns.comp.upfront },
                  { category: "Fuel / Energy", Diesel: results.breakdowns.diesel.fuel, BEV: results.breakdowns.bev.energy, Comp: results.breakdowns.comp.energy },
                  { category: "Financing EMI", Diesel: results.breakdowns.diesel.emi, BEV: results.breakdowns.bev.emi, Comp: results.breakdowns.comp.emi },
                  { category: "Maintenance", Diesel: results.breakdowns.diesel.maint, BEV: results.breakdowns.bev.maint, Comp: results.breakdowns.comp.maint },
                  { category: "Staff / Wages", Diesel: results.breakdowns.diesel.driver, BEV: results.breakdowns.bev.driver, Comp: results.breakdowns.comp.driver },
                  { category: "Tolls & Tyres", Diesel: results.breakdowns.diesel.tolls + results.breakdowns.diesel.tyres, BEV: results.breakdowns.bev.tolls + results.breakdowns.bev.tyres, Comp: results.breakdowns.comp.tolls + results.breakdowns.comp.tyres },
                  { category: "Battery Replacement", Diesel: 0, BEV: results.breakdowns.bev.battery, Comp: results.breakdowns.comp.battery },
                  { category: "Infra Upkeep", Diesel: 0, BEV: results.breakdowns.bev.infrastructure, Comp: results.breakdowns.comp.infrastructure },
                ]}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="category" stroke="var(--text-dim)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--text-dim)" tickFormatter={(v) => inrCompact(v)} width={80} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }} formatter={(v) => inr(v)} />
                <Legend />
                <Bar dataKey="Diesel" fill="var(--diesel)" />
                <Bar dataKey="BEV" fill="var(--bev)" />
                <Bar dataKey="Comp" fill="var(--comp)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Operating Detail Insights */}
          <div style={{ marginTop: "24px" }} className="grid-3">
            <div className="kpi-card" style={{ background: "var(--panel)" }}>
              <div className="kpi-label">Battery SOH Lifecycle</div>
              <div style={{ fontSize: "14px", marginTop: "8px" }}>
                BEV SOH at Period End: <strong className="num" style={{ color: results.sohBEV < 80 ? "var(--diesel)" : "var(--good)" }}>{results.sohBEV.toFixed(1)}%</strong><br />
                BEV Battery Pack Replacements: <strong className="num">{results.replacementsCountBEV} sets</strong><br />
                {inp.compName} SOH at Period End: <strong className="num" style={{ color: results.sohComp < 80 ? "var(--diesel)" : "var(--good)" }}>{results.sohComp.toFixed(1)}%</strong><br />
                {inp.compName} Battery Replacements: <strong className="num">{results.replacementsCountComp} sets</strong>
              </div>
            </div>
            <div className="kpi-card" style={{ background: "var(--panel)" }}>
              <div className="kpi-label">Fleet Sizing Detail</div>
              <div style={{ fontSize: "14px", marginTop: "8px" }}>
                Diesel Fleet Size: <strong className="num">{results.fleetSizeDiesel} units</strong><br />
                Electric Fleet Size: <strong className="num">{results.fleetSizeBEV} units</strong><br />
                {inp.compName} Fleet Size: <strong className="num">{results.fleetSizeComp} units</strong><br />
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  (Sized to move a total of {results.fleetSizeBEV > results.fleetSizeDiesel ? "more frequent trips/trucks due to charging downtimes" : "the monthly target cargo volume"})
                </span>
              </div>
            </div>
            <div className="kpi-card" style={{ background: "var(--panel)" }}>
              <div className="kpi-label">Asset Residuals (Discounted NPV)</div>
              <div style={{ fontSize: "14px", marginTop: "8px" }}>
                Diesel Fleet Residual: <strong className="num" style={{ color: "var(--diesel)" }}>{inrCompact(inp.dieselPurchasePrice * (inp.dieselResidualValue / 100) * results.fleetSizeDiesel)}</strong><br />
                Electric Fleet Residual: <strong className="num" style={{ color: "var(--bev)" }}>{inrCompact(inp.bevPurchasePrice * (inp.bevResidualValue / 100) * results.fleetSizeBEV)}</strong><br />
                {inp.compName} Residual: <strong className="num" style={{ color: "var(--comp)" }}>{inrCompact(inp.compPurchasePrice * (inp.compResidualValue / 100) * results.fleetSizeComp)}</strong>
              </div>
            </div>
          </div>

          {/* Footnotes */}
          <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "24px", display: "flex", gap: "8px", alignItems: "flex-start", lineHeight: "1.4" }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>
              All calculated configurations, sized grids, and project trends are illustrative planning estimations based on custom-built duty cycles. Range simulations account for standard fast-charging degradation variables, safe operating state parameters, and configured regional utility rates. Assumed asset parameters and policy guidelines should be evaluated in accordance with localized regional RTO definitions, current fleet operational procedures, and localized tax structures.
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

// Reusable Small Field Input Sub-Component
function Field({ label, value, onChange, suffix, step = 1, min = 0 }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-input">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
    </div>
  );
}