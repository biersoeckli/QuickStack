import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export function SecretSummaryRow({
  label,
  value,
  visible,
  onVisibleChange
}: {
  label: string;
  value: string;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
}) {
  const EyeIcon = visible ? EyeOff : Eye;
  const displayValue = value ? (visible ? value : '************') : 'Not configured';
  return (
    <div className='grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:items-center'>
      <p className='text-sm text-muted-foreground'>{label}</p>
      <div className='flex min-w-0 items-center gap-2'>
        <p className='truncate font-mono text-sm font-medium'>{displayValue}</p>
        {!!value && (
          <Button type='button' variant='ghost' size='icon' className='h-7 w-7 shrink-0' onClick={() => onVisibleChange(!visible)}>
            <EyeIcon className='h-4 w-4' />
            <span className='sr-only'>{visible ? 'Hide secret' : 'Show secret'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
