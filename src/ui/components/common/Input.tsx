import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', type, ...props }, ref) => {
    // Prevent scroll wheel from changing number input values
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === 'number') {
        e.currentTarget.blur();
      }
    };

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</label>
        )}
        <input
          ref={ref}
          type={type}
          onWheel={handleWheel}
          style={{ padding: '14px' }}
          className={`
            w-full bg-bg-secondary border
            text-text-primary placeholder-text-tertiary text-sm
            focus:outline-none
            transition-colors
            ${error
              ? 'border-accent-red focus:border-accent-red'
              : 'border-border-primary focus:border-octra-blue'
            }
            ${className}
          `}
          {...props}
        />
        {error && <span className="text-sm text-accent-red">{error}</span>}
        {hint && !error && <span className="text-sm text-text-tertiary">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
