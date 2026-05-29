import { useMemo, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';
import { stateOptions } from '../data/solarLUT';
import { generateViipDocument } from '../utils/openaiApi';
import { insertViipDocument } from '../utils/supabaseClient';

const districtByState = {
  haryana: ['Panipat', 'Karnal', 'Sonipat', 'Hisar', 'Rohtak'],
  punjab: ['Ludhiana', 'Patiala', 'Bathinda'],
  rajasthan: ['Jaipur', 'Udaipur', 'Jodhpur'],
  uttar_pradesh: ['Lucknow', 'Kanpur Nagar', 'Varanasi'],
  maharashtra: ['Pune', 'Nashik', 'Nagpur'],
};

const livelihoodOptions = ['Agriculture', 'Mixed', 'Small Trade', 'Daily Wage Labour'];
const waterOptions = ['Borewell', 'Canal', 'Rainwater', 'River', 'Mixed'];
const priorityOptions = [
  'Solar Energy (PM Surya Ghar)',
  'Water Conservation',
  'Agroforestry & Nature-Based Solutions',
  'Crop Diversification',
  'Disaster Resilience',
  'Health & Sanitation',
  "Women's Livelihood (SHG)",
  'Carbon Credit Generation',
];

function EmptyViipState() {
  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/50 px-8 text-center">
      <div className="empty-illustration mb-6 text-meadow">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="48" y="34" width="104" height="132" rx="18" fill="#E4F0E9" />
          <path d="M74 72H126" stroke="#1A5C40" strokeWidth="10" strokeLinecap="round" />
          <path d="M74 100H126" stroke="#2E7D52" strokeWidth="10" strokeLinecap="round" />
          <path d="M74 128H112" stroke="#D4A017" strokeWidth="10" strokeLinecap="round" />
          <circle cx="134" cy="128" r="12" fill="#D4A017" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold">Generate the first ViIP</h3>
      <p className="mt-2 max-w-md text-sm text-muted">Capture the village profile and priority areas, then let the AI draft a structured investment plan for block and Panchayat review.</p>
    </div>
  );
}

function splitViipSections(documentText) {
  return documentText
    .split(/(?=\n?\d+\.\s)/)
    .map((section) => section.trim())
    .filter(Boolean);
}

function ViIPGenerator({ villages, saveViipDocument, viipDocuments, showToast, currentUser }) {
  const [form, setForm] = useState({
    villageName: 'Naultha',
    gpName: 'Panipat Gram Panchayat',
    state: 'haryana',
    district: 'Panipat',
    population: 4200,
    households: 760,
    livelihood: 'Agriculture',
    waterSource: 'Borewell',
    electricityHours: 8,
    hasSchool: true,
    hasPhc: false,
  });
  const [selectedPriorities, setSelectedPriorities] = useState(['Solar Energy (PM Surya Ghar)', 'Water Conservation']);
  const [loading, setLoading] = useState(false);
  const [documentText, setDocumentText] = useState('');

  const availableDistricts = useMemo(() => districtByState[form.state] || ['District not listed'], [form.state]);
  const documentSections = useMemo(() => splitViipSections(documentText), [documentText]);

  const handleFormChange = (event) => {
    const { name, value, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'number' || name === 'electricityHours' ? Number(value) : value,
      ...(name === 'state' ? { district: districtByState[value]?.[0] || '' } : {}),
    }));
  };

  const handleToggleField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const togglePriority = (priority) => {
    setSelectedPriorities((current) =>
      current.includes(priority) ? current.filter((item) => item !== priority) : [...current, priority],
    );
  };

  const handleGenerate = async () => {
    if (!selectedPriorities.length) {
      showToast('Select at least one priority area.', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...form,
        stateLabel: stateOptions.find((state) => state.value === form.state)?.label || form.state,
      };
      const text = await generateViipDocument(payload, selectedPriorities);
      setDocumentText(text);

      const doc = {
        id: Date.now(),
        villageName: form.villageName,
        gpName: form.gpName,
        state: form.state,
        district: form.district,
        content: text,
        priorities: selectedPriorities,
        generatedBy: currentUser?.name ?? null,
        generatedAt: new Date().toISOString(),
        status: 'draft',
      };
      saveViipDocument(doc);

      // Persist to Supabase
      const { error } = await insertViipDocument(doc);
      if (error) {
        showToast(`Saved locally. DB sync pending: ${error.message}`, 'error');
      } else {
        showToast('ViIP saved to database.');
      }
    } catch (error) {
      showToast(error.message || 'Unable to generate ViIP.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="card p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">ViIP Generator</h2>
          <p className="mt-1 text-sm text-muted">Village Integrated Investment Plan drafting for climate resilience and energy transition.</p>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Step 1 · Village Profile</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Village name</label>
                <input className="input-base" name="villageName" value={form.villageName} onChange={handleFormChange} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Gram Panchayat name</label>
                <input className="input-base" name="gpName" value={form.gpName} onChange={handleFormChange} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">State</label>
                <select className="input-base" name="state" value={form.state} onChange={handleFormChange}>
                  {stateOptions.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">District</label>
                <select className="input-base" name="district" value={form.district} onChange={handleFormChange}>
                  {availableDistricts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Population</label>
                <input className="input-base" type="number" name="population" value={form.population} onChange={handleFormChange} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Number of households</label>
                <input className="input-base" type="number" name="households" value={form.households} onChange={handleFormChange} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Primary livelihood</label>
                <select className="input-base" name="livelihood" value={form.livelihood} onChange={handleFormChange}>
                  {livelihoodOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Water source</label>
                <select className="input-base" name="waterSource" value={form.waterSource} onChange={handleFormChange}>
                  {waterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-card border border-border bg-parchment/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Current electricity hours/day</label>
                <span className="text-sm font-semibold text-meadow">{form.electricityHours} hrs</span>
              </div>
              <input
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-meadow/15 accent-meadow"
                type="range"
                min="0"
                max="24"
                name="electricityHours"
                value={form.electricityHours}
                onChange={handleFormChange}
              />

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[
                  { key: 'hasSchool', label: 'Has school?' },
                  { key: 'hasPhc', label: 'Has PHC?' },
                ].map((toggle) => (
                  <div key={toggle.key}>
                    <div className="mb-2 text-sm font-medium">{toggle.label}</div>
                    <div className="flex gap-2">
                      {[true, false].map((value) => (
                        <button
                          key={String(value)}
                          onClick={() => handleToggleField(toggle.key, value)}
                          className={`flex-1 rounded-input border px-3 py-2 text-sm font-medium transition ${
                            form[toggle.key] === value
                              ? 'border-meadow bg-meadow/10 text-meadow'
                              : 'border-border bg-white text-muted hover:border-meadow hover:text-meadow'
                          }`}
                        >
                          {value ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Step 2 · Priority Selection</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {priorityOptions.map((priority) => {
                const checked = selectedPriorities.includes(priority);
                return (
                  <label
                    key={priority}
                    className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 transition ${
                      checked ? 'border-meadow bg-meadow/10' : 'border-border bg-white hover:border-meadow/40'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => togglePriority(priority)} className="mt-1 accent-meadow" />
                    <span className="text-sm font-medium">{priority}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-meadow px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Sparkles className="h-4 w-4" />
            Generate ViIP with AI
          </button>
        </div>
      </section>

      <section className="card p-6">
        {!documentText && !loading ? <EmptyViipState /> : null}

        {loading ? (
          <div className="space-y-6">
            <div className="mb-3 h-6 w-48 rounded-full bg-slate-200 animate-pulse" />
            <SkeletonLoader lines={10} />
          </div>
        ) : null}

        {documentText ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">Generated ViIP</h3>
                <p className="mt-1 text-sm text-muted">Formal draft for Panchayat, block, and partner review.</p>
              </div>

              <button
                onClick={() => window.print()}
                className="no-print flex items-center gap-2 rounded-card border border-border bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-meadow hover:text-meadow"
              >
                <Download className="h-4 w-4" />
                Download as PDF
              </button>
            </div>

            <div className="rounded-card border border-border bg-parchment/40 p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedPriorities.map((priority) => (
                  <span key={priority} className="badge bg-amber/15 text-amber">
                    {priority}
                  </span>
                ))}
              </div>

              <div className="space-y-4">
                {documentSections.map((section) => {
                  const lines = section.split('\n').filter(Boolean);
                  const heading = lines[0];
                  const body = lines.slice(1).join('\n') || heading.replace(/^\d+\.\s*/, '');

                  return (
                    <section key={heading} className="rounded-card border border-border bg-white p-5 shadow-sm">
                      <h4 className="text-lg font-semibold text-forest">{heading}</h4>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink">{body}</p>
                    </section>
                  );
                })}
              </div>
            </div>

            {viipDocuments.length ? (
              <div className="rounded-card border border-border p-4">
                <div className="mb-2 text-sm font-semibold">Recent generated drafts</div>
                <div className="space-y-2 text-sm text-muted">
                  {viipDocuments.slice(0, 3).map((document) => (
                    <div key={document.id} className="rounded-input border border-border bg-parchment/40 px-3 py-2">
                      {document.villageName} · {new Date(document.generatedAt).toLocaleDateString('en-IN')}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default ViIPGenerator;