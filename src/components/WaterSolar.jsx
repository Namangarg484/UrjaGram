import { useMemo, useState } from 'react';
import { Droplets, ExternalLink, Waves } from 'lucide-react';
import { runPumpSizing } from '../utils/calculations';
import { stateOptions } from '../data/solarLUT';
import { formatIndianNumber } from '../utils/indianFormat';

const waterBodyTypes = [
  { value: 'hand_pump', label: 'Hand Pump', defaultHead: 30 },
  { value: 'open_well', label: 'Open Well', defaultHead: 20 },
  { value: 'borewell', label: 'Borewell', defaultHead: 60 },
  { value: 'pond', label: 'Pond / Surface', defaultHead: 10 },
];

function WaterSolar({ showToast }) {
  const [form, setForm] = useState({
    waterBodyType: 'borewell',
    state: 'haryana',
    dailyWaterNeedL: 20000,
    totalDynamicHead: 60,
  });
  const [result, setResult] = useState(null);

  const selectedState = useMemo(
    () => stateOptions.find((s) => s.value === form.state) || stateOptions[0],
    [form.state],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'waterBodyType') {
        const wb = waterBodyTypes.find((w) => w.value === value);
        if (wb) next.totalDynamicHead = wb.defaultHead;
      }
      return next;
    });
  };

  const runSizing = () => {
    const computed = runPumpSizing({
      dailyWaterNeedL: Number(form.dailyWaterNeedL),
      totalDynamicHead: Number(form.totalDynamicHead),
      stateKey: form.state,
      overridePeakHours: selectedState.peakHours,
    });
    setResult(computed);
    showToast('Solar pump sizing complete — PM-KUSUM Component B matched.');
  };

  return (
    <div className="space-y-6 animate-floatin">
      {/* Aqua hero header — gives the Water module its own visual identity */}
      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-[#38BDF8] via-[#2563EB] to-[#1E3A8A] p-6 text-white shadow-float md:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-md animate-floaty">
            <Droplets className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Water + Solar Module</div>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-3xl">Solar Water Pump Sizing</h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Hydraulic sizing engine with automatic PM-KUSUM Component B subsidy matching for zero-emission irrigation.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
      <section className="panel-3d p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-aqua-light/20 to-aqua/15 text-aqua ring-1 ring-aqua/20">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-aqua-deep">Pump parameters</h2>
            <p className="text-xs text-muted">Enter source, demand & head.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">Water source type</label>
            <select className="input-base" name="waterBodyType" value={form.waterBodyType} onChange={handleChange}>
              {waterBodyTypes.map((wb) => (
                <option key={wb.value} value={wb.value}>{wb.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">State</label>
            <select className="input-base" name="state" value={form.state} onChange={handleChange}>
              {stateOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Daily water need (litres/day)</label>
            <input
              className="input-base"
              type="number"
              name="dailyWaterNeedL"
              min="500"
              step="500"
              value={form.dailyWaterNeedL}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Total dynamic head (metres)</label>
            <input
              className="input-base"
              type="number"
              name="totalDynamicHead"
              min="5"
              step="5"
              value={form.totalDynamicHead}
              onChange={handleChange}
            />
          </div>

          <button
            onClick={runSizing}
            className="btn-grad btn-aqua w-full"
          >
            <Waves className="relative z-10 h-4 w-4" /> <span className="relative z-10">Size Solar Pump</span>
          </button>
        </div>
      </section>

      <section>
        {result ? (
          <div className="space-y-6 stagger">
            <div className="panel-3d p-6">
              <h3 className="mb-4 text-lg font-bold tracking-tight text-aqua-deep">Pump &amp; array sizing</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Buffered demand', value: `${formatIndianNumber(result.bufferedDemandL)} L/day` },
                  { label: 'Motor size', value: `${result.motorHP} HP` },
                  { label: 'Solar array', value: `${result.arrayKWp} kWp` },
                  { label: 'Peak sun hours', value: `${result.peakHours} h` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-aqua/15 bg-gradient-to-br from-aqua-light/8 to-transparent p-4">
                    <div className="text-[11px] uppercase tracking-wide text-muted">{item.label}</div>
                    <div className="mt-1 text-xl font-bold text-aqua">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-3d p-6">
              <h3 className="mb-4 text-lg font-bold tracking-tight text-aqua-deep">PM-KUSUM Component B financing</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">System cost</span><span className="font-semibold">₹{formatIndianNumber(result.systemCost)}</span></div>
                <div className="flex justify-between"><span className="text-muted">KUSUM subsidy (60%)</span><span className="font-semibold text-meadow">− ₹{formatIndianNumber(result.kusumSubsidy)}</span></div>
                <div className="flex justify-between border-t border-border pt-3 text-base"><span className="font-semibold">Farmer contribution</span><span className="font-bold text-aqua">₹{formatIndianNumber(result.netCost)}</span></div>
              </div>
              <a
                href="https://pmkusum.mnre.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-grad btn-aqua mt-5 w-full"
              >
                <ExternalLink className="relative z-10 h-4 w-4" /> <span className="relative z-10">Apply on PM-KUSUM portal</span>
              </a>
              <div className="mt-3 rounded-2xl bg-aqua-light/10 px-4 py-3 text-xs text-aqua-deep">
                💧 Contributes to <strong>SDG 6 (Clean Water)</strong> — solar pump ensures reliable, zero-emission water access.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-aqua/25 bg-gradient-to-b from-aqua-light/5 to-transparent px-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-aqua-light/10 ring-1 ring-aqua/15 animate-floaty">
              <Droplets className="h-8 w-8 text-aqua" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-aqua-deep">Size your first solar pump</h3>
            <p className="mt-2 max-w-md text-sm text-muted">
              Enter the water source, daily demand and head. UrjaGram computes motor HP, solar array size, and PM-KUSUM subsidy.
            </p>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

export default WaterSolar;
