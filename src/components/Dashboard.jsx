import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardForecastData, recentActivity } from '../data/sampleData';
import { useIndianNumberFormat } from '../utils/indianFormat';

const roofTypeData = [
  { name: 'Flat RCC', value: 52, color: '#1A5C40' },
  { name: 'Sloped', value: 31, color: '#2E7D52' },
  { name: 'Mixed', value: 17, color: '#D4A017' },
];

const statCards = [
  { label: 'Villages Assessed', value: 12, icon: '🏘' },
  { label: 'Total Solar Capacity Mapped', value: '847 kWp', icon: '☀️' },
  { label: 'Estimated CO₂ Offset', value: '694 t', icon: '🌱' },
  { label: 'Active Gram Panchayats', value: 4, icon: '📍' },
];

function Dashboard({ villages, assessments, mrvRecords }) {
  const formatNumber = useIndianNumberFormat();

  // ── Live SDG aggregation from real assessment records ──────────────────────
  const totalKWp = assessments.reduce((s, a) => s + (Number(a.systemKWp) || 0), 0);
  const totalAnnualKWh = assessments.reduce((s, a) => s + (Number(a.annualKWh) || 0), 0);
  const totalCo2T = assessments.reduce((s, a) => s + (Number(a.co2OffsetT) || 0), 0);
  const householdsPowered = Math.round(totalAnnualKWh / 1200); // 1200 kWh/yr per rural HH
  const billSavingsInr = Math.round(totalAnnualKWh * 7.5);      // ₹7.5/kWh residential tariff

  const sdgGoals = [
    { id: 1, label: 'No Poverty', sub: 'Annual bill savings', value: billSavingsInr, target: 5_000_000, fmt: (v) => `₹${formatNumber(v)}`, color: '#EF4444' },
    { id: 7, label: 'Clean Energy', sub: 'Solar capacity installed', value: totalKWp, target: 1000, fmt: (v) => `${formatNumber(Math.round(v))} kWp`, color: '#D4A017' },
    { id: 11, label: 'Sustainable Communities', sub: 'Households powered', value: householdsPowered, target: 500, fmt: (v) => `${formatNumber(v)} HH`, color: '#8B5CF6' },
    { id: 13, label: 'Climate Action', sub: 'CO₂ offset per year', value: totalCo2T, target: 1000, fmt: (v) => `${formatNumber(Math.round(v))} tCO₂`, color: '#10B981' },
  ];

  return (
    <div className="space-y-6 animate-floatin">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <article key={card.label} className="card overflow-hidden p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 text-sm font-medium text-muted">{card.label}</div>
                <div className="text-3xl font-semibold tracking-tight">
                  {typeof card.value === 'number' ? formatNumber(card.value) : card.value}
                </div>
              </div>
              <div className="rounded-2xl bg-meadow/10 px-3 py-2 text-2xl">{card.icon}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="card p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Monthly Energy Generation Forecast (kWh)</h2>
              <p className="text-sm text-muted">Haryana seasonal production profile with summer peak.</p>
            </div>
            <span className="badge bg-meadow/10 text-meadow">Forecast</span>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardForecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E0D5" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip formatter={(value) => [`${formatNumber(value)} kWh`, 'Forecast']} />
                <Bar dataKey="generation" fill="#2E7D52" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Roof Type Distribution</h2>
            <p className="text-sm text-muted">Assessment mix across current Haryana sample villages.</p>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roofTypeData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                  {roofTypeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {roofTypeData.map((item) => (
              <div key={item.name} className="rounded-2xl border border-border bg-parchment/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="text-xl font-semibold">{item.value}%</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent Activity Feed</h2>
              <p className="text-sm text-muted">Latest system and field actions across UrjaGram.</p>
            </div>
            <span className="badge bg-amber/15 text-amber">Live</span>
          </div>

          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-border bg-parchment/60 p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{activity.text}</div>
                  <div className="text-xs text-muted">{activity.time}</div>
                </div>
                <div className="text-xs text-muted">{activity.meta}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Deployment Snapshot</h2>
            <p className="text-sm text-muted">Ground-truth summary from seeded app state.</p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-parchment/60 p-4">
              <div className="text-sm text-muted">Village records</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(villages.length)}</div>
            </div>
            <div className="rounded-2xl border border-border bg-parchment/60 p-4">
              <div className="text-sm text-muted">Completed assessments</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(assessments.length)}</div>
            </div>
            <div className="rounded-2xl border border-border bg-parchment/60 p-4">
              <div className="text-sm text-muted">MRV records loaded</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(mrvRecords.length)}</div>
            </div>
          </div>
        </article>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">UN SDG Impact (Live)</h2>
            <p className="text-sm text-muted">Aggregated from completed assessments — progress toward programme targets.</p>
          </div>
          <span className="badge bg-meadow/10 text-meadow">{formatNumber(assessments.length)} assessments</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sdgGoals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.value / goal.target) * 100));
            return (
              <div key={goal.id} className="rounded-2xl border border-border bg-parchment/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: goal.color }}
                  >
                    {goal.id}
                  </span>
                  <span className="text-sm font-semibold">SDG {goal.id}</span>
                </div>
                <div className="text-xs text-muted">{goal.label}</div>
                <div className="mt-2 text-xl font-semibold tracking-tight">{goal.fmt(goal.value)}</div>
                <div className="mt-1 text-[11px] text-muted">{goal.sub}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: goal.color }}
                  />
                </div>
                <div className="mt-1 text-right text-[11px] font-medium text-muted">{pct}% of target</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;