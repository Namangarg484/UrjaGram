import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle2, Server, ArrowRightLeft, ShieldCheck, Loader2 } from 'lucide-react';

export default function GoiRpaSync({ isSyncing, onSyncComplete }) {
  const [syncStep, setSyncStep] = useState(0);

  const steps = [
    { label: "Initializing RPA Handshake...", detail: "Connecting to pmsuryaghar.gov.in via secure proxy" },
    { label: "Resolving Captcha...", detail: "Using AI vision model for captcha resolution" },
    { label: "Pushing Consumer Data...", detail: "Injecting Aadhaar, Bill, and predicted load payload" },
    { label: "Validating Success Hash...", detail: "Verifying GOI server response 200 OK" }
  ];

  useEffect(() => {
    if (!isSyncing) return;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setSyncStep(currentStep);
      } else {
        clearInterval(interval);
        setTimeout(onSyncComplete, 1000);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isSyncing, onSyncComplete]);

  return (
    <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Server className="w-48 h-48" />
      </div>

      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className="relative">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500 ${isSyncing ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
            <Bot className="h-6 w-6 text-white" />
          </div>
          {isSyncing && <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
          </span>}
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-ink">Zero-Defect RPA Sync</h3>
          <p className="text-sm font-medium text-muted">Seamless automated push to GOI Portal</p>
        </div>
      </div>

      <div className="bg-white/60 border border-white rounded-[1.5rem] p-5 relative z-10 space-y-4">
        {steps.map((step, idx) => {
          const isActive = syncStep === idx;
          const isDone = syncStep > idx;
          const isPending = syncStep < idx;

          return (
            <div key={idx} className={`flex items-start gap-3 transition-all duration-300 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
              <div className="mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : isActive && isSyncing ? (
                  <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-border/60" />
                )}
              </div>
              <div>
                <div className={`text-sm font-bold ${isActive && isSyncing ? 'text-indigo-900' : isDone ? 'text-emerald-900' : 'text-slate-600'}`}>
                  {step.label}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isSyncing && syncStep >= steps.length && (
        <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between animate-in zoom-in-95 duration-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-900">Successfully Injected to PM Surya Ghar</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">100% Verified</span>
        </div>
      )}
    </div>
  );
}
