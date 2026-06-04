import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Satellite, Sparkles, Save, Sun, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';
import { stateOptions } from '../data/solarLUT';
import { formatIndianNumber } from '../utils/indianFormat';
import { runSolarCalculations } from '../utils/calculations';
import { assessSolarImage, generateSolarViipSection } from '../utils/openaiApi';
import { resizeImageForVision } from '../utils/imageUtils';
import { insertSolarAssessment } from '../utils/supabaseClient';
import { fetchLivePeakSunHours } from '../utils/geeApi';

const roofTypeOptions = [
  { value: 'flat', label: 'Flat / RCC' },
  { value: 'sloped', label: 'Sloped / Tiled' },
  { value: 'mixed', label: 'Mixed' },
];

const confidenceTone = {
  low: 'bg-red-100 text-red-600',
  medium: 'bg-amber/20 text-amber',
  high: 'bg-meadow/10 text-meadow',
};

function EmptyAssessmentState() {
  return (
    <div className="flex min-h-[480px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/50 px-8 text-center">
      <div className="empty-illustration mb-6 text-meadow">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="28" y="48" width="144" height="96" rx="20" fill="#E4F0E9" />
          <path d="M50 122L82 94L108 118L132 86L154 112" stroke="#1A5C40" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="143" cy="72" r="13" fill="#D4A017" />
          <path d="M64 150H137" stroke="#2E7D52" strokeWidth="10" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold">Run the first assessment</h3>
      <p className="mt-2 max-w-md text-sm text-muted">
        Upload a rooftop or satellite image, select the site context, and UrjaGram will estimate solar fit, capacity, and subsidy potential. हिंदी लेबल support can be layered next.
      </p>
    </div>
  );
}

const ASSESSMENT_STEPS = [
  'Compressing image…',
  'Sending to GPT-4o Vision API…',
  'Analysing rooftop geometry…',
  'Running solar calculations…',
];

const PM_SURYA_PROCESS_STEPS = [
  'Register consumer mobile number on PM Surya Ghar portal.',
  'Complete profile with name, address, state, district and PIN.',
  'Choose DISCOM and fetch consumer account details.',
  'Submit rooftop application and wait for feasibility approval.',
  'Select empanelled vendor and finalise technical proposal.',
  'Collect KYC documents and upload clear mobile scans/photos.',
  'Install plant as per sanctioned capacity and DISCOM norms.',
  'Request DISCOM inspection and net-metering approval.',
  'Upload commissioning proof and vendor completion report.',
  'Track subsidy disbursal to beneficiary bank account.',
];

const MOBILE_DOCS = [
  'Aadhaar (front + back)',
  'Latest electricity bill',
  'Bank passbook / cancelled cheque',
  'Roof ownership / NOC proof',
  'Applicant passport photo',
  'Site photos (roof + meter board)',
];

const normalizeName = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenSet = (name = '') => new Set(normalizeName(name).split(' ').filter(Boolean));

const nameSimilarity = (left = '', right = '') => {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((t) => b.has(t)).length;
  return common / Math.max(a.size, b.size);
};

function SolarAssessment({ villages, saveAssessment, showToast, currentUser }) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    state: 'haryana',
    roofType: 'flat',
    buildingType: 'residential',
    monthlyConsumption: 300,
    estimatedMonthlyIncome: 15000,
    villageName: '',
    aadhaarName: '',
    billName: '',
    aadhaarNumber: '',
    photoMatchConfirmed: 'yes',
  });
  const [docChecklist, setDocChecklist] = useState(
    MOBILE_DOCS.reduce((acc, doc) => ({ ...acc, [doc]: false }), {}),
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingViipSection, setLoadingViipSection] = useState(false);
  const [result, setResult] = useState(null);
  const [viipSection, setViipSection] = useState('');
  const [showRawResponse, setShowRawResponse] = useState(false);

  const selectedState = useMemo(
    () => stateOptions.find((item) => item.value === form.state) || stateOptions[0],
    [form.state],
  );

  const kycCheck = useMemo(() => {
    const aadhaar = normalizeName(form.aadhaarName);
    const bill = normalizeName(form.billName);
    const hasNames = Boolean(aadhaar && bill);
    const sameName = hasNames && aadhaar === bill;
    const similarity = nameSimilarity(form.aadhaarName, form.billName);
    const partial = hasNames && !sameName && similarity >= 0.5;
    const aadhaarValid = /^\d{12}$/.test((form.aadhaarNumber || '').replace(/\s+/g, ''));
    const photoMatch = form.photoMatchConfirmed === 'yes';

    if (!hasNames) {
      return {
        tone: 'border-border bg-parchment/40 text-muted',
        label: 'Pending KYC pre-check',
        note: 'Enter Aadhaar name and electricity-bill name to detect mismatch risk early.',
      };
    }

    if (sameName) {
      return {
        tone: 'border-meadow/25 bg-meadow/10 text-meadow',
        label: 'Name match: low rejection risk',
        note: 'Aadhaar and bill name match. Continue with vendor quote and DISCOM feasibility.',
      };
    }

    if (partial && aadhaarValid && photoMatch) {
      return {
        tone: 'border-amber/30 bg-amber/10 text-amber',
        label: 'Partial mismatch: needs supporting papers',
        note: 'Likely resolvable with self-declaration affidavit + ownership/NOC + same Aadhaar proof.',
      };
    }

    return {
      tone: 'border-red-200 bg-red-50 text-red-600',
      label: 'High mismatch risk',
      note: 'Correct profile details before submission. Collect affidavit and verify identity at DISCOM helpdesk.',
    };
  }, [form.aadhaarName, form.billName, form.aadhaarNumber, form.photoMatchConfirmed]);

  const docsCollectedCount = useMemo(
    () => Object.values(docChecklist).filter(Boolean).length,
    [docChecklist],
  );

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });

  const handleFileSelection = async (file) => {
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      showToast('Please upload a PNG, JPG, or WEBP image.', 'error');
      return;
    }

    setImageFile(file);
    setResult(null);
    setViipSection('');
    const preview = await readFileAsDataUrl(file);
    setImagePreview(preview);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    await handleFileSelection(file);
  };

  const runAssessment = async () => {
    if (!imageFile) {
      showToast('Upload a rooftop image before running the assessment.', 'error');
      return;
    }

    if (!form.villageName.trim()) {
      showToast('Enter a village or Gram Panchayat name.', 'error');
      return;
    }

    // Map AI-detected roof type label → calculation key
    const detectRoofKey = (detected = '') => {
      const d = detected.toLowerCase();
      if (d.includes('slop') || d.includes('til')) return 'sloped';
      if (d.includes('mix')) return 'mixed';
      if (d.includes('terrace') || d.includes('industrial')) return 'flat';
      return 'flat';
    };

    try {
      setLoadingAssessment(true);
      setLoadingStep(0);
      setResult(null);

      // Step 0: compress image
      const { base64: imageBase64, mime: imageMime } = await resizeImageForVision(imageFile, 1024);

      // Step 1 → 2: call GPT-4o Vision
      setLoadingStep(1);
      const aiResult = await assessSolarImage({ imageMime, imageBase64 });

      // Step 3: run calculations (optionally with live GEE peak sun hours)
      setLoadingStep(3);
      const resolvedRoofType = aiResult.roof_type_detected
        ? detectRoofKey(aiResult.roof_type_detected)
        : form.roofType;

      setForm((current) => ({ ...current, roofType: resolvedRoofType }));

      // Try live satellite peak sun hours; fall back to LUT if unavailable
      const stateCoords = stateOptions.find((s) => s.value === form.state);
      const livePeakHours = stateCoords
        ? await fetchLivePeakSunHours(stateCoords.lat, stateCoords.lng)
        : null;

      const computed = runSolarCalculations({
        roofArea: aiResult.roof_area_sqm,
        shadingPct: aiResult.shading_pct,
        roofType: resolvedRoofType,
        stateKey: form.state,
        buildingType: form.buildingType,
        monthlyConsumption: Number(form.monthlyConsumption),
        estimatedMonthlyIncome: Number(form.estimatedMonthlyIncome),
        overridePeakHours: livePeakHours,
      });

      setResult({
        aiResult,
        computed,
        resolvedRoofType,
        livePeakHours,
        formSnapshot: { ...form, roofType: resolvedRoofType, monthlyConsumption: Number(form.monthlyConsumption) },
        imagePreview: imagePreview,
        calledAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        callId: aiResult._callId,
      });
      showToast('Solar assessment complete.');
    } catch (error) {
      showToast(error.message || 'Solar assessment failed.', 'error');
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;

    const matchedVillage = villages.find(
      (village) => village.name.toLowerCase() === result.formSnapshot.villageName.trim().toLowerCase(),
    );

    const record = {
      id: Date.now(),
      villageId: matchedVillage?.id || null,
      villageName: result.formSnapshot.villageName.trim(),
      roofAreaSqm: result.aiResult.roof_area_sqm,
      usableAreaSqm: Number(result.computed.usableArea.toFixed(2)),
      panelCount: result.computed.panelCount,
      systemKWp: Number(result.computed.systemKWp.toFixed(2)),
      annualKWh: Number(result.computed.annualKWh.toFixed(0)),
      co2OffsetT: Number(result.computed.co2Offset.toFixed(2)),
      coveragePct: Number(result.computed.coveragePct.toFixed(0)),
      subsidyInr: Math.round(result.computed.subsidy),
      confidence: result.aiResult.confidence,
      orientation: result.aiResult.orientation,
      shadingPct: result.aiResult.shading_pct,
      roofTypeDetected: result.aiResult.roof_type_detected ?? null,
      observations: result.aiResult.observations ?? null,
      imageUrl: result.imagePreview,
      assessedBy: currentUser?.name ?? null,
      assessedAt: new Date().toISOString(),
    };

    // Always update local state immediately so the UI is responsive.
    saveAssessment(record);

    // Attempt live Supabase insert — graceful fallback if table doesn't exist yet.
    const { error } = await insertSolarAssessment(record);
    if (error) {
      showToast(`Saved locally. DB sync pending: ${error.message}`, 'error');
    } else {
      showToast('Assessment saved to village database.');
    }
  };

  const handleGenerateViipSection = async () => {
    if (!result) {
      return;
    }

    try {
      setLoadingViipSection(true);
      const text = await generateSolarViipSection({
        village: result.formSnapshot.villageName,
        state: selectedState.label,
        roofType: form.roofType,
        detectedRoofType: result.aiResult.roof_type_detected,
        observations: result.aiResult.observations,
        shadingPct: result.aiResult.shading_pct,
        orientation: result.aiResult.orientation,
        roofAreaSqm: result.aiResult.roof_area_sqm,
        usableAreaSqm: Number(result.computed.usableArea.toFixed(2)),
        panelCount: result.computed.panelCount,
        systemKWp: Number(result.computed.systemKWp.toFixed(2)),
        annualKWh: Number(result.computed.annualKWh.toFixed(0)),
        monthlyDemandKWh: Number(form.monthlyConsumption),
        coveragePct: Number(result.computed.coveragePct.toFixed(0)),
        subsidyInr: Math.round(result.computed.subsidy),
      });

      setViipSection(text);
      showToast('ViIP energy section generated.');
    } catch (error) {
      showToast(error.message || 'Unable to generate ViIP section.', 'error');
    } finally {
      setLoadingViipSection(false);
    }
  };

  return (
    <div className="space-y-6 animate-floatin">
      {/* Solar hero header — amber/green identity, distinct from Water module */}
      <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-[#D4A017] via-[#2E7D52] to-[#1A5C40] p-6 text-white shadow-float md:p-8">
        <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-amber/30 blur-2xl" />
        <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-meadow/30 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-md animate-floaty">
            <Sun className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Solar Assessment Module</div>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-3xl">AI Rooftop Solar Analysis</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              GPT-4o Vision + live satellite irradiance for subsidy, loan feasibility and government CAPEX planning.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="panel-3d p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-forest">Roof & demand inputs</h2>
            <p className="mt-1 text-sm text-muted">VET-OS rooftop fit analysis for village solar planning.</p>
          </div>
          <span className="badge bg-forest/10 text-forest">VET-OS Core</span>
        </div>

        <div className="space-y-5">
          <div>
            <div
              className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/60 p-6 text-center transition hover:border-meadow hover:bg-meadow/5"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="w-full space-y-4">
                  <img src={imagePreview} alt="Rooftop preview" className="h-52 w-full rounded-card object-cover" />
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-meadow">
                    <ImagePlus className="h-4 w-4" />
                    Replace uploaded image
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 text-meadow">
                    <Satellite className="h-8 w-8" />
                  </div>
                  <p className="text-base font-semibold">Drop satellite or rooftop image here</p>
                  <p className="mt-2 text-sm text-muted">PNG, JPG, WEBP supported. Click to browse.</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(event) => handleFileSelection(event.target.files?.[0])}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Building type</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'residential', l: 'Residential' }, { v: 'government', l: 'Govt building' }].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, buildingType: opt.v }))}
                  className={`rounded-input border px-4 py-2.5 text-sm font-semibold transition ${
                    form.buildingType === opt.v
                      ? 'border-meadow bg-meadow/10 text-meadow'
                      : 'border-border bg-white text-muted hover:border-meadow/40'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">State</label>
            <select name="state" value={form.state} onChange={handleFieldChange} className="input-base">
              {stateOptions.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label} ({state.peakHours}h)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Roof Type</label>
            <select name="roofType" value={form.roofType} onChange={handleFieldChange} className="input-base">
              {roofTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Monthly consumption</label>
              <span className="text-sm font-semibold text-meadow">{formatIndianNumber(form.monthlyConsumption)} kWh</span>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              name="monthlyConsumption"
              value={form.monthlyConsumption}
              onChange={handleFieldChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-meadow/15 accent-meadow"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Village / GP name</label>
            <input
              type="text"
              name="villageName"
              value={form.villageName}
              onChange={handleFieldChange}
              placeholder="Naultha Gram Panchayat"
              className="input-base"
            />
          </div>

          {/* PM Surya Ghar KYC mismatch resolver */}
          <div className="rounded-card border border-border bg-parchment/40 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">PM Surya Ghar KYC pre-check</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Name as per Aadhaar</label>
                <input
                  type="text"
                  name="aadhaarName"
                  value={form.aadhaarName}
                  onChange={handleFieldChange}
                  placeholder="e.g. RAVI KUMAR"
                  className="input-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Name as per electricity bill</label>
                <input
                  type="text"
                  name="billName"
                  value={form.billName}
                  onChange={handleFieldChange}
                  placeholder="e.g. RAVI KUMAR SHARMA"
                  className="input-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Aadhaar number (12 digits)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  name="aadhaarNumber"
                  value={form.aadhaarNumber}
                  onChange={(e) => setForm((c) => ({ ...c, aadhaarNumber: e.target.value.replace(/\D/g, '') }))}
                  placeholder="XXXXXXXXXXXX"
                  className="input-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Photo matches Aadhaar?</label>
                <select
                  name="photoMatchConfirmed"
                  value={form.photoMatchConfirmed}
                  onChange={handleFieldChange}
                  className="input-base"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
            <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${kycCheck.tone}`}>
              <div className="font-semibold">{kycCheck.label}</div>
              <div className="mt-1">{kycCheck.note}</div>
            </div>
          </div>

          {/* Mobile document collection tracker */}
          <div className="rounded-card border border-aqua/20 bg-aqua-light/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-aqua-deep">
                <Smartphone className="h-3.5 w-3.5" /> Mobile Document Collection
              </div>
              <div className="text-xs font-semibold text-aqua-deep">{docsCollectedCount}/{MOBILE_DOCS.length}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MOBILE_DOCS.map((doc) => (
                <label key={doc} className="flex items-center gap-2 rounded-lg border border-border/60 bg-white px-2.5 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(docChecklist[doc])}
                    onChange={() => setDocChecklist((c) => ({ ...c, [doc]: !c[doc] }))}
                  />
                  <span className="text-ink">{doc}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Capture clear photos in daylight. Keep file size under 2 MB per document for faster portal upload.
            </p>
          </div>

          {form.buildingType === 'residential' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Est. monthly income</label>
                <span className="text-sm font-semibold text-meadow">₹{formatIndianNumber(form.estimatedMonthlyIncome)}</span>
              </div>
              <input
                type="range"
                min="5000"
                max="100000"
                step="1000"
                name="estimatedMonthlyIncome"
                value={form.estimatedMonthlyIncome}
                onChange={handleFieldChange}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-meadow/15 accent-meadow"
              />
              <p className="mt-1 text-[11px] text-muted">Used for loan feasibility / CIBIL-risk check.</p>
            </div>
          )}

          <button
            onClick={runAssessment}
            disabled={loadingAssessment}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-meadow px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Sparkles className="h-4 w-4" />
            Run Solar Assessment
          </button>

          <div className="rounded-card border border-forest/20 bg-forest/5 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-forest">PM Surya Ghar: 10-step guided process</div>
            <ol className="space-y-1.5 text-xs text-ink">
              {PM_SURYA_PROCESS_STEPS.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-forest/15 text-[10px] font-bold text-forest">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="card p-6">
        {!result && !loadingAssessment ? (
          <EmptyAssessmentState />
        ) : null}

        {loadingAssessment ? (
          <div className="space-y-6">
            {/* Step progress indicator */}
            <div className="rounded-card border border-meadow/20 bg-meadow/5 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-meadow border-t-transparent" />
                <span className="text-sm font-semibold text-meadow">{ASSESSMENT_STEPS[loadingStep]}</span>
              </div>
              <div className="flex gap-2">
                {ASSESSMENT_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                      i <= loadingStep ? 'bg-meadow' : 'bg-meadow/20'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">Live GPT-4o Vision API call in progress — not a cached result</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-card border border-border p-4">
                  <SkeletonLoader lines={3} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">Assessment Results</h3>
                <p className="mt-1 text-sm text-muted">
                  {result.formSnapshot.villageName} · {selectedState.label} · {selectedState.peakHours} peak sun hours
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${confidenceTone[result.aiResult.confidence] || confidenceTone.medium}`}>
                  Confidence: {result.aiResult.confidence}
                </span>
                {/* Live-call proof — callId is unique per GPT-4o request */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-meadow/10 px-2.5 py-1 text-[11px] font-semibold text-meadow" title={`OpenAI call ID: ${result.callId || 'n/a'} · tokens: ${(result.aiResult._promptTokens || 0) + (result.aiResult._completionTokens || 0)}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-meadow" />
                  Live · {result.calledAt}
                  {result.callId && <span className="opacity-60 font-mono text-[10px]">#{result.callId.slice(-6)}</span>}
                </span>
              </div>
            </div>

            <div className="rounded-card border border-border bg-parchment/60 p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">AI Observation</div>
              <p className="text-sm leading-6 text-ink">{result.aiResult.observations}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-card border border-border p-4">
                <div className="text-sm text-muted">Shading</div>
                <div className="mt-1 text-2xl font-semibold">{result.aiResult.shading_pct}%</div>
              </div>
              <div className="rounded-card border border-border p-4">
                <div className="text-sm text-muted">Orientation rating</div>
                <div className="mt-1 text-2xl font-semibold capitalize">{result.aiResult.orientation}</div>
              </div>
              <div className="rounded-card border border-border p-4">
                <div className="flex items-center gap-1 text-sm text-muted">
                  AI Detected Roof
                  <span className="ml-1 rounded bg-meadow/10 px-1.5 py-0.5 text-[10px] font-semibold text-meadow">AI</span>
                </div>
                <div className="mt-1 text-base font-semibold">{result.aiResult.roof_type_detected || '—'}</div>
              </div>
              <div className="rounded-card border border-border p-4">
                <div className="text-sm text-muted">Used in Calc</div>
                <div className="mt-1 text-base font-semibold capitalize">{result.resolvedRoofType}</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Roof Area', value: `${formatIndianNumber(result.aiResult.roof_area_sqm)} m²` },
                { label: 'Usable Area', value: `${formatIndianNumber(result.computed.usableArea.toFixed(2))} m²` },
                { label: 'Panels Recommended', value: formatIndianNumber(result.computed.panelCount) },
                { label: 'System Capacity', value: `${formatIndianNumber(result.computed.systemKWp.toFixed(2))} kWp` },
                { label: 'Annual Generation', value: `${formatIndianNumber(result.computed.annualKWh.toFixed(0))} kWh` },
                { label: 'CO₂ Offset', value: `${formatIndianNumber(result.computed.co2Offset.toFixed(2))} tCO₂/yr` },
              ].map((metric) => (
                <div key={metric.label} className="rounded-card border border-border bg-white p-4 shadow-sm">
                  <div className="text-sm text-muted">{metric.label}</div>
                  <div className="mt-2 text-xl font-semibold tracking-tight">{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-card border border-border p-5">
              {/* Coverage bar */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Consumption coverage</div>
                  <div className="text-xs text-muted">
                    {formatIndianNumber(Math.round(result.computed.monthlyKWh))} kWh/mo generated
                    &nbsp;vs&nbsp;
                    {formatIndianNumber(result.formSnapshot.monthlyConsumption)} kWh/mo demand
                  </div>
                </div>
                <div className={`text-lg font-semibold ${result.computed.coveragePct > 100 ? 'text-amber' : 'text-meadow'}`}>
                  {Math.round(result.computed.coveragePct)}%
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-meadow/10">
                <div
                  className="h-full rounded-full bg-meadow transition-all duration-700"
                  style={{ width: `${Math.min(100, result.computed.coveragePct)}%` }}
                />
              </div>
              {result.computed.coveragePct > 110 && (
                <div className="mt-2 text-xs text-amber">
                  ⚡ Oversized — surplus ~{formatIndianNumber(Math.round(result.computed.monthlyKWh - result.formSnapshot.monthlyConsumption))} kWh/mo.
                  &nbsp;Right-sized system: {result.computed.recommendedKWp.toFixed(1)} kWp.
                </div>
              )}
            </div>

            {/* PM Surya Ghar subsidy */}
            {result.computed.flow === 'residential' && (
            <div className="rounded-card border border-amber/25 bg-amber/10 p-5">
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber">PM Surya Ghar Muft Bijli Yojana — CFA</div>
              <p className="mt-1 text-[11px] text-muted">
                Left card driven by <span className="font-semibold text-ink">consumption + state</span> — change either to see it update.
                Right card driven by <span className="font-semibold text-ink">AI roof area</span> — changes with each image.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {/* Recommended — changes with every consumption input */}
                <div className="rounded-xl border border-meadow/25 bg-white p-4">
                  <div className="text-xs text-muted">For your demand ({result.computed.recommendedKWp.toFixed(2)} kWp)</div>
                  <div className="mt-1 text-2xl font-bold text-meadow">
                    ₹{formatIndianNumber(Math.round(result.computed.recommendedSubsidy))}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted">
                    {result.computed.recommendedKWp <= 2
                      ? `${result.computed.recommendedKWp.toFixed(2)} kW × ₹30,000`
                      : result.computed.recommendedKWp <= 3
                      ? `2 kW×₹30k + ${(result.computed.recommendedKWp - 2).toFixed(2)} kW×₹18k`
                      : `2 kW×₹30k + 1 kW×₹18k → capped`}
                  </div>
                  <div className="mt-2 text-[11px] text-muted">
                    ({formatIndianNumber(result.formSnapshot.monthlyConsumption)} kWh/mo ÷ {result.computed.peakHours}h × 365 = {result.computed.recommendedKWp.toFixed(2)} kWp)
                  </div>
                </div>

                {/* Full roof — hits cap for large systems */}
                <div className="rounded-xl border border-amber/20 bg-amber/5 p-4">
                  <div className="text-xs text-muted">Full roof ({result.computed.systemKWp.toFixed(1)} kWp)</div>
                  <div className="mt-1 text-2xl font-bold text-forest">
                    ₹{formatIndianNumber(Math.round(result.computed.subsidy))}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted">
                    {result.computed.systemKWp <= 2
                      ? `${result.computed.systemKWp.toFixed(2)} kW × ₹30,000`
                      : result.computed.systemKWp <= 3
                      ? `2 kW×₹30k + ${(result.computed.systemKWp - 2).toFixed(2)} kW×₹18k`
                      : `2 kW×₹30k + 1 kW×₹18k → capped at 3 kW`}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {result.computed.systemKWp > 3 ? 'CFA capped at 3 kW — no extra benefit above' : 'Full roof eligible for CFA'}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <div className="font-semibold text-ink">≤ 2 kW</div>₹30,000 / kW
                </div>
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <div className="font-semibold text-ink">2 – 3 kW</div>+₹18,000 / kW
                </div>
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <div className="font-semibold text-ink">Above 3 kW</div>Capped at ₹78,000
                </div>
              </div>
            </div>
            )}

            {/* Loan feasibility — addresses the CIBIL/paperwork hurdle */}
            {result.computed.flow === 'residential' && result.computed.loanFeasibility && (
              <div className={`rounded-card border p-5 ${result.computed.loanFeasibility.cibilFlag ? 'border-red-200 bg-red-50' : 'border-meadow/25 bg-meadow/5'}`}>
                <div className={`mb-1 text-xs font-semibold uppercase tracking-[0.14em] ${result.computed.loanFeasibility.cibilFlag ? 'text-red-600' : 'text-meadow'}`}>
                  Loan Feasibility {result.computed.loanFeasibility.cibilFlag ? '— ⚠ CIBIL risk' : '— ✓ Affordable'}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-xs text-muted">Net cost (after subsidy)</div>
                    <div className="mt-1 text-xl font-bold text-ink">₹{formatIndianNumber(Math.round(result.computed.netCost))}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-xs text-muted">Monthly EMI (7 yr @ 8.5%)</div>
                    <div className="mt-1 text-xl font-bold text-ink">₹{formatIndianNumber(result.computed.loanFeasibility.emi)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-xs text-muted">Payback period</div>
                    <div className="mt-1 text-xl font-bold text-ink">{result.computed.paybackYears.toFixed(1)} yrs</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted">
                  Recommended channel: <span className="font-semibold text-ink">{result.computed.loanFeasibility.recommendedChannel}</span>
                </div>
              </div>
            )}

            {result.computed.flow === 'residential' && (
              <div className="rounded-card border border-border bg-white p-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ground challenges observed in government workflow</div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Name mismatch between Aadhaar and electricity bill.
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Delay in DISCOM feasibility, inspection and net-metering.
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Loan/CIBIL friction for low-income rural households.
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-meadow/20 bg-meadow/10 px-3 py-2 text-meadow">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Mobile document checklist reduces rejection and rework.
                  </div>
                </div>
              </div>
            )}

            {/* Government building financials */}
            {result.computed.flow === 'government' && (
              <div className="rounded-card border border-forest/25 bg-forest/5 p-5">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-forest">Government CAPEX model</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-xs text-muted">System cost</div>
                    <div className="mt-1 text-xl font-bold">₹{formatIndianNumber(Math.round(result.computed.systemCost))}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-xs text-muted">Annual savings</div>
                    <div className="mt-1 text-xl font-bold text-meadow">₹{formatIndianNumber(Math.round(result.computed.annualSavings))}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-xs text-muted">ROI / year</div>
                    <div className="mt-1 text-xl font-bold">{result.computed.roi.toFixed(1)}%</div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-xs text-muted">25-yr NPV @ 8%</div>
                    <div className="mt-1 text-xl font-bold text-forest">₹{formatIndianNumber(Math.round(result.computed.npv))}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted">
                  Carbon credit potential: <span className="font-semibold text-ink">{result.computed.carbonCreditTonnesPerYear.toFixed(2)} tCO₂/yr</span>
                </div>
              </div>
            )}

            {/* Panel fit notes from AI */}
            {result.aiResult.panel_fit_notes && (
              <div className="rounded-card border border-meadow/20 bg-meadow/5 p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-meadow">Panel Layout Recommendation</div>
                <p className="text-sm leading-6 text-ink">{result.aiResult.panel_fit_notes}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-card border border-meadow/20 bg-meadow/10 px-4 py-3 text-sm font-semibold text-meadow transition hover:bg-meadow/15"
              >
                <Save className="h-4 w-4" />
                Save to Village Database
              </button>
              <button
                onClick={handleGenerateViipSection}
                disabled={loadingViipSection}
                className="flex flex-1 items-center justify-center gap-2 rounded-card bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-meadow disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Sparkles className="h-4 w-4" />
                Generate ViIP Section
              </button>
            </div>

            {/* Raw AI response — expandable proof that the API is live */}
            <div className="rounded-card border border-border">
              <button
                type="button"
                onClick={() => setShowRawResponse((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted hover:text-ink"
              >
                <span>Raw GPT-4o Vision Response</span>
                <span className="rounded bg-parchment px-2 py-0.5 text-[10px] font-bold text-meadow">
                  {showRawResponse ? 'Hide' : 'Show proof'}
                </span>
              </button>
              {showRawResponse && (
                <pre className="overflow-x-auto rounded-b-card bg-slate-50 p-4 text-[11px] leading-5 text-slate-700">
                  {JSON.stringify(result.aiResult, null, 2)}
                </pre>
              )}
            </div>

            {loadingViipSection ? (
              <div className="rounded-card border border-border p-5">
                <SkeletonLoader lines={5} />
              </div>
            ) : null}

            {viipSection ? (
              <div className="rounded-card border border-border bg-parchment/60 p-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Generated ViIP Energy Section</div>
                <p className="text-sm leading-7 text-ink">{viipSection}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      </div>
    </div>
  );
}

export default SolarAssessment;