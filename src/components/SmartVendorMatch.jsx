import React, { useState } from 'react';
import { Store, Star, Clock, MapPin, CheckCircle2, ShieldAlert, ArrowRight, TrendingUp } from 'lucide-react';

export default function SmartVendorMatch({ requiredLoad, onVendorSelect }) {
  const [selectedId, setSelectedId] = useState(null);

  // Mock hybrid vendor data (MNRE scraped + UrjaGram onboarded)
  const vendors = [
    {
      id: 'v1',
      name: "Solaris Power India",
      source: "UrjaGram Partner",
      rating: 4.9,
      installs: 142,
      sla: "3 Days",
      distance: "4.2 km",
      pricePerKw: 42000,
      inventory: "Available",
      verified: true
    },
    {
      id: 'v2',
      name: "EcoTech Energy Co.",
      source: "MNRE Scraped",
      rating: 4.2,
      installs: 38,
      sla: "14-21 Days",
      distance: "12.5 km",
      pricePerKw: 43500,
      inventory: "Unknown",
      verified: false
    },
    {
      id: 'v3',
      name: "GreenGrid Solutions",
      source: "UrjaGram Partner",
      rating: 4.8,
      installs: 89,
      sla: "5 Days",
      distance: "8.1 km",
      pricePerKw: 41500,
      inventory: "Low Stock",
      verified: true
    }
  ];

  const handleSelect = (id) => {
    setSelectedId(id);
    setTimeout(() => onVendorSelect(id), 600);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-8 duration-700 ease-out">
      <div>
        <h3 className="text-3xl font-black tracking-tight text-ink">Smart Vendor Matchmaking</h3>
        <p className="text-base font-medium text-muted mt-1.5">Bypassing the opaque MNRE portal. Select a verified UrjaGram partner for guaranteed SLA and parallel loan approval.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 relative z-10">
        {vendors.map(v => {
          const isSelected = selectedId === v.id;
          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v.id)}
              className={`text-left p-5 rounded-[1.5rem] border backdrop-blur-md transition-all duration-300 relative overflow-hidden group ${
                isSelected 
                  ? 'bg-emerald-50 border-emerald-400 shadow-[0_8px_24px_rgba(16,185,129,0.15)] ring-2 ring-emerald-400/50 scale-[1.02]' 
                  : 'bg-white/60 border-white hover:border-emerald-200 hover:bg-white hover:shadow-md'
              }`}
            >
              {v.verified && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Partner
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${v.verified ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-ink truncate max-w-[140px]">{v.name}</h4>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-ink">{v.rating}</span>
                    <span className="text-[10px] font-medium text-muted ml-1">({v.installs})</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Install SLA</span>
                  <span className={`font-black ${v.verified ? 'text-emerald-600' : 'text-amber-600'}`}>{v.sla}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted font-semibold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Distance</span>
                  <span className="font-bold text-ink">{v.distance}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted font-semibold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5"/> Rate/kW</span>
                  <span className="font-bold text-ink">₹{(v.pricePerKw/1000).toFixed(1)}k</span>
                </div>
              </div>

              <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg text-center transition-colors ${
                v.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {v.source} • {v.inventory}
              </div>

              {isSelected && (
                <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="bg-white rounded-full p-2 shadow-lg">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  );
}
