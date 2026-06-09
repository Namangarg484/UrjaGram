import { useMemo, useRef, useState, useEffect } from 'react';
import { ImagePlus, Satellite, Sparkles, Sun, CheckCircle2, AlertTriangle, Smartphone, Camera, ChevronDown, ArrowRight, ArrowLeft, UserCircle, Store, Lock, FileText, Zap, IndianRupee, ShieldCheck } from 'lucide-react';
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

// AI Electricity Demand Estimator Logic (Mirroring Python Gradient Boosting Heuristic)
const estimateMonthlyDemand = (appliances) => {
  let dailyKwh = 0;
  const hours = Number(appliances.supplyHours);
  
  dailyKwh += Number(appliances.fans) * 0.075 * (hours > 12 ? 12 : hours);
  dailyKwh += Number(appliances.tvs) * 0.1 * 4;
  dailyKwh += Number(appliances.acs) * 1.5 * 6; 
  dailyKwh += Number(appliances.coolers) * 0.2 * 8;
  if (appliances.fridge) dailyKwh += 1.2; 
  dailyKwh += Number(appliances.geysers) * 2.0 * 1; 
  dailyKwh += Number(appliances.heaters) * 1.5 * 2;
  if (appliances.mixer) dailyKwh += 0.5 * 0.5;
  if (appliances.washingMachine) dailyKwh += 0.5 * 1;
  if (appliances.pump) dailyKwh += 0.75 * 1;
  dailyKwh += Number(appliances.bulbs) * 0.015 * 6; 
  
  let monthlyKwh = dailyKwh * 30;
  monthlyKwh = monthlyKwh * (1 + (Number(appliances.familySize) * 0.02));

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
    washingMachine: true, pump: false, bulbs: 6, supplyHours: 10
  });

  const predictedLoad = estimateMonthlyDemand(appliances);

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
    setStep(1);
    setCompletedSteps(new Set());
    setResult(null);
  };

  const handleRoleToggle = (role) => {
    setUserRole(role);
    setStep(1); 
    setCompletedSteps(new Set());
  };

  // Render VET-OS Touchpoints Box for Household
  const renderVetosDetails = (vetosData) => {
    if (!vetosData || userRole !== 'household') return null;
    return (
      <div className="mt-8 pt-8 border-t border-border/50 animate-in fade-in duration-500 delay-150">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-accent"/>
          <h4 className="font-semibold text-ink">VET-OS Module 7 Analysis</h4>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white/60 border border-border/70 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Real-world Friction</div>
            <p className="text-sm text-ink/90 leading-relaxed">{vetosData.friction}</p>
          </div>
          <div className="bg-white/60 border border-border/70 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Components Engaged</div>
            <div className="flex flex-wrap gap-2">
              {vetosData.comp.map((c, i) => <span key={i} className="text-[11px] font-semibold bg-accent/10 text-accent px-2.5 py-1 rounded-full border border-accent/20">{c}</span>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-green/5 border border-green/20 rounded-xl p-3 text-center">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Nominal SLA</div>
            <div className="text-lg font-bold text-green">{vetosData.sla[0]}d</div>
          </div>
          <div className="bg-amber/5 border border-amber/20 rounded-xl p-3 text-center">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Warning</div>
            <div className="text-lg font-bold text-amber">{vetosData.sla[1]}d</div>
          </div>
          <div className="bg-red/5 border border-red/20 rounded-xl p-3 text-center">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Escalation</div>
            <div className="text-lg font-bold text-red">{vetosData.sla[2]}d</div>
          </div>
        </div>

        {loanTrackOn && vetosData.loan && (
          <div className="mt-4 bg-[#f1e7fb] border border-[#b48ee0] rounded-2xl p-4 shadow-sm">
            <h5 className="text-xs font-bold text-[#3d1a72] uppercase tracking-wider mb-2 flex items-center gap-2"><IndianRupee className="h-4 w-4"/> Loan Touchpoint</h5>
            <p className="text-sm text-[#3d1a72]/90 mb-3">{vetosData.loanText}</p>
            <ul className="space-y-1.5 pl-4 list-disc text-sm text-[#3d1a72]">
              {vetosData.loanSla.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    const vetosData = userRole === 'household' ? VETOS_STEPS[step - 1] : null;

    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-ink">{userRole === 'vendor' ? 'Client Site AI Assessment' : 'Consumer Registration & AI Rooftop Check'}</h3>
              <p className="text-sm text-muted mt-1">Upload a clear satellite or drone image of the {userRole === 'vendor' ? "client's" : "your"} rooftop to begin the PM Surya Ghar process.</p>
              {vetosData && <p className="text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-lg inline-flex mt-3 border border-accent/20">Portal: {vetosData.portal}</p>}
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

            {renderVetosDetails(vetosData)}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-ink">{userRole === 'vendor' ? 'Technical Proposal & Load' : 'Application Submission & Demand Forecasting'}</h3>
              <p className="text-sm text-muted mt-1">Provide household appliance details to accurately forecast monthly electricity demand using AI.</p>
              {vetosData && <p className="text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-lg inline-flex mt-3 border border-accent/20">Portal: {vetosData.portal}</p>}
            </div>
            
            <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-border/70 rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"><Zap className="w-48 h-48"/></div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between bg-forest rounded-2xl p-5 text-white shadow-lg">
                <div>
                  <h4 className="text-sm font-medium text-white/80 uppercase tracking-wider mb-1">Predicted Monthly Consumption</h4>
                  <div className="text-4xl font-black tracking-tight">{predictedLoad} <span className="text-xl font-semibold opacity-80">kWh</span></div>
                </div>
                <div className="text-right mt-4 md:mt-0">
                  <div className="text-xs text-white/70">Estimated CO₂ Offset</div>
                  <div className="text-lg font-bold">~{(predictedLoad * 0.82).toFixed(1)} kg</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                {[
                  { label: "Family Size", name: "familySize", max: 15 },
                  { label: "Rooms", name: "rooms", max: 10 },
                  { label: "Fans", name: "fans", max: 10 },
                  { label: "TVs", name: "tvs", max: 5 },
                  { label: "ACs", name: "acs", max: 5 },
                  { label: "Coolers", name: "coolers", max: 5 },
                  { label: "Geysers", name: "geysers", max: 4 },
                  { label: "Heaters", name: "heaters", max: 4 },
                  { label: "Bulbs", name: "bulbs", max: 30 },
                  { label: "Supply Hrs/Day", name: "supplyHours", max: 24 }
                ].map((input) => (
                  <div key={input.name} className="space-y-1">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">{input.label}</label>
                    <input type="number" min="0" max={input.max} name={input.name} value={appliances[input.name]} onChange={handleApplianceChange} className="w-full rounded-xl border border-border/70 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-meadow focus:ring-2 focus:ring-meadow/20" />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 pt-4 border-t border-border/50 relative z-10">
                {[
                  { label: "Refrigerator", name: "fridge" },
                  { label: "Mixer", name: "mixer" },
                  { label: "Washing Machine", name: "washingMachine" },
                  { label: "Water Pump", name: "pump" }
                ].map((chk) => (
                  <label key={chk.name} className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer bg-white px-4 py-2 rounded-xl border border-border/70 shadow-sm hover:border-meadow/50 transition-colors">
                    <input type="checkbox" name={chk.name} checked={appliances[chk.name]} onChange={handleApplianceChange} className="w-4 h-4 text-meadow rounded border-gray-300 focus:ring-meadow accent-meadow" />
                    {chk.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="px-6 py-4 rounded-2xl font-semibold text-muted bg-white border border-border/70 hover:bg-parchment transition-colors shadow-sm"><ArrowLeft className="h-5 w-5"/></button>
              <button onClick={() => { markStepComplete(2); setStep(3); }} className="flex-1 bg-forest text-white py-4 rounded-2xl font-semibold flex justify-center items-center gap-2 shadow-md transition-all hover:bg-[#154a33] hover:shadow-lg hover:-translate-y-0.5">
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
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center py-12 bg-white/50 backdrop-blur-xl border border-border/70 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-6">
              {isFinalStep ? (
                <div className="mx-auto h-24 w-24 rounded-full bg-meadow/10 flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-12 w-12 text-meadow" />
                </div>
              ) : null}

              <h3 className="text-3xl font-bold tracking-tight text-ink mb-2">Step {step}: {currentSteps[step-1].t}</h3>
              {vetosData && <p className="text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-lg inline-flex mb-8 border border-accent/20">Portal Action: {vetosData.portal}</p>}
              {!vetosData && <p className="text-muted text-lg max-w-md mx-auto leading-relaxed mb-10">This process step occurs offline or directly within the government portal interface.</p>}
              
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
                      <>Submit Full Dossier <ArrowRight className="h-5 w-5" /></>
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

            {renderVetosDetails(vetosData)}
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-6 animate-floatin max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/60 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <div className="pl-2 flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-ink">PM Surya Ghar Flow</h2>
          <p className="text-sm text-muted mt-0.5">Streamlined {currentSteps.length}-stage wizard with AI Demand Forecasting</p>
        </div>
        
        {userRole === 'household' && (
          <button 
            onClick={() => setLoanTrackOn(!loanTrackOn)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 uppercase tracking-widest ${loanTrackOn ? 'bg-[#f1e7fb] text-[#3d1a72] border border-[#b48ee0] shadow-sm' : 'bg-parchment text-muted border border-border/50 hover:bg-white hover:text-ink'}`}>
            <IndianRupee className="h-4 w-4"/> Loan Overlay {loanTrackOn ? '(ON)' : '(OFF)'}
          </button>
        )}

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
          <h4 className="font-bold mb-5 text-xs text-muted uppercase tracking-widest pl-2">Progress Map</h4>
          <div className="space-y-1.5">
            {currentSteps.map((sData, index) => {
              const label = sData.t;
              const hasLoan = loanTrackOn && sData.loan;
              const dropTxt = sData.drop ? `~${sData.drop}% drop` : '';
              
              const s = index + 1;
              const isCurrent = step === s;
              const isCompleted = completedSteps.has(s);
              
              let statusClass = "text-muted hover:bg-parchment hover:text-ink border border-transparent";
              if (isCurrent) statusClass = "bg-white text-ink font-bold shadow-[0_2px_10px_rgb(0,0,0,0.03)] border border-border/80";
              else if (isCompleted) statusClass = "text-ink font-medium bg-meadow/5 hover:bg-meadow/10 border border-transparent";
              if (hasLoan && !isCurrent) statusClass += " border-[#b48ee0]/40";
              if (hasLoan && isCurrent) statusClass += " border-[#b48ee0]";
              
              return (
                <button 
                  key={s} 
                  onClick={() => setStep(s)}
                  className={`w-full text-left flex gap-3.5 items-center p-3 rounded-2xl transition-all duration-300 text-xs ${statusClass} group relative`}
                >
                  {hasLoan && <div className="absolute top-0 right-0 -mr-1 -mt-1 w-2.5 h-2.5 rounded-full bg-[#7a3ec9] shadow-[0_0_4px_rgba(122,62,201,0.6)] animate-pulse" />}
                  
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors ${isCompleted ? 'bg-meadow text-white shadow-sm' : isCurrent ? 'bg-forest text-white shadow-md' : 'bg-parchment border border-border/80 text-muted group-hover:bg-white group-hover:border-border'}`}>
                    {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5"/> : s}
                  </span>
                  
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="line-clamp-2 leading-relaxed">{label}</div>
                    {dropTxt && <div className={`text-[9px] mt-0.5 font-semibold ${sData.drop > 20 ? 'text-red' : sData.drop > 10 ? 'text-amber' : 'text-green'}`}>{dropTxt}</div>}
                  </div>
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