import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  hint?: ReactNode;
}

export function Card({ title, hint, className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-200 p-5 shadow-sm',
        className,
      )}
    >
      {(title || hint) && (
        <header className="mb-3 flex items-baseline justify-between">
          {title && <h3 className="text-sm font-semibold text-ink-100">{title}</h3>}
          {hint && <span className="text-xs text-ink-300">{hint}</span>}
        </header>
      )}
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: string;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-ink-300">{label}</span>
        <span className="text-3xl font-bold text-ink-50">{value}</span>
        {delta && <span className="text-xs text-ink-300">{delta}</span>}
      </div>
    </Card>
  );
}
