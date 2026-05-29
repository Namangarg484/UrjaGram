import { solarPeakHours } from '../data/solarLUT';

export const PEAK_HOURS = solarPeakHours;
export const ROOF_FACTOR = { flat: 0.75, sloped: 0.65, mixed: 0.7 };
export const PANEL_AREA = 1.8;
export const PANEL_WATT = 400;
export const CO2_FACTOR = 0.82;

export function runSolarCalculations({ roofArea, shadingPct, roofType, stateKey, monthlyConsumption }) {
  const peakHours = PEAK_HOURS[stateKey] || PEAK_HOURS.haryana;
  const roofFactor = ROOF_FACTOR[roofType] || ROOF_FACTOR.flat;
  const usableArea = roofArea * roofFactor * (1 - shadingPct / 100);
  const panelCount = Math.max(0, Math.floor(usableArea / PANEL_AREA));
  const systemKWp = (panelCount * PANEL_WATT) / 1000;
  const annualKWh = systemKWp * peakHours * 365;
  const monthlyKWh = annualKWh / 12;

  // Actual coverage ratio — not capped so oversized systems show > 100%
  const coveragePct = monthlyConsumption > 0 ? (monthlyKWh / monthlyConsumption) * 100 : 0;

  // kWp that would exactly meet stated monthly demand
  const recommendedKWp = monthlyConsumption > 0
    ? Math.min((monthlyConsumption * 12) / (peakHours * 365), systemKWp)
    : 0;

  const co2Offset = (annualKWh * CO2_FACTOR) / 1000;

  // PM Surya Ghar CFA tiers (2024):
  //   ≤ 2 kW  → ₹30,000 / kW
  //   2–3 kW  → ₹60,000 + ₹18,000 / kW above 2
  //   > 3 kW  → capped at ₹78,000
  function pmsgSubsidy(kWp) {
    if (kWp <= 0) return 0;
    const k = Math.min(kWp, 3);
    return k <= 2 ? k * 30000 : 60000 + (k - 2) * 18000;
  }

  // Full-roof system subsidy (may hit ₹78k cap for large roofs)
  const subsidy = pmsgSubsidy(systemKWp);

  // Recommended-system subsidy — sized to exactly meet stated consumption.
  // This varies directly with consumption: 100 kWh → ~₹20k, 300 kWh → ~₹57k, 600 kWh → ₹78k
  const recommendedSubsidy = pmsgSubsidy(recommendedKWp);

  return {
    peakHours,
    usableArea,
    panelCount,
    systemKWp,
    annualKWh,
    monthlyKWh,
    coveragePct,
    recommendedKWp,
    co2Offset,
    subsidy,
    recommendedSubsidy,
  };
}