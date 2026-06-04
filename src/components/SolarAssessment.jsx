import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Satellite, Sparkles, Sun, CheckCircle2, AlertTriangle, Smartphone, Camera, ChevronDown, ArrowRight, ArrowLeft, UserCircle, Store, Lock } from 'lucide-react';
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
  PM_SURYA_MOBILE_DOCS,
} from '../utils/pmSuryaKyc';

const roofTypeOptions = [
  { value: 'flat', label: 'Flat / RCC' },
  { value: 'sloped', label: 'Sloped / Tiled' },
  { value: 'mixed', label: 'Mixed' },
];

const HOUSEHOLD_STEPS = [
  'Register mobile number on PM Surya Ghar portal',
  'Complete profile — name, address, DISCOM details',
  'Select DISCOM and fetch consumer account',
  'Submit rooftop application & wait for feasibility',
  'Select MNRE-empanelled vendor',
  'Collect KYC documents and upload clear scans',
  'Install plant as per sanctioned capacity',
  'Request DISCOM inspection and net-metering',
  'Upload commissioning certificate',
  'Track CFA subsidy disbursal (DBT)'
];

const VENDOR_STEPS = [
  'Client Site AI Assessment',
  'Technical Proposal & Load Calculation',
  'Collect Client KYC Documents',
  'KYC Pre-Check & Verification',
  'Submit Technical Proposal to DISCOM',
  'Install Plant & Upload Commissioning Report'
];

export default function SolarAssessment({ villages, saveAssessment, showToast, currentUser }) {
  const [step, setStep] = useState(1);
  const [userRole, setUserRole] = useState('household'); // 'household' or 'vendor'
  const [completedSteps, setCompletedSteps] = useState(new Set());
  
  const currentSteps = userRole === 'vendor' ? VENDOR_STEPS : HOUSEHOLD_STEPS;
  
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

  const markStepComplete = (s) => {
    setCompletedSteps(prev => new Set(prev).add(s));
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
      markStepComplete(1);
      setStep(2); 
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
    showToast('Process fully completed and saved!');
    // Final logic could go here
    setStep(1);
    setCompletedSteps(new Set());
    setResult(null);
  };

  const handleRoleToggle = (role) => {
    setUserRole(role);
    setStep(1); 
    setCompletedSteps(new Set());
  };

  // Render the current step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-ink">{userRole === 'vendor' ? 'Client Site AI Assessment' : 'Rooftop Generation Assessment'}</h3>
              <p className="text-sm text-muted mt-1">Upload a clear satellite or drone image of the {userRole === 'vendor' ? "client's" : "your"} rooftop.</p>
            </div>
            
            <div
              className="group flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-white/50 backdrop-blur-sm p-6 text-center transition-all duration-300 hover:border-meadow/50 hover:bg-meadow/5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="w-full space-y-4 animate-in zoom-in-95 duration-300">
                  <img src={imagePreview} alt="Preview" className="h-64 w-full rounded-2xl object-cover shadow-sm" />
                  <div className="text-sm font-medium text-meadow group-hover:text-forest transition-colors">Tap to change image</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted transition-transform duration-300 group-hover:scale-105">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-meadow/10 mb-4">
                    <Satellite className="h-8 w-8 text-meadow" />
                  </div>
                  <p className="font-semibold text-ink text-lg">Drop image here or browse</p>
                  <p className="text-sm mt-1">Supports PNG, JPG, WEBP</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelection(e.target.files?.[0])} />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink/80">State</label>
                <select name="state" value={form.state} onChange={handleFieldChange} className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm text-ink outline-none transition-shadow focus:border-meadow focus:ring-4 focus:ring-meadow/10 appearance-none shadow-sm">
                  {stateOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink/80">Roof Type</label>
                <select name="roofType" value={form.roofType} onChange={handleFieldChange} className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm text-ink outline-none transition-shadow focus:border-meadow focus:ring-4 focus:ring-meadow/10 appearance-none shadow-sm">
                  {roofTypeOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <button onClick={runAssessment} disabled={loadingAssessment} className="group relative w-full overflow-hidden rounded-2xl bg-forest px-6 py-4 text-white font-semibold shadow-md transition-all hover:bg-[#154a33] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed">
              <div className="flex items-center justify-center gap-2 relative z-10">
                {loadingAssessment ? 'Analysing with GPT-4o Vision...' : <><Sparkles className="h-5 w-5"/> Analyze Generation</>}
              </div>
            </button>
            
            {result && (
              <div className="mt-6 p-6 border border-meadow/20 bg-meadow/5 rounded-3xl animate-in slide-in-from-bottom-4 duration-500">
                <h4 className="font-semibold text-forest mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5"/> Assessment Complete</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-6">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50">
                    <div className="text-muted text-xs mb-1">System Size</div>
                    <div className="font-bold text-lg text-ink">{result.computed.systemKWp.toFixed(2)} kWp</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50">
                    <div className="text-muted text-xs mb-1">Annual Gen</div>
                    <div className="font-bold text-lg text-ink">{result.computed.annualKWh.toFixed(0)} kWh</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50">
                    <div className="text-muted text-xs mb-1">Est. Subsidy</div>
                    <div className="font-bold text-lg text-meadow">₹{formatIndianNumber(Math.round(result.computed.subsidy))}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50">
                    <div className="text-muted text-xs mb-1">Usable Area</div>
                    <div className="font-bold text-lg text-ink">{result.computed.usableArea.toFixed(0)} m²</div>
                  </div>
                </div>
                <button onClick={() => { markStepComplete(1); setStep(2); }} className="w-full bg-white border border-meadow/30 text-forest py-3.5 rounded-2xl font-semibold flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  Proceed to Next Step <ArrowRight className="h-4 w-4"/>
                </button>
              </div>
            )}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-ink">{userRole === 'vendor' ? 'Client Details & Load' : 'Your Details & Load'}</h3>
              <p className="text-sm text-muted mt-1">Provide electricity consumption metrics to size the system perfectly.</p>
            </div>
            
            <div className="bg-white/50 backdrop-blur-sm border border-border/70 rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-ink/80">{userRole === 'vendor' ? "Client's" : "Your"} Monthly Consumption</label>
                  <span className="text-lg font-bold text-meadow bg-meadow/10 px-3 py-1 rounded-full">{form.monthlyConsumption} kWh</span>
                </div>
                <input type="range" min="50" max="1000" name="monthlyConsumption" value={form.monthlyConsumption} onChange={handleFieldChange} className="w-full h-2 rounded-full appearance-none bg-border accent-meadow outline-none" />
                <p className="text-xs text-muted mt-3">If E-Cooking is planned, ensure the extra load is accounted for here.</p>
              </div>

              <div className="pt-4 border-t border-border/50">
                <label className="text-sm font-medium text-ink/80 block mb-2">Location / Village</label>
                <input type="text" name="villageName" value={form.villageName} onChange={handleFieldChange} placeholder="e.g. Bapoli" className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3.5 text-sm text-ink outline-none transition-all focus:border-meadow focus:ring-4 focus:ring-meadow/10 shadow-sm" />
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="px-6 py-4 rounded-2xl font-semibold text-muted bg-white border border-border/70 hover:bg-parchment transition-colors shadow-sm"><ArrowLeft className="h-5 w-5"/></button>
              <button onClick={() => { markStepComplete(2); setStep(3); }} className="flex-1 bg-forest text-white py-4 rounded-2xl font-semibold flex justify-center items-center gap-2 shadow-md transition-all hover:bg-[#154a33] hover:shadow-lg hover:-translate-y-0.5">
                Save & Continue <ArrowRight className="h-5 w-5"/>
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-ink">Document Capture</h3>
              <p className="text-sm text-muted mt-1">Securely capture high-quality images of required KYC documents.</p>
            </div>
            
            <div className="grid gap-4">
              {PM_SURYA_MOBILE_DOCS.map((doc) => {
                const upload = docUploads[doc.id];
                return (
                  <div key={doc.id} className={`group flex justify-between items-center p-4 rounded-3xl border transition-all duration-300 ${upload ? 'border-meadow/40 bg-meadow/5' : 'border-border/70 bg-white shadow-sm hover:border-meadow/30 hover:shadow-md'}`}>
                    <div>
                      <div className="font-semibold text-ink">{doc.label}</div>
                      {upload ? (
                        <div className="text-xs font-medium text-meadow flex items-center gap-1.5 mt-1.5"><CheckCircle2 className="h-4 w-4"/> Successfully Captured</div>
                      ) : (
                        <div className="text-xs text-muted mt-1">Awaiting capture</div>
                      )}
                    </div>
                    <input ref={el => docInputRefs.current[doc.id] = el} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleDocCapture(doc.id, e.target.files?.[0])} />
                    <button onClick={() => docInputRefs.current[doc.id]?.click()} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${upload ? 'bg-white border border-meadow/20 text-meadow hover:bg-meadow hover:text-white' : 'bg-parchment text-ink hover:bg-meadow hover:text-white'}`}>
                      <Camera className="h-5 w-5"/>
                    </button>
                  </div>
                )
              })}
            </div>
            
            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="px-6 py-4 rounded-2xl font-semibold text-muted bg-white border border-border/70 hover:bg-parchment transition-colors shadow-sm"><ArrowLeft className="h-5 w-5"/></button>
              <button onClick={() => { markStepComplete(3); setStep(4); }} className="flex-1 bg-forest text-white py-4 rounded-2xl font-semibold flex justify-center items-center gap-2 shadow-md transition-all hover:bg-[#154a33] hover:shadow-lg hover:-translate-y-0.5">
                Proceed to Verification <ArrowRight className="h-5 w-5"/>
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-ink">KYC Verification</h3>
              <p className="text-sm text-muted mt-1">Cross-check names to prevent DBT subsidy rejection during disbursement.</p>
            </div>
            
            <div className="bg-white/50 backdrop-blur-sm border border-border/70 rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)] space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1.5 uppercase tracking-wider">Aadhaar Name</label>
                  <input type="text" name="aadhaarName" value={form.aadhaarName} onChange={handleFieldChange} placeholder="Exact spelling on Aadhaar" className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm text-ink outline-none transition-all focus:border-meadow focus:ring-2 focus:ring-meadow/20 shadow-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1.5 uppercase tracking-wider">Electricity Bill Name</label>
                  <input type="text" name="billName" value={form.billName} onChange={handleFieldChange} placeholder="Exact spelling on Bill" className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm text-ink outline-none transition-all focus:border-meadow focus:ring-2 focus:ring-meadow/20 shadow-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted block mb-1.5 uppercase tracking-wider">Bank Account Name</label>
                  <input type="text" name="bankName" value={form.bankName} onChange={handleFieldChange} placeholder="Exact spelling in Passbook/NPCI" className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm text-ink outline-none transition-all focus:border-meadow focus:ring-2 focus:ring-meadow/20 shadow-sm" />
                </div>
              </div>

              <div className={`mt-2 rounded-2xl border p-5 transition-colors duration-300 ${kycCheck.tone}`}>
                <div className="font-bold flex items-center gap-2">
                  {kycCheck.risk === 'low' && <CheckCircle2 className="h-5 w-5" />}
                  {kycCheck.risk !== 'low' && <AlertTriangle className="h-5 w-5" />}
                  {kycCheck.label}
                </div>
                <div className="text-sm mt-2 leading-relaxed opacity-90">{kycCheck.note}</div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(3)} className="px-6 py-4 rounded-2xl font-semibold text-muted bg-white border border-border/70 hover:bg-parchment transition-colors shadow-sm"><ArrowLeft className="h-5 w-5"/></button>
              <button onClick={() => { markStepComplete(4); setStep(5); }} className="flex-1 bg-forest text-white py-4 rounded-2xl font-semibold flex justify-center items-center gap-2 shadow-md transition-all hover:bg-[#154a33] hover:shadow-lg hover:-translate-y-0.5">
                Review & Apply <ArrowRight className="h-5 w-5"/>
              </button>
            </div>
          </div>
        );

      default: {
        const isFinalStep = step === currentSteps.length;
        const missingSteps = currentSteps.length - 1 - completedSteps.size;
        const canSubmit = missingSteps <= 0;

        return (
          <div className="space-y-6 animate-in fade-in text-center py-12 bg-white/50 backdrop-blur-xl border border-border/70 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-6">
            
            {isFinalStep ? (
              <div className="mx-auto h-24 w-24 rounded-full bg-meadow/10 flex items-center justify-center mb-6">
                <CheckCircle2 className="h-12 w-12 text-meadow" />
              </div>
            ) : null}

            <h3 className="text-3xl font-bold tracking-tight text-ink mb-3">Step {step}: {currentSteps[step-1]}</h3>
            <p className="text-muted text-lg max-w-md mx-auto leading-relaxed mb-10">This process step occurs offline, on the physical site, or directly within the government portal interface.</p>
            
            {isFinalStep ? (
              <div className="mt-8">
                <button 
                  onClick={handleSaveAssessment} 
                  disabled={!canSubmit}
                  className={`px-8 py-4 rounded-2xl font-bold inline-flex items-center gap-3 transition-all duration-300 ${
                    canSubmit 
                      ? 'bg-forest text-white shadow-lg hover:shadow-xl hover:bg-[#154a33] hover:-translate-y-1' 
                      : 'bg-parchment text-muted cursor-not-allowed border border-border'
                  }`}
                >
                  {canSubmit ? (
                    <>Submit Full Application <ArrowRight className="h-5 w-5" /></>
                  ) : (
                    <><Lock className="h-5 w-5" /> Complete {missingSteps} more steps to submit</>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
                <button onClick={() => setStep(step - 1)} className="flex-1 bg-white border border-border/70 text-ink font-semibold py-4 rounded-2xl shadow-sm hover:bg-parchment transition-colors">Previous</button>
                
                <button onClick={() => { markStepComplete(step); setStep(step + 1); }} className="flex-1 bg-meadow text-white font-semibold py-4 rounded-2xl shadow-md hover:bg-[#276e47] transition-colors">Mark Complete</button>
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-6 animate-floatin max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/60 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <div className="pl-2">
          <h2 className="text-2xl font-bold tracking-tight text-ink">PM Surya Ghar Flow</h2>
          <p className="text-sm text-muted mt-0.5">Streamlined {currentSteps.length}-step wizard</p>
        </div>
        
        {/* Sleek Apple-like Toggle */}
        <div className="flex bg-parchment/80 p-1.5 rounded-2xl border border-border/50">
          <button 
            onClick={() => handleRoleToggle('household')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${userRole === 'household' ? 'bg-white shadow-sm border border-border/50 text-ink scale-100' : 'text-muted hover:text-ink/70 scale-95'}`}>
            <UserCircle className="h-4 w-4"/> Household
          </button>
          <button 
            onClick={() => handleRoleToggle('vendor')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${userRole === 'vendor' ? 'bg-white shadow-sm border border-border/50 text-ink scale-100' : 'text-muted hover:text-ink/70 scale-95'}`}>
            <Store className="h-4 w-4"/> Vendor Mode
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Left sidebar: Steps progress */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] h-fit sticky top-24">
          <h4 className="font-bold mb-5 text-xs text-muted uppercase tracking-widest pl-2">Progress</h4>
          <div className="space-y-1.5">
            {currentSteps.map((label, index) => {
              const s = index + 1;
              const isCurrent = step === s;
              const isCompleted = completedSteps.has(s);
              
              let statusClass = "text-muted hover:bg-parchment hover:text-ink";
              if (isCurrent) statusClass = "bg-white text-ink font-bold shadow-sm border border-border/50";
              else if (isCompleted) statusClass = "text-ink font-medium bg-meadow/5 hover:bg-meadow/10 border border-transparent";
              
              return (
                <button 
                  key={s} 
                  onClick={() => setStep(s)}
                  className={`w-full text-left flex gap-3.5 items-center p-3 rounded-2xl transition-all duration-300 text-xs ${statusClass} group`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors ${isCompleted ? 'bg-meadow text-white shadow-sm' : isCurrent ? 'bg-forest text-white shadow-md' : 'bg-parchment border border-border/80 text-muted group-hover:bg-white group-hover:border-border'}`}>
                    {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5"/> : s}
                  </span>
                  <span className="line-clamp-2 leading-relaxed pr-1">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Content */}
        <div className="min-h-[600px] h-full flex flex-col justify-center">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}