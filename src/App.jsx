import React, { useState, useMemo } from "react";
import {
  Truck, Zap, Fuel, BatteryCharging, TrendingUp, TrendingDown,
  Flag, Package, Info, RotateCcw, PlugZap, ShieldCheck, Layers,
  Plus, Trash2, MapPin, DollarSign, Settings, Eye, Sun, Moon, AlertTriangle
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from "recharts";

// 1. Core Lookup Matrix for Duty Cycle Efficiency (km/kWh)
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

const ROAD_TYPES = Object.keys(EFFICIENCY_MATRIX);
const TRAFFIC_CONDITIONS = ["High", "Medium", "Low"];

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

// Generate default balanced duty cycle stretches
const generateDefaultStretches = () => {
  const stretches = [];
  ROAD_TYPES.forEach((road) => {
    TRAFFIC_CONDITIONS.forEach((traffic) => {
      // Setup logical default allocations that sum to 100%
      let pct = 0;
      if (road === "6 lane highway/Expressway" && traffic === "Medium") pct = 50;
      else if (road === "4 lane highway" && traffic === "High") pct = 20;
      else if (road === "2 lane state highway" && traffic === "Medium") pct = 10;
      else if (road === "City road" && traffic === "High") pct = 5;
      else if (road === "Broken road" && traffic === "Medium") pct = 15;
      stretches.push({ roadType: road, traffic, percentage: pct });
    });
  });
  return stretches;
};

const DEFAULT_ROUTE = [
  { id: "1", from: "Mumbai", to: "Pune", distance: 150, payload: 35, avgSpeed: 60, stretches: generateDefaultStretches() },
  { id: "2", from: "Pune", to: "Satara", distance: 120, payload: 35, avgSpeed: 50, stretches: generateDefaultStretches() },
  { id: "3", from: "Satara", to: "Kolhapur", distance: 130, payload: 35, avgSpeed: 55, stretches: generateDefaultStretches() },
  { id: "4", from: "Kolhapur", to: "Mumbai", distance: 400, payload: 0, avgSpeed: 65, stretches: generateDefaultStretches() }
];

const VEHICLE_COLORS = ["#e29532", "#21bfa9", "#b16af0", "#38bdf8", "#ec4899", "#10b981"];

const INITIAL_VEHICLES = [
  {
    id: "v-diesel-1",
    name: "Standard Diesel 55T",
    type: "diesel",
    purchasePrice: 4200000,
    gstRate: 18,
    tractorWeight: 8500,
    trailerWeight: 9000,
    gvwr: 55000,
    baseFuelEconomy: 4.0,
    fuelOrElectricPrice: 94, // ₹/l
    maintCostPerKm: 3.5,
    insuranceRatePct: 2.5,
    residualPct: 15,
    financing: "emi",
    downPaymentPct: 15,
    interestRate: 9.5,
    loanTenure: 7,
    driverSalaryMonthly: 35000,
    tollCostPerTrip: 3500,
    tyreCostPerSet: 180000,
    tyreLifeKm: 90000,
    scheduledDowntimeDays: 12,
    unscheduledDowntimeHrs: 48,
  },
  {
    id: "v-bev-1",
    name: "Electric BEV 55T",
    type: "electric",
    purchasePrice: 9500000,
    gstRate: 5,
    tractorWeight: 11000,
    trailerWeight: 9000,
    gvwr: 55000,
    batteryCapacity: 450, // kWh
    batteryReplacementCost: 3500000,
    batteryDegradationPerCycle: 0.006,
    batterySOHThreshold: 75,
    maintCostPerKm: 2.2,
    insuranceRatePct: 2.8,
    residualPct: 8,
    financing: "emi",
    downPaymentPct: 15,
    interestRate: 10.0,
    loanTenure: 7,
    driverSalaryMonthly: 35000,
    tollCostPerTrip: 3500,
    tyreCostPerSet: 180000,
    tyreLifeKm: 90000,
    scheduledDowntimeDays: 10,
    unscheduledDowntimeHrs: 36,
    // Charging Infrastructure Specifics (Per Vehicle setup profile)
    safeSoCThreshold: 20,
    stationCost: 4500000,
    stationMaintenance: 180000,
    chargerCost: 1800000,
    chargerMaintenance: 60000,
    infrastructureTaxCredit: 5,
    chargingTimePerCycle: 1.25,
    electricityRate: 8.5,
    depotLandLeaseMonthly: 120000,
    depotDemandChargesMonthly: 80000,
  }
];

export default function ComprehensiveTCOCalculator() {
  const [darkMode, setDarkMode] = useState(true);
  const [monthlyCargoVolume, setMonthlyCargoVolume] = useState(12000);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(25);
  const [dailyOperatingLimitHrs, setDailyOperatingLimitHrs] = useState(18);
  const [loadingUnloadingTimePerTrip, setLoadingUnloadingTimePerTrip] = useState(3.5);

  const [analysisPeriod, setAnalysisPeriod] = useState(8);
  const [discountRate, setDiscountRate] = useState(9);

  // Global Escalation Parameters
  const [escGeneral, setEscGeneral] = useState(4.0);
  const [escFuel, setEscFuel] = useState(5.0);
  const [escElectricity, setEscElectricity] = useState(3.0);
  const [escWages, setEscWages] = useState(6.0);
  const [escInfrastructure, setEscInfrastructure] = useState(4.0);

  // Dynamic Route Planner
  const [routeSegments, setRouteSegments] = useState(DEFAULT_ROUTE);
  const [expandedSegmentId, setExpandedSegmentId] = useState(null);

  // Dynamic Vehicles Comparison Array
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);

  const handleAddVehicle = (type) => {
    const nextId = `v-custom-${Date.now()}`;
    const baseDefault = {
      id: nextId,
      name: `${type.toUpperCase()} Custom ${vehicles.length + 1}`,
      type: type,
      purchasePrice: type === "diesel" ? 4500000 : 10500000,
      gstRate: type === "diesel" ? 18 : 5,
      tractorWeight: type === "diesel" ? 8500 : 11500,
      trailerWeight: 9000,
      gvwr: 55000,
      maintCostPerKm: type === "diesel" ? 3.6 : 2.4,
      insuranceRatePct: 2.5,
      residualPct: type === "diesel" ? 12 : 10,
      financing: "emi",
      downPaymentPct: 15,
      interestRate: 9.5,
      loanTenure: 7,
      driverSalaryMonthly: 35000,
      tollCostPerTrip: 3500,
      tyreCostPerSet: 180000,
      tyreLifeKm: 90000,
      scheduledDowntimeDays: 12,
      unscheduledDowntimeHrs: 45,
    };

    if (type === "diesel") {
      baseDefault.baseFuelEconomy = 3.8;
      baseDefault.fuelOrElectricPrice = 94;
    } else {
      baseDefault.batteryCapacity = 500;
      baseDefault.batteryReplacementCost = 3800000;
      baseDefault.batteryDegradationPerCycle = 0.005;
      baseDefault.batterySOHThreshold = 75;
      baseDefault.safeSoCThreshold = 20;
      baseDefault.stationCost = 4500000;
      baseDefault.stationMaintenance = 180000;
      baseDefault.chargerCost = 1800000;
      baseDefault.chargerMaintenance = 60000;
      baseDefault.infrastructureTaxCredit = 5;
      baseDefault.chargingTimePerCycle = 1.3;
      baseDefault.electricityRate = 8.5;
      baseDefault.depotLandLeaseMonthly = 120000;
      baseDefault.depotDemandChargesMonthly = 80000;
    }

    setVehicles([...vehicles, baseDefault]);
  };

  const handleRemoveVehicle = (id) => {
    if (vehicles.length <= 1) return;
    setVehicles(vehicles.filter((v) => v.id !== id));
  };

  const updateVehicleProp = (id, prop, val) => {
    setVehicles(
      vehicles.map((v) => (v.id === id ? { ...v, [prop]: val } : v))
    );
  };

  const handleAddSegment = () => {
    const nextChar = String.fromCharCode(65 + routeSegments.length);
    const nextCharTo = String.fromCharCode(66 + routeSegments.length);
    const newSeg = {
      id: `s-${Date.now()}`,
      from: `Point ${nextChar}`,
      to: `Point ${nextCharTo}`,
      distance: 120,
      payload: 30,
      avgSpeed: 55,
      stretches: generateDefaultStretches(),
    };
    setRouteSegments([...routeSegments, newSeg]);
  };

  const handleRemoveSegment = (id) => {
    if (routeSegments.length <= 1) return;
    setRouteSegments(routeSegments.filter((s) => s.id !== id));
  };

  const updateSegmentProp = (segId, prop, val) => {
    setRouteSegments(
      routeSegments.map((s) => (s.id === segId ? { ...s, [prop]: val } : s))
    );
  };

  const updateStretchPercentage = (segId, roadType, traffic, val) => {
    setRouteSegments(
      routeSegments.map((seg) => {
        if (seg.id !== segId) return seg;
        const updated = seg.stretches.map((st) => {
          if (st.roadType === roadType && st.traffic === traffic) {
            return { ...st, percentage: val };
          }
          return st;
        });
        return { ...seg, stretches: updated };
      })
    );
  };

  // Run Calculations
  const results = useMemo(() => {
    const years = Math.max(1, Math.round(analysisPeriod));
    const dfRate = discountRate / 100;

    // Escalation factors
    const escGen = escGeneral / 100;
    const escF = escFuel / 100;
    const escE = escElectricity / 100;
    const escW = escWages / 100;
    const escI = escInfrastructure / 100;

    const computedVehicles = vehicles.map((v, vehicleIdx) => {
      const payloadCap = Math.max(0, v.gvwr - v.tractorWeight - v.trailerWeight) / 1000; // Tonnes
      let tripMaxPayload = 0;
      let totalTripDistance = 0;
      let totalTripDrivingHrs = 0;
      let weightedEnergyNeeded = 0; // Total energy needed per loop for EVs

      // Check for segment payload alerts
      const segmentOverloads = [];
      routeSegments.forEach((seg, idx) => {
        totalTripDistance += seg.distance;
        totalTripDrivingHrs += seg.distance / Math.max(1, seg.avgSpeed);
        if (seg.payload > tripMaxPayload) {
          tripMaxPayload = seg.payload;
        }
        if (seg.payload > payloadCap) {
          segmentOverloads.push({ segmentIdx: idx + 1, payload: seg.payload, cap: payloadCap });
        }

        // Segment Weighted Efficiency using exact custom stretch matrix configured
        let segWeightedEff = 0;
        let sumStretch = 0;
        seg.stretches.forEach((st) => {
          if (st.percentage > 0) {
            const eff = interpolateEfficiency(st.roadType, st.traffic, Math.min(seg.payload, payloadCap));
            segWeightedEff += eff * (st.percentage / 100);
            sumStretch += st.percentage;
          }
        });

        // Normalize if stretches don't perfectly sum to 100
        const normalizeFactor = sumStretch > 0 ? 100 / sumStretch : 1;
        segWeightedEff = segWeightedEff * normalizeFactor;

        weightedEnergyNeeded += seg.distance / Math.max(0.01, segWeightedEff);
      });

      const avgRouteEfficiency = weightedEnergyNeeded > 0 ? totalTripDistance / weightedEnergyNeeded : 1.0;

      // Scale diesel fuel economy from average segment efficiency baseline ratio
      const baselineMediumEff = 1.21;
      const actualEfficiencyRatio = avgRouteEfficiency / baselineMediumEff;
      const vehicleSpecificEconomy = v.type === "diesel"
        ? Math.max(0.5, v.baseFuelEconomy * actualEfficiencyRatio)
        : avgRouteEfficiency; // km/kWh for electric

      // SoC Node Tracing along the point-to-point sequence
      let chargingStopsCount = 0;
      let stopsLog = [];
      if (v.type === "electric") {
        let currentSoC = 100;
        let totalTripSegmentDistance = 0;

        routeSegments.forEach((seg, idx) => {
          let segWeightedEff = 0;
          let sumStretch = 0;
          seg.stretches.forEach((st) => {
            if (st.percentage > 0) {
              const eff = interpolateEfficiency(st.roadType, st.traffic, Math.min(seg.payload, payloadCap));
              segWeightedEff += eff * (st.percentage / 100);
              sumStretch += st.percentage;
            }
          });
          const normalizeFactor = sumStretch > 0 ? 100 / sumStretch : 1;
          segWeightedEff = segWeightedEff * normalizeFactor;

          const energyRequired = seg.distance / Math.max(0.01, segWeightedEff);
          const energySoCPct = (energyRequired / v.batteryCapacity) * 100;

          if (currentSoC - energySoCPct < v.safeSoCThreshold) {
            chargingStopsCount++;
            stopsLog.push({ stopName: seg.from, distanceTraveled: totalTripSegmentDistance, socBeforeCharge: currentSoC.toFixed(1) });
            currentSoC = 85; // Fast charge to standard 85% limit
          }
          currentSoC = Math.max(0, currentSoC - energySoCPct);
          totalTripSegmentDistance += seg.distance;
        });
      }

      // Turnaround calculations incorporating separate downtimes
      const chargingDowntimeHrs = v.type === "electric" ? chargingStopsCount * v.chargingTimePerCycle : 0;

      const annualScheduledDowntimeHrs = v.scheduledDowntimeDays * 24;
      const annualUnscheduledDowntimeHrs = v.unscheduledDowntimeHrs;
      const totalAnnualFixedDowntimeHrs = annualScheduledDowntimeHrs + annualUnscheduledDowntimeHrs;

      const drivingAndLoadingTurnaround = totalTripDrivingHrs + loadingUnloadingTimePerTrip;
      const fullTurnaroundCycleHrs = drivingAndLoadingTurnaround + chargingDowntimeHrs;

      // Calculate total potential operational loops run by a single vehicle over the year
      const totalOperatingHoursAvailableYear = (workingDaysPerMonth * 12 * dailyOperatingLimitHrs) - totalAnnualFixedDowntimeHrs;
      const tripsPerYearPerVehicle = fullTurnaroundCycleHrs > 0 ? totalOperatingHoursAvailableYear / fullTurnaroundCycleHrs : 0;

      // Calculate cargo throughput capacity
      const cappedPayloadPerTrip = Math.min(tripMaxPayload, payloadCap);
      const annualCargoThroughputPerVehicle = tripsPerYearPerVehicle * cappedPayloadPerTrip;

      // Scale dynamic fleet size to meet target monthly volume
      const totalAnnualVolumeTarget = monthlyCargoVolume * 12;
      const fleetSizeRequired = Math.max(1, Math.ceil(totalAnnualVolumeTarget / Math.max(1, annualCargoThroughputPerVehicle)));

      const totalTripsAcrossFleetYear = tripsPerYearPerVehicle * fleetSizeRequired;
      const totalDistanceAcrossFleetYear = totalTripsAcrossFleetYear * totalTripDistance;

      // Setup infrastructure requirements for EVs
      let chargersNeeded = 0;
      let stationsNeeded = 0;
      let capitalSetupInfra = 0;

      if (v.type === "electric") {
        const totalChargesPerYearFleet = totalTripsAcrossFleetYear * chargingStopsCount;
        const chargeSlotsPerDayPerCharger = dailyOperatingLimitHrs / Math.max(0.5, v.chargingTimePerCycle);
        const dailyChargesDemand = totalChargesPerYearFleet / (workingDaysPerMonth * 12);
        chargersNeeded = Math.max(1, Math.ceil(dailyChargesDemand / chargeSlotsPerDayPerCharger));
        stationsNeeded = Math.max(1, Math.ceil(chargersNeeded / 3)); // Assume 3 chargers per depot
        capitalSetupInfra = (stationsNeeded * v.stationCost + chargersNeeded * v.chargerCost) * (1 - v.infrastructureTaxCredit / 100);
      }

      // Amortize Loans
      const totalUpfrontGSTPrice = v.purchasePrice * (1 + v.gstRate / 100);
      let loanUpfrontDownpayment = totalUpfrontGSTPrice;
      let loanAnnualEMI = 0;
      let principalDebt = 0;
      let totalInterestAccrued = 0;

      if (v.financing === "emi" && v.loanTenure > 0) {
        loanUpfrontDownpayment = totalUpfrontGSTPrice * (v.downPaymentPct / 100);
        principalDebt = Math.max(0, totalUpfrontGSTPrice - loanUpfrontDownpayment);
        const monthlyRate = v.interestRate / 1200;
        const totalMonths = v.loanTenure * 12;
        const emi = monthlyRate > 0
          ? (principalDebt * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
          : principalDebt / totalMonths;
        loanAnnualEMI = emi * 12;
        totalInterestAccrued = Math.max(0, emi * 12 * v.loanTenure - principalDebt);
      }

      // Cumulative Cost NPV Sizing Arrays
      let npvTCOSum = (loanUpfrontDownpayment * fleetSizeRequired) + capitalSetupInfra;
      let cumCostTimeline = [npvTCOSum];

      const breakdown = {
        upfront: (loanUpfrontDownpayment * fleetSizeRequired) + capitalSetupInfra,
        fuelOrEnergy: 0,
        emi: 0,
        maintenance: 0,
        wages: 0,
        tolls: 0,
        tyres: 0,
        batteryReplacements: 0,
        infraMaintenance: 0,
        residuals: 0
      };

      let currentSOH = 100;
      let cyclesAccumulated = 0;
      let batterySetsReplacedCount = 0;

      for (let t = 1; t <= years; t++) {
        const df = 1 / Math.pow(1 + dfRate, t);
        const multGen = Math.pow(1 + escGen, t - 1);
        const multF = Math.pow(1 + escF, t - 1);
        const multE = Math.pow(1 + escE, t - 1);
        const multW = Math.pow(1 + escW, t - 1);
        const multI = Math.pow(1 + escI, t - 1);

        // EMI Cost
        let yearEMI = 0;
        if (v.financing === "emi" && t <= v.loanTenure) {
          yearEMI = loanAnnualEMI * fleetSizeRequired;
        }

        // Fuel / Energy Cost
        let yearFuelOrEnergy = 0;
        if (v.type === "diesel") {
          yearFuelOrEnergy = (totalDistanceAcrossFleetYear / vehicleSpecificEconomy) * v.fuelOrElectricPrice * multF;
        } else {
          yearFuelOrEnergy = totalDistanceAcrossFleetYear * (1 / avgRouteEfficiency) * v.electricityRate * multE;
        }

        // Maintenance
        const yearMaint = totalDistanceAcrossFleetYear * v.maintCostPerKm * multGen;

        // Insurance
        const yearIns = totalUpfrontGSTPrice * (v.insuranceRatePct / 100) * multGen * fleetSizeRequired;

        // Staff / Wages
        const yearWages = v.driverSalaryMonthly * 12 * multW * fleetSizeRequired;

        // Tolls & Tyres
        const yearTolls = v.tollCostPerTrip * totalTripsAcrossFleetYear * multGen;
        const yearTyres = (totalDistanceAcrossFleetYear / v.tyreLifeKm) * v.tyreCostPerSet * multGen;

        // Battery Degradation Replacement Check
        let yearBatteryCost = 0;
        if (v.type === "electric") {
          const annualMileagePerVehicle = totalDistanceAcrossFleetYear / fleetSizeRequired;
          const rangePerCharge = (v.batteryCapacity * 0.85) / Math.max(0.01, 1 / avgRouteEfficiency);
          const cyclesPerYearPerVehicle = annualMileagePerVehicle / rangePerCharge;

          cyclesAccumulated += cyclesPerYearPerVehicle;
          const projectedSOH = 100 - (cyclesAccumulated * v.batteryDegradationPerCycle);

          if (projectedSOH <= v.batterySOHThreshold) {
            yearBatteryCost = v.batteryReplacementCost * fleetSizeRequired * multGen;
            cyclesAccumulated = 0;
            batterySetsReplacedCount += fleetSizeRequired;
            currentSOH = 100;
          } else {
            currentSOH = Math.max(10, projectedSOH);
          }
        }

        // Infrastructure Upkeep
        let yearInfraOverhead = 0;
        if (v.type === "electric") {
          const annualStationUpkeep = stationsNeeded * v.stationMaintenance;
          const annualChargerUpkeep = chargersNeeded * v.chargerMaintenance;
          const annualDepotUtility = (v.depotDemandChargesMonthly + v.depotLandLeaseMonthly) * 12;
          yearInfraOverhead = (annualStationUpkeep + annualChargerUpkeep + annualDepotUtility) * multI;
        }

        const totalYearlyExpenses = yearEMI + yearFuelOrEnergy + yearMaint + yearIns + yearWages + yearTolls + yearTyres + yearBatteryCost + yearInfraOverhead;
        npvTCOSum += totalYearlyExpenses * df;
        cumCostTimeline.push(cumCostTimeline[cumCostTimeline.length - 1] + totalYearlyExpenses);

        // Breakdowns mapping (Discounted back to NPV)
        breakdown.fuelOrEnergy += yearFuelOrEnergy * df;
        breakdown.emi += yearEMI * df;
        breakdown.maintenance += (yearMaint + yearIns) * df;
        breakdown.wages += yearWages * df;
        breakdown.tolls += yearTolls * df;
        breakdown.tyres += yearTyres * df;
        breakdown.batteryReplacements += yearBatteryCost * df;
        breakdown.infraMaintenance += yearInfraOverhead * df;
      }

      // Residual Valuation Discounted Back
      const dfN = 1 / Math.pow(1 + dfRate, years);
      const absoluteResidualValue = v.purchasePrice * (v.residualPct / 100) * fleetSizeRequired;
      const npvResidualValue = absoluteResidualValue * dfN;

      npvTCOSum -= npvResidualValue;
      cumCostTimeline[years] -= absoluteResidualValue;
      breakdown.residuals = -npvResidualValue;

      // Tonne-km Calculations using high precision floats
      const annualCargoThroughputFleet = annualCargoThroughputPerVehicle * fleetSizeRequired;
      const totalCargoMovedOverTimeline = annualCargoThroughputFleet * years;
      const totalCargoTonneKmFleet = totalCargoMovedOverTimeline * totalTripDistance;

      // Cost per Tonne-Km calculation with full precision division
      const costPerTonneKm = totalCargoTonneKmFleet > 0 ? npvTCOSum / totalCargoTonneKmFleet : 0;

      return {
        ...v,
        payloadCap,
        actualEfficiencyRatio,
        avgRouteEfficiency,
        vehicleSpecificEconomy,
        chargingStopsCount,
        stopsLog,
        turnaroundCycleHrs: fullTurnaroundCycleHrs,
        fleetSizeRequired,
        tripsPerYearPerVehicle,
        totalTripsAcrossFleetYear,
        totalDistanceAcrossFleetYear,
        chargersNeeded,
        stationsNeeded,
        npvTCOSum,
        cumCostTimeline,
        breakdown,
        costPerTonneKm,
        currentSOH,
        batterySetsReplacedCount,
        segmentOverloads,
      };
    });

    // Structure charts mapping datasets
    const chartData = [{ year: 0 }];
    computedVehicles.forEach((v) => {
      chartData[0][v.name] = v.cumCostTimeline[0];
    });

    for (let t = 1; t <= years; t++) {
      const row = { year: t };
      computedVehicles.forEach((v) => {
        row[v.name] = v.cumCostTimeline[t];
      });
      chartData.push(row);
    }

    return {
      years,
      computedVehicles,
      chartData,
    };
  }, [
    vehicles,
    routeSegments,
    monthlyCargoVolume,
    workingDaysPerMonth,
    dailyOperatingLimitHrs,
    loadingUnloadingTimePerTrip,
    analysisPeriod,
    discountRate,
    escGeneral,
    escFuel,
    escElectricity,
    escWages,
    escInfrastructure,
  ]);

  return (
    <div className={`wrap ${darkMode ? "dark-theme" : "light-theme"}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

        /* Dynamic Theme Swapping Styles */
        .wrap.dark-theme {
          --bg: #0d1011;
          --panel: #161a1d;
          --panel-alt: #1e2427;
          --border: #2c3437;
          --text: #f1ede4;
          --text-dim: #8b999c;
          --bev: #20c4af;
          --diesel: #e0922f;
          --good: #4cb264;
          --bad: #d14636;
          --input-bg: #0a0d0e;
        }

        .wrap.light-theme {
          --bg: #f3f6f7;
          --panel: #ffffff;
          --panel-alt: #edf0f2;
          --border: #ccd3d6;
          --text: #1b2123;
          --text-dim: #627275;
          --bev: #129382;
          --diesel: #be7a21;
          --good: #2a8a43;
          --bad: #b22d1f;
          --input-bg: #fbfcfd;
        }

        .wrap {
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          padding: 24px;
          border-radius: 12px;
          min-height: 100vh;
          max-width: 1400px;
          margin: 0 auto;
          box-sizing: border-box;
          transition: background 0.2s, color 0.2s;
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

        .theme-btn, .reset-btn, .add-btn {
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

        .theme-btn:hover, .reset-btn:hover, .add-btn:hover {
          border-color: var(--bev);
        }

        .add-btn {
          margin-top: 12px;
        }

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

        .field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
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

        /* Route Table Styles */
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
          padding: 10px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
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

        .expand-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--bev);
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11.5px;
        }

        .remove-btn {
          background: transparent;
          border: none;
          color: var(--bad);
          cursor: pointer;
        }

        /* Segment Stretches Drawer */
        .stretch-drawer {
          background: var(--panel-alt);
          border: 1px dashed var(--border);
          border-radius: 8px;
          padding: 14px;
          margin-top: 8px;
        }

        .stretch-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 8px;
        }

        @media(max-width: 768px) {
          .stretch-grid { grid-template-columns: 1fr; }
        }

        .stretch-card {
          background: var(--panel);
          border: 1px solid var(--border);
          padding: 10px;
          border-radius: 6px;
        }

        /* Vehicle Configuration Deck */
        .vehicle-deck {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
        }

        .vehicle-card {
          background: var(--panel);
          border: 1.5px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .vehicle-card.active-electric {
          border-color: var(--bev);
        }

        .vehicle-card.active-diesel {
          border-color: var(--diesel);
        }

        .vcard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
        }

        .vcard-title {
          font-size: 18px;
          font-weight: 700;
          text-transform: uppercase;
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
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
        }

        .seg button.active {
          background: var(--bev);
          color: #0c0e0f;
          font-weight: 600;
        }

        /* KPI styling */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }

        .kpi-card {
          background: var(--panel-alt);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px;
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
          font-size: 22px;
          font-weight: 700;
        }

        .kpi-sub {
          font-size: 11.5px;
          color: var(--text-dim);
          margin-top: 4px;
          line-height: 1.4;
        }

        .add-vehicle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: var(--panel-alt);
          border: 2px dashed var(--border);
          color: var(--text);
          border-radius: 12px;
          padding: 40px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .add-vehicle-btn:hover {
          border-color: var(--bev);
          background: rgba(33, 196, 175, 0.03);
        }

        .alert-strip {
          background: rgba(209, 70, 54, 0.1);
          border: 1px solid var(--bad);
          color: var(--bad);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .section-tag {
          font-size: 11px;
          font-weight: 700;
          color: var(--bev);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 16px 0 8px;
          border-bottom: 1.5px solid var(--border);
          padding-bottom: 4px;
        }

        .legend-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 12px;
          color: var(--text-dim);
          margin-bottom: 8px;
        }

        .legend-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
        }
      `}</style>

      {/* Top Header Controls */}
      <div className="header">
        <div>
          <h1>
            <Truck size={28} style={{ display: "inline", verticalAlign: "-5px", marginRight: 10, color: "var(--bev)" }} />
            Enterprise Logistics & Duty Cycle TCO Simulator
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-dim)", fontSize: "14px" }}>
            Multi-vehicle comparative fleet planner utilizing custom weighted route profiles & sequential battery tracing
          </p>
        </div>
        <div className="header-actions">
          <button className="theme-btn" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="reset-btn" onClick={() => {
            setMonthlyCargoVolume(12000);
            setWorkingDaysPerMonth(25);
            setDailyOperatingLimitHrs(18);
            setLoadingUnloadingTimePerTrip(3.5);
            setAnalysisPeriod(8);
            setDiscountRate(9);
            setEscGeneral(4.0);
            setEscFuel(5.0);
            setEscElectricity(3.0);
            setEscWages(6.0);
            setEscInfrastructure(4.0);
            setRouteSegments(DEFAULT_ROUTE);
            setVehicles(INITIAL_VEHICLES);
          }}>
            <RotateCcw size={15} /> Reset Core defaults
          </button>
        </div>
      </div>

      <div className="vertical-stack">

        {/* SECTION 1: Logistics Sizing Requirements */}
        <div className="panel">
          <h2><Package size={18} color="var(--bev)" /> 1. Logistics Sizing & Turnaround Requirements</h2>
          <div className="grid-3">
            <div>
              <Field label="Monthly Cargo Volume Goal" value={monthlyCargoVolume} onChange={setMonthlyCargoVolume} suffix="Tonnes" step={100} />
              <Field label="Operational Working Days" value={workingDaysPerMonth} onChange={setWorkingDaysPerMonth} suffix="Days" step={1} />
            </div>
            <div>
              <Field label="Operating Hours Limit/Day" value={dailyOperatingLimitHrs} onChange={setDailyOperatingLimitHrs} suffix="Hours" step={1} />
              <Field label="Turnaround Load/Unload Cost" value={loadingUnloadingTimePerTrip} onChange={setLoadingUnloadingTimePerTrip} suffix="Hours" step={0.5} />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.5", background: "var(--panel-alt)", padding: "12px", borderRadius: "8px" }}>
                <strong>Dynamic Logistics Sizing Model:</strong> Instead of entering an arbitrary vehicle count, define your required monthly throughput. The simulator automatically calculates the turnaround time, evaluates battery degradation, inserts required charging stops, and sizes your fleet dynamically.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Point-to-Point Route Matrix & Duty Cycle Planner */}
        <div className="panel">
          <h2><MapPin size={18} color="var(--bev)" /> 2. Multi-Node Route Planner & Duty Cycle Breakdown</h2>

          <div className="table-container">
            <table className="route-table">
              <thead>
                <tr>
                  <th>From Node</th>
                  <th>To Node</th>
                  <th>Distance (km)</th>
                  <th>Onward Cargo Payload (T)</th>
                  <th>Segment Avg Speed (km/h)</th>
                  <th>Segment Custom Duty Cycle</th>
                  <th style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {routeSegments.map((seg) => {
                  const activeStretchesSum = seg.stretches.reduce((sum, st) => sum + st.percentage, 0);
                  return (
                    <React.Fragment key={seg.id}>
                      <tr>
                        <td>
                          <input type="text" value={seg.from} onChange={(e) => updateSegmentProp(seg.id, "from", e.target.value)} />
                        </td>
                        <td>
                          <input type="text" value={seg.to} onChange={(e) => updateSegmentProp(seg.id, "to", e.target.value)} />
                        </td>
                        <td>
                          <input type="number" value={seg.distance} onChange={(e) => updateSegmentProp(seg.id, "distance", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td>
                          <input type="number" value={seg.payload} onChange={(e) => updateSegmentProp(seg.id, "payload", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td>
                          <input type="number" value={seg.avgSpeed} onChange={(e) => updateSegmentProp(seg.id, "avgSpeed", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td>
                          <button
                            className="expand-btn"
                            onClick={() => setExpandedSegmentId(expandedSegmentId === seg.id ? null : seg.id)}
                          >
                            {expandedSegmentId === seg.id ? "Collapse Matrix" : `Configure Matrix (${activeStretchesSum}%)`}
                          </button>
                        </td>
                        <td>
                          <button className="remove-btn" onClick={() => handleRemoveSegment(seg.id)} disabled={routeSegments.length <= 1}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded stretch editor drawer */}
                      {expandedSegmentId === seg.id && (
                        <tr>
                          <td colSpan="7">
                            <div className="stretch-drawer">
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span style={{ fontWeight: 600, fontSize: "12.5px" }}>Configure Segment Stretch Allocation Matrix (Must sum to 100%)</span>
                                <span className="num" style={{ fontWeight: 700, color: activeStretchesSum !== 100 ? "var(--bad)" : "var(--good)" }}>
                                  Current Sum: {activeStretchesSum}%
                                </span>
                              </div>

                              <div className="stretch-grid">
                                {ROAD_TYPES.map((road) => (
                                  <div key={road} className="stretch-card">
                                    <div style={{ fontWeight: 600, fontSize: "11px", textTransform: "uppercase", marginBottom: "6px", color: "var(--bev)" }}>{road}</div>
                                    {TRAFFIC_CONDITIONS.map((traffic) => {
                                      const matched = seg.stretches.find(st => st.roadType === road && st.traffic === traffic);
                                      const currentVal = matched ? matched.percentage : 0;
                                      return (
                                        <div key={traffic} className="field">
                                          <span style={{ fontSize: "11px" }}>{traffic} Traffic</span>
                                          <div className="field-input">
                                            <input
                                              type="number"
                                              value={currentVal}
                                              onChange={(e) => updateStretchPercentage(seg.id, road, traffic, parseFloat(e.target.value) || 0)}
                                              style={{ width: "50px", padding: "4px" }}
                                            />
                                            <span style={{ fontSize: "9px", paddingRight: "4px" }}>%</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button className="add-btn" onClick={handleAddSegment}>
            <Plus size={14} /> Add Route segment
          </button>
        </div>

        {/* SECTION 3: Global Financial and Escalation Matrix */}
        <div className="panel">
          <h2><Settings size={18} color="var(--bev)" /> 3. Global Financial & Inflation Escalation Matrix</h2>
          <div className="grid-3">
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Timeline Parameters</div>
              <Field label="Analysis Window" value={analysisPeriod} onChange={setAnalysisPeriod} suffix="Years" step={1} />
              <Field label="Discount Rate (Cost of Cap)" value={discountRate} onChange={setDiscountRate} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Basic Overhead Escalations</div>
              <Field label="General Escalation" value={escGeneral} onChange={setEscGeneral} suffix="%" step={0.5} />
              <Field label="Fuel / Diesel Escalation" value={escFuel} onChange={setEscFuel} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Infrastructure Overheads</div>
              <Field label="Electricity Rate Escalation" value={escElectricity} onChange={setEscElectricity} suffix="%" step={0.5} />
              <Field label="Staff Wage Escalation" value={escWages} onChange={setEscWages} suffix="%" step={0.5} />
              <Field label="Depot Upkeep Escalation" value={escInfrastructure} onChange={setEscInfrastructure} suffix="%" step={0.5} />
            </div>
          </div>
        </div>

        {/* SECTION 4: Compared Vehicles Configurations */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ margin: 0, textTransform: "uppercase", fontSize: "20px" }}><Truck size={20} style={{ verticalAlign: "-3px", marginRight: "6px" }} /> 4. Configured Fleet Vehicle Profiles</h2>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="theme-btn" style={{ borderColor: "var(--diesel)" }} onClick={() => handleAddVehicle("diesel")}>
                <Plus size={14} /> Add Diesel Vehicle
              </button>
              <button className="theme-btn" style={{ borderColor: "var(--bev)" }} onClick={() => handleAddVehicle("electric")}>
                <Plus size={14} /> Add Electric Vehicle
              </button>
            </div>
          </div>

          <div className="vehicle-deck">
            {vehicles.map((v, idx) => (
              <div key={v.id} className={`vehicle-card ${v.type === "electric" ? "active-electric" : "active-diesel"}`}>
                <div className="vcard-header">
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "700", color: v.type === "electric" ? "var(--bev)" : "var(--diesel)" }}>
                      {v.type.toUpperCase()} PROFILE
                    </span>
                    <input
                      type="text"
                      value={v.name}
                      className="vcard-title num"
                      onChange={(e) => updateVehicleProp(v.id, "name", e.target.value)}
                      style={{ background: "transparent", border: "none", color: "var(--text)", borderBottom: "1px dashed var(--border)", width: "200px" }}
                    />
                  </div>
                  <button className="remove-btn" onClick={() => handleRemoveVehicle(v.id)} disabled={vehicles.length <= 1}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="section-tag" style={{ marginTop: 0 }}>Asset Specifications</div>
                <Field label="Base Purchase Price (ex GST)" value={v.purchasePrice} onChange={(val) => updateVehicleProp(v.id, "purchasePrice", val)} suffix="₹" step={50000} />
                <Field label="GST Rate" value={v.gstRate} onChange={(val) => updateVehicleProp(v.id, "gstRate", val)} suffix="%" step={1} />
                <Field label="Tractor Curb Weight" value={v.tractorWeight} onChange={(val) => updateVehicleProp(v.id, "tractorWeight", val)} suffix="kg" step={100} />
                <Field label="Trailer Curb Weight" value={v.trailerWeight} onChange={(val) => updateVehicleProp(v.id, "trailerWeight", val)} suffix="kg" step={100} />
                <Field label="Gross Vehicle Weight (GVWR)" value={v.gvwr} onChange={(val) => updateVehicleProp(v.id, "gvwr", val)} suffix="kg" step={500} />

                {v.type === "diesel" ? (
                  <>
                    <div className="section-tag">Diesel Overheads</div>
                    <Field label="Base Fuel Economy" value={v.baseFuelEconomy} onChange={(val) => updateVehicleProp(v.id, "baseFuelEconomy", val)} suffix="km/l" step={0.1} />
                    <Field label="Diesel Base Price" value={v.fuelOrElectricPrice} onChange={(val) => updateVehicleProp(v.id, "fuelOrElectricPrice", val)} suffix="₹/l" step={0.5} />
                  </>
                ) : (
                  <>
                    <div className="section-tag">Electric Battery Overheads</div>
                    <Field label="Battery Capacity" value={v.batteryCapacity} onChange={(val) => updateVehicleProp(v.id, "batteryCapacity", val)} suffix="kWh" step={25} />
                    <Field label="Battery Pack Cost" value={v.batteryReplacementCost} onChange={(val) => updateVehicleProp(v.id, "batteryReplacementCost", val)} suffix="₹" step={100000} />
                    <Field label="Degradation / Cycle" value={v.batteryDegradationPerCycle} onChange={(val) => updateVehicleProp(v.id, "batteryDegradationPerCycle", val)} suffix="%" step={0.001} />
                    <Field label="SOH Limit Threshold" value={v.batterySOHThreshold} onChange={(val) => updateVehicleProp(v.id, "batterySOHThreshold", val)} suffix="%" step={1} />
                    <Field label="Safe Limit SoC Margin" value={v.safeSoCThreshold} onChange={(val) => updateVehicleProp(v.id, "safeSoCThreshold", val)} suffix="%" step={1} />
                  </>
                )}

                <div className="section-tag">Overhead & Operating Parameters</div>
                <Field label="Maintenance Cost" value={v.maintCostPerKm} onChange={(val) => updateVehicleProp(v.id, "maintCostPerKm", val)} suffix="₹/km" step={0.1} />
                <Field label="Insurance Premium Rate" value={v.insuranceRatePct} onChange={(val) => updateVehicleProp(v.id, "insuranceRatePct", val)} suffix="%" step={0.25} />
                <Field label="Residual Asset Value" value={v.residualPct} onChange={(val) => updateVehicleProp(v.id, "residualPct", val)} suffix="%" step={1} />

                <Field label="Driver Monthly Wage" value={v.driverSalaryMonthly} onChange={(val) => updateVehicleProp(v.id, "driverSalaryMonthly", val)} suffix="₹" step={1000} />
                <Field label="Tolls per Round-Trip" value={v.tollCostPerTrip} onChange={(val) => updateVehicleProp(v.id, "tollCostPerTrip", val)} suffix="₹" step={250} />
                <Field label="Tyre Cost (Set of 12)" value={v.tyreCostPerSet} onChange={(val) => updateVehicleProp(v.id, "tyreCostPerSet", val)} suffix="₹" step={5000} />
                <Field label="Expected Tyre Life" value={v.tyreLifeKm} onChange={(val) => updateVehicleProp(v.id, "tyreLifeKm", val)} suffix="km" step={5000} />

                <div className="section-tag">Scheduled & Unscheduled Downtime</div>
                <Field label="Scheduled Downtime" value={v.scheduledDowntimeDays} onChange={(val) => updateVehicleProp(v.id, "scheduledDowntimeDays", val)} suffix="Days/yr" step={1} />
                <Field label="Unscheduled Downtime" value={v.unscheduledDowntimeHrs} onChange={(val) => updateVehicleProp(v.id, "unscheduledDowntimeHrs", val)} suffix="Hrs/yr" step={1} />

                {v.type === "electric" && (
                  <>
                    <div className="section-tag">Sized Charging Overheads</div>
                    <Field label="Station Setup Cost" value={v.stationCost} onChange={(val) => updateVehicleProp(v.id, "stationCost", val)} suffix="₹" step={100000} />
                    <Field label="Station Annual Upkeep" value={v.stationMaintenance} onChange={(val) => updateVehicleProp(v.id, "stationMaintenance", val)} suffix="₹/yr" step={10000} />
                    <Field label="Charger Dispenser Unit Cost" value={v.chargerCost} onChange={(val) => updateVehicleProp(v.id, "chargerCost", val)} suffix="₹" step={50000} />
                    <Field label="Charger Annual Upkeep" value={v.chargerMaintenance} onChange={(val) => updateVehicleProp(v.id, "chargerMaintenance", val)} suffix="₹/yr" step={5000} />
                    <Field label="Setup Tax Credit (Subsidy)" value={v.infrastructureTaxCredit} onChange={(val) => updateVehicleProp(v.id, "infrastructureTaxCredit", val)} suffix="%" step={1} />
                    <Field label="Charging Turnaround Time" value={v.chargingTimePerCycle} onChange={(val) => updateVehicleProp(v.id, "chargingTimePerCycle", val)} suffix="Hrs" step={0.1} />
                    <Field label="Depot Electricity Rate" value={v.electricityRate} onChange={(val) => updateVehicleProp(v.id, "electricityRate", val)} suffix="₹/kWh" step={0.5} />
                    <Field label="Monthly Land Lease" value={v.depotLandLeaseMonthly} onChange={(val) => updateVehicleProp(v.id, "depotLandLeaseMonthly", val)} suffix="₹" step={5000} />
                    <Field label="Monthly Utility Demand Fee" value={v.depotDemandChargesMonthly} onChange={(val) => updateVehicleProp(v.id, "depotDemandChargesMonthly", val)} suffix="₹" step={5000} />
                  </>
                )}

                <div className="section-tag">Financing Structure</div>
                <div className="field">
                  <span className="field-label">Financing Type</span>
                  <div className="seg">
                    <button className={v.financing === "cash" ? "active" : ""} onClick={() => updateVehicleProp(v.id, "financing", "cash")}>Cash</button>
                    <button className={v.financing === "emi" ? "active" : ""} onClick={() => updateVehicleProp(v.id, "financing", "emi")}>Loan</button>
                  </div>
                </div>
                {v.financing === "emi" && (
                  <>
                    <Field label="Down Payment" value={v.downPaymentPct} onChange={(val) => updateVehicleProp(v.id, "downPaymentPct", val)} suffix="%" step={5} />
                    <Field label="Loan Interest Rate" value={v.interestRate} onChange={(val) => updateVehicleProp(v.id, "interestRate", val)} suffix="%" step={0.25} />
                    <Field label="Loan Tenure" value={v.loanTenure} onChange={(val) => updateVehicleProp(v.id, "loanTenure", val)} suffix="Yrs" step={1} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: Dynamic Warnings and Safety Checks */}
        {results.computedVehicles.some(v => v.segmentOverloads.length > 0) && (
          <div className="alert-strip">
            <AlertTriangle size={18} />
            <div>
              <strong>Payload Validation Alert:</strong> Configured route segment cargo weights exceed maximum carrying capacities of some vehicles!
              {results.computedVehicles.map(v => {
                if (v.segmentOverloads.length === 0) return null;
                return (
                  <div key={v.id} style={{ paddingLeft: "10px", marginTop: "4px" }}>
                    · <strong>{v.name}</strong> caps out at <strong>{v.payloadCap.toFixed(1)}T</strong> payload. Capped values will be scaled to ensure turnaround parameters are mapped correctly.
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 6: Advanced TCO Dashboard */}
        <div className="panel" style={{ border: "2.5px solid var(--bev)" }}>
          <h2 style={{ color: "var(--bev)" }}><TrendingUp size={20} /> 6. Dynamic Comparative Fleet Results Dashboard</h2>

          {/* KPI Dashboard Grid */}
          <div className="kpi-grid">
            {results.computedVehicles.map((v, idx) => (
              <div key={v.id} className="kpi-card" style={{ borderTop: `4px solid ${VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}` }}>
                <div className="kpi-label">{v.name} ({v.fleetSizeRequired} Sized Trucks)</div>
                <div className="kpi-val num" style={{ color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] }}>
                  {inrCompact(v.npvTCOSum)}
                </div>
                {/* Fixed precise division metric showing high precision rate floats */}
                <div className="kpi-sub num" style={{ fontWeight: 600 }}>
                  ₹{v.costPerTonneKm.toFixed(3)} / tonne-km
                </div>
                <div className="kpi-sub">
                  Turnaround: <strong className="num">{v.turnaroundCycleHrs.toFixed(1)} Hrs</strong><br />
                  Trips/Yr: <strong className="num">{Math.round(v.tripsPerYearPerVehicle)} / unit</strong><br />
                  {v.type === "electric" && (
                    <>
                      Stops: <strong className="num">{v.chargingStopsCount} stops</strong><br />
                      Sized Network: <strong className="num">{v.stationsNeeded} Station / {v.chargersNeeded} Charger</strong>
                    </>
                  )}
                  {v.type === "diesel" && <span>Stops: <strong className="num">0 stops</strong></span>}
                </div>
              </div>
            ))}
          </div>

          {/* Sequential Path SoC Tracing Log */}
          {results.computedVehicles.some(v => v.type === "electric") && (
            <div style={{ background: "var(--panel-alt)", padding: "14px", borderRadius: "8px", marginBottom: "24px" }}>
              <div className="kpi-label" style={{ color: "var(--bev)", fontWeight: "bold" }}>
                Sequential Battery State of Charge (SoC) Tracing details
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "10px" }}>
                {results.computedVehicles.map((v) => {
                  if (v.type !== "electric") return null;
                  return (
                    <div key={v.id} style={{ flex: 1, minWidth: "280px" }}>
                      <strong style={{ fontSize: "13px" }}>{v.name} Nodes:</strong>
                      {v.stopsLog.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
                          No charging stops required. Complete loop runs cleanly within the safe limit.
                        </div>
                      ) : (
                        <ul style={{ margin: "6px 0", paddingLeft: "16px", fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.4" }}>
                          {v.stopsLog.map((log, lIdx) => (
                            <li key={lIdx}>
                              Charge triggered at <strong>{log.stopName}</strong> (Distance: {log.distanceTraveled} km, SoC: {log.socBeforeCharge}%)
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recharts Cumulative Trend Graph */}
          <div style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "16px", textTransform: "uppercase", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
              NPV Cost Trends Over Operative Timeline ({results.years} Years)
            </h3>
            <div className="legend-row">
              {results.computedVehicles.map((v, idx) => (
                <span key={v.id}>
                  <span className="legend-dot" style={{ background: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] }} />
                  {v.name}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={results.chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="var(--text-dim)" label={{ value: "Operating Year", position: "insideBottom", offset: -5, fill: "var(--text-dim)", fontSize: 12 }} />
                <YAxis stroke="var(--text-dim)" tickFormatter={(v) => inrCompact(v)} width={80} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }} formatter={(v) => inr(v)} />
                {results.computedVehicles.map((v, idx) => (
                  <Line
                    key={v.id}
                    type="monotone"
                    dataKey={v.name}
                    stroke={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recharts Categorized Cost Category Breakdown */}
          <div style={{ marginTop: "32px" }}>
            <h3 style={{ fontSize: "16px", textTransform: "uppercase", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
              Dynamic Cost Category Comparison (Discounted NPV Breakdown)
            </h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={[
                  {
                    category: "Acquisition & Infra Setup",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.upfront }), {})
                  },
                  {
                    category: "Fuel & Power Overheads",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.fuelOrEnergy }), {})
                  },
                  {
                    category: "EMI Loans Amortization",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.emi }), {})
                  },
                  {
                    category: "Maintenance & Insurance",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.maintenance }), {})
                  },
                  {
                    category: "Staff/Driver Overheads",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.wages }), {})
                  },
                  {
                    category: "Road Tolls & Tyres",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.tolls + v.breakdown.tyres }), {})
                  },
                  {
                    category: "Energy Pack Replacements",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.batteryReplacements }), {})
                  },
                  {
                    category: "Depot Upkeep & Lease",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.infraMaintenance }), {})
                  }
                ]}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="category" stroke="var(--text-dim)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--text-dim)" tickFormatter={(v) => inrCompact(v)} width={80} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }} formatter={(v) => inr(v)} />
                <Legend />
                {results.computedVehicles.map((v, idx) => (
                  <Bar
                    key={v.id}
                    dataKey={v.name}
                    fill={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* SOH Degradation Trends Summary */}
          <div style={{ marginTop: "24px" }} className="grid-3">
            {results.computedVehicles.map((v, idx) => {
              if (v.type !== "electric") return null;
              return (
                <div key={v.id} className="kpi-card" style={{ background: "var(--panel)", borderLeft: `4px solid ${VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}` }}>
                  <div className="kpi-label">{v.name} Battery Health</div>
                  <div style={{ fontSize: "14px", marginTop: "8px" }}>
                    Period End SOH: <strong className="num" style={{ color: v.currentSOH < 80 ? "var(--diesel)" : "var(--good)" }}>{v.currentSOH.toFixed(1)}%</strong><br />
                    Degradation Replacements: <strong className="num">{v.batterySetsReplacedCount} sets</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sizing Verification Notes */}
          <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "24px", display: "flex", gap: "8px", alignItems: "flex-start", lineHeight: "1.4" }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>
              <strong>Simulation Verification Note:</strong> Cost per tonne-km is evaluated on total cargo capacity transported throughout the {results.years}-year operational timeline. Segment-level efficiencies are determined by calculating the weighted average of each road type's custom stretch percentage. Downtime parameters incorporate both scheduled/unscheduled operational delays and dynamic charging stoppages to model fleet sizing accurately.
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

// Small Component for Clean Numerical Fields
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

// Currency formatting helpers
function inr(value) {
  if (value === null || value === undefined || isNaN(value)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function inrCompact(value) {
  if (value === null || value === undefined || isNaN(value)) return "₹0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)} K`;
  return `${sign}₹${abs.toFixed(0)}`;
}