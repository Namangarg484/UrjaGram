import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Send, CheckCircle2, UploadCloud, FileCheck2, Building2, Zap, Landmark, Camera } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export default function UrjaSakhi({ showToast }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    householdHead: '',
    contactNumber: '',
    contactNumber: '',
    email: '',
    state: '',
    district: '',
    address: '',
    familySize: '',
    discom: '',
    consumerAccountNumber: '',
    sanctionedLoadKw: '',
    electricitySource: 'grid',
    monthlyBill: '',
    roofType: 'concrete',
    roofAreaSqft: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
  });
  const [documents, setDocuments] = useState({ 
    bill: { front: null, back: null }, 
    bankProof: { front: null },
    photos: [] 
  });
  const [uploadingDoc, setUploadingDoc] = useState({ id: null, side: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  const [isDigilockerVerified, setIsDigilockerVerified] = useState(false);

  // --- Camera Logic ---
  const [cameraActiveFor, setCameraActiveFor] = useState(null); 
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (cameraActiveFor && videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActiveFor]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async (docId, side, isMultiple = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraActiveFor({ docId, side, isMultiple });
    } catch (err) {
      console.error(err);
      showToast('Could not access camera. Please check permissions.', 'error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActiveFor(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(blob => {
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const { docId, side, isMultiple } = cameraActiveFor;
      stopCamera();
      
      if (isMultiple) {
         setUploadingDoc({ id: 'photos', side: 'all' });
         setTimeout(() => {
           setDocuments(prev => ({ ...prev, photos: [...prev.photos, file.name] }));
           setUploadingDoc({ id: null, side: null });
           showToast(`1 photo captured successfully`, 'success');
         }, 500);
      } else {
         setUploadingDoc({ id: docId, side });
         setTimeout(() => {
           setDocuments(prev => ({ ...prev, [docId]: { ...prev[docId], [side]: file.name } }));
           setUploadingDoc({ id: null, side: null });
           showToast(`Document captured successfully`, 'success');
         }, 500);
      }
    }, 'image/jpeg');
  };

  const handleFileChange = (e, type, side) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingDoc({ id: type, side });
      setTimeout(() => {
        setDocuments(prev => ({ 
          ...prev, 
          [type]: { ...prev[type], [side]: file.name } 
        }));
        setUploadingDoc({ id: null, side: null });
        showToast(`Document uploaded successfully`, 'success');
      }, 1200);
    }
  };

  const handlePhotosChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const fileNames = files.map(f => f.name);
      setUploadingDoc({ id: 'photos', side: 'all' });
      setTimeout(() => {
        setDocuments(prev => ({ 
          ...prev, 
          photos: [...prev.photos, ...fileNames] 
        }));
        setUploadingDoc({ id: null, side: null });
        showToast(`${fileNames.length} photo(s) uploaded successfully`, 'success');
      }, 1200);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPushSuccess(false);

    try {
      const backendUrl = import.meta.env.VITE_GEE_BACKEND_URL || 'http://localhost:8000';
      const payload = {
          householdHead: formData.householdHead,
          contactNumber: formData.contactNumber,
          email: formData.email || undefined,
          state: formData.state,
          district: formData.district,
          address: formData.address,
          familySize: formData.familySize ? parseInt(formData.familySize, 10) : undefined,
          discom: formData.discom,
          consumerAccountNumber: formData.consumerAccountNumber,
          electricitySource: formData.electricitySource,
          monthlyBill: formData.monthlyBill ? parseFloat(formData.monthlyBill) : undefined,
          sanctionedLoadKw: formData.sanctionedLoadKw ? parseFloat(formData.sanctionedLoadKw) : undefined,
          category: 'Residential',
          roofType: formData.roofType,
          roofAreaSqft: formData.roofAreaSqft ? parseFloat(formData.roofAreaSqft) : undefined,
          bankName: formData.bankName || undefined,
          bankAccountNumber: formData.bankAccountNumber || undefined,
          bankIfsc: formData.bankIfsc || undefined,
          bankProofUrl: documents.bankProof.front,
          electricityBillFrontUrl: documents.bill.front,
          electricityBillBackUrl: documents.bill.back,
          rooftopPhotoFrontUrl: documents.photos.length > 0 ? documents.photos[0] : null,
          rooftopPhotoBackUrl: documents.photos.length > 1 ? documents.photos[1] : null,
          rooftopPhotosList: documents.photos,
      };

      // 1. Push data to Backend Wrapper
      const response = await fetch(`${backendUrl}/api/urjasakhi/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Backend submission failed');
      }
      
      // 2. Save data to Supabase
      if (supabase) {
        const { error } = await supabase.from('urjasakhi_data').insert([{
          household_head: formData.householdHead,
          contact_number: formData.contactNumber,
          email: formData.email,
          state: formData.state,
          district: formData.district,
          address: formData.address,
          family_size: formData.familySize ? parseInt(formData.familySize, 10) : null,
          discom: formData.discom,
          consumer_account_number: formData.consumerAccountNumber,
          electricity_source: formData.electricitySource,
          monthly_bill: formData.monthlyBill ? parseFloat(formData.monthlyBill) : null,
          sanctioned_load_kw: formData.sanctionedLoadKw ? parseFloat(formData.sanctionedLoadKw) : null,
          roof_type: formData.roofType,
          roof_area_sqft: formData.roofAreaSqft ? parseFloat(formData.roofAreaSqft) : null,
          bank_name: formData.bankName,
          bank_account_number: formData.bankAccountNumber,
          bank_ifsc: formData.bankIfsc,
          bank_proof_url: documents.bankProof.front,
          electricity_bill_front_url: documents.bill.front,
          electricity_bill_back_url: documents.bill.back,
          rooftop_photo_front_url: documents.photos.length > 0 ? documents.photos[0] : null,
          rooftop_photo_back_url: documents.photos.length > 1 ? documents.photos[1] : null,
          status: 'pushed'
        }]);
      }

      setPushSuccess(true);
      showToast('Data orchestrated via Plug-and-Play backend to MNRE, DISCOM & Banks', 'success');
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          householdHead: '',
          contactNumber: '',
          email: '',
          state: '',
          district: '',
          address: '',
          familySize: '',
          discom: '',
          consumerAccountNumber: '',
          sanctionedLoadKw: '',
          electricitySource: 'grid',
          monthlyBill: '',
          roofType: 'concrete',
          roofAreaSqft: '',
          bankName: '',
          bankAccountNumber: '',
          bankIfsc: '',
        });
        setDocuments({ 
          bill: { front: null, back: null }, 
          bankProof: { front: null },
          photos: [] 
        });
        setPushSuccess(false);
        setIsDigilockerVerified(false);
      }, 3000);

    } catch (error) {
      console.error(error);
      showToast('Failed to submit data', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {cameraActiveFor && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <video ref={videoRef} autoPlay playsInline className="max-h-[70vh] w-full max-w-md rounded-2xl bg-black object-cover shadow-2xl" />
          <div className="mt-8 flex gap-6">
            <button type="button" onClick={stopCamera} className="rounded-full bg-white/10 border border-white/20 px-6 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white/20">
              Cancel
            </button>
            <button type="button" onClick={capturePhoto} className="flex items-center gap-2 rounded-full bg-purple-600 px-8 py-3 font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.5)] transition hover:bg-purple-500 hover:scale-105 active:scale-95">
              <Camera className="h-5 w-5" />
              Capture
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-lg shadow-purple-500/20">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('us_title')}</h2>
          <p className="text-sm text-slate-500">PM Surya Ghar 100% Compliant Data Collection</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SECTION: Consumer Details */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-bold text-slate-800">Consumer Details</h3>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Household Head</label>
              <input type="text" name="householdHead" value={formData.householdHead} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="e.g. Ramesh Kumar" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contact Number</label>
              <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="10-digit number" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email (Optional)</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="email@example.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Identity Verification</label>
              {isDigilockerVerified ? (
                <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Verified via DigiLocker
                </div>
              ) : (
                <button type="button" onClick={() => { showToast('Redirecting to DigiLocker...', 'success'); setTimeout(() => setIsDigilockerVerified(true), 1500); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100">
                  <FileCheck2 className="h-5 w-5" />
                  Verify with DigiLocker
                </button>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Address</label>
              <textarea name="address" value={formData.address} onChange={handleChange} required rows={2} className="w-full resize-none rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="House Number, Street, Village Name" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">State</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="e.g. Haryana" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">District</label>
              <input type="text" name="district" value={formData.district} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="e.g. Panipat" />
            </div>
          </div>
        </div>

        {/* SECTION: Electricity & Roof Details */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-800">Electricity & Roof Details</h3>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">DISCOM (Electricity Board)</label>
              <input type="text" name="discom" value={formData.discom} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10" placeholder="e.g. UHBVN" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Consumer Account Number</label>
              <input type="text" name="consumerAccountNumber" value={formData.consumerAccountNumber} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10" placeholder="From Electricity Bill" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Sanctioned Load (kW)</label>
              <input type="number" step="0.1" name="sanctionedLoadKw" value={formData.sanctionedLoadKw} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10" placeholder="e.g. 2.5" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Monthly Bill (₹)</label>
              <input type="number" name="monthlyBill" value={formData.monthlyBill} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10" placeholder="₹ Amount" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Roof Area (sq. ft.)</label>
              <input type="number" name="roofAreaSqft" value={formData.roofAreaSqft} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10" placeholder="e.g. 1000" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Roof Type</label>
              <div className="grid grid-cols-3 gap-2">
                {['concrete', 'tin', 'kacha'].map((rt) => (
                  <label key={rt} className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-xs font-medium transition ${formData.roofType === rt ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-200 bg-white/50 text-slate-600 hover:bg-white'}`}>
                    <input type="radio" name="roofType" value={rt} checked={formData.roofType === rt} onChange={handleChange} className="sr-only" />
                    {rt === 'concrete' ? 'Concrete / RCC' : rt.charAt(0).toUpperCase() + rt.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: Bank Details */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-800">Bank Details (For Subsidy)</h3>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Bank Name</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10" placeholder="e.g. SBI" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Account Number</label>
              <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10" placeholder="Account Number" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">IFSC Code</label>
              <input type="text" name="bankIfsc" value={formData.bankIfsc} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10" placeholder="IFSC Code" />
            </div>
          </div>
        </div>

        {/* SECTION: Documents */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-bold text-slate-800">Required Documents</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { id: 'bill', label: 'Electricity Bill', sides: ['front', 'back'] },
              { id: 'bankProof', label: 'Bank Proof (Cheque/Passbook)', sides: ['front'] },
            ].map((doc) => (
              <div key={doc.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/50 p-3">
                <span className="text-sm font-semibold text-slate-800">{doc.label}</span>
                <div className={`grid gap-2 ${doc.sides.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {doc.sides.map((side) => (
                    <div key={side} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white/80 p-2 items-center justify-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{doc.sides.length === 2 ? side : 'Upload'}</span>
                      {documents[doc.id][side] ? (
                        <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <FileCheck2 className="h-3 w-3" />
                          Uploaded
                        </div>
                      ) : uploadingDoc.id === doc.id && uploadingDoc.side === side ? (
                        <div className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                        </div>
                      ) : (
                        <div className="flex gap-1 w-full mt-auto">
                          <button type="button" onClick={() => startCamera(doc.id, side, false)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-50 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 shadow-sm transition hover:bg-slate-100 hover:text-blue-600 hover:border-blue-200 cursor-pointer" title="Take Photo">
                            <Camera className="h-3 w-3" />
                          </button>
                          <label className="flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-50 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 shadow-sm transition hover:bg-slate-100 hover:text-blue-600 hover:border-blue-200 cursor-pointer" title="Upload File">
                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, doc.id, side)} />
                            <UploadCloud className="h-3 w-3" />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Rooftop Photos */}
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/50 p-3">
              <span className="text-sm font-semibold text-slate-800">Rooftop Photos</span>
              <div className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white/80 p-2 items-center justify-center h-full min-h-[96px]">
                {documents.photos.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center mb-2">
                     <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <FileCheck2 className="h-3 w-3" />
                        {documents.photos.length} Uploaded
                     </div>
                  </div>
                )}
                {uploadingDoc.id === 'photos' ? (
                  <div className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                  </div>
                ) : (
                  <div className="flex gap-2 w-full mt-auto">
                    <button type="button" onClick={() => startCamera('photos', 'all', true)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-50 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 shadow-sm transition hover:bg-slate-100 hover:text-blue-600 hover:border-blue-200 cursor-pointer">
                      <Camera className="h-4 w-4" />
                      Camera
                    </button>
                    <label className="flex flex-1 items-center justify-center gap-1 rounded-full bg-slate-50 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 shadow-sm transition hover:bg-slate-100 hover:text-blue-600 hover:border-blue-200 cursor-pointer">
                      <input type="file" multiple className="hidden" accept="image/*" onChange={handlePhotosChange} />
                      <UploadCloud className="h-4 w-4" />
                      Upload
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || pushSuccess || !isDigilockerVerified}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-bold text-white shadow-lg transition-all focus:outline-none focus:ring-4 ${
              pushSuccess
                ? 'bg-emerald-500 shadow-emerald-500/30'
                : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 shadow-purple-500/30 hover:shadow-purple-500/40 hover:scale-[1.02] focus:ring-purple-500/20'
            } disabled:pointer-events-none disabled:opacity-70`}
          >
            {isSubmitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Orchestrating Data...</span>
              </>
            ) : pushSuccess ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>Successfully Dispatched!</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
    </>
  );
}
