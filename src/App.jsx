import React, { useState, useMemo, useEffect } from "react";
import {
  Truck, Zap, Fuel, BatteryCharging, TrendingUp, TrendingDown,
  Flag, Package, Info, RotateCcw, PlugZap, ShieldCheck, Layers,
  Plus, Trash2, MapPin, DollarSign, Settings, Eye, Sun, Moon, AlertTriangle, CheckCircle2
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
    "Medium": { 0: 0.93, 20: 0.74, 40: 0.56, 60: 0.47 }, // Fixed lookup key
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

function computeWeightedEfficiency(stretches, payload) {
  let weighted = 0;
  let sumStretch = 0;
  stretches.forEach((st) => {
    if (st.percentage > 0) {
      const eff = interpolateEfficiency(st.roadType, st.traffic, payload);
      weighted += eff * (st.percentage / 100);
      sumStretch += st.percentage;
    }
  });
  const normalizeFactor = sumStretch > 0 ? 100 / sumStretch : 1;
  return weighted * normalizeFactor;
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
  { id: "1", from: "Mumbai", to: "Pune", distance: 150, payload: 35, avgSpeed: 60, stretches: generateDefaultStretches(), hasDepotAtTo: true },
  { id: "2", from: "Pune", to: "Satara", distance: 120, payload: 35, avgSpeed: 50, stretches: generateDefaultStretches(), hasDepotAtTo: false },
  { id: "3", from: "Satara", to: "Kolhapur", distance: 130, payload: 35, avgSpeed: 55, stretches: generateDefaultStretches(), hasDepotAtTo: false },
  { id: "4", from: "Kolhapur", to: "Mumbai", distance: 400, payload: 0, avgSpeed: 65, stretches: generateDefaultStretches(), hasDepotAtTo: true }
];

const VEHICLE_COLORS = ["#21bfa9", "#e29532", "#b16af0", "#38bdf8", "#ec4899", "#10b981"];

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
    fuelOrElectricPrice: 94,
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
    batteryCapacity: 450,
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
    safeSoCThreshold: 20,
    stationCost: 3500000,
    stationMaintenance: 120000,
    chargerCost: 1500000,
    chargerMaintenance: 50000,
    infrastructureTaxCredit: 5,
    chargingTimePerCycle: 1.25,
    electricityRate: 8.5,
    depotLandLeaseMonthly: 120000,
    depotDemandChargesMonthly: 80000,
    useDynamicSOHLimit: true,
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

  const [escGeneral, setEscGeneral] = useState(4.0);
  const [escFuel, setEscFuel] = useState(5.0);
  const [escElectricity, setEscElectricity] = useState(3.0);
  const [escWages, setEscWages] = useState(6.0);
  const [escInfrastructure, setEscInfrastructure] = useState(4.0);

  const [routeSegments, setRouteSegments] = useState(DEFAULT_ROUTE);
  const [expandedSegmentId, setExpandedSegmentId] = useState(null);
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

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
      baseDefault.stationCost = 3500000;
      baseDefault.stationMaintenance = 120000;
      baseDefault.chargerCost = 1500000;
      baseDefault.chargerMaintenance = 50000;
      baseDefault.infrastructureTaxCredit = 5;
      baseDefault.chargingTimePerCycle = 1.3;
      baseDefault.electricityRate = 8.5;
      baseDefault.depotLandLeaseMonthly = 120000; // Fixed colons to equals signs
      baseDefault.depotDemandChargesMonthly = 80000; // Fixed colons to equals signs
      baseDefault.useDynamicSOHLimit = true;
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
      hasDepotAtTo: false
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

  // Run Sizing Calculations
  const results = useMemo(() => {
    const years = Math.max(1, Math.round(analysisPeriod));
    const dfRate = discountRate / 100;

    const escGen = escGeneral / 100;
    const escF = escFuel / 100;
    const escE = escElectricity / 100;
    const escW = escWages / 100;
    const escI = escInfrastructure / 100;

    const computedVehicles = vehicles.map((v) => {
      const payloadCap = Math.max(0, v.gvwr - v.tractorWeight - v.trailerWeight) / 1000;
      let tripMaxPayload = 0;
      let totalTripDistance = 0;
      let totalTripDrivingHrs = 0;
      let weightedEnergyNeeded = 0;

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
        weightedEnergyNeeded += seg.distance / Math.max(0.01, segWeightedEff);
      });

      const avgRouteEfficiency = weightedEnergyNeeded > 0 ? totalTripDistance / weightedEnergyNeeded : 1.0;
      const baselineMediumEff = 1.21;
      const actualEfficiencyRatio = avgRouteEfficiency / baselineMediumEff;
      const vehicleSpecificEconomy = v.type === "diesel"
        ? Math.max(0.5, v.baseFuelEconomy * actualEfficiencyRatio)
        : avgRouteEfficiency;

      // Trace charging stop locations & calculate intermediate energy legs.
      let stopsLog = [];
      let uniqueChargingStopsMap = {};
      let criticalSOHLimit = 20.0;
      let maxEnergyLegKWh = 0;

      if (v.type === "electric" && v.batteryCapacity > 0) {
        let currentSoC = 100;
        let cumulativeDistance = 0;
        let currentEnergySinceCharge = 0;
        let previousChargeKm = 0;
        let lastChargedFromSoC = 100;

        const recordChargeStop = (label, km, socBefore, chargeToSoC, isDepot) => {
          stopsLog.push({
            label,
            km: Math.round(km),
            socBefore: socBefore.toFixed(1),
            socAfter: chargeToSoC,
            isDepot,
            energyLegConsumed: currentEnergySinceCharge,
            startSoCWindow: lastChargedFromSoC,
          });

          const uniqueKey = `${label}_${Math.round(km)}`;
          if (!uniqueChargingStopsMap[uniqueKey]) {
            uniqueChargingStopsMap[uniqueKey] = {
              label,
              km: Math.round(km),
              isDepot,
              chargesPerLoop: 0
            };
          }
          uniqueChargingStopsMap[uniqueKey].chargesPerLoop += 1;

          if (currentEnergySinceCharge > maxEnergyLegKWh) {
            maxEnergyLegKWh = currentEnergySinceCharge;
          }

          const usableSoCWindow = (lastChargedFromSoC - v.safeSoCThreshold) / 100;
          const reqSOHFraction = currentEnergySinceCharge / (v.batteryCapacity * usableSoCWindow);
          const reqSOHPercent = reqSOHFraction * 100;
          if (reqSOHPercent > criticalSOHLimit) {
            criticalSOHLimit = Math.min(100, Math.max(criticalSOHLimit, reqSOHPercent));
          }

          currentEnergySinceCharge = 0;
          previousChargeKm = km;
          lastChargedFromSoC = chargeToSoC;
        };

        routeSegments.forEach((seg) => {
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
          segWeightedEff = (segWeightedEff * normalizeFactor) || 1.0;

          const socPctPerKm = 100 / (segWeightedEff * v.batteryCapacity);
          let remainingSegDistance = seg.distance;
          let distanceIntoSegment = 0;

          while (remainingSegDistance > 0.001) {
            const availableSoC = currentSoC - v.safeSoCThreshold;
            const maxDistanceBeforeCharge = socPctPerKm > 0 ? Math.max(0, availableSoC / socPctPerKm) : remainingSegDistance;

            if (maxDistanceBeforeCharge >= remainingSegDistance) {
              const energyConsumed = remainingSegDistance / segWeightedEff;
              currentEnergySinceCharge += energyConsumed;
              currentSoC -= remainingSegDistance * socPctPerKm;
              cumulativeDistance += remainingSegDistance;
              distanceIntoSegment += remainingSegDistance;
              remainingSegDistance = 0;
            } else {
              const travelDist = maxDistanceBeforeCharge;
              const energyConsumed = travelDist / segWeightedEff;
              currentEnergySinceCharge += energyConsumed;
              currentSoC -= travelDist * socPctPerKm;
              cumulativeDistance += travelDist;
              distanceIntoSegment += travelDist;
              remainingSegDistance -= travelDist;

              recordChargeStop(
                `Mid-Segment Fast Charger (${seg.from} \u2192 ${seg.to})`,
                cumulativeDistance,
                currentSoC,
                85,
                false
              );
              currentSoC = 85;
            }
          }

          if (seg.hasDepotAtTo) {
            recordChargeStop(
              `Terminal Depot (${seg.to})`,
              cumulativeDistance,
              currentSoC,
              100,
              true
            );
            currentSoC = 100;
          }
        });

        if (currentEnergySinceCharge > 0) {
          recordChargeStop(
            `Home Base Depot Terminal`,
            cumulativeDistance,
            currentSoC,
            100,
            true
          );
        }
      }

      const resolvedSOHReplacementLimit = (v.type === "electric" && v.useDynamicSOHLimit)
        ? Math.min(98, Math.max(v.batterySOHThreshold, criticalSOHLimit))
        : (v.batterySOHThreshold || 80);

      const chargingStopsCount = stopsLog.length;
      const chargingDowntimeHrs = v.type === "electric" ? chargingStopsCount * v.chargingTimePerCycle : 0;

      const annualScheduledDowntimeHrs = v.scheduledDowntimeDays * 24;
      const annualUnscheduledDowntimeHrs = v.unscheduledDowntimeHrs;
      const totalAnnualFixedDowntimeHrs = annualScheduledDowntimeHrs + annualUnscheduledDowntimeHrs;

      const drivingAndLoadingTurnaround = totalTripDrivingHrs + loadingUnloadingTimePerTrip;
      const fullTurnaroundCycleHrs = drivingAndLoadingTurnaround + chargingDowntimeHrs;

      const totalOperatingHoursAvailableYear = (workingDaysPerMonth * 12 * dailyOperatingLimitHrs) - totalAnnualFixedDowntimeHrs;
      const tripsPerYearPerVehicle = fullTurnaroundCycleHrs > 0 ? totalOperatingHoursAvailableYear / fullTurnaroundCycleHrs : 0;

      const cappedPayloadPerTrip = Math.min(tripMaxPayload, payloadCap);
      const annualCargoThroughputPerVehicle = tripsPerYearPerVehicle * cappedPayloadPerTrip;

      const totalAnnualVolumeTarget = monthlyCargoVolume * 12;
      const fleetSizeRequired = Math.max(1, Math.ceil(totalAnnualVolumeTarget / Math.max(1, annualCargoThroughputPerVehicle)));

      const totalTripsAcrossFleetYear = tripsPerYearPerVehicle * fleetSizeRequired;
      const totalDistanceAcrossFleetYear = totalTripsAcrossFleetYear * totalTripDistance;

      let uniqueStationsCount = 0;
      let totalChargersNeeded = 0;
      let capitalSetupInfra = 0;
      let uniqueStationsList = [];

      if (v.type === "electric") {
        const STATION_DAILY_UPTIME_HRS = 22;
        const chargeSlotsPerDayPerCharger = STATION_DAILY_UPTIME_HRS / Math.max(0.1, v.chargingTimePerCycle);
        const dailyLoopsAcrossFleet = totalTripsAcrossFleetYear / (workingDaysPerMonth * 12);

        Object.keys(uniqueChargingStopsMap).forEach((key) => {
          const rawStop = uniqueChargingStopsMap[key];
          const dailyChargesAtThisLocation = dailyLoopsAcrossFleet * rawStop.chargesPerLoop;
          
          const chargersSized = Math.max(1, Math.ceil(dailyChargesAtThisLocation / chargeSlotsPerDayPerCharger));
          
          uniqueStationsCount += 1;
          totalChargersNeeded += chargersSized;

          uniqueStationsList.push({
            ...rawStop,
            chargersSized,
            stationSetupCost: v.stationCost,
            chargersCostSum: chargersSized * v.chargerCost
          });

          const stationCapEx = v.stationCost + (chargersSized * v.chargerCost);
          capitalSetupInfra += stationCapEx * (1 - v.infrastructureTaxCredit / 100);
        });
      }

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
      let batteryReplacementLog = [];
      let sohTimeline = [];
      let mileageSinceLastReplacement = 0;

      for (let t = 1; t <= years; t++) {
        const df = 1 / Math.pow(1 + dfRate, t);
        const multGen = Math.pow(1 + escGen, t - 1);
        const multF = Math.pow(1 + escF, t - 1);
        const multE = Math.pow(1 + escE, t - 1);
        const multW = Math.pow(1 + escW, t - 1);
        const multI = Math.pow(1 + escI, t - 1);

        let yearEMI = 0;
        if (v.financing === "emi" && t <= v.loanTenure) {
          yearEMI = loanAnnualEMI * fleetSizeRequired;
        }

        let yearFuelOrEnergy = 0;
        if (v.type === "diesel") {
          yearFuelOrEnergy = (totalDistanceAcrossFleetYear / vehicleSpecificEconomy) * v.fuelOrElectricPrice * multF;
        } else {
          yearFuelOrEnergy = totalDistanceAcrossFleetYear * (1 / avgRouteEfficiency) * v.electricityRate * multE;
        }

        const yearMaint = totalDistanceAcrossFleetYear * v.maintCostPerKm * multGen;
        const yearIns = totalUpfrontGSTPrice * (v.insuranceRatePct / 100) * multGen * fleetSizeRequired;
        const yearWages = v.driverSalaryMonthly * 12 * multW * fleetSizeRequired;
        const yearTolls = v.tollCostPerTrip * totalTripsAcrossFleetYear * multGen;
        const yearTyres = (totalDistanceAcrossFleetYear / v.tyreLifeKm) * v.tyreCostPerSet * multGen;

        let yearBatteryCost = 0;
        if (v.type === "electric") {
          const annualMileagePerVehicle = totalDistanceAcrossFleetYear / fleetSizeRequired;
          const rangePerCharge = (v.batteryCapacity * (85 - v.safeSoCThreshold) / 100) / Math.max(0.01, 1 / avgRouteEfficiency);
          const cyclesPerYearPerVehicle = annualMileagePerVehicle / rangePerCharge;

          mileageSinceLastReplacement += annualMileagePerVehicle;
          cyclesAccumulated += cyclesPerYearPerVehicle;
          const projectedSOH = 100 - (cyclesAccumulated * v.batteryDegradationPerCycle);

          if (projectedSOH <= resolvedSOHReplacementLimit) {
            yearBatteryCost = v.batteryReplacementCost * fleetSizeRequired * multGen;
            batteryReplacementLog.push({
              year: t,
              sohAtReplacement: Math.max(0, projectedSOH),
              mileageSinceLastReplacement: Math.round(mileageSinceLastReplacement),
            });
            cyclesAccumulated = 0;
            mileageSinceLastReplacement = 0;
            batterySetsReplacedCount += fleetSizeRequired;
            currentSOH = 100;
          } else {
            currentSOH = Math.max(10, projectedSOH);
          }
          sohTimeline.push({ year: t, soh: Math.round(currentSOH * 10) / 10 });
        }

        let yearInfraOverhead = 0;
        if (v.type === "electric") {
          const annualStationUpkeep = uniqueStationsCount * v.stationMaintenance;
          const annualChargerUpkeep = totalChargersNeeded * v.chargerMaintenance;
          const annualDepotUtility = (v.depotDemandChargesMonthly + v.depotLandLeaseMonthly) * 12;
          yearInfraOverhead = (annualStationUpkeep + annualChargerUpkeep + annualDepotUtility) * multI;
        }

        const totalYearlyExpenses = yearEMI + yearFuelOrEnergy + yearMaint + yearIns + yearWages + yearTolls + yearTyres + yearBatteryCost + yearInfraOverhead;
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
      }

      const dfN = 1 / Math.pow(1 + dfRate, years);
      const absoluteResidualValue = v.purchasePrice * (v.residualPct / 100) * fleetSizeRequired;
      const npvResidualValue = absoluteResidualValue * dfN;

      npvTCOSum -= npvResidualValue;
      cumCostTimeline[years] -= absoluteResidualValue;
      breakdown.residuals = -npvResidualValue;

      const annualCargoThroughputFleet = annualCargoThroughputPerVehicle * fleetSizeRequired;
      const totalCargoMovedOverTimeline = annualCargoThroughputFleet * years;
      const totalCargoTonneKmFleet = totalCargoMovedOverTimeline * totalTripDistance;
      const costPerTonneKm = totalCargoTonneKmFleet > 0 ? npvTCOSum / totalCargoTonneKmFleet : 0;

      return {
        ...v,
        payloadCap,
        actualEfficiencyRatio,
        avgRouteEfficiency,
        vehicleSpecificEconomy,
        chargingStopsCount,
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
        currentSOH,
        criticalSOHLimit,
        resolvedSOHReplacementLimit,
        batterySetsReplacedCount,
        batteryReplacementLog,
        sohTimeline,
        segmentOverloads,
      };
    });

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
        .wrap {
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          --shadow-glow: 0 0 15px rgba(33, 196, 175, 0.15);
          
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 24px;
          border-radius: 12px;
          min-height: 100vh;
          max-width: 1400px;
          margin: 0 auto;
          box-sizing: border-box;
          transition: all 0.2s ease-in-out;
          -webkit-font-smoothing: antialiased;
        }

        .wrap * { box-sizing: border-box; }

        .wrap.dark-theme {
          --bg: #090b0c;
          --panel: #131719;
          --panel-alt: #1a2022;
          --border: #262f32;
          --text: #f3f4f6;
          --text-dim: #9ca3af;
          --bev: #21bfa9;
          --diesel: #e29532;
          --good: #10b981;
          --bad: #ef4444;
          --input-bg: #0d0f10;
        }

        .wrap.light-theme {
          --bg: #f9fafb;
          --panel: #ffffff;
          --panel-alt: #f3f4f6;
          --border: #e5e7eb;
          --text: #111827;
          --text-dim: #6b7280;
          --bev: #129382;
          --diesel: #be7a21;
          --good: #059669;
          --bad: #dc2626;
          --input-bg: #f9fafb;
        }

        h1, h2, h3, .display {
          font-family: 'Barlow Condensed', sans-serif;
          letter-spacing: 0.02em;
        }

        .num { font-family: 'JetBrains Mono', monospace; font-weight: 500; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 1.5px solid var(--border);
          padding-bottom: 16px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header h1 {
          font-size: 26px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
        }

        .theme-btn, .reset-btn, .add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          box-shadow: var(--shadow-sm);
          transition: all 0.15s ease-in-out;
        }

        .theme-btn:hover, .reset-btn:hover, .add-btn:hover {
          border-color: var(--bev);
          background: var(--panel-alt);
        }

        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          box-shadow: var(--shadow-md);
          margin-bottom: 24px;
        }

        .panel h2 {
          font-size: 18px;
          margin: 0 0 20px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
        }

        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        @media(max-width: 900px) {
          .grid-3 { grid-template-columns: 1fr; }
        }

        .field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .field-label {
          font-size: 13px;
          color: var(--text-dim);
          flex: 1;
        }

        .field-input {
          display: flex;
          align-items: center;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.15s ease-in-out;
        }

        .field-input:focus-within {
          border-color: var(--bev);
        }

        .field-input input {
          width: 100px;
          background: transparent;
          border: none;
          color: var(--text);
          padding: 8px 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          text-align: right;
        }

        .field-input input:focus { outline: none; }

        .field-suffix {
          font-size: 11px;
          color: var(--text-dim);
          padding-right: 10px;
          font-weight: 500;
        }

        .route-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }

        .route-table th {
          background: var(--panel-alt);
          padding: 12px;
          color: var(--text-dim);
          border-bottom: 2px solid var(--border);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
        }

        .route-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }

        .route-table input, .route-table select {
          background: var(--input-bg);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px;
          border-radius: 6px;
          font-size: 13px;
        }

        .route-table input[type="text"] { width: 100%; }
        .route-table input[type="number"] { width: 85px; text-align: right; }

        .expand-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--bev);
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }

        .expand-btn:hover {
          background: rgba(33, 196, 175, 0.05);
          border-color: var(--bev);
        }

        .stretch-drawer {
          background: var(--panel-alt);
          border: 1px dashed var(--border);
          border-radius: 10px;
          padding: 16px;
          margin-top: 8px;
        }

        .stretch-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-top: 12px;
        }

        @media(max-width: 1024px) {
          .stretch-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .stretch-card {
          background: var(--panel);
          border: 1px solid var(--border);
          padding: 12px;
          border-radius: 8px;
        }

        .vehicle-deck {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
          gap: 20px;
          margin-top: 16px;
        }

        .vehicle-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          box-shadow: var(--shadow-md);
          transition: border-color 0.2s ease-in-out;
        }

        .vehicle-card.active-electric { border-top: 4px solid var(--bev); }
        .vehicle-card.active-diesel { border-top: 4px solid var(--diesel); }

        .vcard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }

        .vcard-title {
          font-size: 18px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .seg {
          display: flex;
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--input-bg);
        }

        .seg button {
          flex: 1;
          background: transparent;
          color: var(--text-dim);
          border: none;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }

        .seg button.active {
          background: var(--bev);
          color: #0c0e0f;
          font-weight: 600;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .kpi-card {
          background: var(--panel-alt);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px;
          box-shadow: var(--shadow-sm);
        }

        .kpi-label {
          font-size: 11px;
          color: var(--text-dim);
          text-transform: uppercase;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .kpi-val {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .kpi-sub {
          font-size: 12px;
          color: var(--text-dim);
          margin-top: 4px;
          line-height: 1.5;
        }

        .alert-strip {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid var(--bad);
          color: var(--text);
          border-radius: 8px;
          padding: 14px;
          font-size: 13px;
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          line-height: 1.4;
        }

        .section-tag {
          font-size: 11px;
          font-weight: 700;
          color: var(--bev);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 20px 0 10px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 4px;
        }

        .legend-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 12px;
          color: var(--text-dim);
          margin-bottom: 12px;
        }

        .legend-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-good {
          background: rgba(16, 185, 129, 0.1);
          color: var(--good);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .badge-warn {
          background: rgba(226, 149, 50, 0.1);
          color: var(--diesel);
          border: 1px solid rgba(226, 149, 50, 0.2);
        }

        .badge-info {
          background: rgba(33, 196, 175, 0.1);
          color: var(--bev);
          border: 1px solid rgba(33, 196, 175, 0.2);
        }
      `}</style>

      {/* Header controls */}
      <div className="header">
        <div>
          <h1>
            <Truck size={26} style={{ display: "inline", verticalAlign: "-4px", marginRight: 10, color: "var(--bev)" }} />
            Enterprise Logistics & Duty Cycle TCO Simulator
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-dim)", fontSize: "14px" }}>
            Multi-vehicle comparative fleet planner utilizing custom weighted route profiles & sequential battery tracing
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* SECTION 1: Logistics Sizing */}
        <div className="panel">
          <h2><Package size={18} color="var(--bev)" /> 1. Logistics Sizing & Turnaround Requirements</h2>
          <div className="grid-3">
            <div>
              <Field label="Monthly Cargo Volume Goal" value={monthlyCargoVolume} onChange={setMonthlyCargoVolume} suffix="Tonnes" step={100} />
              <Field label="Operational Working Days" value={workingDaysPerMonth} onChange={setWorkingDaysPerMonth} suffix="Days/Month" step={1} />
            </div>
            <div>
              <Field label="Operating Hours Limit/Day" value={dailyOperatingLimitHrs} onChange={setDailyOperatingLimitHrs} suffix="Hours/Day" step={1} />
              <Field label="Turnaround Load/Unload Cost" value={loadingUnloadingTimePerTrip} onChange={setLoadingUnloadingTimePerTrip} suffix="Hours" step={0.5} />
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: "12.5px", color: "var(--text-dim)", lineHeight: "1.6", background: "var(--panel-alt)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <strong>Dynamic Fleet Optimization:</strong> Instead of estimating static fleet sizes, define your targets. The engine calculates turnaround dynamics, scales fleet sizes based on degradation limits, and structures charging infrastructure automatically.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Route Planner */}
        <div className="panel">
          <h2><MapPin size={18} color="var(--bev)" /> 2. Multi-Node Route Planner & Charging Network Siting</h2>
          
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
                        <td style={{ textAlign: "center" }}>
                          <input 
                            type="checkbox" 
                            checked={seg.hasDepotAtTo} 
                            onChange={(e) => updateSegmentProp(seg.id, "hasDepotAtTo", e.target.checked)}
                            style={{ width: "16px", height: "16px", accentColor: "var(--bev)", cursor: "pointer" }}
                          />
                        </td>
                        <td>
                          <button
                            className="expand-btn"
                            onClick={() => setExpandedSegmentId(expandedSegmentId === seg.id ? null : seg.id)}
                          >
                            {expandedSegmentId === seg.id ? "Close Configuration" : `Configure stretches (${activeStretchesSum}%)`}
                          </button>
                        </td>
                        <td>
                          <button className="remove-btn" onClick={() => handleRemoveSegment(seg.id)} disabled={routeSegments.length <= 1} style={{ background: "transparent", border: "none", color: "var(--bad)", cursor: "pointer" }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>

                      {expandedSegmentId === seg.id && (
                        <tr>
                          <td colSpan="8">
                            <div className="stretch-drawer">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                                <span style={{ fontWeight: 600, fontSize: "13px" }}>Segment Surface / Traffic Allocation Matrix (Target: 100%)</span>
                                <span className="num badge" style={{ background: activeStretchesSum !== 100 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: activeStretchesSum !== 100 ? "var(--bad)" : "var(--good)" }}>
                                  Matrix Sum: {activeStretchesSum}%
                                </span>
                              </div>

                              <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "var(--panel)",
                                border: "1px solid var(--border)",
                                borderRadius: "6px",
                                padding: "6px 10px",
                                marginBottom: "12px",
                                fontSize: "12px"
                              }}>
                                <Zap size={13} color="var(--bev)" />
                                <span style={{ color: "var(--text-dim)" }}>Segment Efficiency at {seg.payload}T:</span>
                                <strong className="num" style={{ color: "var(--bev)" }}>
                                  {computeWeightedEfficiency(seg.stretches, seg.payload).toFixed(3)} km/kWh-equiv
                                </strong>
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
                                            <input
                                              type="number"
                                              value={currentVal}
                                              onChange={(e) => updateStretchPercentage(seg.id, road, traffic, parseFloat(e.target.value) || 0)}
                                              style={{ width: "45px", padding: "4px", fontSize: "11.5px" }}
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

          <button className="add-btn" style={{ marginTop: "16px" }} onClick={handleAddSegment}>
            <Plus size={14} /> Add Route Segment
          </button>
        </div>

        {/* SECTION 3: Global Economic Overheads */}
        <div className="panel">
          <h2><Settings size={18} color="var(--bev)" /> 3. Economic parameters & Annual Escalations</h2>
          <div className="grid-3">
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Timeline parameters</div>
              <Field label="Analysis Window" value={analysisPeriod} onChange={setAnalysisPeriod} suffix="Years" step={1} />
              <Field label="Discount Rate (WACC)" value={discountRate} onChange={setDiscountRate} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Base Asset Overheads</div>
              <Field label="General Inflation Rate" value={escGeneral} onChange={setEscGeneral} suffix="%" step={0.5} />
              <Field label="Diesel Price Inflation" value={escFuel} onChange={setEscFuel} suffix="%" step={0.5} />
            </div>
            <div>
              <div className="section-tag" style={{ marginTop: 0 }}>Utility & Staff Overheads</div>
              <Field label="Electricity Tariff Inflation" value={escElectricity} onChange={setEscElectricity} suffix="%" step={0.5} />
              <Field label="Wages Inflation" value={escWages} onChange={setEscWages} suffix="%" step={0.5} />
              <Field label="Depot Leases Inflation" value={escInfrastructure} onChange={setEscInfrastructure} suffix="%" step={0.5} />
            </div>
          </div>
        </div>

        {/* SECTION 4: Vehicle Configurations */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, textTransform: "uppercase", fontSize: "18px" }}><Truck size={20} style={{ verticalAlign: "-3px", marginRight: "6px", color: "var(--bev)" }} /> 4. Configured Fleet Vehicle Profiles</h2>
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
            {vehicles.map((v) => (
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
                  <button className="remove-btn" onClick={() => handleRemoveVehicle(v.id)} disabled={vehicles.length <= 1} style={{ background: "transparent", border: "none", color: "var(--bad)", cursor: "pointer" }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="section-tag" style={{ marginTop: 0 }}>Base Unit Economics</div>
                <Field label="Ex-Showroom Price (Ex GST)" value={v.purchasePrice} onChange={(val) => updateVehicleProp(v.id, "purchasePrice", val)} suffix="₹" step={50000} />
                <Field label="GST Rate" value={v.gstRate} onChange={(val) => updateVehicleProp(v.id, "gstRate", val)} suffix="%" step={1} />
                <Field label="Tractor Weight" value={v.tractorWeight} onChange={(val) => updateVehicleProp(v.id, "tractorWeight", val)} suffix="kg" step={100} />
                <Field label="Trailer Weight" value={v.trailerWeight} onChange={(val) => updateVehicleProp(v.id, "trailerWeight", val)} suffix="kg" step={100} />
                <Field label="GVWR Limit" value={v.gvwr} onChange={(val) => updateVehicleProp(v.id, "gvwr", val)} suffix="kg" step={500} />

                {v.type === "diesel" ? (
                  <>
                    <div className="section-tag">Fuel Parameters</div>
                    <Field label="Baseline Fuel Economy" value={v.baseFuelEconomy} onChange={(val) => updateVehicleProp(v.id, "baseFuelEconomy", val)} suffix="km/l" step={0.1} />
                    <Field label="Diesel Retail Price" value={v.fuelOrElectricPrice} onChange={(val) => updateVehicleProp(v.id, "fuelOrElectricPrice", val)} suffix="₹/l" step={0.5} />
                  </>
                ) : (
                  <>
                    <div className="section-tag">Battery & Cycle Sizing</div>
                    <Field label="Battery Pack Sizing" value={v.batteryCapacity} onChange={(val) => updateVehicleProp(v.id, "batteryCapacity", val)} suffix="kWh" step={25} />
                    <Field label="Pack Replacement Cost" value={v.batteryReplacementCost} onChange={(val) => updateVehicleProp(v.id, "batteryReplacementCost", val)} suffix="₹" step={100000} />
                    <Field label="Cycle-wise SOH Degradation" value={v.batteryDegradationPerCycle} onChange={(val) => updateVehicleProp(v.id, "batteryDegradationPerCycle", val)} suffix="%" step={0.001} />
                    
                    <div className="field">
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span className="field-label" style={{ fontWeight: 600 }}>Adaptive Battery Lifecycle Sizing</span>
                        <span style={{ fontSize: "10.5px", color: "var(--text-dim)" }}>Compute physical limit dynamically rather than assuming a static 80%?</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={v.useDynamicSOHLimit} 
                        onChange={(e) => updateVehicleProp(v.id, "useDynamicSOHLimit", e.target.checked)}
                        style={{ width: "16px", height: "16px", accentColor: "var(--bev)", cursor: "pointer" }}
                      />
                    </div>

                    {!v.useDynamicSOHLimit && (
                      <Field label="Manual Target SOH Trigger" value={v.batterySOHThreshold} onChange={(val) => updateVehicleProp(v.id, "batterySOHThreshold", val)} suffix="%" step={1} />
                    )}
                    <Field label="Reserve Safe Limit Margin" value={v.safeSoCThreshold} onChange={(val) => updateVehicleProp(v.id, "safeSoCThreshold", val)} suffix="%" step={1} />
                  </>
                )}

                <div className="section-tag">Overhead & Operating Parameters</div>
                <Field label="Periodic Maintenance Overhead" value={v.maintCostPerKm} onChange={(val) => updateVehicleProp(v.id, "maintCostPerKm", val)} suffix="₹/km" step={0.1} />
                <Field label="Annual Insurance Rate" value={v.insuranceRatePct} onChange={(val) => updateVehicleProp(v.id, "insuranceRatePct", val)} suffix="%" step={0.25} />
                <Field label="Terminal Salvage Value" value={v.residualPct} onChange={(val) => updateVehicleProp(v.id, "residualPct", val)} suffix="%" step={1} />
                <Field label="Driver Monthly Base Salary" value={v.driverSalaryMonthly} onChange={(val) => updateVehicleProp(v.id, "driverSalaryMonthly", val)} suffix="₹" step={1000} />
                <Field label="Toll Overhead Per Trip" value={v.tollCostPerTrip} onChange={(val) => updateVehicleProp(v.id, "tollCostPerTrip", val)} suffix="₹" step={250} />
                <Field label="Tyre Cost (Set of 12)" value={v.tyreCostPerSet} onChange={(val) => updateVehicleProp(v.id, "tyreCostPerSet", val)} suffix="₹" step={5000} />
                <Field label="Expected Tyre Lifespan" value={v.tyreLifeKm} onChange={(val) => updateVehicleProp(v.id, "tyreLifeKm", val)} suffix="km" step={5000} />

                <div className="section-tag">Downtime allocations</div>
                <Field label="Scheduled Fleet Service" value={v.scheduledDowntimeDays} onChange={(val) => updateVehicleProp(v.id, "scheduledDowntimeDays", val)} suffix="Days/Year" step={1} />
                <Field label="Unscheduled Fleet Outages" value={v.unscheduledDowntimeHrs} onChange={(val) => updateVehicleProp(v.id, "unscheduledDowntimeHrs", val)} suffix="Hours/Year" step={1} />

                {v.type === "electric" && (
                  <>
                    <div className="section-tag">Charger Infrastructure Sizing</div>
                    <Field label="Station Setup Cost" value={v.stationCost} onChange={(val) => updateVehicleProp(v.id, "stationCost", val)} suffix="₹/station" step={100000} />
                    <Field label="Station Annual Upkeep" value={v.stationMaintenance} onChange={(val) => updateVehicleProp(v.id, "stationMaintenance", val)} suffix="₹/yr" step={10000} />
                    <Field label="Charger Dispenser Unit Cost" value={v.chargerCost} onChange={(val) => updateVehicleProp(v.id, "chargerCost", val)} suffix="₹/unit" step={50000} />
                    <Field label="Charger Annual Upkeep" value={v.chargerMaintenance} onChange={(val) => updateVehicleProp(v.id, "chargerMaintenance", val)} suffix="₹/yr" step={5000} />
                    <Field label="Infra Subsidies / Incentives" value={v.infrastructureTaxCredit} onChange={(val) => updateVehicleProp(v.id, "infrastructureTaxCredit", val)} suffix="%" step={1} />
                    <Field label="Fast-Charging Window" value={v.chargingTimePerCycle} onChange={(val) => updateVehicleProp(v.id, "chargingTimePerCycle", val)} suffix="Hours" step={0.1} />
                    <Field label="Depot Electricity Rate" value={v.electricityRate} onChange={(val) => updateVehicleProp(v.id, "electricityRate", val)} suffix="₹/kWh" step={0.5} />
                    <Field label="Monthly Depot Land Lease" value={v.depotLandLeaseMonthly} onChange={(val) => updateVehicleProp(v.id, "depotLandLeaseMonthly", val)} suffix="₹" step={5000} />
                    <Field label="Monthly Peak Demand Fee" value={v.depotDemandChargesMonthly} onChange={(val) => updateVehicleProp(v.id, "depotDemandChargesMonthly", val)} suffix="₹" step={5000} />
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
            ))}
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
                      · <strong>{v.name}</strong> payload capacity is capped at <strong>{v.payloadCap.toFixed(1)}T</strong> (Segment cargo is capped to this limit during simulation runs).
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 6: Analytics Dashboard */}
        <div className="panel" style={{ border: "2px solid var(--bev)", boxShadow: "var(--shadow-glow)" }}>
          <h2 style={{ color: "var(--bev)" }}><TrendingUp size={20} /> 5. Logistics Optimization & Comparative TCO Analytics</h2>

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
                  Turnaround: <strong className="num">{v.turnaroundCycleHrs.toFixed(2)} Hrs</strong><br />
                  Trips/Yr/Unit: <strong className="num">{Math.round(v.tripsPerYearPerVehicle)}</strong><br />
                  Total fleet distance: <strong className="num">{Math.round(v.totalDistanceAcrossFleetYear).toLocaleString()} km/yr</strong><br />
                  {v.type === "electric" ? (
                    <>
                      Station Count: <strong className="num">{v.uniqueStationsCount} Stops</strong><br />
                      Total Sized Chargers: <strong className="num">{v.totalChargersNeeded} Units</strong>
                    </>
                  ) : (
                    <span>Charging Stops: <strong className="num">0</strong></span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sequential SoC Trace details */}
          {results.computedVehicles.some(v => v.type === "electric") && (
            <div style={{ background: "var(--panel-alt)", padding: "18px", borderRadius: "10px", marginBottom: "24px", border: "1px solid var(--border)" }}>
              <div className="kpi-label" style={{ color: "var(--bev)" }}>
                <BatteryCharging size={16} style={{ marginRight: 6 }} /> Sequential Route SoC tracing & localized charging stations
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "12px" }}>
                {results.computedVehicles.map((v) => {
                  if (v.type !== "electric") return null;
                  return (
                    <div key={v.id} style={{ flex: 1, minWidth: "300px" }}>
                      <strong style={{ fontSize: "13px", display: "block", marginBottom: "8px" }}>{v.name} Charge Event Sequence:</strong>
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
                                State of Charge: <span className="num">{log.socBefore}% SoC</span> → <span className="num">{log.socAfter}% SOH</span>
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

          {/* SOH Degradation and Replacement Summary */}
          <div style={{ marginBottom: "24px" }} className="grid-3">
            {results.computedVehicles.map((v, idx) => {
              if (v.type !== "electric") return null;
              return (
                <div key={v.id} className="kpi-card" style={{ background: "var(--panel)", borderLeft: `4px solid ${VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}` }}>
                  <div className="kpi-label">{v.name} Battery Degradation & Life cycle policy</div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Critical physical range SOH:</span>
                      <strong className="num badge badge-warn" style={{ fontSize: "12px" }}>{v.criticalSOHLimit.toFixed(1)}% SOH</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Resolved trigger limit:</span>
                      <strong className="num badge badge-info" style={{ fontSize: "12px" }}>{v.resolvedSOHReplacementLimit.toFixed(1)}% SOH</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Analysis end SOH:</span>
                      <strong className="num" style={{ fontSize: "12px" }}>{v.currentSOH.toFixed(1)}%</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Battery swaps completed:</span>
                      <strong className="num" style={{ fontSize: "12px" }}>{v.batterySetsReplacedCount} sets</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "12px", lineHeight: "1.5", borderTop: "1px dashed var(--border)", paddingTop: "8px" }}>
                    {v.useDynamicSOHLimit ? (
                      <span>
                        <CheckCircle2 size={12} style={{ display: "inline", verticalAlign: "-2px", color: "var(--good)", marginRight: 4 }} />
                        Dynamically sized replacement at <strong>{v.resolvedSOHReplacementLimit.toFixed(1)}% SOH</strong> to ensure the truck can complete its largest single-charge gap without getting stranded.
                      </span>
                    ) : (
                      <span>
                        SOH Replacement scheduled blindly at static <strong>{v.batterySOHThreshold}%</strong> limit.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sized Station & Chargers Siting Table */}
          {results.computedVehicles.some(v => v.type === "electric") && (
            <div style={{ background: "var(--panel-alt)", padding: "18px", borderRadius: "10px", marginBottom: "24px", border: "1px solid var(--border)" }}>
              <div className="kpi-label" style={{ color: "var(--bev)" }}>
                <PlugZap size={16} style={{ marginRight: 6 }} /> localized Charging Station Sizing Profiles (1 Station Per Stop, Variable Chargers)
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
                          <td>
                            <strong>{v.name}</strong> - {st.label}
                          </td>
                          <td className="num" style={{ textAlign: "right" }}>{st.km} km</td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`badge ${st.isDepot ? "badge-info" : "badge-warn"}`}>
                              {st.isDepot ? "Terminal Depot" : "Highway charger"}
                            </span>
                          </td>
                          <td className="num" style={{ textAlign: "center" }}>1 Station</td>
                          <td className="num" style={{ textAlign: "center", fontWeight: "bold", color: "var(--bev)" }}>
                            {st.chargersSized} High-Speed Plugs
                          </td>
                          <td className="num" style={{ textAlign: "right" }}>
                            {inr(st.stationSetupCost + st.chargersCostSum)}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={results.chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="var(--text-dim)" label={{ value: "Operating Year", position: "insideBottom", offset: -5, fill: "var(--text-dim)", fontSize: 11 }} />
                <YAxis stroke="var(--text-dim)" tickFormatter={(v) => inrCompact(v)} width={80} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }} formatter={(v) => inr(v)} />
                {results.computedVehicles.map((v, idx) => (
                  <Line
                    key={v.id}
                    type="monotone"
                    dataKey={v.name}
                    stroke={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cost Category Breakdown */}
          <div style={{ marginTop: "32px" }}>
            <h3 style={{ fontSize: "15px", textTransform: "uppercase", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px", color: "var(--text)" }}>
              NPV Cost Category breakdown comparison
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={[
                  {
                    category: "Capital Setup & Infra",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.upfront }), {})
                  },
                  {
                    category: "Fuel & Energy Tariffs",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.fuelOrEnergy }), {})
                  },
                  {
                    category: "EMI Debt Amortization",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.emi }), {})
                  },
                  {
                    category: "Maintenance & Ins",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.maintenance }), {})
                  },
                  {
                    category: "Staff Base Salaries",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.wages }), {})
                  },
                  {
                    category: "Road Tolls & Tyres",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.tolls + v.breakdown.tyres }), {})
                  },
                  {
                    category: "Battery pack swaps",
                    ...results.computedVehicles.reduce((acc, v) => ({ ...acc, [v.name]: v.breakdown.batteryReplacements }), {})
                  },
                  {
                    category: "Depot Leases & Upkeep",
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

          {/* Model methodology notes */}
          <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "28px", display: "flex", gap: "8px", alignItems: "flex-start", lineHeight: "1.5", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: "2px", color: "var(--bev)" }} />
            <span>
              <strong>Methodology & Verification Note:</strong> The cost per tonne-kilometer metric is computed from the Net Present Value (NPV) divided by the absolute lifetime volume transported across the route. Charging network infrastructure is built with high specificity: each unique charging coordinate consists of exactly <strong>one station grid</strong> with a localized count of fast-chargers sized to accommodate your daily scheduling demands. Dynamic battery lifecycles evaluate the maximum continuous energy draw across all route segments to secure a safe, range-limiting replacement threshold, preventing roadside outages as the battery pack degrades.
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

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