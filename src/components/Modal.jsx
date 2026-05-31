import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible, animated modal shell.
 * Closes on Escape and backdrop click; locks body scroll while open.
 */
function Modal({ open, onClose, title, subtitle, icon: Icon, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm animate-scalein sm:items-center sm:p-4"
    >
      <div className={`panel-3d flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl`}>
        {/* Header */}
        <div className="relative flex items-start gap-4 overflow-hidden border-b border-border/60 px-6 py-5">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-forest/8 via-transparent to-amber/8" />
          {Icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest/10 text-meadow">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted transition hover:border-meadow hover:text-meadow"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && <div className="border-t border-border/60 bg-parchment/40 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
