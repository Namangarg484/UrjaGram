import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Satellite, Sparkles, Sun, CheckCircle2, AlertTriangle, Smartphone, Camera, ChevronDown, ArrowRight, UserCircle, Store } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';
import { stateOptions } from '../data/solarLUT';
import { formatIndianNumber } from '../utils/indianFormat';
import { runSolarCalculations } from '../utils/calculations';
import { assessSolarImage } from '../utils/openaiApi';
import { resizeImageForVision } from '../utils/imageUtils';
import { insertSolarAssessment } from '../utils/supabaseClient';
import { fetchLivePeakSunHours } from '../utils/geeApi';
import { analyzeDocumentImage } from '../utils/documentQuality';
import {
  evaluatePmSuryaKyc,
  NAME_MISMATCH_PLAYBOOK,
  PM_SURYA_GOVT_CHALLENGES,
  PM_SURYA_MOBILE_DOCS,
  PM_SURYA_PROCESS_STEPS,
} from '../utils/pmSuryaKyc';

const roofTypeOptions = [
  { value: 'flat', label: 'Flat / RCC' },
  { value: 'sloped', label: 'Sloped / Tiled' },
  { value: 'mixed', label: 'Mixed' },
];

export default function SolarAssessment({ villages, saveAssessment, showToast, currentUser }) {
  const [step, setStep] = useState(1);
  const [userRole, setUserRole] = useState('household'); // 'household' or 'vendor'
  
  const fileInputRef = useRef(null);
  const docInputRefs = useRef({});
  
  const [form, setForm] = useState({
    state: 'haryana',
    roofType: 'flat',
    buildingType: 'residential',
    monthlyConsumption: 300,
    estimatedMonthlyIncome: 15000,
    villageName: '',
    aadhaarName: '',
    billName: '',
    bankName: '',
    aadhaarNumber: '',
    photoMatchConfirmed: 'yes',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [result, setResult] = useState(null);
  const [docUploads, setDocUploads] = useState({});
  const [docAnalyzingId, setDocAnalyzingId] = useState(null);
  const [showMismatchPlaybook, setShowMismatchPlaybook] = useState(false);

  const selectedState = useMemo(() => stateOptions.find((item) => item.value === form.state) || stateOptions[0], [form.state]);

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
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      showToast('Please upload a PNG, JPG, or WEBP image.', 'error');
      return;
    }
    setImageFile(file);
    setResult(null);
    const preview = await readFileAsDataUrl(file);
    setImagePreview(preview);
  };

  const runAssessment = async () => {
    if (!imageFile) {
      showToast('Upload a rooftop image first.', 'error');
      return;
    }

    try {
      setLoadingAssessment(true);
      const { base64: imageBase64, mime: imageMime } = await resizeImageForVision(imageFile, 1024);
      const aiResult = await assessSolarImage({ imageMime, imageBase64 });
      
      const computed = runSolarCalculations({
        roofArea: aiResult.roof_area_sqm,
        shadingPct: aiResult.shading_pct,
        roofType: form.roofType,
        stateKey: form.state,
        buildingType: form.buildingType,
        monthlyConsumption: Number(form.monthlyConsumption),
        estimatedMonthlyIncome: Number(form.estimatedMonthlyIncome),
        overridePeakHours: null,
      });

      setResult({ aiResult, computed });
      showToast('AI Rooftop assessment complete.');
      setStep(2); // Auto-advance to next step
    } catch (error) {
      showToast(error.message || 'Assessment failed.', 'error');
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleDocCapture = async (docId, file) => {
    if (!file) return;
    setDocAnalyzingId(docId);
    try {
      const analysis = await analyzeDocumentImage(file);
      const preview = await readFileAsDataUrl(file);
      setDocUploads((current) => ({ ...current, [docId]: { ...analysis, preview, fileName: file.name } }));
      if (analysis.ok) showToast('Document looks good.');
      else showToast(analysis.warnings[0] || 'Review document quality.', 'error');
    } catch (error) {
      showToast('Could not analyse document.', 'error');
    } finally {
      setDocAnalyzingId(null);
    }
  };

  const kycCheck = evaluatePmSuryaKyc({
    aadhaarName: form.aadhaarName,
    billName: form.billName,
    bankName: form.bankName,
    aadhaarNumber: form.aadhaarNumber,
    photoMatchConfirmed: form.photoMatchConfirmed,
  });

  const handleSaveAssessment = async () => {
    showToast('Assessment saved. Ready for DISCOM application.');
    setStep(6);
  };

  // Render the current step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5 animate-in fade-in">
            <h3 className="text-xl font-bold">Step 1: Rooftop AI Assessment</h3>
            <p className="text-sm text-muted">Upload a satellite or drone image of the rooftop to assess solar generation capacity.</p>
            
            <div
              className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-border bg-parchment/60 p-6 text-center transition hover:border-meadow hover:bg-meadow/5"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="w-full space-y-4">
                  <img src={imagePreview} alt="Preview" className="h-52 w-full rounded-card object-cover" />
                  <div className="text-sm font-medium text-meadow">Change Image</div>
                </div>
              ) : (
                <>
                  <Satellite className="mb-4 h-8 w-8 text-meadow" />
                  <p className="font-semibold">Drop image here or click to browse</p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelection(e.target.files?.[0])} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">State</label>
                <select name="state" value={form.state} onChange={handleFieldChange} className="input-base mt-1">
                  {stateOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Roof Type</label>
                <select name="roofType" value={form.roofType} onChange={handleFieldChange} className="input-base mt-1">
                  {roofTypeOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <button onClick={runAssessment} disabled={loadingAssessment} className="w-full btn-primary flex justify-center gap-2 py-3 bg-meadow text-white rounded-xl">
              {loadingAssessment ? 'Analysing with GPT-4o Vision...' : <><Sparkles className="h-5 w-5"/> Analyze Generation</>}
            </button>
            
            {result && (
              <div className="mt-4 p-4 border border-meadow/30 bg-meadow/5 rounded-xl">
                <h4 className="font-bold text-forest mb-2">AI Results</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>System Size:</strong> {result.computed.systemKWp.toFixed(2)} kWp</div>
                  <div><strong>Annual Gen:</strong> {result.computed.annualKWh.toFixed(0)} kWh</div>
                  <div><strong>Subsidy Est:</strong> ₹{formatIndianNumber(Math.round(result.computed.subsidy))}</div>
                  <div><strong>Usable Area:</strong> {result.computed.usableArea.toFixed(0)} m²</div>
                </div>
                <button onClick={() => setStep(2)} className="mt-4 w-full bg-forest text-white py-2 rounded-lg font-semibold flex justify-center items-center gap-2">
                  Proceed to Application <ArrowRight className="h-4 w-4"/>
                </button>
              </div>
            )}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-5 animate-in fade-in">
            <h3 className="text-xl font-bold">Step 2: Consumer Details & Cooking Load</h3>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Monthly Electricity Consumption (kWh)</label>
              <input type="range" min="50" max="1000" name="monthlyConsumption" value={form.monthlyConsumption} onChange={handleFieldChange} className="w-full accent-meadow" />
              <div className="text-right text-sm font-bold text-meadow">{form.monthlyConsumption} kWh</div>
              <p className="text-xs text-muted mt-1">If you selected E-Cooking in the Clean Cooking tab, ensure you account for the extra load here.</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Village / Location</label>
              <input type="text" name="villageName" value={form.villageName} onChange={handleFieldChange} placeholder="e.g. Bapoli" className="input-base" />
            </div>

            <button onClick={() => setStep(3)} className="w-full bg-meadow text-white py-3 rounded-xl font-semibold flex justify-center items-center gap-2 mt-4">
              Save & Next <ArrowRight className="h-4 w-4"/>
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5 animate-in fade-in">
            <h3 className="text-xl font-bold">Step 3: Document Data Capture</h3>
            <p className="text-sm text-muted">Capture documents for PM Surya Ghar application. AI will verify image clarity.</p>
            
            <div className="grid gap-3">
              {PM_SURYA_MOBILE_DOCS.map((doc) => {
                const upload = docUploads[doc.id];
                return (
                  <div key={doc.id} className="rounded-lg border p-3 flex justify-between items-center bg-parchment/30">
                    <div>
                      <div className="font-semibold text-sm">{doc.label}</div>
                      {upload && <div className="text-xs text-meadow flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3"/> Captured</div>}
                    </div>
                    <input ref={el => docInputRefs.current[doc.id] = el} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleDocCapture(doc.id, e.target.files?.[0])} />
                    <button onClick={() => docInputRefs.current[doc.id]?.click()} className="p-2 bg-meadow/10 text-meadow rounded-md"><Camera className="h-5 w-5"/></button>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setStep(4)} className="w-full bg-meadow text-white py-3 rounded-xl font-semibold flex justify-center items-center gap-2 mt-4">
              Proceed to KYC <ArrowRight className="h-4 w-4"/>
            </button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5 animate-in fade-in">
            <h3 className="text-xl font-bold">Step 4: KYC Pre-Check</h3>
            <p className="text-sm text-muted">Ensure names match across Aadhaar, Electricity Bill, and Bank to prevent subsidy DBT rejection.</p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Name on Aadhaar</label>
                <input type="text" name="aadhaarName" value={form.aadhaarName} onChange={handleFieldChange} className="input-base" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Name on Electricity Bill</label>
                <input type="text" name="billName" value={form.billName} onChange={handleFieldChange} className="input-base" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted block mb-1">Name on Bank Account</label>
                <input type="text" name="bankName" value={form.bankName} onChange={handleFieldChange} className="input-base" />
              </div>
            </div>

            <div className={`mt-4 rounded-xl border p-4 ${kycCheck.tone}`}>
              <div className="font-bold">{kycCheck.label}</div>
              <div className="text-sm mt-1">{kycCheck.note}</div>
            </div>

            <button onClick={() => setStep(5)} className="w-full bg-meadow text-white py-3 rounded-xl font-semibold flex justify-center items-center gap-2 mt-4">
              Finalise Application <ArrowRight className="h-4 w-4"/>
            </button>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-5 animate-in fade-in text-center py-10 border border-dashed border-border rounded-xl">
            <CheckCircle2 className="h-16 w-16 text-meadow mx-auto mb-4" />
            <h3 className="text-2xl font-bold">Application Ready</h3>
            <p className="text-muted max-w-sm mx-auto">All data captured. In a real environment, this data is submitted to the PM Surya Ghar DISCOM portal.</p>
            <button onClick={handleSaveAssessment} className="bg-forest text-white px-6 py-3 rounded-xl font-bold mt-6 inline-block">
              Submit to DISCOM Portal
            </button>
          </div>
        );

      default:
        // Steps 6-10 placeholders
        return (
          <div className="space-y-5 animate-in fade-in text-center py-10 border border-dashed border-border rounded-xl">
            <h3 className="text-2xl font-bold mb-2">Step {step}: {PM_SURYA_PROCESS_STEPS[step-1]}</h3>
            <p className="text-muted mb-6">This step happens offline or on the government portal.</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setStep(step - 1)} className="border border-border px-4 py-2 rounded-lg">Back</button>
              {step < 10 ? (
                <button onClick={() => setStep(step + 1)} className="bg-meadow text-white px-4 py-2 rounded-lg">Mark Done & Next</button>
              ) : (
                <button onClick={() => setStep(1)} className="bg-forest text-white px-4 py-2 rounded-lg">Start New Application</button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-floatin">
      <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold">PM Surya Ghar Wizard</h2>
          <p className="text-sm text-muted">10-step seamless application process</p>
        </div>
        
        {/* Vendor vs Household Toggle */}
        <div className="flex bg-parchment p-1 rounded-lg border border-border">
          <button 
            onClick={() => setUserRole('household')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${userRole === 'household' ? 'bg-white shadow-sm border border-border text-ink' : 'text-muted'}`}>
            <UserCircle className="h-4 w-4"/> Household
          </button>
          <button 
            onClick={() => setUserRole('vendor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${userRole === 'vendor' ? 'bg-white shadow-sm border border-border text-ink' : 'text-muted'}`}>
            <Store className="h-4 w-4"/> Vendor
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[250px_1fr] gap-6">
        {/* Left sidebar: 10 Steps progress */}
        <div className="bg-white rounded-2xl border border-border p-4 h-fit">
          <h4 className="font-bold mb-4 text-sm text-muted uppercase">Sequence</h4>
          <div className="space-y-1">
            {PM_SURYA_PROCESS_STEPS.map((label, index) => {
              const s = index + 1;
              let statusClass = "text-muted hover:bg-parchment cursor-pointer";
              if (step === s) statusClass = "bg-meadow/10 text-meadow font-bold border border-meadow/20";
              else if (step > s) statusClass = "text-ink font-medium cursor-pointer";
              
              // Only allow clicking steps we've reached (simple mock)
              return (
                <div 
                  key={s} 
                  onClick={() => s <= step ? setStep(s) : null}
                  className={`flex gap-3 items-center p-2 rounded-lg transition-colors text-xs ${statusClass}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${step > s ? 'bg-meadow text-white' : step === s ? 'bg-meadow text-white' : 'bg-parchment border border-border text-muted'}`}>
                    {step > s ? <CheckCircle2 className="h-3 w-3"/> : s}
                  </span>
                  <span className="line-clamp-2 leading-tight">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Content */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm min-h-[500px]">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}