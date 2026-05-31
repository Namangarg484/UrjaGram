import { useMemo, useState } from 'react';
import { Search, ExternalLink, FileDown } from 'lucide-react';
import { schemes, schemeEligibility } from '../data/schemes';
import { stateOptions } from '../data/solarLUT';
import { formatIndianNumber } from '../utils/indianFormat';

const villageCategories = ['General', 'SC/ST majority', 'Tribal', 'Coastal', 'Hill'];
const focusAreas = ['Solar', 'Water', 'Agriculture', 'Finance', 'Infrastructure', 'Livelihood'];

const ELIGIBILITY_TONE = {
  green: 'bg-meadow/10 text-meadow border-meadow/30',
  orange: 'bg-amber/15 text-amber border-amber/30',
  red: 'bg-red-100 text-red-600 border-red-200',
};
const ELIGIBILITY_LABEL = { green: 'Eligible', orange: 'Partial match', red: 'Not eligible' };

function downloadChecklist(scheme) {
  const lines = [
    `UrjaGram — Document Checklist`,
    `Scheme: ${scheme.name} (${scheme.ministry})`,
    `Portal: ${scheme.url}`,
    ``,
    `Required documents:`,
    ...scheme.documents.map((d, i) => `  ${i + 1}. ${d}`),
  ].join('\n');
  const blob = new Blob([lines], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${scheme.name.replace(/[^a-z0-9]+/gi, '_')}_checklist.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function EmptySchemeState() {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/50 px-8 text-center">
      <div className="empty-illustration mb-6 text-meadow">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="42" y="48" width="116" height="96" rx="20" fill="#E4F0E9" />
          <circle cx="88" cy="96" r="20" stroke="#1A5C40" strokeWidth="10" />
          <path d="M104 112L134 142" stroke="#D4A017" strokeWidth="12" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold">No matching schemes</h3>
      <p className="mt-2 max-w-md text-sm text-muted">Adjust the village profile filters to broaden the funding search and find eligible schemes for the current ViIP.</p>
    </div>
  );
}

function SchemeFinder({ addSchemeToViip, showToast }) {
  const [filters, setFilters] = useState({
    state: 'haryana',
    category: 'General',
    focus: ['Solar', 'Water'],
    budget: 20,
  });

  const filteredSchemes = useMemo(() => {
    return schemes.filter((scheme) => {
      const matchesState = scheme.states.includes('all') || scheme.states.includes(filters.state);
      const matchesCategory = scheme.categories.includes(filters.category);
      const matchesBudget = scheme.budgetLakh <= filters.budget;
      const matchesFocus = !filters.focus.length || filters.focus.some((focus) => scheme.tags.includes(focus));

      return matchesState && matchesCategory && matchesBudget && matchesFocus;
    });
  }, [filters]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: name === 'budget' ? Number(value) : value,
    }));
  };

  const toggleFocusArea = (focus) => {
    setFilters((current) => ({
      ...current,
      focus: current.focus.includes(focus)
        ? current.focus.filter((item) => item !== focus)
        : [...current.focus, focus],
    }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.34fr_0.66fr] animate-floatin">
      <section className="card p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/10 text-meadow">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Scheme Finder</h2>
            <p className="text-sm text-muted">Match village needs with relevant government schemes.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">State</label>
            <select className="input-base" name="state" value={filters.state} onChange={handleFilterChange}>
              {stateOptions.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Village category</label>
            <select className="input-base" name="category" value={filters.category} onChange={handleFilterChange}>
              {villageCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Focus area</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {focusAreas.map((focus) => {
                const active = filters.focus.includes(focus);
                return (
                  <button
                    key={focus}
                    onClick={() => toggleFocusArea(focus)}
                    className={`rounded-card border px-4 py-3 text-left text-sm font-medium transition ${
                      active ? 'border-meadow bg-meadow/10 text-meadow' : 'border-border bg-white text-muted hover:border-meadow/40'
                    }`}
                  >
                    {focus}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Budget range</label>
              <span className="text-sm font-semibold text-meadow">₹{filters.budget}L</span>
            </div>
            <input
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-meadow/15 accent-meadow"
              type="range"
              min="1"
              max="50"
              name="budget"
              value={filters.budget}
              onChange={handleFilterChange}
            />
          </div>
        </div>
      </section>

      <section>
        {filteredSchemes.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredSchemes.map((scheme) => {
              const verdict = schemeEligibility(scheme, { state: filters.state, category: filters.category });
              return (
              <article key={scheme.id} className="card flex flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold leading-6">{scheme.name}</h3>
                    <span className="mt-2 inline-flex rounded-badge bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
                      {scheme.ministry}
                    </span>
                  </div>
                  <span className={`shrink-0 rounded-badge border px-2.5 py-1 text-xs font-semibold ${ELIGIBILITY_TONE[verdict]}`}>
                    {ELIGIBILITY_LABEL[verdict]}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-muted">
                  <div><span className="font-semibold text-ink">Max benefit:</span> {scheme.maxBenefit}</div>
                  {scheme.estBenefitInr > 0 && (
                    <div><span className="font-semibold text-ink">Est. value:</span> ₹{formatIndianNumber(scheme.estBenefitInr)}</div>
                  )}
                  <div><span className="font-semibold text-ink">Eligibility:</span> {scheme.eligibility}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {scheme.tags.map((tag) => (
                    <span key={tag} className="badge bg-amber/15 text-amber">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <a
                    href={scheme.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-input bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-meadow"
                  >
                    <ExternalLink className="h-4 w-4" /> Apply Now
                  </a>
                  <button
                    onClick={() => { downloadChecklist(scheme); showToast(`Document checklist for ${scheme.name} downloaded.`); }}
                    className="flex items-center justify-center gap-2 rounded-input border border-border bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-meadow hover:text-meadow"
                  >
                    <FileDown className="h-4 w-4" /> Documents
                  </button>
                </div>
                <button
                  onClick={() => addSchemeToViip(scheme)}
                  className="mt-3 rounded-input border border-border bg-parchment/60 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-meadow hover:text-meadow"
                >
                  Add to ViIP
                </button>
              </article>
            );})}
          </div>
        ) : (
          <EmptySchemeState />
        )}
      </section>
    </div>
  );
}

export default SchemeFinder;