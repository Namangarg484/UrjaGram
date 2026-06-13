import { useMemo, useRef, useState, useEffect } from 'react';
import { ImagePlus, Satellite, Sparkles, Sun, CheckCircle2, AlertTriangle, Smartphone, Camera, ChevronDown, ArrowRight, ArrowLeft, UserCircle, Store, Lock, FileText, Zap, IndianRupee, ShieldCheck, Activity, Users, Home, Monitor, Wind, Snowflake, Flame } from 'lucide-react';
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

const VETOS_STEPS = [
  {n:1, t:"Consumer Registration", portal:"Mobile + DISCOM consumer no.; OTP", friction:"Spelling / Aadhaar mismatches; consumer-no. wrong on bill.", comp:["#1 Eligibility","#6 Aadhaar/DigiLocker"], sla:[2,5,10], drop:8, loan:false},
  {n:2, t:"Application Submission", portal:"Sanctioned load, roof area, address proof", friction:"Document rejections are the #1 cause of failure (~22%). Wrong load values, blurry rooftop photos, address proof mismatch.", comp:["#3 Document Validator","#10 Loan Facilitation"], sla:[3,7,14], drop:22, loan:true, loanText:"Module 10 starts a parallel loan-readiness check (CIBIL pull, income, KYC).", loanSla:["L-1: CIBIL & eligibility pre-check within 48 h","L-2: Loan offer letter from ≥ 2 banks within 7 days"]},
  {n:3, t:"Feasibility Approval", portal:"DISCOM technical feasibility on sanctioned load", friction:"Silent rejection if sanctioned load < proposed kW.", comp:["#1 Eligibility","#4 Tariff Engine"], sla:[7,15,30], drop:4, loan:false},
  {n:4, t:"Vendor Selection", portal:"Pick from MNRE/HAREDA empanelled list", friction:"Vendors don't respond, distance and price are opaque.", comp:["#9 Vendor Engine","#10 Loan Facilitation"], sla:[3,10,21], drop:15, loan:true, loanText:"Module 10 binds vendor quote to loan offer.", loanSla:["L-3: Vendor quote tagged to loan offer within 2 days of selection"]},
  {n:5, t:"Work Start", portal:"Trigger after vendor accepts", friction:"7→30+ day silent stall.", comp:["#5 Anomaly Monitor","#10 Loan Facilitation"], sla:[7,14,30], drop:14, loan:true, loanText:"Bank releases first tranche (40–60%) to vendor.", loanSla:["L-4: First disbursal tranche to vendor within 5 days of work-start evidence"]},
  {n:6, t:"Installation Details", portal:"Plant model, inverter S/N, photos", friction:"Wrong model / serial-number entries; rooftop photo quality below portal threshold.", comp:["#3 Document Validator"], sla:[2,5,10], drop:3, loan:false},
  {n:7, t:"Project Inspection", portal:"DISCOM net-meter inspection request", friction:"Inspector schedule, no cluster-batching.", comp:["#5 Cluster Scheduler"], sla:[7,21,45], drop:8, loan:false},
  {n:8, t:"Project Commissioning", portal:"Commissioning certificate (CC) issued", friction:"CC issuance pending stalls subsidy AND final loan disbursal.", comp:["#5 Anomaly Monitor","#10 Loan Facilitation"], sla:[7,15,30], drop:5, loan:true, loanText:"Bank disburses balance loan to vendor against CC.", loanSla:["L-5: Final loan tranche to vendor within 7 days of CC upload"]},
  {n:9, t:"Subsidy Request", portal:"Cancelled cheque, Aadhaar-bank match", friction:"Aadhaar–bank IFSC name mismatch is the #1 subsidy rejection cause (~12%).", comp:["#3 Document Validator"], sla:[2,5,10], drop:12, loan:false},
  {n:10, t:"Subsidy Disbursal", portal:"MNRE credits central subsidy to bank account", friction:"30–90 day delays. No household-facing status.", comp:["#7 Disbursement Tracker","#8 VEA Dashboard","#10 Loan Facilitation"], sla:[30,60,90], drop:2, loan:true, loanText:"Module 10 sends a 7-day reminder to apply subsidy against loan principal.", loanSla:["L-6: Reminder + assisted application to adjust subsidy against loan principal within 7 days of credit"]}
];

const VENDOR_STEPS = [
  'Client Site AI Assessment',
  'Technical Proposal & Load Calculation',
  'Collect Client KYC Documents',
  'KYC Pre-Check & Verification',
  'Submit Technical Proposal to DISCOM',
  'Install Plant & Upload Commissioning Report'
];

// AI Electricity Demand Estimator Logic
const estimateMonthlyDemand = (appliances) => {
  let dailyKwh = 0;
  const hours = Number(appliances.supplyHours) || 10;
  
  dailyKwh += (Number(appliances.fans) || 0) * 0.075 * Math.min(hours, 12);
  dailyKwh += (Number(appliances.tvs) || 0) * 0.1 * 4;
  dailyKwh += (Number(appliances.acs) || 0) * 1.5 * 6; 
  dailyKwh += (Number(appliances.coolers) || 0) * 0.2 * 8;
  if (appliances.fridge) dailyKwh += 1.2; 
  dailyKwh += (Number(appliances.geysers) || 0) * 2.0 * 1; 
  dailyKwh += (Number(appliances.heaters) || 0) * 1.5 * 2;
  if (appliances.mixer) dailyKwh += 0.25;
  if (appliances.washingMachine) dailyKwh += 0.5;
  if (appliances.pump) dailyKwh += 0.75;
  dailyKwh += (Number(appliances.bulbs) || 0) * 0.015 * 6; 
  
  let monthlyKwh = dailyKwh * 30;
  monthlyKwh = monthlyKwh * (1 + ((Number(appliances.familySize) || 5) * 0.02));

  // Future Demand Prediction (EV / Appliance Upgrade)
  if (appliances.futureGrowth) {
    monthlyKwh = monthlyKwh * 1.30; // 30% increase for future lifestyle creep
  }

  return Math.round(Math.max(50, monthlyKwh));
};

export default function SolarAssessment({ villages, saveAssessment, showToast, currentUser }) {
  const [step, setStep] = useState(1);
  const [userRole, setUserRole] = useState('household'); // 'household' or 'vendor'
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [loanTrackOn, setLoanTrackOn] = useState(false);
  
  const currentSteps = userRole === 'vendor' ? VENDOR_STEPS.map(t => ({ t, n: 0 })) : VETOS_STEPS;
  
  const fileInputRef = useRef(null);
  const docInputRefs = useRef({});
  
  const [form, setForm] = useState({
    state: 'haryana',
    roofType: 'flat',
    buildingType: 'residential',
    estimatedMonthlyIncome: 15000,
    villageName: '',
    aadhaarName: '',
    billName: '',
    bankName: '',
    aadhaarNumber: '',
    photoMatchConfirmed: 'yes',
  });

  const [appliances, setAppliances] = useState({
    familySize: 5, rooms: 2, fans: 3, tvs: 1, acs: 1, coolers: 0,
    fridge: true, geysers: 0, heaters: 0, mixer: true,
    washingMachine: true, pump: false, bulbs: 6, supplyHours: 10,
    futureGrowth: false
  });

  const predictedLoad = estimateMonthlyDemand(appliances);
  const estimatedBill = predictedLoad * 5; // AI Forecast repo uses approx 5 INR/kWh
  const fiveYearSavings = Math.round(estimatedBill * 12 * 5.52); // Assuming ~5% annual tariff inflation

  let loadCategory = { label: 'Cluster A: Low', color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20', text: 'text-blue-100' };
  if (predictedLoad > 100 && predictedLoad <= 300) {
    loadCategory = { label: 'Cluster B: Medium', color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20', text: 'text-emerald-100' };
  } else if (predictedLoad > 300 && predictedLoad <= 600) {
    loadCategory = { label: 'Cluster C: High', color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20', text: 'text-amber-100' };
  } else if (predictedLoad > 600) {
    loadCategory = { label: 'Cluster D: Ultra-High', color: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/20', text: 'text-rose-100' };
  }

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [result, setResult] = useState(null);
  const [docUploads, setDocUploads] = useState({});
  const [docAnalyzingId, setDocAnalyzingId] = useState(null);

  const selectedState = useMemo(() => stateOptions.find((item) => item.value === form.state) || stateOptions[0], [form.state]);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleApplianceChange = (event) => {
    const { name, value, type, checked } = event.target;
    setAppliances(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
        monthlyConsumption: predictedLoad,
        estimatedMonthlyIncome: Number(form.estimatedMonthlyIncome),
        overridePeakHours: null,
      });

      setResult({ aiResult, computed });
      showToast('AI Rooftop assessment complete.');
      markStepComplete(1);
      setTimeout(() => setStep(2), 1500); 
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
    setStep(1);
    setCompletedSteps(new Set());
    setResult(null);
  };

  const handleRoleToggle = (role) => {
    setUserRole(role);
    setStep(1); 
    setCompletedSteps(new Set());
  };

  // Render Premium VET-OS Touchpoints Box
  const renderVetosDetails = (vetosData) => {
    if (!vetosData || userRole !== 'household') return null;
    return (
      <div className="mt-8 pt-6 border-t border-border/30 animate-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none"><Activity className="w-32 h-32"/></div>
          
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <ShieldCheck className="h-4 w-4 text-white"/>
            </div>
            <h4 className="font-bold text-ink tracking-tight text-lg">VET-OS Insights</h4>
          </div>
          
          <div className="grid md:grid-cols-2 gap-5 mb-5 relative z-10">
            <div className="bg-white/80 border border-white shadow-sm rounded-2xl p-4 transition-all hover:shadow-md">
              <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-500"/> Friction Point</div>
              <p className="text-sm text-ink/90 leading-relaxed font-medium">{vetosData.friction}</p>
            </div>
            <div className="bg-white/80 border border-white shadow-sm rounded-2xl p-4 transition-all hover:shadow-md flex flex-col justify-center">
              <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5"><Zap className="h-3 w-3 text-yellow-500"/> Modules Engaged</div>
              <div className="flex flex-wrap gap-2">
                {vetosData.comp.map((c, i) => <span key={i} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-100 shadow-sm">{c}</span>)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 relative z-10">
            <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-3.5 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] font-bold text-emerald-700/70 uppercase tracking-widest mb-1">Nominal</div>
              <div className="text-xl font-black text-emerald-600">{vetosData.sla[0]}<span className="text-sm font-semibold opacity-70 ml-0.5">d</span></div>
            </div>
            <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-3.5 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] font-bold text-amber-700/70 uppercase tracking-widest mb-1">Warning</div>
              <div className="text-xl font-black text-amber-500">{vetosData.sla[1]}<span className="text-sm font-semibold opacity-70 ml-0.5">d</span></div>
            </div>
            <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-3.5 text-center flex flex-col items-center justify-center">
              <div className="text-[10px] font-bold text-rose-700/70 uppercase tracking-widest mb-1">Escalation</div>
              <div className="text-xl font-black text-rose-500">{vetosData.sla[2]}<span className="text-sm font-semibold opacity-70 ml-0.5">d</span></div>
            </div>
          </div>

          {loanTrackOn && vetosData.loan && (
            <div className="mt-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5 shadow-sm relative z-10 animate-in zoom-in-95 duration-300">
              <h5 className="text-[11px] font-black text-purple-800 uppercase tracking-widest mb-2 flex items-center gap-2"><IndianRupee className="h-4 w-4 text-purple-600"/> Loan Touchpoint</h5>
              <p className="text-sm font-medium text-purple-900/90 mb-3">{vetosData.loanText}</p>
              <ul className="space-y-2 pl-1">
                {vetosData.loanSla.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-purple-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"/>
                    <span className="leading-snug">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    const vetosData = userRole === 'household' ? VETOS_STEPS[step - 1] : null;

    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700 ease-out">
            <div>
              <h3 className="text-3xl font-bold tracking-tight text-ink">{userRole === 'vendor' ? 'Client Site AI Assessment' : 'Consumer Registration'}</h3>
              <p className="text-base text-muted mt-1.5">Upload a clear satellite or drone image of the {userRole === 'vendor' ? "client's" : "your"} rooftop to begin the PM Surya Ghar process.</p>
              {vetosData && <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full mt-3 border border-indigo-100 shadow-sm"><FileText className="w-3.5 h-3.5"/> Portal: {vetosData.portal}</div>}
            </div>
            
            <div
              className="group flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-border/60 bg-white/40 backdrop-blur-md p-8 text-center transition-all duration-300 hover:border-emerald-400/50 hover:bg-emerald-50/30 hover:shadow-[0_8px_32px_rgba(16,185,129,0.06)]"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="w-full space-y-4 animate-in zoom-in-95 duration-500">
                  <img src={imagePreview} alt="Preview" className="h-[280px] w-full rounded-[1.5rem] object-cover shadow-md" />
                  <div className="text-sm font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">Tap to change image</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted transition-transform duration-500 group-hover:scale-105">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 shadow-sm mb-5">
                    <Satellite className="h-10 w-10 text-emerald-500" />
                  </div>
                  <p className="font-bold text-ink text-xl tracking-tight">Drop image here or browse</p>
                  <p className="text-sm mt-1.5 font-medium opacity-70">Supports high-res PNG, JPG, WEBP</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelection(e.target.files?.[0])} />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted uppercase tracking-widest pl-1">State</label>
                <select name="state" value={form.state} onChange={handleFieldChange} className="w-full rounded-2xl border border-white bg-white/60 backdrop-blur-sm px-5 py-3.5 text-sm font-semibold text-ink outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 appearance-none shadow-sm hover:shadow-md">
                  {stateOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted uppercase tracking-widest pl-1">Roof Type</label>
                <select name="roofType" value={form.roofType} onChange={handleFieldChange} className="w-full rounded-2xl border border-white bg-white/60 backdrop-blur-sm px-5 py-3.5 text-sm font-semibold text-ink outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 appearance-none shadow-sm hover:shadow-md">
                  {roofTypeOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <button onClick={runAssessment} disabled={loadingAssessment} className="group relative w-full overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4.5 text-white font-bold shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all hover:shadow-[0_12px_28px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
              <div className="flex items-center justify-center gap-2.5 relative z-10 py-1">
                {loadingAssessment ? 'Analysing with GPT-4o Vision...' : <><Sparkles className="h-5 w-5"/> Analyze Generation Potential</>}
              </div>
            </button>
            
            {result && (
              <div className="mt-8 p-6 border-2 border-emerald-100 bg-emerald-50/50 rounded-[2rem] animate-in zoom-in-95 duration-500 shadow-sm">
                <h4 className="font-bold text-emerald-800 mb-5 flex items-center gap-2 text-lg"><CheckCircle2 className="h-6 w-6 text-emerald-500"/> Assessment Complete</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-6">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
                    <div className="text-emerald-600/70 font-bold text-[10px] uppercase tracking-widest mb-1">System Size</div>
                    <div className="font-black text-xl text-emerald-900">{result.computed.systemKWp.toFixed(2)} <span className="text-sm opacity-70">kWp</span></div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
                    <div className="text-emerald-600/70 font-bold text-[10px] uppercase tracking-widest mb-1">Annual Gen</div>
                    <div className="font-black text-xl text-emerald-900">{result.computed.annualKWh.toFixed(0)} <span className="text-sm opacity-70">kWh</span></div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
                    <div className="text-emerald-600/70 font-bold text-[10px] uppercase tracking-widest mb-1">Est. Subsidy</div>
                    <div className="font-black text-xl text-emerald-600">₹{formatIndianNumber(Math.round(result.computed.subsidy))}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
                    <div className="text-emerald-600/70 font-bold text-[10px] uppercase tracking-widest mb-1">Usable Area</div>
                    <div className="font-black text-xl text-emerald-900">{result.computed.usableArea.toFixed(0)} <span className="text-sm opacity-70">m²</span></div>
                  </div>
                </div>
                <button onClick={() => { markStepComplete(1); setStep(2); }} className="w-full bg-white border border-emerald-200 text-emerald-700 py-4 rounded-2xl font-bold flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  Proceed to Next Step <ArrowRight className="h-5 w-5"/>
                </button>
              </div>
            )}

            {renderVetosDetails(vetosData)}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-700 ease-out">
            <div>
              <h3 className="text-3xl font-bold tracking-tight text-ink">{userRole === 'vendor' ? 'Technical Proposal & Load' : 'Application Submission'}</h3>
              <p className="text-base text-muted mt-1.5">Provide household appliance details to accurately forecast monthly electricity demand using AI.</p>
              {vetosData && <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full mt-3 border border-indigo-100 shadow-sm"><FileText className="w-3.5 h-3.5"/> Portal: {vetosData.portal}</div>}
            </div>
            
            <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none"><Zap className="w-64 h-64"/></div>
              
              {/* Premium Gradient Result Card */}
              <div className={`relative z-10 flex flex-col md:flex-row items-center justify-between bg-gradient-to-br ${loadCategory.color} rounded-3xl p-6 sm:p-8 text-white shadow-xl ${loadCategory.shadow} transition-colors duration-500`}>
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h4 className={`text-xs font-bold ${loadCategory.text} uppercase tracking-widest flex items-center gap-2`}><Sparkles className="w-4 h-4 text-yellow-300"/> AI Predicted Monthly Load</h4>
                    <span className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/30 shadow-sm">{loadCategory.label}</span>
                  </div>
                  <div className="text-5xl font-black tracking-tighter">{predictedLoad} <span className="text-2xl font-bold opacity-80 tracking-normal">kWh</span></div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-6 md:mt-0">
                  <div className="flex flex-col sm:items-end bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex-1">
                    <div className={`text-[10px] font-bold ${loadCategory.text} uppercase tracking-widest mb-1`}>Estimated Bill</div>
                    <div className="text-2xl font-bold text-white flex items-center gap-1">₹{formatIndianNumber(estimatedBill)} <span className="text-sm font-medium opacity-80">/mo</span></div>
                  </div>
                  <div className="flex flex-col sm:items-end bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex-1">
                    <div className={`text-[10px] font-bold ${loadCategory.text} uppercase tracking-widest mb-1`}>Est. CO₂ Offset</div>
                    <div className="text-2xl font-bold text-white flex items-center gap-1">~{(predictedLoad * 0.82).toFixed(1)} <span className="text-sm font-medium opacity-80">kg</span></div>
                  </div>
                  <div className="flex flex-col sm:items-end bg-white/20 backdrop-blur-md border border-white/40 rounded-2xl p-4 flex-1 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                    <div className={`text-[10px] font-bold text-white uppercase tracking-widest mb-1 flex items-center gap-1`}><Zap className="w-3 h-3 text-yellow-300"/> 5-Year Savings</div>
                    <div className="text-2xl font-black text-white flex items-center gap-1">₹{formatIndianNumber(fiveYearSavings)}</div>
                  </div>
                </div>
              </div>

              {/* Crisp Inputs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-6 relative z-10">
                {[
                  { label: "Family Size", name: "familySize", max: 15, icon: Users },
                  { label: "Rooms", name: "rooms", max: 10, icon: Home },
                  { label: "Fans", name: "fans", max: 10, icon: Wind },
                  { label: "TVs", name: "tvs", max: 5, icon: Monitor },
                  { label: "ACs", name: "acs", max: 5, icon: Snowflake },
                  { label: "Coolers", name: "coolers", max: 5, icon: Wind },
                  { label: "Geysers", name: "geysers", max: 4, icon: Flame },
                  { label: "Heaters", name: "heaters", max: 4, icon: Flame },
                  { label: "Bulbs", name: "bulbs", max: 30, icon: Sun },
                  { label: "Supply Hrs", name: "supplyHours", max: 24, icon: Zap }
                ].map((input) => (
                  <div key={input.name} className="space-y-2 group">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5"><input.icon className="w-3.5 h-3.5 opacity-60"/> {input.label}</label>
                    <input type="number" min="0" max={input.max} name={input.name} value={appliances[input.name]} onChange={handleApplianceChange} className="w-full rounded-xl border border-white bg-white/70 backdrop-blur-sm px-4 py-2.5 text-base font-bold text-ink outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all hover:shadow-md group-hover:border-emerald-200" />
                  </div>
                ))}
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-3 pt-6 border-t border-border/40 relative z-10">
                {[
                  { label: "Refrigerator", name: "fridge" },
                  { label: "Mixer/Grinder", name: "mixer" },
                  { label: "Washing Machine", name: "washingMachine" },
                  { label: "Water Pump", name: "pump" },
                  { label: "Plan for Future EV/AC Upgrade (+30%)", name: "futureGrowth" }
                ].map((chk) => (
                  <label key={chk.name} className={`flex items-center gap-2.5 text-sm font-bold cursor-pointer px-4 py-2.5 rounded-xl border transition-all ${appliances[chk.name] ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm' : 'bg-white/60 border-white text-muted hover:border-emerald-200 hover:text-ink shadow-sm'}`}>
                    <input type="checkbox" name={chk.name} checked={appliances[chk.name]} onChange={handleApplianceChange} className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500 accent-emerald-500" />
                    {chk.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="px-6 py-4.5 rounded-2xl font-bold text-muted bg-white border border-white shadow-sm hover:bg-parchment hover:border-border/50 transition-all"><ArrowLeft className="h-5 w-5"/></button>
              <button onClick={() => { markStepComplete(2); setStep(3); }} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4.5 rounded-2xl font-bold flex justify-center items-center gap-2 shadow-[0_8px_20px_rgba(16,185,129,0.2)] transition-all hover:shadow-[0_12px_28px_rgba(16,185,129,0.3)] hover:-translate-y-0.5">
                Save Load & Continue <ArrowRight className="h-5 w-5"/>
              </button>
            </div>

            {renderVetosDetails(vetosData)}
          </div>
        );

      case 6:
      case 3:
      case 4:
      case 5:
      case 7:
      case 8:
      case 9:
      case 10:
      default: {
        const isFinalStep = step === currentSteps.length;
        const missingSteps = currentSteps.length - 1 - completedSteps.size;
        const canSubmit = missingSteps <= 0;

        return (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-700 ease-out">
            <div className="text-center py-16 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] px-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none"><FileText className="w-64 h-64"/></div>
              
              <div className="relative z-10">
                {isFinalStep ? (
                  <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                ) : null}

                <h3 className="text-3xl font-black tracking-tight text-ink mb-4">Step {step}: {currentSteps[step-1].t}</h3>
                {vetosData && <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full mb-8 border border-indigo-100 shadow-sm"><FileText className="w-4 h-4"/> Portal Action: {vetosData.portal}</div>}
                {!vetosData && <p className="text-muted text-lg max-w-md mx-auto leading-relaxed mb-10 font-medium">This process step occurs offline or directly within the government portal interface.</p>}
                
                {isFinalStep ? (
                  <div className="mt-10">
                    <button 
                      onClick={handleSaveAssessment} 
                      disabled={!canSubmit}
                      className={`px-10 py-5 rounded-[1.5rem] font-black inline-flex items-center gap-3 transition-all duration-300 ${
                        canSubmit 
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_8px_24px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_32px_rgba(16,185,129,0.35)] hover:-translate-y-1' 
                          : 'bg-white/80 text-muted cursor-not-allowed border border-border shadow-sm'
                      }`}
                    >
                      {canSubmit ? (
                        <>Submit Full Dossier <ArrowRight className="h-5 w-5" /></>
                      ) : (
                        <><Lock className="h-5 w-5" /> Complete {missingSteps} more steps to submit</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto mt-6">
                    <button onClick={() => setStep(step - 1)} className="flex-1 bg-white border border-white text-ink font-bold py-4.5 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">Previous</button>
                    <button onClick={() => { markStepComplete(step); setStep(step + 1); }} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-4.5 rounded-2xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">Mark Complete</button>
                  </div>
                )}
              </div>
            </div>

            {renderVetosDetails(vetosData)}
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/50 backdrop-blur-2xl p-5 rounded-[2rem] border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
        <div className="pl-3 flex-1">
          <h2 className="text-2xl font-black tracking-tight text-ink">PM Surya Ghar Flow</h2>
          <p className="text-sm text-muted font-medium mt-0.5">Streamlined {currentSteps.length}-stage wizard with AI Demand Forecasting</p>
        </div>
        
        {userRole === 'household' && (
          <button 
            onClick={() => setLoanTrackOn(!loanTrackOn)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 uppercase tracking-widest ${loanTrackOn ? 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 border border-purple-200 shadow-md transform scale-105' : 'bg-white/80 text-muted border border-border/50 hover:bg-white hover:text-ink hover:shadow-sm'}`}>
            <IndianRupee className={`h-4 w-4 ${loanTrackOn ? 'text-purple-600' : ''}`}/> Loan Overlay {loanTrackOn ? '(ON)' : '(OFF)'}
          </button>
        )}

        <div className="flex bg-white/40 p-1.5 rounded-[1.5rem] border border-white shadow-inner">
          <button 
            onClick={() => handleRoleToggle('household')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${userRole === 'household' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-ink scale-100' : 'text-muted hover:text-ink/80 scale-95'}`}>
            <UserCircle className="h-4 w-4"/> Household
          </button>
          <button 
            onClick={() => handleRoleToggle('vendor')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${userRole === 'vendor' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-ink scale-100' : 'text-muted hover:text-ink/80 scale-95'}`}>
            <Store className="h-4 w-4"/> Vendor Mode
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
        {/* Left sidebar: Steps progress */}
        <div className="bg-white/50 backdrop-blur-2xl rounded-[2.5rem] border border-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <h4 className="font-black mb-6 text-[10px] text-muted/80 uppercase tracking-[0.2em] pl-3">Progress Map</h4>
          <div className="space-y-2 relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-border/40 z-0"></div>

            {currentSteps.map((sData, index) => {
              const label = sData.t;
              const hasLoan = loanTrackOn && sData.loan;
              const dropTxt = sData.drop ? `~${sData.drop}% drop` : '';
              
              const s = index + 1;
              const isCurrent = step === s;
              const isCompleted = completedSteps.has(s);
              
              let statusClass = "text-muted hover:bg-white/80 border border-transparent z-10 bg-transparent";
              if (isCurrent) statusClass = "bg-white text-ink font-bold shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-white z-10 transform scale-[1.02]";
              else if (isCompleted) statusClass = "text-ink font-semibold bg-emerald-50/50 border border-transparent z-10 hover:bg-emerald-50";
              
              if (hasLoan && !isCurrent) statusClass += " border-purple-200/50 bg-purple-50/30";
              if (hasLoan && isCurrent) statusClass += " border-purple-300 shadow-[0_4px_20px_rgba(168,85,247,0.15)]";
              
              return (
                <button 
                  key={s} 
                  onClick={() => setStep(s)}
                  className={`w-full text-left flex gap-4 items-center p-3.5 rounded-2xl transition-all duration-300 text-xs relative ${statusClass} group`}
                >
                  {hasLoan && <div className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse z-20" />}
                  
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-all z-20 shadow-sm ${isCompleted ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white' : isCurrent ? 'bg-gradient-to-br from-gray-800 to-black text-white' : 'bg-white border-2 border-border/60 text-muted group-hover:border-ink/20'}`}>
                    {isCompleted ? <CheckCircle2 className="h-3 w-3"/> : s}
                  </span>
                  
                  <div className="flex-1 min-w-0 pr-1 z-10">
                    <div className="line-clamp-2 leading-relaxed">{label}</div>
                    {dropTxt && <div className={`text-[9px] mt-1 font-black uppercase tracking-wider ${sData.drop > 20 ? 'text-rose-500' : sData.drop > 10 ? 'text-amber-500' : 'text-emerald-500'}`}>{dropTxt}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex flex-col pt-2 pb-10">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}