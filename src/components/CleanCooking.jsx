import { useState } from 'react';
import { Flame, Info, CheckCircle2, Zap } from 'lucide-react';
import { formatIndianNumber } from '../utils/indianFormat';

const COOKTOPS = [
  {
    id: 'single',
    label: 'Single Induction Cooktop',
    cost: 2500,
    powerW: 1500, // 1.5 kW
    dailyHours: 2,
  },
  {
    id: 'double',
    label: 'Double Induction Cooktop',
    cost: 5500,
    powerW: 3000, // 3.0 kW
    dailyHours: 2.5,
  },
];

export default function CleanCooking({ showToast }) {
  const [cylindersPerYear, setCylindersPerYear] = useState(8);
  const [cylinderCost, setCylinderCost] = useState(900);
  const [electricityTariff, setElectricityTariff] = useState(7.5);
  const [selectedCooktop, setSelectedCooktop] = useState('single');
  const [applied, setApplied] = useState(false);

  // Current Costs
  const annualLpgCost = cylindersPerYear * cylinderCost;
  const monthlyLpgCost = annualLpgCost / 12;

  // New Costs
  const cooktop = COOKTOPS.find((c) => c.id === selectedCooktop);
  const dailyKWh = (cooktop.powerW * cooktop.dailyHours) / 1000;
  const annualKWh = dailyKWh * 365;
  const monthlyKWh = annualKWh / 12;

  const annualElectricityCost = annualKWh * electricityTariff;
  const monthlyElectricityCost = annualElectricityCost / 12;

  const annualSavings = annualLpgCost - annualElectricityCost;
  const paybackMonths = annualSavings > 0 ? (cooktop.cost / annualSavings) * 12 : 0;

  // PM Surya Ghar addition
  // Roughly, 1 kWp generates ~4 kWh/day or ~1460 kWh/year
  const extraSolarNeededKWp = annualKWh / 1460;

  const handleApply = () => {
    setApplied(true);
    showToast(`${cooktop.label} selected! Extra ${extraSolarNeededKWp.toFixed(2)} kWp required in PM Surya Ghar.`);
  };

  return (
    <div className="space-y-6 animate-floatin">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-[#FF9800] via-[#E65100] to-[#BF360C] p-6 text-white shadow-float md:p-8">
        <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-yellow-400/30 blur-2xl" />
        <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-red-500/30 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-md animate-floaty">
            <Flame className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Clean Cooking Transition</div>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-3xl">E-Cooking & PM Surya Ghar</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              Transition from LPG to electric induction cooking and offset the extra electricity load with rooftop solar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="panel-3d p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold tracking-tight text-ink">Household Cooking Data</h2>
            <p className="text-sm text-muted">Enter your current LPG usage and electricity tariff.</p>
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">LPG Cylinders used per year</label>
                <span className="text-sm font-semibold text-orange-600">{cylindersPerYear}</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                value={cylindersPerYear}
                onChange={(e) => setCylindersPerYear(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-orange-200 accent-orange-600"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Cost per LPG Cylinder (₹)</label>
                <span className="text-sm font-semibold text-orange-600">₹{cylinderCost}</span>
              </div>
              <input
                type="range"
                min="500"
                max="1500"
                step="10"
                value={cylinderCost}
                onChange={(e) => setCylinderCost(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-orange-200 accent-orange-600"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Electricity Tariff (₹/kWh)</label>
                <span className="text-sm font-semibold text-meadow">₹{electricityTariff}</span>
              </div>
              <input
                type="range"
                min="3"
                max="12"
                step="0.5"
                value={electricityTariff}
                onChange={(e) => setElectricityTariff(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-meadow/20 accent-meadow"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <label className="mb-3 block text-sm font-medium">Choose E-Cooking Option</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {COOKTOPS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedCooktop(opt.id);
                      setApplied(false);
                    }}
                    className={`flex flex-col items-start gap-1 rounded-card border p-3 transition ${
                      selectedCooktop === opt.id
                        ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                        : 'border-border bg-white hover:border-orange-300'
                    }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs text-muted">₹{formatIndianNumber(opt.cost)} Upfront</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="panel-3d p-6">
            <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">Impact & Savings Analysis</h2>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-card border border-red-200 bg-red-50 p-4">
                <div className="text-xs font-semibold text-red-600 uppercase tracking-wider">Current LPG Cost</div>
                <div className="mt-1 text-2xl font-bold text-red-700">₹{formatIndianNumber(Math.round(annualLpgCost))} <span className="text-sm font-medium text-red-600/70">/yr</span></div>
                <div className="mt-1 text-xs text-red-600/80">₹{formatIndianNumber(Math.round(monthlyLpgCost))} /month</div>
              </div>
              
              <div className="rounded-card border border-meadow/20 bg-meadow/10 p-4">
                <div className="text-xs font-semibold text-meadow uppercase tracking-wider">New E-Cooking Cost</div>
                <div className="mt-1 text-2xl font-bold text-forest">₹{formatIndianNumber(Math.round(annualElectricityCost))} <span className="text-sm font-medium text-forest/70">/yr</span></div>
                <div className="mt-1 text-xs text-forest/80">₹{formatIndianNumber(Math.round(monthlyElectricityCost))} /month</div>
              </div>
            </div>

            <div className="mt-4 rounded-card border border-border bg-parchment/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Estimated Savings</div>
                  <div className="text-2xl font-bold text-meadow">
                    {annualSavings > 0 ? `₹${formatIndianNumber(Math.round(annualSavings))}` : 'Negative Savings'}
                    <span className="text-sm font-medium text-muted"> /yr</span>
                  </div>
                </div>
                {annualSavings > 0 && paybackMonths > 0 && (
                  <div className="text-right">
                    <div className="text-sm font-medium">Payback Period</div>
                    <div className="text-lg font-bold text-ink">{paybackMonths.toFixed(1)} months</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="panel-3d p-6 border-2 border-amber/30 bg-amber/5">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber" />
              <h2 className="text-lg font-bold tracking-tight text-ink">PM Surya Ghar Integration</h2>
            </div>
            
            <p className="text-sm text-muted mb-4">
              Switching to E-Cooking will increase your electricity consumption by <strong>{Math.round(monthlyKWh)} kWh/month</strong>. To keep your electricity bill at zero, you should add this load to your solar capacity.
            </p>

            <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/15 text-amber">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{cooktop.label}</div>
                  <div className="text-xs text-muted">Requires extra solar capacity</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-amber">+{extraSolarNeededKWp.toFixed(2)} kWp</div>
              </div>
            </div>

            {!applied ? (
              <button
                onClick={handleApply}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-card bg-amber px-5 py-3 text-sm font-semibold text-white transition hover:bg-yellow-600"
              >
                Add E-Cooking Load to Surya Ghar Plan
              </button>
            ) : (
              <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-card bg-meadow/10 border border-meadow/30 px-5 py-3 text-sm font-semibold text-forest">
                <CheckCircle2 className="h-4 w-4" />
                Added +{extraSolarNeededKWp.toFixed(2)} kWp to your Solar Assessment
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
