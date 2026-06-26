import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export default function UrjaSakhi({ showToast }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    householdHead: '',
    contactNumber: '',
    address: '',
    familySize: '',
    electricitySource: 'grid',
    monthlyBill: '',
    roofType: 'concrete',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPushSuccess(false);

    try {
      // 1. Mock pushing data to DISCOM/MNRE
      // In a real scenario, this would be an API call to a specific GOI endpoint.
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
      
      // 2. Save data to Supabase (if connected)
      if (supabase) {
        const { error } = await supabase.from('urjasakhi_data').insert([{
          household_head: formData.householdHead,
          contact_number: formData.contactNumber,
          address: formData.address,
          family_size: formData.familySize ? parseInt(formData.familySize, 10) : null,
          electricity_source: formData.electricitySource,
          monthly_bill: formData.monthlyBill ? parseFloat(formData.monthlyBill) : null,
          roof_type: formData.roofType,
          status: 'pushed'
        }]);
        
        if (error) {
          console.warn("Supabase insertion failed or table missing:", error);
          // Don't throw here for demo purposes if table isn't created yet
        }
      }

      setPushSuccess(true);
      showToast('Data successfully pushed to DISCOM/MNRE', 'success');
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setFormData({
          householdHead: '',
          contactNumber: '',
          address: '',
          familySize: '',
          electricitySource: 'grid',
          monthlyBill: '',
          roofType: 'concrete',
        });
        setPushSuccess(false);
      }, 3000);

    } catch (error) {
      showToast('Failed to submit data', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-lg shadow-purple-500/20">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('us_title')}</h2>
          <p className="text-sm text-slate-500">{t('us_subtitle')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Household Head Name */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {t('us_form_head')}
            </label>
            <input
              type="text"
              name="householdHead"
              value={formData.householdHead}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10"
              placeholder="e.g. Ramesh Kumar"
            />
          </div>

          {/* Contact & Family Size Row */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {t('us_form_contact')}
              </label>
              <input
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                placeholder="10-digit number"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {t('us_form_family_size')}
              </label>
              <input
                type="number"
                name="familySize"
                value={formData.familySize}
                onChange={handleChange}
                required
                min="1"
                className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                placeholder="e.g. 4"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {t('us_form_address')}
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10"
              placeholder="House Number, Street, Village Name"
            />
          </div>

          {/* Electricity Source & Monthly Bill Row */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {t('us_form_electricity')}
              </label>
              <select
                name="electricitySource"
                value={formData.electricitySource}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10"
              >
                <option value="grid">{t('us_form_electricity_grid')}</option>
                <option value="offgrid">{t('us_form_electricity_offgrid')}</option>
                <option value="none">{t('us_form_electricity_none')}</option>
              </select>
            </div>
            
            {formData.electricitySource === 'grid' && (
              <div className="animate-in fade-in zoom-in-95">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {t('us_form_bill')}
                </label>
                <input
                  type="number"
                  name="monthlyBill"
                  value={formData.monthlyBill}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                  placeholder="₹ Amount"
                />
              </div>
            )}
          </div>

          {/* Roof Type */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {t('us_form_roof')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'concrete', label: t('us_form_roof_concrete') },
                { id: 'tin', label: t('us_form_roof_tin') },
                { id: 'kacha', label: t('us_form_roof_kacha') },
              ].map((rt) => (
                <label
                  key={rt.id}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition ${
                    formData.roofType === rt.id
                      ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                      : 'border-slate-200 bg-white/50 text-slate-600 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="roofType"
                    value={rt.id}
                    checked={formData.roofType === rt.id}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  {rt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || pushSuccess}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg transition-all focus:outline-none focus:ring-4 ${
                pushSuccess
                  ? 'bg-emerald-500 shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 shadow-purple-500/30 hover:shadow-purple-500/40 hover:scale-[1.02] focus:ring-purple-500/20'
              } disabled:pointer-events-none disabled:opacity-70`}
            >
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Pushing Data...</span>
                </>
              ) : pushSuccess ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Success!</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{t('us_submit')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
