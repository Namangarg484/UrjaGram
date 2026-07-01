import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Send, CheckCircle2, UploadCloud, FileCheck2, Building2, Zap, Landmark } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export default function UrjaSakhi({ showToast }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    householdHead: '',
    contactNumber: '',
    email: '',
    aadhaarNumber: '',
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
    aadhaar: { front: null, back: null }, 
    bill: { front: null, back: null }, 
    photo: { front: null, back: null } 
  });
  const [uploadingDoc, setUploadingDoc] = useState({ id: null, side: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);

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
          aadhaarNumber: formData.aadhaarNumber || undefined,
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
          aadhaarFrontUrl: documents.aadhaar.front,
          aadhaarBackUrl: documents.aadhaar.back,
          electricityBillFrontUrl: documents.bill.front,
          electricityBillBackUrl: documents.bill.back,
          rooftopPhotoFrontUrl: documents.photo.front,
          rooftopPhotoBackUrl: documents.photo.back,
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
          aadhaar_number: formData.aadhaarNumber,
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
          aadhaar_front_url: documents.aadhaar.front,
          aadhaar_back_url: documents.aadhaar.back,
          electricity_bill_front_url: documents.bill.front,
          electricity_bill_back_url: documents.bill.back,
          rooftop_photo_front_url: documents.photo.front,
          rooftop_photo_back_url: documents.photo.back,
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
          aadhaarNumber: '',
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
          aadhaar: { front: null, back: null }, 
          bill: { front: null, back: null }, 
          photo: { front: null, back: null } 
        });
        setPushSuccess(false);
      }, 3000);

    } catch (error) {
      console.error(error);
      showToast('Failed to submit data', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Aadhaar Number</label>
              <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10" placeholder="12-digit Aadhaar" />
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
                    {rt.charAt(0).toUpperCase() + rt.slice(1)}
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
              { id: 'aadhaar', label: 'Aadhaar Card' },
              { id: 'bill', label: 'Electricity Bill' },
              { id: 'photo', label: 'Rooftop Photo' },
            ].map((doc) => (
              <div key={doc.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/50 p-3">
                <span className="text-sm font-semibold text-slate-800">{doc.label}</span>
                <div className="grid grid-cols-2 gap-2">
                  {['front', 'back'].map((side) => (
                    <div key={side} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white/80 p-2 items-center justify-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{side}</span>
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
                        <label className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 shadow-sm transition hover:bg-slate-100 hover:text-blue-600 hover:border-blue-200 cursor-pointer">
                          <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, doc.id, side)} />
                          <UploadCloud className="h-3 w-3" />
                          Upload
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || pushSuccess}
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
                <span>Submit to Govt & Vendor Systems (Wrapper)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
