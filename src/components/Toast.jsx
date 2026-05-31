import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const tones = {
  success: {
    icon: CheckCircle2,
    className: 'border-meadow/20 bg-white text-ink',
    accent: 'text-meadow',
  },
  error: {
    icon: AlertCircle,
    className: 'border-red-200 bg-white text-ink',
    accent: 'text-red-500',
  },
};

function Toast({ toast, onClose }) {
  const tone = tones[toast.tone] || tones.success;
  const Icon = tone.icon;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => onClose(toast.id), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [onClose, toast.id]);

  return (
    <div className={`animate-slidein rounded-card border px-4 py-3 shadow-lift backdrop-blur-md ${tone.className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 ${tone.accent}`} />
        <div className="flex-1 text-sm font-medium">{toast.message}</div>
        <button onClick={() => onClose(toast.id)} className="text-muted transition hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Toast;