import { solarPeakHours } from '../data/solarLUT';

export const PEAK_HOURS = solarPeakHours;

// ── Engineering constants (MNRE / industry 2025) ──────────────────────────────
export const PANEL_AREA = 2.0;          // m² per 400 Wp panel (2025 standard)
export const PANEL_WATT = 400;          // Wp per panel
export const INVERTER_EFF = 0.97;       // modern string inverter
export const PERFORMANCE_RATIO = 0.75;  // PR — temp/wiring/soiling, Indian climate (MNRE)
export const CO2_FACTOR = 0.82;         // kg CO₂ / kWh, Indian grid (CEA 2024)

// Shadow Loss Factor by roof type
export const SHADOW_LOSS_FACTOR = { flat: 0.85, sloped: 0.80, mixed: 0.82 };

// Cost benchmarks (₹/kWp installed, 2025)
export const COST_RESIDENTIAL = 55000;  // < 5 kW residential
export const COST_GOVT = 45000;         // bulk / CPWD procurement

// Tariffs (₹/unit)
export const TARIFF_RESIDENTIAL = 7.5;
export const TARIFF_COMMERCIAL = 8.0;
export const FEED_IN_TARIFF = 3.5;      // Haryana HERC net-metering export

// Loan parameters
export const LOAN_RATE_ANNUAL = 0.085;  // 8.5%
export const LOAN_TENURE_MONTHS = 84;   // 7 years

// Avg rural household annual consumption (kWh)
export const RURAL_HH_ANNUAL_KWH = 1200;

// ── PM Surya Ghar CFA subsidy (2024) ──────────────────────────────────────────
//   ≤ 2 kW → ₹30,000 / kW
//   2–3 kW → ₹60,000 + ₹18,000 / kW above 2 kW
//   > 3 kW → flat cap ₹78,000
export function pmSuryaGharSubsidy(kWp) {
  if (kWp <= 0) return 0;
  if (kWp <= 2) return kWp * 30000;
  if (kWp <= 3) return 60000 + (kWp - 2) * 18000;
  return 78000;
}

// ── EMI (reducing balance) ────────────────────────────────────────────────────
export function calculateEMI(principal, annualRate = LOAN_RATE_ANNUAL, months = LOAN_TENURE_MONTHS) {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

// ── Core engineering: roof → kWp → annual yield ───────────────────────────────
function sizeSystem({ roofArea, shadingPct, roofType, peakHours }) {
  const slf = SHADOW_LOSS_FACTOR[roofType] ?? SHADOW_LOSS_FACTOR.flat;
  const effectiveArea = roofArea * (1 - (shadingPct || 0) / 100) * slf;
  const panelCount = Math.max(0, Math.floor(effectiveArea / PANEL_AREA));
  const dcKWp = (panelCount * PANEL_WATT) / 1000;
  const systemKWp = dcKWp * INVERTER_EFF; // AC-side after inverter
  const annualKWh = systemKWp * peakHours * 365 * PERFORMANCE_RATIO;
  return { slf, effectiveArea, panelCount, dcKWp, systemKWp, annualKWh };
}

// ── SDG mapping (shared) ──────────────────────────────────────────────────────
function sdgMapping(systemKWp, annualKWh, co2OffsetKg, billSavings) {
  return {
    sdg1_billSavingsInr: Math.round(billSavings),
    sdg7_kwpInstalled: Number(systemKWp.toFixed(2)),
    sdg11_householdsPowered: Number((annualKWh / RURAL_HH_ANNUAL_KWH).toFixed(1)),
    sdg13_co2TonnesPerYear: Number((co2OffsetKg / 1000).toFixed(2)),
  };
}

/**
 * RESIDENTIAL flow — PM Surya Ghar + net metering + loan feasibility.
 */
export function runResidentialAssessment({
  roofArea,
  shadingPct,
  roofType,
  stateKey,
  monthlyConsumption,
  overridePeakHours,
  estimatedMonthlyIncome,
}) {
  const peakHours = overridePeakHours ?? PEAK_HOURS[stateKey] ?? PEAK_HOURS.haryana;
  const { slf, effectiveArea, panelCount, systemKWp, annualKWh } = sizeSystem({
    roofArea, shadingPct, roofType, peakHours,
  });
  const monthlyKWh = annualKWh / 12;

  const coveragePct = monthlyConsumption > 0 ? (monthlyKWh / monthlyConsumption) * 100 : 0;

  const recommendedKWp = monthlyConsumption > 0
    ? Math.min((monthlyConsumption * 12) / (peakHours * 365 * PERFORMANCE_RATIO), systemKWp)
    : systemKWp;

  const grossCost = systemKWp * COST_RESIDENTIAL;
  const subsidy = pmSuryaGharSubsidy(systemKWp);
  const netCost = Math.max(0, grossCost - subsidy);
  const recommendedSubsidy = pmSuryaGharSubsidy(recommendedKWp);

  const annualConsumption = monthlyConsumption * 12;
  const unitsExported = Math.max(0, annualKWh - annualConsumption);
  const netMeteringCredit = unitsExported * FEED_IN_TARIFF;
  const selfConsumed = Math.min(annualKWh, annualConsumption);
  const annualSavings = selfConsumed * TARIFF_RESIDENTIAL + netMeteringCredit;
  const paybackYears = annualSavings > 0 ? netCost / annualSavings : 0;

  const co2OffsetKg = annualKWh * CO2_FACTOR;

  const emi = calculateEMI(netCost);
  const incomeProxy = estimatedMonthlyIncome || 0;
  const cibilFlag = incomeProxy > 0 && emi > incomeProxy / 3;
  const loanFeasibility = {
    emi: Math.round(emi),
    affordable: incomeProxy === 0 ? null : !cibilFlag,
    cibilFlag,
    recommendedChannel: cibilFlag
      ? 'PMEGP / NABARD / MUDRA or state cooperative bank (low-CIBIL friendly)'
      : 'Standard bank rooftop solar loan',
    tenureMonths: LOAN_TENURE_MONTHS,
    rateAnnual: LOAN_RATE_ANNUAL,
  };

  return {
    flow: 'residential',
    peakHours,
    slf,
    usableArea: effectiveArea,
    panelCount,
    systemKWp,
    recommendedKWp,
    annualKWh,
    monthlyKWh,
    coveragePct,
    grossCost,
    subsidy,
    recommendedSubsidy,
    netCost,
    unitsExported,
    netMeteringCredit,
    annualSavings,
    paybackYears,
    co2Offset: co2OffsetKg / 1000,
    co2OffsetKg,
    loanFeasibility,
    sdg: sdgMapping(systemKWp, annualKWh, co2OffsetKg, annualSavings),
  };
}

/**
 * GOVERNMENT BUILDING flow — CAPEX model, no PM Surya Ghar subsidy.
 */
export function runGovtAssessment({
  roofArea,
  shadingPct,
  roofType,
  stateKey,
  overridePeakHours,
  discountRate = 0.08,
  years = 25,
}) {
  const peakHours = overridePeakHours ?? PEAK_HOURS[stateKey] ?? PEAK_HOURS.haryana;
  const { slf, effectiveArea, panelCount, systemKWp, annualKWh } = sizeSystem({
    roofArea, shadingPct, roofType, peakHours,
  });

  const systemCost = systemKWp * COST_GOVT;
  const annualSavings = annualKWh * TARIFF_COMMERCIAL;
  const roi = systemCost > 0 ? (annualSavings / systemCost) * 100 : 0;
  const paybackYears = annualSavings > 0 ? systemCost / annualSavings : 0;

  const co2OffsetKg = annualKWh * CO2_FACTOR;
  const carbonCreditTonnesPerYear = co2OffsetKg / 1000;

  let npv = -systemCost;
  for (let t = 1; t <= years; t += 1) {
    npv += annualSavings / Math.pow(1 + discountRate, t);
  }

  return {
    flow: 'government',
    peakHours,
    slf,
    usableArea: effectiveArea,
    panelCount,
    systemKWp,
    annualKWh,
    monthlyKWh: annualKWh / 12,
    systemCost,
    annualSavings,
    roi,
    paybackYears,
    co2Offset: carbonCreditTonnesPerYear,
    co2OffsetKg,
    carbonCreditTonnesPerYear,
    npv,
    npvYears: years,
    discountRate,
    // residential fields defaulted so shared UI never crashes
    subsidy: 0,
    recommendedKWp: systemKWp,
    recommendedSubsidy: 0,
    coveragePct: 0,
    sdg: sdgMapping(systemKWp, annualKWh, co2OffsetKg, annualSavings),
  };
}

/**
 * Unified entry — dispatches by building type.
 */
export function runSolarCalculations(params) {
  if (params.buildingType === 'government') {
    return runGovtAssessment(params);
  }
  return runResidentialAssessment(params);
}

// ── WATER: solar pump sizing (PM-KUSUM Component B) ───────────────────────────
export function runPumpSizing({
  dailyWaterNeedL,
  totalDynamicHead,
  pumpEfficiency = 0.40,
  stateKey,
  overridePeakHours,
}) {
  const peakHours = overridePeakHours ?? PEAK_HOURS[stateKey] ?? PEAK_HOURS.haryana;
  const Q = dailyWaterNeedL * 1.2; // 20% buffer

  // Motor HP = Q(L/day) × TDH(m) / (3960 × η × 0.746)
  const motorHP = (Q * totalDynamicHead) / (3960 * pumpEfficiency * 0.746);
  // Solar array (kWp) = Motor HP × 0.746 / (PSH × PR)
  const arrayKWp = (motorHP * 0.746) / (peakHours * PERFORMANCE_RATIO);

  const systemCost = arrayKWp * COST_GOVT;
  const kusumSubsidy = systemCost * 0.6; // 60% under KUSUM Component B
  const netCost = Math.max(0, systemCost - kusumSubsidy);

  return {
    peakHours,
    bufferedDemandL: Math.round(Q),
    motorHP: Number(motorHP.toFixed(2)),
    arrayKWp: Number(arrayKWp.toFixed(2)),
    systemCost: Math.round(systemCost),
    kusumSubsidy: Math.round(kusumSubsidy),
    netCost: Math.round(netCost),
    sdg6_waterAccess: true,
  };
}