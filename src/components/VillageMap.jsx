import 'leaflet/dist/leaflet.css';
import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { MapPinned, X, Sun, Leaf, Gauge, LayoutGrid } from 'lucide-react';
import { formatIndianNumber } from '../utils/indianFormat';

const filterOptions = [
  { value: 'all', label: 'All Villages' },
  { value: 'assessed', label: 'Assessed' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_started', label: 'Not Started' },
];

const statusStyles = {
  assessed: { label: 'Assessed', color: '#2E7D52' },
  pending: { label: 'Pending', color: '#D4A017' },
  not_started: { label: 'Not Started', color: '#9CA3AF' },
};

function EmptyMapState() {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/50 px-8 text-center">
      <div className="empty-illustration mb-6 text-meadow">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M44 54L88 38L156 58V146L112 162L44 142V54Z" fill="#E4F0E9" />
          <path d="M88 38V126" stroke="#2E7D52" strokeWidth="10" strokeLinecap="round" />
          <path d="M112 70V162" stroke="#1A5C40" strokeWidth="10" strokeLinecap="round" />
          <circle cx="112" cy="92" r="18" fill="#D4A017" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold">No village locations loaded</h3>
      <p className="mt-2 max-w-md text-sm text-muted">Add village records to begin spatial planning and track assessment coverage across the block.</p>
    </div>
  );
}

function VillageMap({ villages, assessments, showToast }) {
  const [filter, setFilter] = useState('all');
  const [report, setReport] = useState(null); // { village, assessment }

  const visibleVillages = useMemo(() => {
    if (filter === 'all') {
      return villages;
    }

    return villages.filter((village) => village.status === filter);
  }, [filter, villages]);

  const assessmentByVillageId = useMemo(
    () =>
      assessments.reduce((accumulator, assessment) => {
        accumulator[assessment.villageId] = assessment;
        return accumulator;
      }, {}),
    [assessments],
  );

  if (!villages.length) {
    return <EmptyMapState />;
  }

  return (
    <div className="space-y-5 animate-floatin">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Village Map</h2>
          <p className="mt-1 text-sm text-muted">Operational map for assessment coverage across Haryana villages.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-badge border px-4 py-2 text-sm font-medium transition ${
                filter === option.value
                  ? 'border-amber bg-amber/15 text-amber'
                  : 'border-border bg-white text-muted hover:border-meadow hover:text-meadow'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card relative overflow-hidden p-3 md:p-4">
        <div className="absolute right-4 top-4 z-[500] w-52 rounded-card border border-border bg-white/95 p-4 shadow-card backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPinned className="h-4 w-4 text-meadow" />
            Status Legend
          </div>
          <div className="space-y-2">
            {Object.entries(statusStyles).map(([key, style]) => (
              <div key={key} className="flex items-center gap-2 text-sm text-muted">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: style.color }} />
                {style.label}
              </div>
            ))}
          </div>
        </div>

        <div className="h-[620px] overflow-hidden rounded-card">
          <MapContainer center={[28.67, 76.99]} zoom={8} scrollWheelZoom className="h-full w-full">
            {/* Google Hybrid — satellite imagery + road labels (Google Earth style) */}
            <TileLayer
              attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
              url="https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              subdomains={['0', '1', '2', '3']}
              maxZoom={20}
            />

            {visibleVillages.map((village) => {
              const statusStyle = statusStyles[village.status] || statusStyles.not_started;
              const assessment = assessmentByVillageId[village.id];

              return (
                <CircleMarker
                  key={village.id}
                  center={[village.lat, village.lng]}
                  radius={11}
                  pathOptions={{
                    color: statusStyle.color,
                    fillColor: statusStyle.color,
                    fillOpacity: 0.78,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="min-w-[220px] space-y-3 p-1">
                      <div>
                        <div className="text-base font-semibold text-ink">{village.name}</div>
                        <div className="text-sm text-muted">{village.gpName}</div>
                      </div>

                      <span
                        className="inline-flex rounded-badge px-3 py-1 text-xs font-semibold"
                        style={{ backgroundColor: `${statusStyle.color}20`, color: statusStyle.color }}
                      >
                        {statusStyle.label}
                      </span>

                      {assessment ? (
                        <div className="space-y-1 text-sm text-ink">
                          <div>Solar capacity: {formatIndianNumber(assessment.systemKWp)} kWp</div>
                          <div>Panels count: {formatIndianNumber(assessment.panelCount)}</div>
                        </div>
                      ) : null}

                      <button
                        onClick={() => setReport({ village, assessment })}
                        className="btn-grad w-full !py-2 !text-sm"
                      >
                        <span className="relative z-10">View Full Report</span>
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Full report modal */}
      {report && (
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm animate-scalein sm:items-center sm:p-4"
          onClick={() => setReport(null)}
        >
          <div
            className="panel-3d max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-meadow">Village Report</div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">{report.village.name}</h3>
                <p className="text-sm text-muted">{report.village.gpName} · {report.village.district}, {report.village.state}</p>
              </div>
              <button
                onClick={() => setReport(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted transition hover:border-meadow hover:text-meadow"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border bg-parchment/50 p-3">
                <div className="text-xs text-muted">Population</div>
                <div className="mt-0.5 text-lg font-semibold">{formatIndianNumber(report.village.population)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-parchment/50 p-3">
                <div className="text-xs text-muted">Households</div>
                <div className="mt-0.5 text-lg font-semibold">{formatIndianNumber(report.village.households)}</div>
              </div>
            </div>

            {report.assessment ? (
              <>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Solar Assessment</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Sun, label: 'System capacity', value: `${formatIndianNumber(report.assessment.systemKWp)} kWp`, color: 'text-amber' },
                    { icon: LayoutGrid, label: 'Panels', value: formatIndianNumber(report.assessment.panelCount), color: 'text-meadow' },
                    { icon: Gauge, label: 'Annual generation', value: `${formatIndianNumber(Math.round(report.assessment.annualKWh || 0))} kWh`, color: 'text-forest' },
                    { icon: Leaf, label: 'CO₂ offset', value: `${formatIndianNumber(report.assessment.co2OffsetT || 0)} t/yr`, color: 'text-meadow' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-2xl border border-border bg-white p-4">
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                      <div className="mt-2 text-xs text-muted">{m.label}</div>
                      <div className="text-lg font-bold">{m.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-parchment/40 p-5 text-center text-sm text-muted">
                No solar assessment recorded for this village yet.
              </div>
            )}

            <button
              onClick={() => setReport(null)}
              className="btn-grad mt-6 w-full"
            >
              <span className="relative z-10">Close report</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VillageMap;