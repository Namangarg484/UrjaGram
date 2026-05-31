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
    <div className="grid gap-6 lg:grid-cols-[0.4fr_0.6fr] animate-floatin">
      <section className="card p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Water + Solar Pump</h2>
            <p className="text-sm text-muted">Size a solar pump and auto-match PM-KUSUM Component B.</p>
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
            className="flex w-full items-center justify-center gap-2 rounded-input bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
          >
            <Waves className="h-4 w-4" /> Size Solar Pump
          </button>
        </div>
      </section>

      <section>
        {result ? (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold">Pump &amp; array sizing</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Buffered demand', value: `${formatIndianNumber(result.bufferedDemandL)} L/day` },
                  { label: 'Motor size', value: `${result.motorHP} HP` },
                  { label: 'Solar array', value: `${result.arrayKWp} kWp` },
                  { label: 'Peak sun hours', value: `${result.peakHours} h` },
                ].map((item) => (
                  <div key={item.label} className="rounded-card border border-border bg-parchment/40 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted">{item.label}</div>
                    <div className="mt-1 text-xl font-semibold text-blue-600">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold">PM-KUSUM Component B financing</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">System cost</span><span className="font-semibold">₹{formatIndianNumber(result.systemCost)}</span></div>
                <div className="flex justify-between"><span className="text-muted">KUSUM subsidy (60%)</span><span className="font-semibold text-meadow">− ₹{formatIndianNumber(result.kusumSubsidy)}</span></div>
                <div className="flex justify-between border-t border-border pt-3 text-base"><span className="font-semibold">Farmer contribution</span><span className="font-bold text-blue-600">₹{formatIndianNumber(result.netCost)}</span></div>
              </div>
              <a
                href="https://pmkusum.mnre.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-center gap-2 rounded-input bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-meadow"
              >
                <ExternalLink className="h-4 w-4" /> Apply on PM-KUSUM portal
              </a>
              <div className="mt-3 rounded-card bg-blue-500/10 px-4 py-3 text-xs text-blue-700">
                💧 Contributes to <strong>SDG 6 (Clean Water)</strong> — solar pump ensures reliable, zero-emission water access.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[480px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/50 px-8 text-center">
            <Droplets className="mb-4 h-12 w-12 text-blue-400" />
            <h3 className="text-lg font-semibold">Size your first solar pump</h3>
            <p className="mt-2 max-w-md text-sm text-muted">
              Enter the water source, daily demand and head. UrjaGram computes motor HP, solar array size, and PM-KUSUM subsidy.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default WaterSolar;
