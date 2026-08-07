import React, { useState, useMemo } from "react";
import {
  Truck, Zap, Fuel, BatteryCharging, TrendingUp,
  Package, Info, RotateCcw, PlugZap,
  Plus, Trash2, MapPin, Settings, Sun, Moon, AlertTriangle, CheckCircle2,
  Sparkles, GitBranch, Route
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from "recharts";

// 1. Core Lookup Matrix for DIESEL Duty Cycle Efficiency
const DIESEL_EFFICIENCY_MATRIX = {
  "6 lane highway/Expressway": {
    "High":   { 0: 1.10, 20: 0.90, 40: 0.70, 60: 0.60 },
    "Medium": { 0: 1.21, 20: 0.97, 40: 0.74, 60: 0.62 }, // BASELINE REFERENCE
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

// 2. Core Lookup Matrix for EV Duty Cycle Efficiency (New Physics Model)
const EV_EFFICIENCY_MATRIX = {
  "6 lane highway/Expressway": {
    "High":   { 0: 1.35, 20: 1.08, 40: 0.82, 60: 0.69 },
    "Medium": { 0: 1.21, 20: 0.97, 40: 0.74, 60: 0.62 }, // MATCHING BASELINE REFERENCE
    "Low":    { 0: 1.10, 20: 0.88, 40: 0.68, 60: 0.57 }
  },
  "4 lane highway": {
    "High":   { 0: 1.40, 20: 1.12, 40: 0.85, 60: 0.72 },
    "Medium": { 0: 1.26, 20: 1.01, 40: 0.77, 60: 0.65 },
    "Low":    { 0: 1.15, 20: 0.92, 40: 0.70, 60: 0.59 }
  },
  "2 lane state highway": {
    "High":   { 0: 1.45, 20: 1.16, 40: 0.88, 60: 0.75 },
    "Medium": { 0: 1.32, 20: 1.05, 40: 0.80, 60: 0.68 },
    "Low":    { 0: 1.22, 20: 0.98, 40: 0.74, 60: 0.63 }
  },
  "City road": {
    "High":   { 0: 1.42, 20: 1.14, 40: 0.86, 60: 0.73 },
    "Medium": { 0: 1.55, 20: 1.24, 40: 0.95, 60: 0.80 },
    "Low":    { 0: 1.48, 20: 1.18, 40: 0.90, 60: 0.76 }
  },
  "Broken road": {
    "High":   { 0: 1.15, 20: 0.92, 40: 0.70, 60: 0.59 },
    "Medium": { 0: 1.20, 20: 0.96, 40: 0.73, 60: 0.61 },
    "Low":    { 0: 1.25, 20: 1.00, 40: 0.76, 60: 0.64 }
  }
};

const ROAD_TYPES = Object.keys(DIESEL_EFFICIENCY_MATRIX);
const TRAFFIC_CONDITIONS = ["High", "Medium", "Low"];

function interpolateEfficiency(roadType, traffic, payload, vehicleType = "diesel") {
  const activeMatrix = vehicleType === "electric" ? EV_EFFICIENCY_MATRIX : DIESEL_EFFICIENCY_MATRIX;
  const road = activeMatrix[roadType] || activeMatrix["6 lane highway/Expressway"];
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

function computeWeightedMultiplier(stretches, payload, vehicleType = "diesel") {
  let weightedMultiplier = 0;
  let sumStretch = 0;
  stretches.forEach((st) => {
    if (st.percentage > 0) {
      const matrixVal = interpolateEfficiency(st.roadType, st.traffic, payload, vehicleType);
      const refVal = interpolateEfficiency("6 lane highway/Expressway", "Medium", payload, vehicleType);
      const factor = refVal > 0 ? matrixVal / refVal : 1;
      weightedMultiplier += factor * (st.percentage / 100);
      sumStretch += st.percentage;
    }
  });
  const normalizeFactor = sumStretch > 0 ? 100 / sumStretch : 1;
  return weightedMultiplier * normalizeFactor;
}

const generateDefaultStretches = () => {
  const stretches = [];
  ROAD_TYPES.forEach((road) => {
    TRAFFIC_CONDITIONS.forEach((traffic) => {
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
  { id: "1", from: "A", to: "B", distance: 500, payload: 35, avgSpeed: 45, stretches: generateDefaultStretches(), hasDepotAtTo: true },
  { id: "2", from: "B", to: "C", distance: 50, payload: 0, avgSpeed: 40, stretches: generateDefaultStretches(), hasDepotAtTo: true },
  { id: "3", from: "C", to: "A", distance: 500, payload: 35, avgSpeed: 45, stretches: generateDefaultStretches(), hasDepotAtTo: true }
];

const VEHICLE_COLORS = ["#21bfa9", "#e29532", "#b16af0", "#38bdf8", "#ec4899", "#10b981"];

const INITIAL_VEHICLES = [
  {
    id: "v-diesel-1",
    name: "Standard Diesel 55T",
    type: "diesel",
    purchasePrice: 4000000,
    gstRate: 18,
    tractorWeight: 9000,
    trailerWeight: 9000,
    gvwr: 55000,
    baseUnloadedEconomy: 4, 
    baseLoadedEconomy: 3, 
    fuelOrElectricPrice: 96,
    maintCostPerKm: 2.5,
    insuranceRatePct: 1.5,
    residualPct: 10,
    financing: "emi",
    downPaymentPct: 20,
    interestRate: 10,
    loanTenure: 7,
    driverSalaryMonthly: 45000,
    tollCostPerTrip: 3500,
    tyresFront: 2, tyreCostFront: 21000, tyreLifeFront: 45000,
    tyresRear: 4, tyreCostRear: 22000, tyreLifeRear: 50000,
    tyresTrailer: 12, tyreCostTrailer: 22000, tyreLifeTrailer: 60000,
    utilizationPct: 40, 
    scheduledDowntimeDays: 12,
    unscheduledDowntimeHrs: 48,
    miscCostPerMonth: 50000,
    miscCostNotes: "Chai/Paani",
  },
  {
    id: "v-bev-1",
    name: "Electric BEV 55T",
    type: "electric",
    purchasePrice: 10000000,
    gstRate: 5,
    tractorWeight: 11000,
    trailerWeight: 9000,
    gvwr: 55000,
    baseUnloadedEconomy: 0.7, 
    baseLoadedEconomy: 0.4,  
    batteryCapacity: 282,
    batteryReplacementCost: 4000000,
    batteryDegradationPerCycle: 0.004,
    batterySOHThreshold: 75,
    maintCostPerKm: 2.5,
    insuranceRatePct: 1.5,
    residualPct: 8,
    financing: "emi",
    downPaymentPct: 20,
    interestRate: 10.0,
    loanTenure: 10,
    driverSalaryMonthly: 45000,
    tollCostPerTrip: 3500,
    tyresFront: 2, tyreCostFront: 21000, tyreLifeFront: 45000,
    tyresRear: 4, tyreCostRear: 22000, tyreLifeRear: 50000,
    tyresTrailer: 12, tyreCostTrailer: 22000, tyreLifeTrailer: 65000,
    scheduledDowntimeDays: 12,
    unscheduledDowntimeHrs: 80,
    safeSoCThreshold: 15,
    stationCost: 5000000,
    stationMaintenance: 120000,
    chargerCost: 1500000,
    chargerMaintenance: 50000,
    infrastructureTaxCredit: 0,
    chargeSpeedKW: 200, 
    chargingTimeMarginPct: 200, 
    electricityRate: 5,
    depotLandLeaseMonthly: 120000,
    depotDemandChargesMonthly: 80000,
    useDynamicSOHLimit: true,
    miscCostPerMonth: 50000,
    miscCostNotes: "Chai/Paani",
  }
];

// ---------------------------------------------------------------------------
// CORE PER-VEHICLE ENGINE
// Extracted into a standalone pure function so it can be reused both by the
// main comparison run AND by the charging-network optimizer (which needs to
// re-run this same math dozens/hundreds of times against candidate route
// configurations without touching component state).
// ---------------------------------------------------------------------------
function computeVehicleMetrics(v, routeSegments, cfg) {
  const {
    years, dfRate, escGen, escF, escE, escW, escI,
    monthlyCargoVolume, workingDaysPerMonth, dailyOperatingLimitHrs, loadingUnloadingTimePerTrip
  } = cfg;

  const payloadCap = Math.max(0, v.gvwr - v.tractorWeight - v.trailerWeight) / 1000;
  let tripMaxPayload = 0;
  let totalTripDistance = 0;
  let totalTripDrivingHrs = 0;
  let weightedEnergyNeeded = 0;

  const segmentOverloads = [];
  const segmentEconomies = [];

  routeSegments.forEach((seg, idx) => {
    totalTripDistance += seg.distance;
    totalTripDrivingHrs += seg.distance / Math.max(1, seg.avgSpeed);
    if (seg.payload > tripMaxPayload) tripMaxPayload = seg.payload;
    if (seg.payload > payloadCap) segmentOverloads.push({ segmentIdx: idx + 1, payload: seg.payload, cap: payloadCap });

    const cappedPayload = Math.min(seg.payload, payloadCap);
    const payloadRatio = payloadCap > 0 ? cappedPayload / payloadCap : 0;

    const baseEconomy = v.baseUnloadedEconomy - (v.baseUnloadedEconomy - v.baseLoadedEconomy) * payloadRatio;
    const segWeightedMultiplier = computeWeightedMultiplier(seg.stretches, cappedPayload, v.type);
    const segVehicleEconomy = baseEconomy * segWeightedMultiplier;

    segmentEconomies.push(segVehicleEconomy);
    weightedEnergyNeeded += seg.distance / Math.max(0.01, segVehicleEconomy);
  });

  const avgRouteEconomy = weightedEnergyNeeded > 0 ? totalTripDistance / weightedEnergyNeeded : 1.0;

  let stopsLog = [];
  let uniqueChargingStopsMap = {};
  let criticalSOHLimit = 20.0;
  let maxEnergyLegKWh = 0;
  let chargingDowntimeHrs = 0;

  if (v.type === "electric" && v.batteryCapacity > 0) {
    let currentSoC = 100;
    let cumulativeDistance = 0;
    let currentEnergySinceCharge = 0;
    let previousChargeKm = 0;
    let lastChargedFromSoC = 100;

    const designSOHLimit = v.batterySOHThreshold || 75;
    const plannedEffectiveCapacity = v.batteryCapacity * (designSOHLimit / 100);

    const recordChargeStop = (label, km, socBefore, chargeToSoC, isDepot) => {
      const energyReplenishedKWh = Math.max(0, ((chargeToSoC - socBefore) / 100) * plannedEffectiveCapacity);
      const baseChargeTimeHrs = energyReplenishedKWh / Math.max(1, v.chargeSpeedKW || 150);
      const finalChargeTimeHrs = baseChargeTimeHrs * (1 + ((v.chargingTimeMarginPct || 0) / 100));

      chargingDowntimeHrs += finalChargeTimeHrs;

      stopsLog.push({
        label,
        km: Math.round(km),
        socBefore: socBefore.toFixed(1),
        socAfter: chargeToSoC,
        isDepot,
        energyLegConsumed: currentEnergySinceCharge,
        startSoCWindow: lastChargedFromSoC,
        chargeTimeHrs: finalChargeTimeHrs
      });

      const uniqueKey = `${label}_${Math.round(km)}`;
      if (!uniqueChargingStopsMap[uniqueKey]) {
        uniqueChargingStopsMap[uniqueKey] = {
          label,
          km: Math.round(km),
          isDepot,
          chargesPerLoop: 0,
          timePerChargeHrs: finalChargeTimeHrs
        };
      }
      uniqueChargingStopsMap[uniqueKey].chargesPerLoop += 1;
      uniqueChargingStopsMap[uniqueKey].timePerChargeHrs = Math.max(uniqueChargingStopsMap[uniqueKey].timePerChargeHrs, finalChargeTimeHrs);

      if (currentEnergySinceCharge > maxEnergyLegKWh) maxEnergyLegKWh = currentEnergySinceCharge;

      const usableSoCWindow = (lastChargedFromSoC - v.safeSoCThreshold) / 100;
      const reqSOHPercent = (currentEnergySinceCharge / (v.batteryCapacity * usableSoCWindow)) * 100;
      if (reqSOHPercent > criticalSOHLimit) criticalSOHLimit = Math.min(100, Math.max(criticalSOHLimit, reqSOHPercent));

      currentEnergySinceCharge = 0;
      previousChargeKm = km;
      lastChargedFromSoC = chargeToSoC;
    };

    routeSegments.forEach((seg, idx) => {
      const segVehicleEconomy = segmentEconomies[idx];
      const safeEconomy = Math.max(0.01, segVehicleEconomy);
      const safeCapacity = Math.max(1, plannedEffectiveCapacity);
      const socPctPerKm = 100 / (safeEconomy * safeCapacity);

      let remainingSegDistance = seg.distance;
      let distanceIntoSegment = 0;

      while (remainingSegDistance > 0.001) {
        const availableSoC = currentSoC - v.safeSoCThreshold;
        const maxDistanceBeforeCharge = socPctPerKm > 0 ? Math.max(0, availableSoC / socPctPerKm) : remainingSegDistance;

        if (maxDistanceBeforeCharge >= remainingSegDistance) {
          const energyConsumed = remainingSegDistance / safeEconomy;
          currentEnergySinceCharge += energyConsumed;
          currentSoC -= remainingSegDistance * socPctPerKm;
          cumulativeDistance += remainingSegDistance;
          distanceIntoSegment += remainingSegDistance;
          remainingSegDistance = 0;
        } else {
          const travelDist = maxDistanceBeforeCharge;

          if (travelDist <= 0.0001) { remainingSegDistance = 0; break; }

          const energyConsumed = travelDist / safeEconomy;
          currentEnergySinceCharge += energyConsumed;
          currentSoC -= travelDist * socPctPerKm;
          cumulativeDistance += travelDist;
          distanceIntoSegment += travelDist;
          remainingSegDistance -= travelDist;

          recordChargeStop(`Mid-Segment Fast Charger (${seg.from} \u2192 ${seg.to})`, cumulativeDistance, currentSoC, 100, false);
          currentSoC = 100;
        }
      }
      if (seg.hasDepotAtTo) {
        recordChargeStop(`Terminal Depot (${seg.to})`, cumulativeDistance, currentSoC, 100, true);
        currentSoC = 100;
      }
    });

    if (currentEnergySinceCharge > 0) recordChargeStop(`Home Base Depot Terminal`, cumulativeDistance, currentSoC, 100, true);
  }

  let dieselRestDowntimeHrs = 0;
  if (v.type === "diesel") {
    const safeUtil = Math.max(1, Math.min(100, v.utilizationPct || 100));
    dieselRestDowntimeHrs = (totalTripDrivingHrs / (safeUtil / 100)) - totalTripDrivingHrs;
  }

  const resolvedSOHReplacementLimit = (v.type === "electric" && v.useDynamicSOHLimit)
    ? Math.min(95, Math.max(v.batterySOHThreshold, criticalSOHLimit))
    : (v.batterySOHThreshold || 75);

  const chargingStopsCount = stopsLog.length;
  const totalAnnualFixedDowntimeHrs = (v.scheduledDowntimeDays * 24) + v.unscheduledDowntimeHrs;
  const fullTurnaroundCycleHrs = totalTripDrivingHrs + loadingUnloadingTimePerTrip + chargingDowntimeHrs + dieselRestDowntimeHrs;

  // Utilization %: share of the full trip turnaround that is actually spent
  // driving (as opposed to loading/unloading, charging, or resting). This is
  // an INPUT for diesel vehicles, but for EVs it's a downstream result of the
  // charging cadence, so it's computed here from the simulated cycle.
  const utilizationPctComputed = fullTurnaroundCycleHrs > 0
    ? (totalTripDrivingHrs / fullTurnaroundCycleHrs) * 100
    : 0;

  const totalOperatingHoursAvailableYear = (workingDaysPerMonth * 12 * dailyOperatingLimitHrs) - totalAnnualFixedDowntimeHrs;
  const tripsPerYearPerVehicle = fullTurnaroundCycleHrs > 0 ? totalOperatingHoursAvailableYear / fullTurnaroundCycleHrs : 0;

  const annualCargoThroughputPerVehicle = tripsPerYearPerVehicle * Math.min(tripMaxPayload, payloadCap);
  const fleetSizeRequired = Math.max(1, Math.ceil((monthlyCargoVolume * 12) / Math.max(1, annualCargoThroughputPerVehicle)));

  const totalTripsAcrossFleetYear = tripsPerYearPerVehicle * fleetSizeRequired;
  const totalDistanceAcrossFleetYear = totalTripsAcrossFleetYear * totalTripDistance;

  let uniqueStationsCount = 0;
  let totalChargersNeeded = 0;
  let capitalSetupInfra = 0;
  let uniqueStationsList = [];

  if (v.type === "electric") {
    const STATION_DAILY_UPTIME_HRS = 22;
    const dailyLoopsAcrossFleet = totalTripsAcrossFleetYear / (workingDaysPerMonth * 12);

    Object.keys(uniqueChargingStopsMap).forEach((key) => {
      const rawStop = uniqueChargingStopsMap[key];
      const chargeSlotsPerDayPerCharger = STATION_DAILY_UPTIME_HRS / Math.max(0.1, rawStop.timePerChargeHrs);
      const dailyChargesAtThisLocation = dailyLoopsAcrossFleet * rawStop.chargesPerLoop;
      const chargersSized = Math.max(1, Math.ceil(dailyChargesAtThisLocation / chargeSlotsPerDayPerCharger));

      uniqueStationsCount += 1;
      totalChargersNeeded += chargersSized;

      uniqueStationsList.push({
        ...rawStop, chargersSized, stationSetupCost: v.stationCost, chargersCostSum: chargersSized * v.chargerCost
      });

      capitalSetupInfra += (v.stationCost + (chargersSized * v.chargerCost)) * (1 - v.infrastructureTaxCredit / 100);
    });
  }

  const totalUpfrontGSTPrice = v.purchasePrice * (1 + v.gstRate / 100);
  let loanUpfrontDownpayment = totalUpfrontGSTPrice;
  let loanAnnualEMI = 0;

  if (v.financing === "emi" && v.loanTenure > 0) {
    loanUpfrontDownpayment = totalUpfrontGSTPrice * (v.downPaymentPct / 100);
    const principalDebt = Math.max(0, totalUpfrontGSTPrice - loanUpfrontDownpayment);
    const monthlyRate = v.interestRate / 1200;
    const totalMonths = v.loanTenure * 12;
    loanAnnualEMI = (monthlyRate > 0 ? (principalDebt * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1) : principalDebt / totalMonths) * 12;
  }

  let npvTCOSum = (loanUpfrontDownpayment * fleetSizeRequired) + capitalSetupInfra;
  let cumCostTimeline = [npvTCOSum];

  const breakdown = { upfront: npvTCOSum, fuelOrEnergy: 0, emi: 0, maintenance: 0, wages: 0, tolls: 0, tyres: 0, batteryReplacements: 0, infraMaintenance: 0, misc: 0, residuals: 0 };

  let currentSOH = 100;
  let mileageSinceLastReplacement = 0;
  let batterySetsReplacedCount = 0;
  let batteryReplacementLog = [];
  let sohTimeline = [];

  for (let t = 1; t <= years; t++) {
    const df = 1 / Math.pow(1 + dfRate, t);
    const multGen = Math.pow(1 + escGen, t - 1);
    const multF = Math.pow(1 + escF, t - 1);
    const multE = Math.pow(1 + escE, t - 1);
    const multW = Math.pow(1 + escW, t - 1);
    const multI = Math.pow(1 + escI, t - 1);

    const yearEMI = (v.financing === "emi" && t <= v.loanTenure) ? loanAnnualEMI * fleetSizeRequired : 0;
    const yearFuelOrEnergy = (totalDistanceAcrossFleetYear / avgRouteEconomy) * (v.type === "diesel" ? (v.fuelOrElectricPrice * multF) : (v.electricityRate * multE));

    const yearMaint = totalDistanceAcrossFleetYear * v.maintCostPerKm * multGen;
    const yearIns = totalUpfrontGSTPrice * (v.insuranceRatePct / 100) * multGen * fleetSizeRequired;
    const yearWages = v.driverSalaryMonthly * 12 * multW * fleetSizeRequired;
    const yearTolls = v.tollCostPerTrip * totalTripsAcrossFleetYear * multGen;
    const yearMisc = (v.miscCostPerMonth || 0) * 12 * multGen * fleetSizeRequired;

    const yearTyres = totalDistanceAcrossFleetYear * (
      (v.tyresFront * v.tyreCostFront / Math.max(1, v.tyreLifeFront)) +
      (v.tyresRear * v.tyreCostRear / Math.max(1, v.tyreLifeRear)) +
      (v.tyresTrailer * v.tyreCostTrailer / Math.max(1, v.tyreLifeTrailer))
    ) * multGen;

    let yearBatteryCost = 0;
    if (v.type === "electric") {
      const annualMileagePerVehicle = totalDistanceAcrossFleetYear / fleetSizeRequired;
      const rangePerCharge = (v.batteryCapacity * (100 - v.safeSoCThreshold) / 100) * avgRouteEconomy;
      const cyclesToFailure = (100 - resolvedSOHReplacementLimit) / v.batteryDegradationPerCycle;
      const lifespanKm = cyclesToFailure * rangePerCharge;

      let availableMileage = annualMileagePerVehicle;
      while (availableMileage > 0) {
        let mileageToLimit = lifespanKm - mileageSinceLastReplacement;
        if (availableMileage >= mileageToLimit) {
          yearBatteryCost += v.batteryReplacementCost * fleetSizeRequired * multGen;
          batterySetsReplacedCount += fleetSizeRequired;
          batteryReplacementLog.push({
            year: t, sohAtReplacement: resolvedSOHReplacementLimit, cycles: Math.round(cyclesToFailure), mileageSinceLastReplacement: Math.round(lifespanKm),
          });
          availableMileage -= mileageToLimit;
          mileageSinceLastReplacement = 0;
        } else {
          mileageSinceLastReplacement += availableMileage;
          availableMileage = 0;
        }
      }
      currentSOH = 100 - (mileageSinceLastReplacement / lifespanKm) * (100 - resolvedSOHReplacementLimit);
      sohTimeline.push({ year: t, soh: Math.round(currentSOH * 10) / 10 });
    }

    let yearInfraOverhead = 0;
    if (v.type === "electric") {
      yearInfraOverhead = ((uniqueStationsCount * v.stationMaintenance) + (totalChargersNeeded * v.chargerMaintenance) + ((v.depotDemandChargesMonthly + v.depotLandLeaseMonthly) * 12)) * multI;
    }

    const totalYearlyExpenses = yearEMI + yearFuelOrEnergy + yearMaint + yearIns + yearWages + yearTolls + yearTyres + yearBatteryCost + yearInfraOverhead + yearMisc;
    npvTCOSum += totalYearlyExpenses * df;
    cumCostTimeline.push(cumCostTimeline[cumCostTimeline.length - 1] + totalYearlyExpenses);

    breakdown.fuelOrEnergy += yearFuelOrEnergy * df;
    breakdown.emi += yearEMI * df;
    breakdown.maintenance += (yearMaint + yearIns) * df;
    breakdown.wages += yearWages * df;
    breakdown.tolls += yearTolls * df;
    breakdown.tyres += yearTyres * df;
    breakdown.batteryReplacements += yearBatteryCost * df;
    breakdown.infraMaintenance += yearInfraOverhead * df;
    breakdown.misc += yearMisc * df;
  }

  const npvResidualValue = v.purchasePrice * (v.residualPct / 100) * fleetSizeRequired * (1 / Math.pow(1 + dfRate, years));
  npvTCOSum -= npvResidualValue;
  cumCostTimeline[years] -= v.purchasePrice * (v.residualPct / 100) * fleetSizeRequired;
  breakdown.residuals = -npvResidualValue;

  const totalCargoTonneKmFleet = (annualCargoThroughputPerVehicle * fleetSizeRequired) * years * totalTripDistance;
  const costPerTonneKm = totalCargoTonneKmFleet > 0 ? npvTCOSum / totalCargoTonneKmFleet : 0;

  const maxTheoreticalRange = v.type === "electric" ? v.batteryCapacity * avgRouteEconomy : 0;
  const operationalRangeAtStart = v.type === "electric" ? v.batteryCapacity * ((100 - v.safeSoCThreshold) / 100) * avgRouteEconomy : 0;
  const operationalRangeAtSOHLimit = v.type === "electric" ? operationalRangeAtStart * (resolvedSOHReplacementLimit / 100) : 0;

  // Per-segment operating cost / tonne-km (fuel-or-energy + maintenance + tyres,
  // i.e. the costs that actually scale with a specific leg of the route).
  // Capital, financing, insurance, wages and infra costs are fleet-level and
  // are NOT attributable to one segment, so they're excluded here and shown
  // separately in the lifetime total (v.costPerTonneKm above).
  const tyreCostPerKmFlat = (v.tyresFront * v.tyreCostFront / Math.max(1, v.tyreLifeFront)) +
    (v.tyresRear * v.tyreCostRear / Math.max(1, v.tyreLifeRear)) +
    (v.tyresTrailer * v.tyreCostTrailer / Math.max(1, v.tyreLifeTrailer));

  const segmentCostPerTonneKm = routeSegments.map((seg, idx) => {
    const segEconomy = Math.max(0.01, segmentEconomies[idx]);
    const fuelPricePerUnit = v.type === "diesel" ? v.fuelOrElectricPrice : v.electricityRate;
    const fuelCostPerKm = fuelPricePerUnit / segEconomy;
    const operatingCostPerKm = fuelCostPerKm + v.maintCostPerKm + tyreCostPerKmFlat;
    const cappedPayload = Math.min(seg.payload, payloadCap);
    const costPerTonneKmSeg = cappedPayload > 0 ? operatingCostPerKm / cappedPayload : null;
    return {
      from: seg.from, to: seg.to, distance: seg.distance, payload: cappedPayload,
      operatingCostPerKm, costPerTonneKmSeg
    };
  });

  return {
    ...v,
    payloadCap,
    avgRouteEconomy,
    chargingStopsCount,
    chargingDowntimeHrs,
    dieselRestDowntimeHrs,
    utilizationPctComputed,
    stopsLog,
    uniqueStationsList,
    turnaroundCycleHrs: fullTurnaroundCycleHrs,
    fleetSizeRequired,
    tripsPerYearPerVehicle,
    totalTripsAcrossFleetYear,
    totalDistanceAcrossFleetYear,
    totalChargersNeeded,
    uniqueStationsCount,
    npvTCOSum,
    cumCostTimeline,
    breakdown,
    costPerTonneKm,
    segmentCostPerTonneKm,
    currentSOH,
    criticalSOHLimit,
    resolvedSOHReplacementLimit,
    batterySetsReplacedCount,
    batteryReplacementLog,
    sohTimeline,
    segmentOverloads,
    maxTheoreticalRange,
    operationalRangeAtStart,
    operationalRangeAtSOHLimit,
    replacementsPerVehicle: batteryReplacementLog.length
  };
}

// Brute-force search over depot-charger placement (the "hasDepotAtTo" flag
// on each route segment) to find the combination that minimizes NPV TCO for
// a given EV. The road/traffic mix and distances are treated as fixed
// (they describe the real route); the decision variable is only WHERE to
// site terminal depot chargers, since that's what actually drives infra
// capex/opex trade-offs. Capped at 12 segments (4096 combos) to stay fast.
function findOptimalChargingNetwork(v, routeSegments, cfg) {
  const n = routeSegments.length;
  if (v.type !== "electric" || n === 0 || n > 12) return null;

  let best = null;
  const totalCombos = 1 << n;
  for (let mask = 0; mask < totalCombos; mask++) {
    const candidateSegments = routeSegments.map((s, i) => ({ ...s, hasDepotAtTo: !!(mask & (1 << i)) }));
    const metrics = computeVehicleMetrics(v, candidateSegments, cfg);
    if (!best || metrics.npvTCOSum < best.npvTCOSum) {
      best = {
        npvTCOSum: metrics.npvTCOSum,
        depotFlags: candidateSegments.map((s) => s.hasDepotAtTo),
        uniqueStationsCount: metrics.uniqueStationsCount,
        totalChargersNeeded: metrics.totalChargersNeeded,
        chargingStopsCount: metrics.chargingStopsCount
      };
    }
  }
  return best;
}

function computeBreakeven(chartData, nameA, nameB) {
  if (!nameA || !nameB) return null;
  for (let i = 1; i < chartData.length; i++) {
    const prevDiff = chartData[i - 1][nameA] - chartData[i - 1][nameB];
    const currDiff = chartData[i][nameA] - chartData[i][nameB];
    if (prevDiff === 0) return chartData[i - 1].year;
    if ((prevDiff > 0) !== (currDiff > 0)) {
      const frac = prevDiff / (prevDiff - currDiff);
      return chartData[i - 1].year + frac;
    }
  }
  return null;
}

export default function ComprehensiveTCOCalculator() {
  const [darkMode, setDarkMode] = useState(true);
  const [monthlyCargoVolume, setMonthlyCargoVolume] = useState(85000);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(24);
  const [dailyOperatingLimitHrs, setDailyOperatingLimitHrs] = useState(16);
  const [loadingUnloadingTimePerTrip, setLoadingUnloadingTimePerTrip] = useState(5);

  const [analysisPeriod, setAnalysisPeriod] = useState(10);
  const [discountRate, setDiscountRate] = useState(7);

  const [escGeneral, setEscGeneral] = useState(4.0);
  const [escFuel, setEscFuel] = useState(5.0);
  const [escElectricity, setEscElectricity] = useState(3.0);
  const [escWages, setEscWages] = useState(6.0);
  const [escInfrastructure, setEscInfrastructure] = useState(4.0);

  const [routeSegments, setRouteSegments] = useState(DEFAULT_ROUTE);
  const [expandedSegmentId, setExpandedSegmentId] = useState(null);
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);

  const [optimizerResults, setOptimizerResults] = useState({});
  const [optimizerRunning, setOptimizerRunning] = useState(null);

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
      baseUnloadedEconomy: type === "diesel" ? 5.0 : 1.3,
      baseLoadedEconomy: type === "diesel" ? 3.2 : 0.75,
      maintCostPerKm: type === "diesel" ? 3.6 : 2.4,
      insuranceRatePct: 2.5,
      residualPct: type === "diesel" ? 12 : 10,
      financing: "emi",
      downPaymentPct: 15,
      interestRate: 9.5,
      loanTenure: 7,
      driverSalaryMonthly: 35000,
      tollCostPerTrip: 3500,
      tyresFront: 2, tyreCostFront: 21000, tyreLifeFront: 100000,
      tyresRear: 4, tyreCostRear: 22000, tyreLifeRear: 90000,
      tyresTrailer: 12, tyreCostTrailer: 22000, tyreLifeTrailer: 80000,
      scheduledDowntimeDays: 12,
      unscheduledDowntimeHrs: 120,
      miscCostPerMonth: 50000,
      miscCostNotes: "Chai/Paani",
    };

    if (type === "diesel") {
      baseDefault.fuelOrElectricPrice = 94;
      baseDefault.utilizationPct = 85;
    } else {
      baseDefault.batteryCapacity = 500;
      baseDefault.batteryReplacementCost = 3800000;
      baseDefault.batteryDegradationPerCycle = 0.004;
      baseDefault.batterySOHThreshold = 75;
      baseDefault.safeSoCThreshold = 20;
      baseDefault.stationCost = 3500000;
      baseDefault.stationMaintenance = 120000;
      baseDefault.chargerCost = 1500000;
      baseDefault.chargerMaintenance = 50000;
      baseDefault.infrastructureTaxCredit = 5;
      baseDefault.chargeSpeedKW = 150;
      baseDefault.chargingTimeMarginPct = 200;
      baseDefault.electricityRate = 8.5;
      baseDefault.depotLandLeaseMonthly = 120000;
      baseDefault.depotDemandChargesMonthly = 80000;
      baseDefault.useDynamicSOHLimit = true;
    }

    setVehicles([...vehicles, baseDefault]);
  };

  const handleRemoveVehicle = (id) => {
    if (vehicles.length <= 1) return;
    setVehicles(vehicles.filter((v) => v.id !== id));
  };

  const updateVehicleProp = (id, prop, val) => {
    setVehicles(vehicles.map((v) => (v.id === id ? { ...v, [prop]: val } : v)));
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
      hasDepotAtTo: false
    };
    setRouteSegments([...routeSegments, newSeg]);
  };

  const handleRemoveSegment = (id) => {
    if (routeSegments.length <= 1) return;
    setRouteSegments(routeSegments.filter((s) => s.id !== id));
  };

  const updateSegmentProp = (segId, prop, val) => {
    setRouteSegments(routeSegments.map((s) => (s.id === segId ? { ...s, [prop]: val } : s)));
  };

  const updateStretchPercentage = (segId, roadType, traffic, val) => {
    setRouteSegments(
      routeSegments.map((seg) => {
        if (seg.id !== segId) return seg;
        const updated = seg.stretches.map((st) => {
          if (st.roadType === roadType && st.traffic === traffic) return { ...st, percentage: val };
          return st;
        });
        return { ...seg, stretches: updated };
      })
    );
  };

  const results = useMemo(() => {
    const years = Math.max(1, Math.round(analysisPeriod));
    const cfg = {
      years,
      dfRate: discountRate / 100,
      escGen: escGeneral / 100,
      escF: escFuel / 100,
      escE: escElectricity / 100,
      escW: escWages / 100,
      escI: escInfrastructure / 100,
      monthlyCargoVolume, workingDaysPerMonth, dailyOperatingLimitHrs, loadingUnloadingTimePerTrip
    };

    const computedVehicles = vehicles.map((v) => computeVehicleMetrics(v, routeSegments, cfg));

    const chartData = [{ year: 0 }];
    computedVehicles.forEach((v) => { chartData[0][v.name] = v.cumCostTimeline[0]; });

    for (let t = 1; t <= years; t++) {
      const row = { year: t };
      computedVehicles.forEach((v) => { row[v.name] = v.cumCostTimeline[t]; });
      chartData.push(row);
    }

    // Breakeven: compare the cheapest-upfront diesel vs cheapest-upfront EV,
    // if both types are present in the current fleet mix.
    const firstDiesel = computedVehicles.find((v) => v.type === "diesel");
    const firstElectric = computedVehicles.find((v) => v.type === "electric");
    const breakevenYear = (firstDiesel && firstElectric)
      ? computeBreakeven(chartData, firstDiesel.name, firstElectric.name)
      : null;

    return { years, computedVehicles, chartData, cfg, firstDiesel, firstElectric, breakevenYear };
  }, [ vehicles, routeSegments, monthlyCargoVolume, workingDaysPerMonth, dailyOperatingLimitHrs, loadingUnloadingTimePerTrip, analysisPeriod, discountRate, escGeneral, escFuel, escElectricity, escWages, escInfrastructure ]);

  const handleRunOptimizer = (vehicleId) => {
    const v = vehicles.find((vv) => vv.id === vehicleId);
    if (!v) return;
    setOptimizerRunning(vehicleId);
    // Runs synchronously - route segment counts are small enough that this
    // completes near-instantly, but we still show a running state for clarity.
    const best = findOptimalChargingNetwork(v, routeSegments, results.cfg);
    setOptimizerResults((prev) => ({ ...prev, [vehicleId]: best }));
    setOptimizerRunning(null);
  };

  const handleApplyOptimalNetwork = (vehicleId) => {
    const best = optimizerResults[vehicleId];
    if (!best) return;
    setRouteSegments(routeSegments.map((s, i) => ({ ...s, hasDepotAtTo: best.depotFlags[i] })));
  };

  return (
    <div className={`wrap ${darkMode ? "dark-theme" : "light-theme"}`}>
      <style>{`
        .wrap {
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          --shadow-glow: 0 0 15px rgba(33, 196, 175, 0.15);
          background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif;
          padding: 24px; border-radius: 12px; min-height: 100vh; max-width: 1400px; margin: 0 auto; box-sizing: border-box;
          transition: all 0.2s ease-in-out; -webkit-font-smoothing: antialiased;
        }
        .wrap * { box-sizing: border-box; }
        .wrap.dark-theme { --bg: #090b0c; --panel: #131719; --panel-alt: #1a2022; --border: #262f32; --text: #f3f4f6; --text-dim: #9ca3af; --bev: #21bfa9; --diesel: #e29532; --good: #10b981; --bad: #ef4444; --input-bg: #0d0f10; }
        .wrap.light-theme { --bg: #f9fafb; --panel: #ffffff; --panel-alt: #f3f4f6; --border: #e5e7eb; --text: #111827; --text-dim: #6b7280; --bev: #129382; --diesel: #be7a21; --good: #059669; --bad: #dc2626; --input-bg: #f9fafb; }
        h1, h2, h3, .display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.02em; }
        .num { font-family: 'JetBrains Mono', monospace; font-weight: 500; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1.5px solid var(--border); padding-bottom: 16px; flex-wrap: wrap; gap: 16px; }
        .header h1 { font-size: 26px; font-weight: 700; margin: 0; text-transform: uppercase; }
        .theme-btn, .reset-btn, .add-btn { display: flex; align-items: center; gap: 6px; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; box-shadow: var(--shadow-sm); transition: all 0.15s ease-in-out; }
        .theme-btn:hover, .reset-btn:hover, .add-btn:hover { border-color: var(--bev); background: var(--panel-alt); }
        .theme-btn:disabled, .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-md); margin-bottom: 24px; }
        .panel h2 { font-size: 18px; margin: 0 0 20px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        @media(max-width: 900px) { .grid-3, .grid-2 { grid-template-columns: 1fr; } }
        .field { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .field-label { font-size: 13px; color: var(--text-dim); flex: 1; }
        .field-input { display: flex; align-items: center; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; transition: border-color 0.15s ease-in-out; }
        .field-input:focus-within { border-color: var(--bev); }
        .field-input input { width: 100px; background: transparent; border: none; color: var(--text); padding: 8px 10px; font-family: 'JetBrains Mono', monospace; font-size: 13px; text-align: right; }
        .field-input input:focus { outline: none; }
        .field-suffix { font-size: 11px; color: var(--text-dim); padding-right: 10px; font-weight: 500; }
        .compact-input { background: var(--input-bg); border: 1px solid var(--border); color: var(--text); padding: 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-align: right; width: 100%; transition: 0.15s; }
        .compact-input:focus { border-color: var(--bev); outline: none; }
        .route-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
        .route-table th { background: var(--panel-alt); padding: 12px; color: var(--text-dim); border-bottom: 2px solid var(--border); text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
        .route-table td { padding: 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .route-table input, .route-table select { background: var(--input-bg); border: 1px solid var(--border); color: var(--text); padding: 8px; border-radius: 6px; font-size: 13px; }
        .route-table input[type="text"] { width: 100%; }
        .route-table input[type="number"] { width: 85px; text-align: right; }
        .expand-btn { background: transparent; border: 1px solid var(--border); color: var(--bev); padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; }
        .expand-btn:hover { background: rgba(33, 196, 175, 0.05); border-color: var(--bev); }
        .stretch-drawer { background: var(--panel-alt); border: 1px dashed var(--border); border-radius: 10px; padding: 16px; margin-top: 8px; }
        .stretch-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-top: 12px; }
        @media(max-width: 1024px) { .stretch-grid { grid-template-columns: repeat(2, 1fr); } }
        .stretch-card { background: var(--panel); border: 1px solid var(--border); padding: 12px; border-radius: 8px; }
        .vehicle-deck { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 20px; margin-top: 16px; }
        .vehicle-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-md); transition: border-color 0.2s ease-in-out; }
        .vehicle-card.active-electric { border-top: 4px solid var(--bev); }
        .vehicle-card.active-diesel { border-top: 4px solid var(--diesel); }
        .vcard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .vcard-title { font-size: 18px; font-weight: 700; text-transform: uppercase; }
        .seg { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--input-bg); }
        .seg button { flex: 1; background: transparent; color: var(--text-dim); border: none; padding: 8px 12px; font-size: 12px; font-weight: 500; cursor: pointer; }
        .seg button.active { background: var(--bev); color: #0c0e0f; font-weight: 600; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .kpi-card { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 10px; padding: 16px; box-shadow: var(--shadow-sm); }
        .kpi-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; letter-spacing: 0.05em; font-weight: 600; }
        .kpi-val { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
        .kpi-sub { font-size: 12px; color: var(--text-dim); margin-top: 4px; line-height: 1.5; }
        .alert-strip { background: rgba(239, 68, 68, 0.08); border: 1px solid var(--bad); color: var(--text); border-radius: 8px; padding: 14px; font-size: 13px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 10px; line-height: 1.4; }
        .breakeven-strip { background: rgba(33, 196, 175, 0.08); border: 1px solid var(--bev); color: var(--text); border-radius: 8px; padding: 16px 18px; font-size: 13px; margin-bottom: 24px; display: flex; align-items: center; gap: 14px; line-height: 1.4; }
        .section-tag { font-size: 11px; font-weight: 700; color: var(--bev); text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 10px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
        .legend-row { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: var(--text-dim); margin-bottom: 12px; }
        .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .badge-good { background: rgba(16, 185, 129, 0.1); color: var(--good); border: 1px solid rgba(16, 185, 129, 0.2); }
        .badge-warn { background: rgba(226, 149, 50, 0.1); color: var(--diesel); border: 1px solid rgba(226, 149, 50, 0.2); }
        .badge-info { background: rgba(33, 196, 175, 0.1); color: var(--bev); border: 1px solid rgba(33, 196, 175, 0.2); }
        .optimizer-box { background: var(--panel-alt); border: 1px dashed var(--bev); border-radius: 10px; padding: 14px; margin-top: 12px; }
        .optimizer-result { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-top: 10px; font-size: 12px; }
        .mini-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--bev); color: #0c0e0f; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
        .mini-btn:hover { opacity: 0.9; }
        .mini-btn-outline { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--bev); border: 1px solid var(--bev); padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
        .seg-cost-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .seg-cost-table th { text-align: right; padding: 8px 10px; color: var(--text-dim); font-size: 10.5px; text-transform: uppercase; border-bottom: 2px solid var(--border); }
        .seg-cost-table th:first-child { text-align: left; }
        .seg-cost-table td { text-align: right; padding: 8px 10px; border-bottom: 1px solid var(--border); }
        .seg-cost-table td:first-child { text-align: left; color: var(--text-dim); }
      `}</style>

      {/* Header controls */}
      <div className="header">
        <div>
          <h1>
            <Truck size={26} style={{ display: "inline", verticalAlign: "-4px", marginRight: 10, color: "var(--bev)" }} />
            Logistics & Duty Cycle TCO Simulator
          </h1>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="theme-btn" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="reset-btn" onClick={() => {
            setRouteSegments(DEFAULT_ROUTE);
            setVehicles(INITIAL_VEHICLES);
            setOptimizerResults({});
          }}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* SECTION 1: Logistics Sizing */}
        <div className="panel">
          <h2><Package size={18} color="var(--bev)" /> 1. Logistics Sizing</h2>
          <div className="grid-2">
            <div>
              <Field label="Monthly Cargo Volume Goal" value={monthlyCargoVolume} onChange={setMonthlyCargoVolume} suffix="Tonnes" step={100} />
              <Field label="Operational Working Days" value={workingDaysPerMonth} onChange={setWorkingDaysPerMonth} suffix="Days/Month" step={1} />
            </div>
            <div>
              <Field label="Operating Hours Limit/Day" value={dailyOperatingLimitHrs} onChange={setDailyOperatingLimitHrs} suffix="Hours/Day" step={1} />
              <Field label="Turnaround Load/Unload Cost" value={loadingUnloadingTimePerTrip} onChange={setLoadingUnloadingTimePerTrip} suffix="Hours" step={0.5} />
            </div>
          </div>
        </div>

        {/* SECTION 2: Route Planner */}
        <div className="panel">
          <h2><MapPin size={18} color="var(--bev)" /> 2. Route Planner & Charging Network</h2>

          <div style={{ overflowX: "auto" }}>
            <table className="route-table">
              <thead>
                <tr>
                  <th>From Node</th>
                  <th>To Node</th>
                  <th>Distance (km)</th>
                  <th>Cargo Payload (T)</th>
                  <th>Avg Speed (km/h)</th>
                  <th style={{ textAlign: "center" }}>Depot Charger at Target?</th>
                  <th>Custom Duty Cycle</th>
                  <th style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {routeSegments.map((seg) => {
                  const activeStretchesSum = seg.stretches.reduce((sum, st) => sum + st.percentage, 0);
                  return (
                    <React.Fragment key={seg.id}>
                      <tr>
                        <td><input type="text" value={seg.from} onChange={(e) => updateSegmentProp(seg.id, "from", e.target.value)} /></td>
                        <td><input type="text" value={seg.to} onChange={(e) => updateSegmentProp(seg.id, "to", e.target.value)} /></td>
                        <td><input type="number" value={seg.distance} onChange={(e) => updateSegmentProp(seg.id, "distance", parseFloat(e.target.value) || 0)} /></td>
                        <td><input type="number" value={seg.payload} onChange={(e) => updateSegmentProp(seg.id, "payload", parseFloat(e.target.value) || 0)} /></td>
                        <td><input type="number" value={seg.avgSpeed} onChange={(e) => updateSegmentProp(seg.id, "avgSpeed", parseFloat(e.target.value) || 0)} /></td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={seg.hasDepotAtTo} onChange={(e) => updateSegmentProp(seg.id, "hasDepotAtTo", e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "var(--bev)", cursor: "pointer" }} />
                        </td>
                        <td>
                          <button className="expand-btn" onClick={() => setExpandedSegmentId(expandedSegmentId === seg.id ? null : seg.id)}>
                            {expandedSegmentId === seg.id ? "Close" : `Configure (${activeStretchesSum}%)`}
                          </button>
                        </td>
                        <td>
                          <button className="remove-btn" onClick={() => handleRemoveSegment(seg.id)} disabled={routeSegments.length <= 1} style={{ background: "transparent", border: "none", color: "var(--bad)", cursor: "pointer" }}><Trash2 size={16} /></button>
                        </td>
                      </tr>

                      {expandedSegmentId === seg.id && (
                        <tr>
                          <td colSpan="8">
                            <div className="stretch-drawer">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                                <span style={{ fontWeight: 600, fontSize: "13px" }}>Surface / Traffic Allocation (Target: 100%)</span>
                                <span className="num badge" style={{ background: activeStretchesSum !== 100 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: activeStretchesSum !== 100 ? "var(--bad)" : "var(--good)" }}>
                                  Sum: {activeStretchesSum}%
                                </span>
                              </div>

                              <div style={{ display: "inline-flex", alignItems: "center", gap: "16px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Fuel size={13} color="var(--diesel)" />
                                  <span style={{ color: "var(--text-dim)" }}>Diesel Route Multiplier:</span>
                                  <strong className="num" style={{ color: "var(--diesel)" }}>
                                    {computeWeightedMultiplier(seg.stretches, seg.payload, "diesel").toFixed(3)}x
                                  </strong>
                                </div>
                                <div style={{ width: "1px", height: "16px", background: "var(--border)" }} />
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Zap size={13} color="var(--bev)" />
                                  <span style={{ color: "var(--text-dim)" }}>EV Route Multiplier:</span>
                                  <strong className="num" style={{ color: "var(--bev)" }}>
                                    {computeWeightedMultiplier(seg.stretches, seg.payload, "electric").toFixed(3)}x
                                  </strong>
                                </div>
                              </div>

                              <div className="stretch-grid">
                                {ROAD_TYPES.map((road) => (
                                  <div key={road} className="stretch-card">
                                    <div style={{ fontWeight: 700, fontSize: "10px", textTransform: "uppercase", marginBottom: "8px", color: "var(--bev)", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>{road}</div>
                                    {TRAFFIC_CONDITIONS.map((traffic) => {
                                      const matched = seg.stretches.find(st => st.roadType === road && st.traffic === traffic);
                                      const currentVal = matched ? matched.percentage : 0;
                                      return (
                                        <div key={traffic} className="field" style={{ marginBottom: "6px" }}>
                                          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>{traffic}</span>
                                          <div className="field-input">
                                            <input type="number" value={currentVal} onChange={(e) => updateStretchPercentage(seg.id, road, traffic, parseFloat(e.target.value) || 0)} style={{ width: "45px", padding: "4px", fontSize: "11.5px" }} />
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

          <button className="add-btn" style={{ marginTop: "16px" }} onClick={handleAddSegment}>
            <Plus size={14} /> Add Route Segment
          </button>
        </div>

        {/* SECTION 3: Global Economic Overheads */}
        <div className="panel">
          <h2><Settings size={18} color="var(--bev)" /> 3. Economic Parameters</h2>
          <div className="grid-3">
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Timeline</div>
              <Field label="Analysis Window" value={analysisPeriod} onChange={setAnalysisPeriod} suffix="Years" step={1} />
              <Field label="Discount Rate (WACC)" value={discountRate} onChange={setDiscountRate} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Fuel & Inflation</div>
              <Field label="General Inflation Rate" value={escGeneral} onChange={setEscGeneral} suffix="%" step={0.5} />
              <Field label="Diesel Price Inflation" value={escFuel} onChange={setEscFuel} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Utility & Staff</div>
              <Field label="Electricity Tariff Inflation" value={escElectricity} onChange={setEscElectricity} suffix="%" step={0.5} />
              <Field label="Wages Inflation" value={escWages} onChange={setEscWages} suffix="%" step={0.5} />
              <Field label="Depot Leases Inflation" value={escInfrastructure} onChange={setEscInfrastructure} suffix="%" step={0.5} />
            </div>
          </div>
        </div>

        {/* SECTION 4: Vehicle Configurations */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, textTransform: "uppercase", fontSize: "18px" }}><Truck size={20} style={{ verticalAlign: "-3px", marginRight: "6px", color: "var(--bev)" }} /> 4. Fleet Vehicle Profiles</h2>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="theme-btn" style={{ borderColor: "var(--diesel)", background: "rgba(226, 149, 50, 0.04)" }} onClick={() => handleAddVehicle("diesel")}>
                <Plus size={14} /> Add Diesel Vehicle
              </button>
              <button className="theme-btn" style={{ borderColor: "var(--bev)", background: "rgba(33, 196, 175, 0.04)" }} onClick={() => handleAddVehicle("electric")}>
                <Plus size={14} /> Add Electric Vehicle
              </button>
            </div>
          </div>

          <div className="vehicle-deck">
            {vehicles.map((v) => {
              const optResult = optimizerResults[v.id];
              const currentComputed = results.computedVehicles.find((cv) => cv.id === v.id);
              return (
              <div key={v.id} className={`vehicle-card ${v.type === "electric" ? "active-electric" : "active-diesel"}`}>
                <div className="vcard-header">
                  <div>
                    <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "700", color: v.type === "electric" ? "var(--bev)" : "var(--diesel)" }}>
                      {v.type.toUpperCase()} Specifications
                    </span>
                    <input
                      type="text"
                      value={v.name}
                      className="vcard-title num"
                      onChange={(e) => updateVehicleProp(v.id, "name", e.target.value)}
                      style={{ background: "transparent", border: "none", color: "var(--text)", borderBottom: "1px dashed var(--border)", width: "220px", display: "block", marginTop: "4px" }}
                    />
                  </div>
                  <button className="remove-btn" onClick={() => handleRemoveVehicle(v.id)} disabled={vehicles.length <= 1} style={{ background: "transparent", border: "none", color: "var(--bad)", cursor: "pointer" }}><Trash2 size={16} /></button>
                </div>

                <div className="section-tag" style={{ marginTop: 0 }}>Base Unit Economics</div>
                <Field label="Ex-Showroom Price (Ex GST)" value={v.purchasePrice} onChange={(val) => updateVehicleProp(v.id, "purchasePrice", val)} suffix="₹" step={50000} />
                <Field label="GST Rate" value={v.gstRate} onChange={(val) => updateVehicleProp(v.id, "gstRate", val)} suffix="%" step={1} />
                <Field label="Tractor Weight" value={v.tractorWeight} onChange={(val) => updateVehicleProp(v.id, "tractorWeight", val)} suffix="kg" step={100} />
                <Field label="Trailer Weight" value={v.trailerWeight} onChange={(val) => updateVehicleProp(v.id, "trailerWeight", val)} suffix="kg" step={100} />
                <Field label="GVWR Limit" value={v.gvwr} onChange={(val) => updateVehicleProp(v.id, "gvwr", val)} suffix="kg" step={500} />

                <div className="section-tag">Efficiency Parameters</div>
                <Field label="Unloaded Base Economy" value={v.baseUnloadedEconomy} onChange={(val) => updateVehicleProp(v.id, "baseUnloadedEconomy", val)} suffix={v.type === "diesel" ? "km/l" : "km/kWh"} step={0.1} />
                <Field label="Loaded Base Economy (at Max Payload)" value={v.baseLoadedEconomy} onChange={(val) => updateVehicleProp(v.id, "baseLoadedEconomy", val)} suffix={v.type === "diesel" ? "km/l" : "km/kWh"} step={0.1} />
                {v.type === "diesel" && (
                  <Field label="Diesel Retail Price" value={v.fuelOrElectricPrice} onChange={(val) => updateVehicleProp(v.id, "fuelOrElectricPrice", val)} suffix="₹/l" step={0.5} />
                )}

                {v.type === "electric" && (
                  <>
                    <div className="section-tag">Battery & Cycle Sizing</div>
                    <Field label="Battery Pack Sizing" value={v.batteryCapacity} onChange={(val) => updateVehicleProp(v.id, "batteryCapacity", val)} suffix="kWh" step={25} />
                    <Field label="Pack Replacement Cost" value={v.batteryReplacementCost} onChange={(val) => updateVehicleProp(v.id, "batteryReplacementCost", val)} suffix="₹" step={100000} />
                    <Field label="Cycle-wise SOH Degradation" value={v.batteryDegradationPerCycle} onChange={(val) => updateVehicleProp(v.id, "batteryDegradationPerCycle", val)} suffix="%" step={0.001} />

                    <div className="field">
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span className="field-label" style={{ fontWeight: 600 }}>Adaptive Lifecycle Replacement Sizing</span>
                        <span style={{ fontSize: "10.5px", color: "var(--text-dim)" }}>Compute physical replacement limit dynamically based on route range limits?</span>
                      </div>
                      <input type="checkbox" checked={v.useDynamicSOHLimit} onChange={(e) => updateVehicleProp(v.id, "useDynamicSOHLimit", e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "var(--bev)", cursor: "pointer" }} />
                    </div>

                    {!v.useDynamicSOHLimit && (
                      <Field label="Manual Target SOH Trigger" value={v.batterySOHThreshold} onChange={(val) => updateVehicleProp(v.id, "batterySOHThreshold", val)} suffix="%" step={1} />
                    )}
                    <Field label="Reserve Safe Limit Margin" value={v.safeSoCThreshold} onChange={(val) => updateVehicleProp(v.id, "safeSoCThreshold", val)} suffix="%" step={1} />
                  </>
                )}

                <div className="section-tag">Tyre Layout & Costing (Independent Axles)</div>
                <div style={{ background: "var(--panel-alt)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", display: "flex", gap: "12px", flexDirection: "column" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1.5fr", gap: "8px", fontSize: "11px", fontWeight: 600, color: "var(--text-dim)", textAlign: "center" }}>
                    <div style={{ textAlign: "left" }}>Axle</div>
                    <div>Tyres</div>
                    <div>Cost/Tyre</div>
                    <div>Life (km)</div>
                  </div>

                  {[{key: "Front", label: "Front"}, {key: "Rear", label: "Rear"}, {key: "Trailer", label: "Trailer"}].map(axle => (
                    <div key={axle.key} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1.5fr", gap: "8px", alignItems: "center" }}>
                      <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{axle.label}</div>
                      <input className="compact-input" type="number" value={v[`tyres${axle.key}`]} onChange={(e) => updateVehicleProp(v.id, `tyres${axle.key}`, parseFloat(e.target.value) || 0)} />
                      <input className="compact-input" type="number" value={v[`tyreCost${axle.key}`]} step={500} onChange={(e) => updateVehicleProp(v.id, `tyreCost${axle.key}`, parseFloat(e.target.value) || 0)} />
                      <input className="compact-input" type="number" value={v[`tyreLife${axle.key}`]} step={5000} onChange={(e) => updateVehicleProp(v.id, `tyreLife${axle.key}`, parseFloat(e.target.value) || 0)} />
                    </div>
                  ))}
                </div>

                <div className="section-tag">Overhead & Operating Parameters</div>
                <Field label="Periodic Maintenance Overhead" value={v.maintCostPerKm} onChange={(val) => updateVehicleProp(v.id, "maintCostPerKm", val)} suffix="₹/km" step={0.1} />
                <Field label="Annual Insurance Rate" value={v.insuranceRatePct} onChange={(val) => updateVehicleProp(v.id, "insuranceRatePct", val)} suffix="%" step={0.25} />
                <Field label="Terminal Salvage Value" value={v.residualPct} onChange={(val) => updateVehicleProp(v.id, "residualPct", val)} suffix="%" step={1} />
                <Field label="Driver Monthly Base Salary" value={v.driverSalaryMonthly} onChange={(val) => updateVehicleProp(v.id, "driverSalaryMonthly", val)} suffix="₹" step={1000} />
                <Field label="Toll Overhead Per Trip" value={v.tollCostPerTrip} onChange={(val) => updateVehicleProp(v.id, "tollCostPerTrip", val)} suffix="₹" step={250} />

                <div className="section-tag">Miscellaneous Expenses</div>
                <Field label="Misc Cost Per Month" value={v.miscCostPerMonth} onChange={(val) => updateVehicleProp(v.id, "miscCostPerMonth", val)} suffix="₹/mo" step={500} />
                <TextField label="Expense Notes" value={v.miscCostNotes} onChange={(val) => updateVehicleProp(v.id, "miscCostNotes", val)} placeholder="e.g. permits, parking..." />

                <div className="section-tag">Downtime allocations</div>
                {v.type === "diesel" && (
                  <Field label="Route En-route Utilization (Driving %)" value={v.utilizationPct} onChange={(val) => updateVehicleProp(v.id, "utilizationPct", val)} suffix="%" step={1} min={1} max={100} />
                )}
                <Field label="Scheduled Fleet Service" value={v.scheduledDowntimeDays} onChange={(val) => updateVehicleProp(v.id, "scheduledDowntimeDays", val)} suffix="Days/Year" step={1} />
                <Field label="Unscheduled Fleet Outages" value={v.unscheduledDowntimeHrs} onChange={(val) => updateVehicleProp(v.id, "unscheduledDowntimeHrs", val)} suffix="Hours/Year" step={1} />
                {v.type === "electric" && currentComputed && (
                  <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "-4px" }}>
                    Computed utilization: <strong className="num" style={{ color: "var(--bev)" }}>{currentComputed.utilizationPctComputed.toFixed(1)}%</strong> of turnaround spent driving
                  </div>
                )}

                {v.type === "electric" && (
                  <>
                    <div className="section-tag">Charger Infrastructure Sizing</div>
                    <Field label="Station Setup Cost" value={v.stationCost} onChange={(val) => updateVehicleProp(v.id, "stationCost", val)} suffix="₹/station" step={100000} />
                    <Field label="Station Annual Upkeep" value={v.stationMaintenance} onChange={(val) => updateVehicleProp(v.id, "stationMaintenance", val)} suffix="₹/yr" step={10000} />
                    <Field label="Charger Dispenser Unit Cost" value={v.chargerCost} onChange={(val) => updateVehicleProp(v.id, "chargerCost", val)} suffix="₹/unit" step={50000} />
                    <Field label="Charger Annual Upkeep" value={v.chargerMaintenance} onChange={(val) => updateVehicleProp(v.id, "chargerMaintenance", val)} suffix="₹/yr" step={5000} />
                    <Field label="Infra Subsidies / Incentives" value={v.infrastructureTaxCredit} onChange={(val) => updateVehicleProp(v.id, "infrastructureTaxCredit", val)} suffix="%" step={1} />
                    <Field label="Charger Output Speed" value={v.chargeSpeedKW} onChange={(val) => updateVehicleProp(v.id, "chargeSpeedKW", val)} suffix="kW" step={10} />
                    <Field label="Charging Time Margin" value={v.chargingTimeMarginPct} onChange={(val) => updateVehicleProp(v.id, "chargingTimeMarginPct", val)} suffix="%" step={1} />
                    <Field label="Depot Electricity Rate" value={v.electricityRate} onChange={(val) => updateVehicleProp(v.id, "electricityRate", val)} suffix="₹/kWh" step={0.5} />
                    <Field label="Monthly Depot Land Lease" value={v.depotLandLeaseMonthly} onChange={(val) => updateVehicleProp(v.id, "depotLandLeaseMonthly", val)} suffix="₹" step={5000} />
                    <Field label="Monthly Peak Demand Fee" value={v.depotDemandChargesMonthly} onChange={(val) => updateVehicleProp(v.id, "depotDemandChargesMonthly", val)} suffix="₹" step={5000} />

                    <div className="section-tag"><Sparkles size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} /> TCO-Optimal Charging Network</div>
                    <div className="optimizer-box">
                      <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginBottom: "10px", lineHeight: 1.5 }}>
                        Tries every combination of terminal depot-charger placement across your {routeSegments.length} route segments and finds the one with the lowest lifecycle NPV TCO for this vehicle.
                        {routeSegments.length > 12 && " (Route has more than 12 segments - optimizer is disabled to stay fast.)"}
                      </div>
                      {routeSegments.length <= 12 && (
                        <button className="mini-btn-outline" onClick={() => handleRunOptimizer(v.id)} disabled={optimizerRunning === v.id}>
                          <GitBranch size={13} /> {optimizerRunning === v.id ? "Running..." : "Find Optimal Network"}
                        </button>
                      )}

                      {optResult && currentComputed && (
                        <div className="optimizer-result">
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ color: "var(--text-dim)" }}>Current network TCO:</span>
                            <strong className="num">{inrCompact(currentComputed.npvTCOSum)}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ color: "var(--text-dim)" }}>Optimal network TCO:</span>
                            <strong className="num" style={{ color: "var(--good)" }}>{inrCompact(optResult.npvTCOSum)}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", borderTop: "1px dashed var(--border)", paddingTop: "6px" }}>
                            <span style={{ color: "var(--text-dim)" }}>Potential savings:</span>
                            <strong className="num" style={{ color: currentComputed.npvTCOSum - optResult.npvTCOSum > 0 ? "var(--good)" : "var(--text-dim)" }}>
                              {inrCompact(Math.max(0, currentComputed.npvTCOSum - optResult.npvTCOSum))}
                            </strong>
                          </div>
                          {currentComputed.npvTCOSum - optResult.npvTCOSum > 1 ? (
                            <button className="mini-btn" onClick={() => handleApplyOptimalNetwork(v.id)}>
                              <CheckCircle2 size={13} /> Apply This Network
                            </button>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>Current depot placement is already optimal.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="section-tag">Financing parameters</div>
                <div className="field">
                  <span className="field-label">Financing Structure</span>
                  <div className="seg">
                    <button className={v.financing === "cash" ? "active" : ""} onClick={() => updateVehicleProp(v.id, "financing", "cash")}>Equity / Cash</button>
                    <button className={v.financing === "emi" ? "active" : ""} onClick={() => updateVehicleProp(v.id, "financing", "emi")}>Debt / Loan</button>
                  </div>
                </div>
                {v.financing === "emi" && (
                  <>
                    <Field label="Equity Contribution" value={v.downPaymentPct} onChange={(val) => updateVehicleProp(v.id, "downPaymentPct", val)} suffix="%" step={5} />
                    <Field label="Annual Interest Rate" value={v.interestRate} onChange={(val) => updateVehicleProp(v.id, "interestRate", val)} suffix="%" step={0.25} />
                    <Field label="Loan Duration Window" value={v.loanTenure} onChange={(val) => updateVehicleProp(v.id, "loanTenure", val)} suffix="Years" step={1} />
                  </>
                )}
              </div>
            );})}
          </div>
        </div>

        {/* SECTION 5: Safety Warnings */}
        {results.computedVehicles.some(v => v.segmentOverloads.length > 0) && (
          <div className="alert-strip">
            <AlertTriangle size={20} style={{ flexShrink: 0, color: "var(--bad)" }} />
            <div>
              <strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>Payload Sizing Violations Detected!</strong>
              The cargo payload configured for some route segments exceeds the maximum carrying capacity of your vehicles.
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {results.computedVehicles.map(v => {
                  if (v.segmentOverloads.length === 0) return null;
                  return (
                    <div key={v.id} style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                      · <strong>{v.name}</strong> payload capacity is capped at <strong>{v.payloadCap.toFixed(1)}T</strong> (Segment cargo limits scaled down internally).
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Breakeven widget */}
        {results.firstDiesel && results.firstElectric && (
          <div className="breakeven-strip">
            <TrendingUp size={22} style={{ flexShrink: 0, color: "var(--bev)" }} />
            <div>
              <strong style={{ display: "block", marginBottom: "2px", fontSize: "14px" }}>
                {results.breakevenYear !== null
                  ? `Breakeven: EV cheaper than Diesel from Year ${results.breakevenYear.toFixed(1)}`
                  : "No breakeven within the analysis horizon"}
              </strong>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                {results.breakevenYear !== null
                  ? `Comparing ${results.firstElectric.name} vs ${results.firstDiesel.name} cumulative TCO. Before this point Diesel is cheaper; after it, EV pulls ahead.`
                  : `${results.firstElectric.name} does not cross below ${results.firstDiesel.name} cumulative TCO within ${results.years} years — extend the analysis window or adjust cost assumptions to see if/when it would.`}
              </span>
            </div>
          </div>
        )}

        {/* SECTION 6: Analytics Dashboard */}
        <div className="panel" style={{ border: "2px solid var(--bev)", boxShadow: "var(--shadow-glow)" }}>
          <h2 style={{ color: "var(--bev)" }}><TrendingUp size={20} /> 5. TCO Analytics</h2>

          {/* Sizing KPIs */}
          <div className="kpi-grid">
            {results.computedVehicles.map((v, idx) => (
              <div key={v.id} className="kpi-card" style={{ borderTop: `4px solid ${VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}` }}>
                <div className="kpi-label">{v.name} ({v.fleetSizeRequired} Units Sized)</div>
                <div className="kpi-val num" style={{ color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] }}>
                  {inrCompact(v.npvTCOSum)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "6px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Cost/Tonne-km</span>
                  <span className="num" style={{ fontWeight: 700, fontSize: "12.5px" }}>₹{v.costPerTonneKm.toFixed(3)}</span>
                </div>
                <div className="kpi-sub">
                  Turnaround: <strong className="num">{v.turnaroundCycleHrs.toFixed(2) } Hrs</strong><br />
                  Utilization: <strong className="num">{v.utilizationPctComputed.toFixed(1)}%</strong><br />
                  Trips/Yr/Unit: <strong className="num">{Math.round(v.tripsPerYearPerVehicle)}</strong><br />
                  Effective Economy: <strong className="num">{v.avgRouteEconomy.toFixed(2)} {v.type === "diesel" ? "km/l" : "km/kWh"}</strong><br />
                  {v.type === "electric" ? (
                    <>
                      Station Count: <strong className="num">{v.uniqueStationsCount} Stops</strong><br />
                      Total Sized Chargers: <strong className="num">{v.totalChargersNeeded} Units</strong><br />
                      Sized EV Fleet Size: <strong className="num" style={{ color: "var(--bev)" }}>{v.fleetSizeRequired} Deployments</strong>
                    </>
                  ) : (
                    <>
                      Sized Diesel Fleet Size: <strong className="num" style={{ color: "var(--diesel)" }}>{v.fleetSizeRequired} Deployments</strong><br />
                      Charging Stops: <strong className="num">0</strong>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sequential SoC Trace details */}
          {results.computedVehicles.some(v => v.type === "electric") && (
            <div style={{ background: "var(--panel-alt)", padding: "18px", borderRadius: "10px", marginBottom: "24px", border: "1px solid var(--border)" }}>
              <div className="kpi-label" style={{ color: "var(--bev)" }}>
                <BatteryCharging size={16} style={{ marginRight: 6 }} /> Charging Sequence Trace
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "12px" }}>
                {results.computedVehicles.map((v) => {
                  if (v.type !== "electric") return null;
                  return (
                    <div key={v.id} style={{ flex: 1, minWidth: "300px" }}>
                      <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>{v.name} Charge Event Sequence:</strong>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "8px" }}>
                        * Simulates worst-case at End-of-Life SOH ({v.resolvedSOHReplacementLimit.toFixed(1)}%) to guarantee route feasibility throughout lifecycle.
                      </div>
                      {v.stopsLog.length === 0 ? (
                        <div style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>
                          No charging stops required. The truck completes its entire route loop within its single-charge range safely.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {v.stopsLog.map((log, lIdx) => (
                            <div key={lIdx} style={{ fontSize: "12px", background: "var(--panel)", padding: "10px", borderRadius: "8px", borderLeft: "3px solid var(--bev)" }}>
                              <strong>Stop {lIdx + 1}: {log.label}</strong> (at {log.km} km)<br />
                              <div style={{ color: "var(--text-dim)", marginTop: "4px" }}>
                                Leg Energy: <span className="num">{Math.round(log.energyLegConsumed)} kWh</span> |
                                SoC: <span className="num">{log.socBefore}%</span> → <span className="num">{log.socAfter}%</span> |
                                Charge Time: <span className="num">{(log.chargeTimeHrs * 60).toFixed(0)} min</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SOH Degradation, Operational Ranges, and Replacement Summary */}
          <div style={{ marginBottom: "24px" }} className="grid-3">
            {results.computedVehicles.map((v, idx) => {
              if (v.type !== "electric") return null;
              return (
                <div key={v.id} className="kpi-card" style={{ background: "var(--panel)", borderLeft: `4px solid ${VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}` }}>
                  <div className="kpi-label">{v.name} Battery Sizing & Lifecycle</div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Max Theoretical Range (100% SOH):</span>
                      <strong className="num" style={{ fontSize: "12px" }}>{Math.round(v.maxTheoreticalRange)} km</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Operational Range at Start (100% SOH):</span>
                      <strong className="num badge badge-info" style={{ fontSize: "12px" }}>{Math.round(v.operationalRangeAtStart)} km</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Operational Range at SOH Limit:</span>
                      <strong className="num badge badge-warn" style={{ fontSize: "12px" }}>{Math.round(v.operationalRangeAtSOHLimit)} km</strong>
                    </div>
                    <hr style={{ border: 0, borderBottom: "1px solid var(--border)", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Critical physical range SOH:</span>
                      <strong className="num" style={{ fontSize: "12px" }}>{v.criticalSOHLimit.toFixed(1)}% SOH</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Resolved SOH replacement trigger:</span>
                      <strong className="num" style={{ fontSize: "12px", fontWeight: "bold", color: "var(--bad)" }}>{v.resolvedSOHReplacementLimit.toFixed(1)}% SOH</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Analysis end SOH (Year {results.years}):</span>
                      <strong className="num" style={{ fontSize: "12px" }}>{v.currentSOH.toFixed(1)}%</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Swaps Completed (Per Vehicle):</span>
                      <strong className="num" style={{ fontSize: "12px", fontWeight: "bold", color: "var(--bev)" }}>{v.replacementsPerVehicle} Swaps</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Total Fleet Battery Swaps:</span>
                      <strong className="num" style={{ fontSize: "12px" }}>{v.batterySetsReplacedCount} Packs</strong>
                    </div>
                  </div>

                  {v.batteryReplacementLog.length > 0 ? (
                    <div style={{ marginTop: "12px", fontSize: "11px", background: "var(--panel-alt)", padding: "10px", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                      <strong>Pack Replacement Schedule:</strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                        {v.batteryReplacementLog.map((log, rIdx) => (
                          <div key={rIdx} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)" }}>
                            <span>Swap #{rIdx + 1}: Year {log.year}</span>
                            <span>{log.sohAtReplacement.toFixed(1)}% SOH ({log.cycles} cycles)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-dim)", fontStyle: "italic" }}>
                      No battery pack replacements occurred during the {results.years}-year project lifecycle.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sized Station & Chargers Siting Table */}
          {results.computedVehicles.some(v => v.type === "electric") && (
            <div style={{ background: "var(--panel-alt)", padding: "18px", borderRadius: "10px", marginBottom: "24px", border: "1px solid var(--border)" }}>
              <div className="kpi-label" style={{ color: "var(--bev)" }}>
                <PlugZap size={16} style={{ marginRight: 6 }} /> Charging Station Sizing (1 Station per Stop, Variable Chargers)
              </div>
              <div style={{ overflowX: "auto", marginTop: "10px" }}>
                <table className="route-table" style={{ background: "var(--panel)", borderRadius: "8px" }}>
                  <thead>
                    <tr>
                      <th>Stop Location</th>
                      <th style={{ textAlign: "right" }}>Cumulative Milepost (km)</th>
                      <th style={{ textAlign: "center" }}>Infrastructure Type</th>
                      <th style={{ textAlign: "center" }}>Dedicated Stations</th>
                      <th style={{ textAlign: "center" }}>Chargers Required</th>
                      <th style={{ textAlign: "right" }}>Cost Profile (Ex-Subsidy)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.computedVehicles.flatMap(v => {
                      if (v.type !== "electric") return [];
                      return v.uniqueStationsList.map((st, sIdx) => (
                        <tr key={`${v.id}_s_${sIdx}`}>
                          <td><strong>{v.name}</strong> - {st.label}</td>
                          <td className="num" style={{ textAlign: "right" }}>{st.km} km</td>
                          <td style={{ textAlign: "center" }}><span className={`badge ${st.isDepot ? "badge-info" : "badge-warn"}`}>{st.isDepot ? "Terminal Depot" : "Highway charger"}</span></td>
                          <td className="num" style={{ textAlign: "center" }}>1 Station</td>
                          <td className="num" style={{ textAlign: "center", fontWeight: "bold", color: "var(--bev)" }}>{st.chargersSized} High-Speed Plugs</td>
                          <td className="num" style={{ textAlign: "right" }}>{inr(st.stationSetupCost + st.chargersCostSum)}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-segment Cost/Tonne-km */}
          <div style={{ marginTop: "8px", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "15px", textTransform: "uppercase", marginBottom: "6px", borderBottom: "1px solid var(--border)", paddingBottom: "6px", color: "var(--text)" }}>
              <Route size={15} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6, color: "var(--bev)" }} />
              Cost per Tonne-km by Route Segment
            </h3>
            <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginBottom: "12px" }}>
              Total row is the full lifecycle NPV figure (includes capital, financing, wages, infra). Segment rows below are operating-cost-only (fuel/energy + maintenance + tyres) since capital and overheads aren't attributable to a single leg. Empty-payload legs (e.g. return trips) show as "—".
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="seg-cost-table">
                <thead>
                  <tr>
                    <th>Segment / Vehicle</th>
                    {results.computedVehicles.map((v, idx) => (
                      <th key={v.id} style={{ color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] }}>{v.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "var(--panel-alt)" }}>
                    <td><strong>Total (lifecycle NPV)</strong></td>
                    {results.computedVehicles.map((v, idx) => (
                      <td key={v.id} className="num" style={{ fontWeight: 700, color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] }}>₹{v.costPerTonneKm.toFixed(3)}</td>
                    ))}
                  </tr>
                  {routeSegments.map((seg, segIdx) => (
                    <tr key={seg.id}>
                      <td>{seg.from} → {seg.to} <span style={{ color: "var(--text-dim)" }}>({seg.distance} km)</span></td>
                      {results.computedVehicles.map((v) => {
                        const segData = v.segmentCostPerTonneKm[segIdx];
                        return (
                          <td key={v.id} className="num">
                            {segData && segData.costPerTonneKmSeg !== null ? `₹${segData.costPerTonneKmSeg.toFixed(3)}` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* NPV Cost Trend Graph */}
          <div style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "15px", textTransform: "uppercase", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px", color: "var(--text)" }}>
              NPV Cost Accrual Over Project Horizon ({results.years} Years)
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
              <LineChart data={results.chartData} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  stroke="var(--text-dim)"
                  tick={{ fontSize: 11, fill: "var(--text-dim)" }}
                  label={{ value: "Operating Year", position: "insideBottom", offset: -12, style: { fill: "var(--text-dim)", fontSize: 12 } }}
                />
                <YAxis
                  stroke="var(--text-dim)"
                  tick={{ fontSize: 11, fill: "var(--text-dim)" }}
                  tickFormatter={(v) => inrCompact(v)}
                  width={80}
                  label={{ value: "Cumulative NPV Cost", angle: -90, position: "insideLeft", style: { fill: "var(--text-dim)", fontSize: 12, textAnchor: "middle" } }}
                />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }} formatter={(v) => inr(v)} />
                {results.computedVehicles.map((v, idx) => (
                  <Line key={v.id} type="monotone" dataKey={v.name} stroke={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cost Category Breakdown */}
          <div style={{ marginTop: "32px" }}>
            <h3 style={{ fontSize: "15px", textTransform: "uppercase", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px", color: "var(--text)" }}>
              NPV Cost Category breakdown comparison
            </h3>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={[
                  { category: "Capital & Infra", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.upfront }), {}) },
                  { category: "Fuel/Energy", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.fuelOrEnergy }), {}) },
                  { category: "EMI/Debt", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.emi }), {}) },
                  { category: "Maint & Ins", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.maintenance }), {}) },
                  { category: "Wages", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.wages }), {}) },
                  { category: "Misc", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.misc }), {}) },
                  { category: "Tolls & Tyres", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.tolls + v.breakdown.tyres }), {}) },
                  { category: "Battery Swaps", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.batteryReplacements }), {}) },
                  { category: "Depot Upkeep", ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.infraMaintenance }), {}) }
                ]}
                margin={{ top: 10, right: 30, left: 10, bottom: 70 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="category"
                  stroke="var(--text-dim)"
                  tick={{ fontSize: 11, fill: "var(--text-dim)" }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                />
                <YAxis stroke="var(--text-dim)" tick={{ fontSize: 11, fill: "var(--text-dim)" }} tickFormatter={(v) => inrCompact(v)} width={80} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }} formatter={(v) => inr(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {results.computedVehicles.map((v, idx) => (
                  <Bar key={v.id} dataKey={v.name} fill={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, suffix, step = 1, min = 0, max }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-input">
        <input type="number" value={value} step={step} min={min} max={max} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-input" style={{ flex: 1.2 }}>
        <input
          type="text"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", textAlign: "left" }}
        />
      </div>
    </div>
  );
}

function inr(value) {
  if (value === null || value === undefined || isNaN(value)) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
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
