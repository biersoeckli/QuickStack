import { cn } from '@/frontend/utils/utils';

export function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('truncate text-sm font-medium', mono && 'font-mono')}>{value || 'Not configured'}</p>
    </div>
  );
}
