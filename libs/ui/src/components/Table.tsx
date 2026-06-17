import type { ReactNode } from 'react';
import { cn } from '../cn';

/**
 * Coquille de table — surfaces TanStack Table dans les apps consommatrices.
 * Le sous-composant `<TableCell />` permet une mise en forme cohérente sans
 * dépendre d'une lib UI tierce.
 */
export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-surface-200', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface-200 text-left text-ink-300">{children}</thead>;
}

export function TableRow({
  children,
  onClick,
  highlighted,
}: {
  children: ReactNode;
  onClick?: () => void;
  highlighted?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-t border-surface-200',
        onClick && 'cursor-pointer hover:bg-surface-200/60',
        highlighted && 'bg-brand-500/10',
      )}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  header,
  className,
  align = 'left',
}: {
  children?: ReactNode;
  header?: boolean;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const Tag = header ? 'th' : 'td';
  return (
    <Tag
      className={cn(
        'px-4 py-3',
        header ? 'font-medium text-xs uppercase tracking-wide' : 'text-ink-100',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
