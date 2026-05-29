import { useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import { Plus, Loader2 } from 'lucide-react';
import { formatIndianNumber } from '../utils/indianFormat';
import { insertMrvRecord } from '../utils/supabaseClient';

const sdgProgress = [
  { id: 'SDG 1', label: 'No Poverty', value: 18, color: '#A21942' },
  { id: 'SDG 2', label: 'Zero Hunger', value: 20, color: '#DDA63A' },
  { id: 'SDG 3', label: 'Good Health', value: 16, color: '#4C9F38' },
  { id: 'SDG 6', label: 'Clean Water', value: 15, color: '#26BDE2' },
  { id: 'SDG 7', label: 'Clean Energy', value: 34, color: '#FCC30B' },
  { id: 'SDG 13', label: 'Climate Action', value: 22, color: '#3F7E44' },
];

const fieldSurveyRows = [
  { date: '12 May 2026', worker: 'Pooja Devi', activity: 'Rooftop verification', points: 22, status: 'Submitted' },
  { date: '15 May 2026', worker: 'Ritu Bala', activity: 'Household energy survey', points: 41, status: 'Synced' },
  { date: '17 May 2026', worker: 'Sunita Rani', activity: 'Panel shadow audit', points: 12, status: 'Reviewed' },
  { date: '19 May 2026', worker: 'Kavita Devi', activity: 'Water-energy nexus interview', points: 18, status: 'Submitted' },
  { date: '20 May 2026', worker: 'Anjali', activity: 'Livelihood baseline update', points: 14, status: 'Pending QA' },
];

function EmptyMrvState() {
  return (
    <div className="flex min-h-[540px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/50 px-8 text-center">
      <div className="empty-illustration mb-6 text-meadow">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="34" y="112" width="28" height="40" rx="10" fill="#D4A017" />
          <rect x="78" y="82" width="28" height="70" rx="10" fill="#2E7D52" />
          <rect x="122" y="54" width="28" height="98" rx="10" fill="#1A5C40" />
          <path d="M36 154H162" stroke="#94A3B8" strokeWidth="10" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold">No MRV data available</h3>
      <p className="mt-2 max-w-md text-sm text-muted">Seed or sync MRV records to track installed capacity, carbon progress, and SDG-linked field outcomes.</p>
    </div>
  );
}

function buildCumulativeTrend(records) {
  let running = 0;
  return records.map((record) => {
    running += record.co2OffsetT;
    return {
      ...record,
      cumulativeCo2: Number(running.toFixed(2)),
    };
  });
}

function MRVDashboard({ villages, mrvRecords, assessments, showToast, setMrvRecords }) {
  const [selectedVillageId, setSelectedVillageId] = useState(villages[0]?.id || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const [newRecord, setNewRecord] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    actualKWh: '',
    forecastKWh: '',
  });

  const selectedVillage = useMemo(
    () => villages.find((village) => village.id === Number(selectedVillageId)) || villages[0],
    [selectedVillageId, villages],
  );

  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment.villageId === selectedVillage?.id),
    [assessments, selectedVillage],
  );

  const villageRecords = useMemo(
    () => mrvRecords.filter((record) => record.villageId === selectedVillage?.id),
    [mrvRecords, selectedVillage],
  );

  const cumulativeTrend = useMemo(() => buildCumulativeTrend(villageRecords), [villageRecords]);

  const handleSaveRecord = async () => {
    if (!newRecord.actualKWh || !newRecord.forecastKWh) {
      showToast('Fill in both actual and forecast kWh.', 'error');
      return;
    }
    const co2 = Number(((Number(newRecord.actualKWh) * 0.82) / 1000).toFixed(3));
    const record = {
      villageId: selectedVillage?.id ?? null,
      villageName: selectedVillage?.name ?? '',
      month: Number(newRecord.month),
      year: Number(newRecord.year),
      actualKWh: Number(newRecord.actualKWh),
      forecastKWh: Number(newRecord.forecastKWh),
      co2OffsetT: co2,
    };
    setSavingRecord(true);
    const { error } = await insertMrvRecord(record);
    setSavingRecord(false);
    if (error) {
      showToast(`Saved locally. DB sync pending: ${error.message}`, 'error');
    } else {
      showToast('MRV record saved to database.');
    }
    const localRecord = { ...record, id: Date.now() };
    setMrvRecords((prev) => [...prev, localRecord]);
    setNewRecord({ month: now.getMonth() + 1, year: now.getFullYear(), actualKWh: '', forecastKWh: '' });
    setShowAddForm(false);
  };

  if (!villages.length || !mrvRecords.length) {
    return <EmptyMrvState />;
  }

  const installedCapacity = selectedAssessment?.systemKWp || 0;
  const capacityTarget = 18;
  const totalUnitsSaved = villageRecords.reduce((total, record) => total + record.actualKWh, 0);
  const totalCo2Offset = cumulativeTrend[cumulativeTrend.length - 1]?.cumulativeCo2 || 0;

  return (
    <div className="space-y-6 animate-floatin">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">MRV Dashboard</h2>
          <p className="mt-1 text-sm text-muted">Measure, report, and verify progress for village energy transition outcomes.</p>
        </div>

        <div className="w-full max-w-sm">
          <label className="mb-2 block text-sm font-medium">Village selector</label>
          <select
            value={selectedVillageId}
            onChange={(event) => setSelectedVillageId(event.target.value)}
            className="input-base"
          >
            {villages.map((village) => (
              <option key={village.id} value={village.id}>
                {village.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-2 rounded-card bg-meadow px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest"
        >
          <Plus className="h-4 w-4" />
          Log MRV Record
        </button>
      </div>

      {showAddForm && (
        <div className="card p-5">
          <h3 className="mb-4 text-base font-semibold">New MRV Entry — {selectedVillage?.name}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Month</label>
              <select className="input-base" value={newRecord.month} onChange={(e) => setNewRecord((r) => ({ ...r, month: e.target.value }))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Year</label>
              <input className="input-base" type="number" value={newRecord.year} onChange={(e) => setNewRecord((r) => ({ ...r, year: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Actual kWh generated</label>
              <input className="input-base" type="number" placeholder="e.g. 1850" value={newRecord.actualKWh} onChange={(e) => setNewRecord((r) => ({ ...r, actualKWh: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Forecast kWh</label>
              <input className="input-base" type="number" placeholder="e.g. 2000" value={newRecord.forecastKWh} onChange={(e) => setNewRecord((r) => ({ ...r, forecastKWh: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveRecord}
              disabled={savingRecord}
              className="flex items-center gap-2 rounded-card bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-meadow disabled:opacity-60"
            >
              {savingRecord ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingRecord ? 'Saving…' : 'Save Record'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="rounded-card border border-border px-5 py-2.5 text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="text-lg font-semibold">Energy KPIs</h3>
          <div className="mt-4 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">Installed capacity</span>
                <span className="font-semibold text-meadow">{formatIndianNumber(installedCapacity)} / {capacityTarget} kWp</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-meadow/10">
                <div className="h-full rounded-full bg-meadow" style={{ width: `${Math.min(100, (installedCapacity / capacityTarget) * 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">Monthly generation</span>
                <span className="font-semibold text-ink">Actual vs forecast</span>
              </div>
              <div className="h-28 rounded-card border border-border bg-parchment/40 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={villageRecords}>
                    <Line type="monotone" dataKey="actualKWh" stroke="#2E7D52" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="forecastKWh" stroke="#D4A017" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    <Tooltip formatter={(value) => [`${formatIndianNumber(value)} kWh`, '']} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-card border border-border bg-parchment/50 p-4">
              <div className="text-sm text-muted">Grid units saved</div>
              <div className="mt-1 text-2xl font-semibold">{formatIndianNumber(totalUnitsSaved)} kWh</div>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h3 className="text-lg font-semibold">Carbon Tracking</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-card border border-border bg-parchment/50 p-4">
              <div className="text-sm text-muted">CO₂ offset to date</div>
              <div className="mt-1 text-2xl font-semibold">{formatIndianNumber(totalCo2Offset)} tCO₂</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge bg-meadow/10 text-meadow">Monitoring</span>
              <span className="badge bg-amber/15 text-amber">Verification standard: Verra VCS</span>
            </div>
            <div className="rounded-card border border-border p-4 text-sm text-muted">
              Current village monitoring cadence is monthly, with cumulative emissions impact verified against the solar generation profile and field validation records.
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h3 className="text-lg font-semibold">SDG Progress</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {sdgProgress.map((sdg) => (
              <div key={sdg.id} className="rounded-card border border-border bg-parchment/40 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: sdg.color }}>
                    {sdg.id.replace('SDG ', '')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{sdg.id}</div>
                    <div className="text-xs text-muted">{sdg.label}</div>
                  </div>
                </div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted">Progress</span>
                  <span className="font-semibold">{sdg.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full" style={{ width: `${sdg.value}%`, backgroundColor: sdg.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden p-5">
          <h3 className="text-lg font-semibold">Field Survey Log</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 font-medium">SHG Worker</th>
                  <th className="pb-3 pr-4 font-medium">Activity</th>
                  <th className="pb-3 pr-4 font-medium">Data Points Collected</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {fieldSurveyRows.map((row) => (
                  <tr key={`${row.date}-${row.worker}`} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4">{row.date}</td>
                    <td className="py-3 pr-4">{row.worker}</td>
                    <td className="py-3 pr-4">{row.activity}</td>
                    <td className="py-3 pr-4">{formatIndianNumber(row.points)}</td>
                    <td className="py-3">
                      <span className="badge bg-forest/10 text-forest">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Monthly CO₂ Offset Trend</h3>
          <p className="text-sm text-muted">Cumulative offset curve beginning from the solar commissioning phase.</p>
        </div>

        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeTrend}>
              <defs>
                <linearGradient id="co2Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E7D52" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2E7D52" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [`${formatIndianNumber(value)} tCO₂`, 'Cumulative offset']} />
              <Area type="monotone" dataKey="cumulativeCo2" stroke="#1A5C40" strokeWidth={3} fill="url(#co2Fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

export default MRVDashboard;