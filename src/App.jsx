import React, { useState, useMemo } from "react";
import {
  Truck, Zap, Fuel, BatteryCharging, TrendingUp, TrendingDown,
  Flag, Package, Info, RotateCcw, PlugZap, ShieldCheck, Layers
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceDot,
} from "recharts";

const DEFAULTS = {
  // Fleet & Scale
  fleetSize: 250,
  fleetStations: 13,  // Explicit number of charging locations/depots
  fleetChargers: 39, // Explicit total chargers/dispensers in fleet

  // Duty cycle
  analysisPeriod: 10,
  annualMileage: 120000,
  loadedDistancePct: 50, // % of distance driven with cargo (e.g. 50% means empty return half the time)
  discountRate: 9,
  costEscalation: 5,

  // Diesel tractor-trailer (55T GVW)
  dieselPurchasePrice: 4000000,
  gstDiesel: 18,
  fuelEconomy: 4.,
  dieselPrice: 96,
  dieselPriceEscalation: 5,
  dieselMaintCostPerKm: 4,
  dieselInsuranceRate: 3,
  dieselResidualValue: 10,
  dieselFinancing: "cash", // "cash" | "emi"
  dieselDownPaymentPct: 20,
  dieselLoanInterestRate: 11,
  dieselLoanTenure: 5,

  // Electric tractor-trailer
  bevPurchasePrice: 10000000,
  gstBEV: 5,
  batteryCapacity: 300,
  electricEfficiency: 1.5,
  batteryReplacementCost: 4000000,
  batteryDegradationPerCycle: 0.005,
  batterySOHThreshold: 80,
  bevMaintCostPerKm: 4,
  bevInsurancePremiumDiff: 20,
  bevResidualValue: 5,
  bevFinancing: "cash", // "cash" | "emi"
  bevDownPaymentPct: 20,
  bevLoanInterestRate: 10,
  bevLoanTenure: 6,

  // Charging & energy
  chargingType: "private",
  privateElectricityRate: 8,
  publicChargingRate: 16,
  electricityEscalation: 3,
  stationCost: 5000000,        // Capital setup cost per depot (grid, transformer, civil works)
  stationMaintenance: 200000,  // Annual maintenance per depot (demand charges, land lease, safety)
  chargerCost: 1500000,        // Capital cost per heavy-duty fast charger unit
  chargerMaintenance: 50000,   // Annual maintenance per fast charger unit
  infrastructureTaxCredit: 0,
  chargingTimePerCycle: 1.5,
  driverLaborCost: 0,

  // Incentives
  stateIncentiveBEV: 0,

  // Payload / weights (kg)
  gvwrDiesel: 55000,
  gvwrBEV: 55000,
  curbWeightDieselTractor: 9000,
  curbWeightBEVTractor: 10000,
  emptyTrailerWeight: 9000,
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

function compute(inp) {
  const n = Math.max(1, Math.round(inp.analysisPeriod));
  const disc = inp.discountRate / 100;
  const escC = inp.costEscalation / 100;
  const escD = inp.dieselPriceEscalation / 100;
  const escE = inp.electricityEscalation / 100;

  const dieselPriceIncGST = inp.dieselPurchasePrice * (1 + inp.gstDiesel / 100);
  const bevPriceIncGST = inp.bevPurchasePrice * (1 + inp.gstBEV / 100);
  const bevPriceAfterIncentive = bevPriceIncGST * (1 - inp.stateIncentiveBEV / 100);

  // EMI loan terms setup
  function loanTerms(price, financing, downPct, annualRatePct, tenureYears) {
    if (financing !== "emi" || tenureYears <= 0) {
      return { upfront: price, annualPayment: 0, tenureYears: 0, principal: 0, interestTotal: 0 };
    }
    const downPayment = price * (downPct / 100);
    const principal = Math.max(0, price - downPayment);
    const monthlyRate = annualRatePct / 1200;
    const nMonths = tenureYears * 12;
    const monthlyEMI = monthlyRate > 0
      ? (principal * monthlyRate * Math.pow(1 + monthlyRate, nMonths)) / (Math.pow(1 + monthlyRate, nMonths) - 1)
      : principal / nMonths;
    const annualPayment = monthlyEMI * 12;
    const interestTotal = Math.max(0, annualPayment * tenureYears - principal);
    return { upfront: downPayment, annualPayment, tenureYears, principal, interestTotal };
  }

  const dieselLoan = loanTerms(dieselPriceIncGST, inp.dieselFinancing, inp.dieselDownPaymentPct, inp.dieselLoanInterestRate, inp.dieselLoanTenure);
  const bevLoan = loanTerms(bevPriceAfterIncentive, inp.bevFinancing, inp.bevDownPaymentPct, inp.bevLoanInterestRate, inp.bevLoanTenure);
  
  // Amortize stations and chargers pro-rata per vehicle for single-vehicle views
  const chargerRatio = inp.fleetChargers / Math.max(1, inp.fleetSize);
  const stationRatio = inp.fleetStations / Math.max(1, inp.fleetSize);

  const stationCostTotalPerVehicle = inp.stationCost * stationRatio;
  const chargerCostTotalPerVehicle = inp.chargerCost * chargerRatio;
  const infraCostTotalPerVehicle = stationCostTotalPerVehicle + chargerCostTotalPerVehicle;
  
  const chargerCostAfterCredit = infraCostTotalPerVehicle * (1 - inp.infrastructureTaxCredit / 100);

  const electricityRate = inp.chargingType === "private" ? inp.privateElectricityRate : inp.publicChargingRate;
  const usableCapacityNominal = inp.batteryCapacity * 0.85;
  const rangePerCharge = Math.max(1, usableCapacityNominal / Math.max(0.01, inp.electricEfficiency));
  const cyclesPerYear = inp.annualMileage / rangePerCharge;

  let sohStart = 100;
  let cyclesSinceReplacement = 0;
  let distanceSinceReplacement = 0;
  let yearsSinceReplacement = 0;
  const replacementEvents = [];

  let dieselCum = [dieselLoan.upfront];
  let bevCum = [bevLoan.upfront + chargerCostAfterCredit];

  // Track discounted (NPV) breakdown categories
  const dieselBreak = { 
    Acquisition: dieselLoan.upfront, 
    "Loan principal": 0, 
    "Financing interest": 0, 
    Fuel: 0, 
    Maintenance: 0, 
    Insurance: 0,
    "Residual value": 0
  };
  const bevBreak = { 
    Acquisition: bevLoan.upfront, 
    "Loan principal": 0, 
    "Financing interest": 0, 
    Infrastructure: chargerCostAfterCredit, 
    Energy: 0, 
    Maintenance: 0, 
    Insurance: 0, 
    "Charging downtime": 0, 
    "Battery replacement": 0,
    "Residual value": 0
  };

  let npvDiesel = dieselLoan.upfront;
  let npvBEV = bevLoan.upfront + chargerCostAfterCredit;

  // Running loan balance tracking for step-by-step amortization
  let balanceD = dieselLoan.principal;
  let balanceB = bevLoan.principal;

  const rows = [];

  for (let t = 1; t <= n; t++) {
    const df = 1 / Math.pow(1 + disc, t);

    // Precise year-by-year amortization calculation for Diesel loan
    let interestPaidD = 0;
    let principalPaidD = 0;
    if (inp.dieselFinancing === "emi" && t <= dieselLoan.tenureYears) {
      const monthlyRate = inp.dieselLoanInterestRate / 1200;
      for (let m = 0; m < 12; m++) {
        const mInterest = balanceD * monthlyRate;
        const mEMI = dieselLoan.annualPayment / 12;
        const mPrincipal = Math.min(balanceD, mEMI - mInterest);
        interestPaidD += mInterest;
        principalPaidD += mPrincipal;
        balanceD = Math.max(0, balanceD - mPrincipal);
      }
    }

    const fuelCost = (inp.annualMileage / Math.max(0.01, inp.fuelEconomy)) * inp.dieselPrice * Math.pow(1 + escD, t - 1);
    const maintCostD = inp.annualMileage * inp.dieselMaintCostPerKm * Math.pow(1 + escC, t - 1);
    const insCostD = dieselPriceIncGST * (inp.dieselInsuranceRate / 100) * Math.pow(1 + escC, t - 1);
    const dieselEMIThisYear = interestPaidD + principalPaidD;
    const yearCostD = fuelCost + maintCostD + insCostD + dieselEMIThisYear;

    // Accumulate discounted NPV categories for Diesel
    dieselBreak.Fuel += fuelCost * df;
    dieselBreak.Maintenance += maintCostD * df;
    dieselBreak.Insurance += insCostD * df;
    dieselBreak["Loan principal"] += principalPaidD * df;
    dieselBreak["Financing interest"] += interestPaidD * df;

    npvDiesel += yearCostD * df;
    dieselCum.push(dieselCum[dieselCum.length - 1] + yearCostD);

    // Precise year-by-year amortization calculation for Electric loan
    let interestPaidB = 0;
    let principalPaidB = 0;
    if (inp.bevFinancing === "emi" && t <= bevLoan.tenureYears) {
      const monthlyRate = inp.bevLoanInterestRate / 1200;
      for (let m = 0; m < 12; m++) {
        const mInterest = balanceB * monthlyRate;
        const mEMI = bevLoan.annualPayment / 12;
        const mPrincipal = Math.min(balanceB, mEMI - mInterest);
        interestPaidB += mInterest;
        principalPaidB += mPrincipal;
        balanceB = Math.max(0, balanceB - mPrincipal);
      }
    }

    const usableCapacityThisYear = usableCapacityNominal * (sohStart / 100);
    const rangeThisYear = Math.max(1, usableCapacityThisYear / Math.max(0.01, inp.electricEfficiency));
    const cyclesThisYear = inp.annualMileage / rangeThisYear;

    const energyCost = inp.annualMileage * inp.electricEfficiency * electricityRate * Math.pow(1 + escE, t - 1);
    const maintCostB = inp.annualMileage * inp.bevMaintCostPerKm * Math.pow(1 + escC, t - 1);
    const insCostB = bevPriceAfterIncentive * (inp.dieselInsuranceRate / 100) * (1 + inp.bevInsurancePremiumDiff / 100) * Math.pow(1 + escC, t - 1);
    
    const stationMaintPerVehicle = inp.stationMaintenance * stationRatio * Math.pow(1 + escC, t - 1);
    const chargerMaintPerVehicle = inp.chargerMaintenance * chargerRatio * Math.pow(1 + escC, t - 1);
    const totalInfraMaintPerVehicle = stationMaintPerVehicle + chargerMaintPerVehicle;

    const downtimeCost = cyclesThisYear * inp.chargingTimePerCycle * inp.driverLaborCost;
    const bevEMIThisYear = interestPaidB + principalPaidB;

    cyclesSinceReplacement += cyclesThisYear;
    distanceSinceReplacement += inp.annualMileage;
    yearsSinceReplacement += 1;
    const sohNow = Math.max(20, 100 - inp.batteryDegradationPerCycle * cyclesSinceReplacement);

    let boundBy = null;
    if (sohNow <= inp.batterySOHThreshold) boundBy = "SOH degradation";

    const batteryCost = boundBy ? inp.batteryReplacementCost : 0;
    if (boundBy) {
      replacementEvents.push({ year: t, boundBy, cycles: Math.round(cyclesSinceReplacement) });
      sohStart = 100;
      cyclesSinceReplacement = 0;
      distanceSinceReplacement = 0;
      yearsSinceReplacement = 0;
    } else {
      sohStart = sohNow;
    }

    const yearCostB = energyCost + maintCostB + insCostB + totalInfraMaintPerVehicle + downtimeCost + batteryCost + bevEMIThisYear;
    
    // Accumulate discounted NPV categories for Electric
    bevBreak.Energy += energyCost * df;
    bevBreak.Maintenance += maintCostB * df;
    bevBreak.Insurance += insCostB * df;
    bevBreak.Infrastructure += totalInfraMaintPerVehicle * df;
    bevBreak["Charging downtime"] += downtimeCost * df;
    bevBreak["Battery replacement"] += batteryCost * df;
    bevBreak["Loan principal"] += principalPaidB * df;
    bevBreak["Financing interest"] += interestPaidB * df;

    npvBEV += yearCostB * df;
    bevCum.push(bevCum[bevCum.length - 1] + yearCostB);

    rows.push({ year: t, diesel: dieselCum[t], bev: bevCum[t] });
  }

  const sohAtEnd = sohStart;
  const firstReplacement = replacementEvents[0] || null;
  const effectiveBatteryLifeYears = firstReplacement ? firstReplacement.year : n;
  const cyclesToFirstReplacement = firstReplacement ? firstReplacement.cycles : Math.round(cyclesSinceReplacement);

  const dfN = 1 / Math.pow(1 + disc, n);
  const residualD = inp.dieselPurchasePrice * (inp.dieselResidualValue / 100);
  const residualB = inp.bevPurchasePrice * (inp.bevResidualValue / 100);
  
  // Discount residual value back to Year 0 (NPV)
  const discountedResidualD = residualD * dfN;
  const discountedResidualB = residualB * dfN;

  npvDiesel -= discountedResidualD;
  npvBEV -= discountedResidualB;
  dieselCum[n] -= residualD;
  bevCum[n] -= residualB;
  
  if (rows.length) {
    rows[rows.length - 1].diesel = dieselCum[n];
    rows[rows.length - 1].bev = bevCum[n];
  }

  const chartData = [{ year: 0, diesel: dieselCum[0], bev: bevCum[0] }, ...rows];

  const payloadDiesel = inp.gvwrDiesel - inp.curbWeightDieselTractor - inp.emptyTrailerWeight;
  const payloadBEV = inp.gvwrBEV - inp.curbWeightBEVTractor - inp.emptyTrailerWeight;
  const payloadDieselT = payloadDiesel / 1000;
  const payloadBEVT = payloadBEV / 1000;

  // Payload Parity Scaling Ratios for Fleet Parity views
  const payloadRatio = payloadDieselT / payloadBEVT;
  const fleetSizeBEVEquated = inp.fleetSize * payloadRatio;
  const fleetStationsBEVEquated = inp.fleetStations * payloadRatio;
  const fleetChargersBEVEquated = inp.fleetChargers * payloadRatio;

  // Calculate unit economics based on loaded km, isolating empty runs
  const loadedFraction = inp.loadedDistancePct / 100;
  const loadedDistanceLife = inp.annualMileage * loadedFraction * n;

  const costPerTonneKmDiesel = npvDiesel / (payloadDieselT * loadedDistanceLife);
  const costPerTonneKmBEV = npvBEV / (payloadBEVT * loadedDistanceLife);

  // Set residual values as negative categories in breakdown to match cards perfectly
  dieselBreak["Residual value"] = -discountedResidualD;
  bevBreak["Residual value"] = -discountedResidualB;

  const breakdownData = [
    { category: "Acquisition", Diesel: dieselBreak.Acquisition, Electric: bevBreak.Acquisition },
    { category: "Loan principal", Diesel: dieselBreak["Loan principal"], Electric: bevBreak["Loan principal"] },
    { category: "Financing interest", Diesel: dieselBreak["Financing interest"], Electric: bevBreak["Financing interest"] },
    { category: "Fuel / Energy", Diesel: dieselBreak.Fuel, Electric: bevBreak.Energy },
    { category: "Maintenance", Diesel: dieselBreak.Maintenance, Electric: bevBreak.Maintenance },
    { category: "Insurance", Diesel: dieselBreak.Insurance, Electric: bevBreak.Insurance },
    { category: "Infrastructure", Diesel: 0, Electric: bevBreak.Infrastructure },
    { category: "Charging downtime", Diesel: 0, Electric: bevBreak["Charging downtime"] },
    { category: "Battery replacement", Diesel: 0, Electric: bevBreak["Battery replacement"] },
    { category: "Residual value", Diesel: dieselBreak["Residual value"], Electric: bevBreak["Residual value"] }
  ];

  return {
    n, npvDiesel, npvBEV, chartData, breakdownData, chargerRatio, stationRatio,
    costPerKmDiesel: npvDiesel / (inp.annualMileage * n),
    costPerKmBEV: npvBEV / (inp.annualMileage * n),
    payloadDiesel, payloadBEV, payloadDieselT, payloadBEVT, rangePerCharge, cyclesPerYear,
    costPerTonneKmDiesel, costPerTonneKmBEV, payloadRatio, fleetSizeBEVEquated, fleetStationsBEVEquated, fleetChargersBEVEquated,
    effectiveBatteryLifeYears, sohAtEnd, cyclesToFirstReplacement, replacementEvents,
    dieselLoan, bevLoan,
  };
}

function Field({ label, value, onChange, suffix, step = 1, min = 0 }) {
  return (
    <label className="field">
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
    </label>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="section">
      <div className="section-head">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}

export default function TCOCalculator() {
  const [inp, setInp] = useState(DEFAULTS);
  const [viewMode, setViewMode] = useState("vehicle"); // "vehicle" | "fleetNominal" | "fleetEquated"
  
  const set = (k) => (v) => setInp((s) => ({ ...s, [k]: v }));
  const results = useMemo(() => compute(inp), [inp]);

  // Determine scaling multipliers based on selected view mode
  const dieselMultiplier = viewMode === "vehicle" ? 1 : inp.fleetSize;
  const bevMultiplier = 
    viewMode === "vehicle" 
      ? 1 
      : (viewMode === "fleetNominal" ? inp.fleetSize : results.fleetSizeBEVEquated);

  const scaledNpvDiesel = results.npvDiesel * dieselMultiplier;
  const scaledNpvBEV = results.npvBEV * bevMultiplier;

  const savings = scaledNpvDiesel - scaledNpvBEV;
  const savingsPct = (savings / scaledNpvDiesel) * 100;

  // Re-calculate the exact break-even year based on the scaled multipliers
  let breakevenYear = null;
  for (let t = 1; t <= results.n; t++) {
    const prevDiesel = results.chartData[t - 1].diesel * dieselMultiplier;
    const prevBev = results.chartData[t - 1].bev * bevMultiplier;
    const curDiesel = results.chartData[t].diesel * dieselMultiplier;
    const curBev = results.chartData[t].bev * bevMultiplier;

    const prevDiff = prevDiesel - prevBev;
    const curDiff = curDiesel - curBev;
    
    if (prevDiff < 0 && curDiff >= 0) {
      breakevenYear = t - 1 + prevDiff / (prevDiff - curDiff || 1);
      break;
    }
    if (prevDiff >= 0 && t === 1) {
      breakevenYear = 0;
      break;
    }
  }

  // Scale data arrays dynamically for rendering
  const chartData = results.chartData.map((d) => ({
    year: d.year,
    diesel: d.diesel * dieselMultiplier,
    bev: d.bev * bevMultiplier,
  }));

  const breakdownData = results.breakdownData.map((d) => ({
    category: d.category,
    Diesel: d.Diesel * dieselMultiplier,
    Electric: d.Electric * bevMultiplier,
  }));

  return (
    <div className="wrap">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght=500;600;700&family=Inter:wght=400;500;600&family=JetBrains+Mono:wght=400;500;700&display=swap');
        
        html, body {
          background-color: #14181a;
          margin: 0;
          padding: 0;
        }

        .wrap {
          --bg: #14181a; --panel: #1d2224; --panel-alt: #232a2c; --border: #333b3d;
          --text: #f0ede4; --dim: #98a3a1; --diesel: #e8a33d; --bev: #29c9b2;
          --good: #5fbf7a; --bad: #e2604f;
          background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif;
          padding: 24px; border-radius: 12px; min-height: 100vh;
          max-width: 1440px;
          margin: 0 auto;
        }
        .wrap * { box-sizing: border-box; }
        h1, h2, h3, .display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.02em; }
        .num { font-family: 'JetBrains Mono', monospace; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .header h1 { font-size: 30px; font-weight: 700; margin: 0; text-transform: uppercase; }
        .header p { color: var(--dim); margin: 4px 0 0; font-size: 14px; }
        .reset-btn { display: flex; align-items: center; gap: 6px; background: var(--panel-alt); border: 1px solid var(--border); color: var(--text); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }
        .reset-btn:hover { border-color: var(--diesel); }
        
        .layout { display: flex; gap: 24px; align-items: flex-start; }
        
        .col-inputs { 
          width: 340px; 
          flex-shrink: 0; 
          display: flex; 
          flex-direction: column; 
          gap: 14px; 
          max-height: calc(100vh - 140px); 
          overflow-y: auto; 
          padding-right: 6px; 
        }

        .col-inputs::-webkit-scrollbar {
          width: 6px;
        }
        .col-inputs::-webkit-scrollbar-track {
          background: transparent;
        }
        .col-inputs::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }
        .col-inputs::-webkit-scrollbar-thumb:hover {
          background: var(--dim);
        }

        .col-results { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
        
        .section { 
          background: var(--panel); 
          border: 1px solid var(--border); 
          border-radius: 10px; 
          overflow: hidden; 
          flex-shrink: 0;
        }
        .section-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--panel-alt); border-bottom: 1px solid var(--border); }
        .section-head h3 { margin: 0; font-size: 17px; font-weight: 600; text-transform: uppercase; }
        .section-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
        .field { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .field-label { font-size: 12.5px; color: var(--dim); flex: 1; }
        .field-input { display: flex; align-items: center; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .field-input input { width: 92px; background: transparent; border: none; color: var(--text); padding: 6px 8px; font-family: 'JetBrains Mono', monospace; font-size: 13px; text-align: right; }
        .field-input input:focus { outline: none; }
        .field-suffix { font-size: 11px; color: var(--dim); padding-right: 8px; }
        .seg { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .seg button { flex: 1; background: var(--bg); color: var(--dim); border: none; padding: 6px 0; font-size: 12px; cursor: pointer; }
        .seg button.active { background: var(--bev); color: #0c1414; font-weight: 600; }
        
        .view-selector {
          display: flex;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 4px;
          gap: 4px;
        }
        .view-selector button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--dim);
          padding: 10px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .view-selector button:hover {
          color: var(--text);
          background: var(--panel-alt);
        }
        .view-selector button.active {
          background: var(--bev);
          color: #0c1414;
          font-weight: 600;
        }

        .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
        .stat-card .label { font-size: 12px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .stat-card .value { font-size: 24px; font-weight: 700; }
        .stat-card .value.diesel { color: var(--diesel); }
        .stat-card .value.bev { color: var(--bev); }
        .stat-card .value.good { color: var(--good); }
        .stat-card .sub { font-size: 12px; color: var(--dim); margin-top: 4px; }
        .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 18px; }
        .panel h2 { font-size: 19px; margin: 0 0 12px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
        .legend-row { display: flex; gap: 18px; font-size: 12px; color: var(--dim); margin-bottom: 4px; }
        .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; margin-right: 5px; }
        .insight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .insight { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
        .insight .title { font-size: 12px; color: var(--dim); text-transform: uppercase; margin-bottom: 6px; }
        .insight .big { font-size: 20px; font-weight: 700; }
        .foot-note { font-size: 11.5px; color: var(--dim); display: flex; gap: 8px; align-items: flex-start; line-height: 1.5; }
        
        @media (max-width: 960px) {
          .layout { flex-direction: column; align-items: center; }
          .col-inputs { width: 100%; max-width: 520px; max-height: none; padding-right: 0; }
          .col-results { width: 100%; max-width: 100%; }
          .stat-row { grid-template-columns: repeat(2, 1fr); }
          .insight-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .stat-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="header">
        <div>
          <h1><Truck size={26} style={{ display: "inline", verticalAlign: "-4px", marginRight: 8 }} />55T Tractor-Trailer TCO — India</h1>
          <p>Diesel vs. battery-electric total cost of ownership for a 55-tonne GVW long-haul tractor-trailer, sized for the Indian market</p>
        </div>
        <button className="reset-btn" onClick={() => setInp(DEFAULTS)}>
          <RotateCcw size={14} /> Reset to defaults
        </button>
      </div>

      <div className="layout">
        <div className="col-inputs">
          <Section icon={<Layers size={16} color="var(--dim)" />} title="Fleet & scale">
            <Field label="Fleet size (Diesel)" value={inp.fleetSize} onChange={set("fleetSize")} suffix="trucks" step={1} />
            <Field label="Total Fleet Stations" value={inp.fleetStations} onChange={set("fleetStations")} suffix="stations" step={1} />
            <Field label="Total Fleet Chargers" value={inp.fleetChargers} onChange={set("fleetChargers")} suffix="chargers" step={1} />
            <div className="foot-note" style={{ marginTop: 4 }}>
              Depot Ratio: {(inp.fleetSize / Math.max(1, inp.fleetStations)).toFixed(1)} trucks/station · {(inp.fleetChargers / Math.max(1, inp.fleetStations)).toFixed(1)} chargers/station · {(inp.fleetChargers / Math.max(1, inp.fleetSize) * 100).toFixed(1)}% charger-to-truck ratio [1].
            </div>
          </Section>

          <Section icon={<Truck size={16} color="var(--dim)" />} title="Duty cycle">
            <Field label="Analysis period" value={inp.analysisPeriod} onChange={set("analysisPeriod")} suffix="years" step={1} />
            <Field label="Annual distance" value={inp.annualMileage} onChange={set("annualMileage")} suffix="km" step={1000} />
            <Field label="Loaded distance ratio" value={inp.loadedDistancePct} onChange={set("loadedDistancePct")} suffix="%" step={5} />
            <Field label="Discount rate" value={inp.discountRate} onChange={set("discountRate")} suffix="%" step={0.5} />
            <Field label="General cost escalation" value={inp.costEscalation} onChange={set("costEscalation")} suffix="%/yr" step={0.5} />
          </Section>

          <Section icon={<Fuel size={16} color="var(--diesel)" />} title="Diesel truck">
            <Field label="Purchase price (ex-GST)" value={inp.dieselPurchasePrice} onChange={set("dieselPurchasePrice")} suffix="₹" step={50000} />
            <Field label="GST on vehicle" value={inp.gstDiesel} onChange={set("gstDiesel")} suffix="%" step={1} />
            <Field label="Fuel economy" value={inp.fuelEconomy} onChange={set("fuelEconomy")} suffix="km/l" step={0.1} />
            <Field label="Diesel price" value={inp.dieselPrice} onChange={set("dieselPrice")} suffix="₹/l" step={1} />
            <Field label="Diesel price escalation" value={inp.dieselPriceEscalation} onChange={set("dieselPriceEscalation")} suffix="%/yr" step={0.5} />
            <Field label="Maintenance cost" value={inp.dieselMaintCostPerKm} onChange={set("dieselMaintCostPerKm")} suffix="₹/km" step={0.5} />
            <Field label="Insurance rate" value={inp.dieselInsuranceRate} onChange={set("dieselInsuranceRate")} suffix="%/yr of price" step={0.25} />
            <Field label="Residual value" value={inp.dieselResidualValue} onChange={set("dieselResidualValue")} suffix="% at end" step={1} />
            <div className="field">
              <span className="field-label">Financing</span>
              <div className="seg" style={{ width: 150 }}>
                <button className={inp.dieselFinancing === "cash" ? "active" : ""} onClick={() => set("dieselFinancing")("cash")}>Cash</button>
                <button className={inp.dieselFinancing === "emi" ? "active" : ""} onClick={() => set("dieselFinancing")("emi")}>EMI</button>
              </div>
            </div>
            {inp.dieselFinancing === "emi" && (
              <>
                <Field label="Down payment" value={inp.dieselDownPaymentPct} onChange={set("dieselDownPaymentPct")} suffix="%" step={5} />
                <Field label="Loan interest rate" value={inp.dieselLoanInterestRate} onChange={set("dieselLoanInterestRate")} suffix="%/yr" step={0.25} />
                <Field label="Loan tenure" value={inp.dieselLoanTenure} onChange={set("dieselLoanTenure")} suffix="years" step={1} />
              </>
            )}
          </Section>

          <Section icon={<BatteryCharging size={16} color="var(--bev)" />} title="Electric truck">
            <Field label="Purchase price (ex-GST)" value={inp.bevPurchasePrice} onChange={set("bevPurchasePrice")} suffix="₹" step={100000} />
            <Field label="GST on vehicle" value={inp.gstBEV} onChange={set("gstBEV")} suffix="%" step={1} />
            <Field label="Battery capacity" value={inp.batteryCapacity} onChange={set("batteryCapacity")} suffix="kWh" step={10} />
            <Field label="Electric efficiency" value={inp.electricEfficiency} onChange={set("electricEfficiency")} suffix="kWh/km" step={0.05} />
            <Field label="Battery replacement cost" value={inp.batteryReplacementCost} onChange={set("batteryReplacementCost")} suffix="₹" step={100000} />
            <Field label="Capacity fade per cycle" value={inp.batteryDegradationPerCycle} onChange={set("batteryDegradationPerCycle")} suffix="% SOH/cycle" step={0.001} />
            <Field label="SOH replacement threshold" value={inp.batterySOHThreshold} onChange={set("batterySOHThreshold")} suffix="%" step={1} />
            <Field label="Maintenance cost" value={inp.bevMaintCostPerKm} onChange={set("bevMaintCostPerKm")} suffix="₹/km" step={0.5} />
            <Field label="Insurance premium vs diesel" value={inp.bevInsurancePremiumDiff} onChange={set("bevInsurancePremiumDiff")} suffix="% higher" step={1} />
            <Field label="Residual value" value={inp.bevResidualValue} onChange={set("bevResidualValue")} suffix="% at end" step={1} />
            <div className="field">
              <span className="field-label">Financing</span>
              <div className="seg" style={{ width: 150 }}>
                <button className={inp.bevFinancing === "cash" ? "active" : ""} onClick={() => set("bevFinancing")("cash")}>Cash</button>
                <button className={inp.bevFinancing === "emi" ? "active" : ""} onClick={() => set("bevFinancing")("emi")}>EMI</button>
              </div>
            </div>
            {inp.bevFinancing === "emi" && (
              <>
                <Field label="Down payment" value={inp.bevDownPaymentPct} onChange={set("bevDownPaymentPct")} suffix="%" step={5} />
                <Field label="Loan interest rate" value={inp.bevLoanInterestRate} onChange={set("bevLoanInterestRate")} suffix="%/yr" step={0.25} />
                <Field label="Loan tenure" value={inp.bevLoanTenure} onChange={set("bevLoanTenure")} suffix="years" step={1} />
              </>
            )}
          </Section>

          <Section icon={<PlugZap size={16} color="var(--bev)" />} title="Charging & energy">
            <div className="field">
              <span className="field-label">Charging type</span>
              <div className="seg" style={{ width: 150 }}>
                <button className={inp.chargingType === "private" ? "active" : ""} onClick={() => set("chargingType")("private")}>Depot</button>
                <button className={inp.chargingType === "public" ? "active" : ""} onClick={() => set("chargingType")("public")}>Public</button>
              </div>
            </div>
            <Field label="Depot electricity rate" value={inp.privateElectricityRate} onChange={set("privateElectricityRate")} suffix="₹/kWh" step={0.5} />
            <Field label="Public charging rate" value={inp.publicChargingRate} onChange={set("publicChargingRate")} suffix="₹/kWh" step={0.5} />
            <Field label="Electricity escalation" value={inp.electricityEscalation} onChange={set("electricityEscalation")} suffix="%/yr" step={0.5} />
            <Field label="Setup cost per Station" value={inp.stationCost} onChange={set("stationCost")} suffix="₹" step={100000} />
            <Field label="Maint. cost per Station" value={inp.stationMaintenance} onChange={set("stationMaintenance")} suffix="₹/yr" step={10000} />
            <Field label="Capital cost per Charger" value={inp.chargerCost} onChange={set("chargerCost")} suffix="₹" step={50000} />
            <Field label="Maint. cost per Charger" value={inp.chargerMaintenance} onChange={set("chargerMaintenance")} suffix="₹/yr" step={5000} />
            <Field label="Infra. tax credit" value={inp.infrastructureTaxCredit} onChange={set("infrastructureTaxCredit")} suffix="%" step={5} />
            <Field label="Charging time per cycle" value={inp.chargingTimePerCycle} onChange={set("chargingTimePerCycle")} suffix="hrs" step={0.25} />
            <Field label="Driver time cost" value={inp.driverLaborCost} onChange={set("driverLaborCost")} suffix="₹/hr" step={10} />
          </Section>

          <Section icon={<ShieldCheck size={16} color="var(--good)" />} title="Incentives">
            <Field label="State subsidy / road-tax waiver" value={inp.stateIncentiveBEV} onChange={set("stateIncentiveBEV")} suffix="% of BEV price" step={1} />
          </Section>

          <Section icon={<Package size={16} color="var(--dim)" />} title="Payload (kg)">
            <Field label="GVW — diesel" value={inp.gvwrDiesel} onChange={set("gvwrDiesel")} suffix="kg" step={500} />
            <Field label="GVW — electric" value={inp.gvwrBEV} onChange={set("gvwrBEV")} suffix="kg" step={500} />
            <Field label="Curb weight — diesel tractor" value={inp.curbWeightDieselTractor} onChange={set("curbWeightDieselTractor")} suffix="kg" step={100} />
            <Field label="Curb weight — electric tractor" value={inp.curbWeightBEVTractor} onChange={set("curbWeightBEVTractor")} suffix="kg" step={100} />
            <Field label="Empty trailer weight" value={inp.emptyTrailerWeight} onChange={set("emptyTrailerWeight")} suffix="kg" step={100} />
          </Section>
        </div>

        <div className="col-results">
          {/* Dashboard Scaling Tab Selector */}
          <div className="view-selector">
            <button className={viewMode === "vehicle" ? "active" : ""} onClick={() => setViewMode("vehicle")}>
              <Truck size={14} /> Per-Vehicle Model
            </button>
            <button className={viewMode === "fleetNominal" ? "active" : ""} onClick={() => setViewMode("fleetNominal")}>
              <Package size={14} /> Nominal Fleet ({inp.fleetSize} trucks · {inp.fleetStations} stations · {inp.fleetChargers} chargers)
            </button>
            <button className={viewMode === "fleetEquated" ? "active" : ""} onClick={() => setViewMode("fleetEquated")}>
              <TrendingUp size={14} /> Cargo-Equated Fleet ({results.fleetSizeBEVEquated.toFixed(1)} EVs · {results.fleetStationsBEVEquated.toFixed(1)} stations · {results.fleetChargersBEVEquated.toFixed(1)} chargers)
            </button>
          </div>

          <div className="stat-row">
            <div className="stat-card">
              <div className="label">
                <Fuel size={13} color="var(--diesel)" />
                {viewMode === "vehicle" ? "Diesel Vehicle TCO (NPV)" : `Diesel Fleet TCO (NPV, ${dieselMultiplier} trucks)`}
              </div>
              <div className="value diesel num">{inrCompact(scaledNpvDiesel)}</div>
              <div className="sub num">{inr(results.costPerKmDiesel)}/km</div>
            </div>
            
            <div className="stat-card">
              <div className="label">
                <BatteryCharging size={13} color="var(--bev)" />
                {viewMode === "vehicle" ? "Electric Vehicle TCO (NPV)" : `Electric Fleet TCO (NPV, ${bevMultiplier.toFixed(1)} trucks)`}
              </div>
              <div className="value bev num">{inrCompact(scaledNpvBEV)}</div>
              <div className="sub num">{inr(results.costPerKmBEV)}/km</div>
            </div>
            
            <div className="stat-card">
              <div className="label">
                {savings >= 0 ? <TrendingDown size={13} color="var(--good)" /> : <TrendingUp size={13} color="var(--bad)" />}
                {savings >= 0 ? "EV saves" : "EV costs more"}
              </div>
              <div className={"value num " + (savings >= 0 ? "good" : "")} style={savings < 0 ? { color: "var(--bad)" } : {}}>
                {inrCompact(Math.abs(savings))}
              </div>
              <div className="sub num">{Math.abs(savingsPct).toFixed(1)}% {savings >= 0 ? "lower" : "higher"} than diesel</div>
            </div>
            
            <div className="stat-card">
              <div className="label"><Flag size={13} color="var(--dim)" />Break-even point</div>
              <div className="value num">{breakevenYear === null ? "Never" : `Yr ${breakevenYear.toFixed(1)}`}</div>
              <div className="sub">within {results.n}-year analysis window</div>
            </div>
          </div>

          {/* Context Explainer Alert when in Cargo-Parity Mode */}
          {viewMode === "fleetEquated" && (
            <div className="insight" style={{ border: "1px solid var(--diesel)", background: "rgba(232, 163, 61, 0.05)", borderRadius: "10px" }}>
              <div className="title" style={{ color: "var(--diesel)", fontWeight: "600", fontSize: "13px" }}>Payload-Parity Correction Active</div>
              <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--text)", lineHeight: "1.5" }}>
                Because a single electric tractor-trailer carries less cargo than a diesel truck due to heavy batteries (<strong>{results.payloadBEVT.toFixed(1)}t</strong> vs <strong>{results.payloadDieselT.toFixed(1)}t</strong>), an electric fleet requires more vehicles to move the same total annual tonnage over the same routes. This mode scales your electric fleet up to <strong>{results.fleetSizeBEVEquated.toFixed(1)} vehicles</strong>, and automatically scales up the required depot infrastructure to <strong>{results.fleetStationsBEVEquated.toFixed(1)} stations</strong> and <strong>{results.fleetChargersBEVEquated.toFixed(1)} chargers</strong> to maintain your exact charger and depot densities [1].
              </p>
            </div>
          )}

          <div className="panel">
            <h2><TrendingUp size={18} />Cumulative cost of ownership</h2>
            <div className="legend-row">
              <span><span className="dot" style={{ background: "var(--diesel)" }} />Diesel</span>
              <span><span className="dot" style={{ background: "var(--bev)" }} />Electric</span>
              {breakevenYear !== null && <span><Flag size={11} style={{ verticalAlign: "-1px" }} /> Break-even marker</span>}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#333b3d" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="#98a3a1" tick={{ fontSize: 12 }} label={{ value: "Year", position: "insideBottom", offset: -3, fill: "#98a3a1", fontSize: 12 }} />
                <YAxis stroke="#98a3a1" tick={{ fontSize: 11 }} tickFormatter={(v) => inrCompact(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: "#1d2224", border: "1px solid #333b3d", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => inr(v)}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Line type="monotone" dataKey="diesel" name="Diesel" stroke="#e8a33d" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="bev" name="Electric" stroke="#29c9b2" strokeWidth={2.5} dot={{ r: 3 }} />
                {breakevenYear !== null && (
                  <ReferenceDot
                    x={Math.round(breakevenYear)}
                    y={chartData[Math.min(chartData.length - 1, Math.round(breakevenYear))]?.bev}
                    r={6}
                    fill="#5fbf7a"
                    stroke="#14181a"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <h2><Package size={18} />Cost breakdown by category (NPV, {results.n}yr)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={breakdownData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="#333b3d" strokeDasharray="3 3" />
                <XAxis dataKey="category" stroke="#98a3a1" tick={{ fontSize: 10.5 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke="#98a3a1" tick={{ fontSize: 11 }} tickFormatter={(v) => inrCompact(v)} width={70} />
                <Tooltip contentStyle={{ background: "#1d2224", border: "1px solid #333b3d", borderRadius: 8, fontSize: 12 }} formatter={(v) => inr(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Diesel" fill="#e8a33d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Electric" fill="#29c9b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <h2><ShieldCheck size={18} />Financing (EMI)</h2>
            <p style={{ fontSize: 12.5, color: "var(--dim)", margin: "-4px 0 14px", lineHeight: 1.5 }}>
              Set independently per vehicle type. Choosing EMI trades a lower upfront outlay for a higher total cost —
              the interest paid over the loan tenure — which now flows straight into the TCO above rather than sitting
              off to the side.
            </p>
            <div className="insight-grid">
              <div className="insight">
                <div className="title">Diesel — {inp.dieselFinancing === "emi" ? "financed" : "cash purchase"}</div>
                {inp.dieselFinancing === "emi" ? (
                  <>
                    <div className="big num" style={{ color: "var(--diesel)" }}>{inr(results.dieselLoan.annualPayment / 12)}/mo</div>
                    <div className="sub" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                      {inr(results.dieselLoan.upfront)} down · {inp.dieselLoanTenure}yr tenure @ {inp.dieselLoanInterestRate}% ·
                      total interest {inrCompact(results.dieselLoan.interestTotal)}
                    </div>
                  </>
                ) : (
                  <div className="big num" style={{ color: "var(--diesel)" }}>{inrCompact(results.dieselLoan.upfront)}</div>
                )}
              </div>
              <div className="insight">
                <div className="title">Electric — {inp.bevFinancing === "emi" ? "financed" : "cash purchase"}</div>
                {inp.bevFinancing === "emi" ? (
                  <>
                    <div className="big num" style={{ color: "var(--bev)" }}>{inr(results.bevLoan.annualPayment / 12)}/mo</div>
                    <div className="sub" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                      {inr(results.bevLoan.upfront)} down · {inp.bevLoanTenure}yr tenure @ {inp.bevLoanInterestRate}% ·
                      total interest {inrCompact(results.bevLoan.interestTotal)}
                    </div>
                  </>
                ) : (
                  <div className="big num" style={{ color: "var(--bev)" }}>{inrCompact(results.bevLoan.upfront)}</div>
                )}
              </div>
            </div>
            {(inp.dieselFinancing === "emi" || inp.bevFinancing === "emi") && (
              <p style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
                If loan tenure exceeds the analysis period, only the payments made within that window are counted — any
                remaining loan balance still owed beyond the analysis period isn't added as a year-{results.n} liability.
              </p>
            )}
          </div>

          <div className="panel">
            <h2><Info size={18} />Operating detail (Per Vehicle)</h2>
            <div className="insight-grid">
              <div className="insight">
                <div className="title">Usable range per charge</div>
                <div className="big num">{Math.round(results.rangePerCharge)} km</div>
              </div>
              <div className="insight">
                <div className="title">Charge cycles per year</div>
                <div className="big num">{Math.round(results.cyclesPerYear)}</div>
              </div>
              <div className="insight">
                <div className="title">Battery life to first replacement</div>
                <div className="big num">
                  {results.replacementEvents.length > 0 ? `${results.effectiveBatteryLifeYears} yrs` : "No replacement"}
                </div>
                <div className="sub" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                  crossed SOH threshold ({inp.batterySOHThreshold}%) · ~{results.cyclesToFirstReplacement.toLocaleString("en-IN")} cycles, derived from your annual mileage
                </div>
              </div>
              <div className="insight">
                <div className="title">Battery SOH at end of period</div>
                <div className="big num" style={{ color: results.sohAtEnd < inp.batterySOHThreshold + 10 ? "var(--diesel)" : "var(--bev)" }}>
                  {results.sohAtEnd.toFixed(0)}%
                </div>
                <div className="sub" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                  {inp.batteryDegradationPerCycle}% SOH lost per cycle · resets to 100% on replacement
                  {results.replacementEvents.length > 1 && ` · ${results.replacementEvents.length} replacements over this period`}
                </div>
              </div>
              <div className="insight">
                <div className="title">Payload — diesel tractor-trailer</div>
                <div className="big num">{results.payloadDiesel.toLocaleString("en-IN")} kg</div>
              </div>
              <div className="insight">
                <div className="title">Payload — electric tractor-trailer</div>
                <div className="big num" style={{ color: results.payloadBEV < results.payloadDiesel ? "var(--diesel)" : "var(--bev)" }}>
                  {results.payloadBEV.toLocaleString("en-IN")} kg
                  <span style={{ fontSize: 13, color: "var(--dim)", marginLeft: 8 }}>
                    ({results.payloadBEV - results.payloadDiesel >= 0 ? "+" : ""}{(results.payloadBEV - results.payloadDiesel).toLocaleString("en-IN")} kg)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2><Package size={18} />Cost per loaded tonne-km</h2>
            <p style={{ fontSize: 12.5, color: "var(--dim)", margin: "-4px 0 14px", lineHeight: 1.5 }}>
              What it costs to move one tonne of freight one loaded kilometre, for each truck — its total cost of
              ownership (TCO) divided by the actual cargo tonne-km it delivers. Because the truck runs empty for the 
              remaining percentage of the trip (generating 0 cargo-carrying value while still accumulating operational 
              and capital TCO), the loaded leg has to recover all expenses.
            </p>
            <div className="insight-grid">
              <div className="insight">
                <div className="title">Cost per loaded tonne-km — diesel</div>
                <div className="big num" style={{ color: "var(--diesel)" }}>₹{results.costPerTonneKmDiesel.toFixed(2)}/t-km</div>
                <div className="sub" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                  {Math.round(results.payloadDieselT)}t payload · {inp.loadedDistancePct}% loaded distance
                </div>
              </div>
              <div className="insight">
                <div className="title">Cost per loaded tonne-km — electric</div>
                <div className="big num" style={{ color: "var(--bev)" }}>₹{results.costPerTonneKmBEV.toFixed(2)}/t-km</div>
                <div className="sub" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                  {Math.round(results.payloadBEVT)}t payload · {inp.loadedDistancePct}% loaded distance
                </div>
              </div>
              <div className="insight" style={{ gridColumn: "1 / -1" }}>
                <div className="title">Difference vs. diesel</div>
                <div className="big num" style={{ color: results.costPerTonneKmBEV <= results.costPerTonneKmDiesel ? "var(--good)" : "var(--bad)" }}>
                  {results.costPerTonneKmBEV <= results.costPerTonneKmDiesel ? "−" : "+"}
                  ₹{Math.abs(results.costPerTonneKmBEV - results.costPerTonneKmDiesel).toFixed(2)}/t-km
                  <span style={{ fontSize: 13, color: "var(--dim)", marginLeft: 8 }}>
                    ({(Math.abs(results.costPerTonneKmBEV - results.costPerTonneKmDiesel) / results.costPerTonneKmDiesel * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="sub" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                  it costs {results.costPerTonneKmBEV <= results.costPerTonneKmDiesel ? "this much less" : "this much more"} to move each tonne-km by electric truck than by diesel
                </div>
              </div>
            </div>
            {results.payloadRatio && results.payloadRatio > 1.001 && (
              <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
                To move the <em>same total tonnage</em> as one diesel truck, you'd need roughly{" "}
                <span className="num" style={{ color: "var(--text)" }}>{results.payloadRatio.toFixed(2)}×</span> the
                electric truck-trips (or an equivalently larger electric fleet) — on top of the per-tonne-km cost gap above.
              </p>
            )}
          </div>

          <div className="foot-note">
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              All figures are illustrative planning estimates in Indian rupees, based on the inputs above — not a quote.
              Range is reflected as a charging-downtime cost (time lost per stop, scaled by charge cycles/year); payload is
              reflected in the cost-per-tonne-km figures, which use each truck's own carrying capacity. Not modelled:
              whether your actual routes exceed the truck's range (which would need corridor charging infrastructure or
              route redesign, not just a time penalty), and any resale or financing-rate differences beyond the
              residual-value and GST inputs. GST, insurance, incentive and residual value assumptions vary by state and
              lender; verify current rates with your RTO, dealer, and finance provider. Heavy-duty electric
              tractor-trailers are an emerging category in India, so purchase price, battery cost, and charging
              infrastructure figures should be checked against current OEM quotes.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}