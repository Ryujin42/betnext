import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-ink-50 shadow-sm disabled:opacity-50',
  secondary:
    'bg-surface-200 hover:bg-surface-300 text-ink-50 border border-surface-300 disabled:opacity-50',
  danger: 'bg-danger-500 hover:bg-red-600 text-ink-50 shadow-sm disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-surface-100 text-ink-100 disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {loading ? <span className="size-3 animate-pulse rounded-full bg-current" /> : null}
      {children}
    </button>
  );
}
