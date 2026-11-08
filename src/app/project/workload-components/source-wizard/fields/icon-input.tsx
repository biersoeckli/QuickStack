import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/frontend/utils/utils';
import { type LucideIcon } from 'lucide-react';
import { type ComponentProps } from 'react';

export function IconInput({ icon: Icon, label, className, ...props }: ComponentProps<typeof Input> & { icon: LucideIcon; label: string }) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <div className='relative'>
        <Icon className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
        <Input className={cn('pl-9', className)} {...props} />
      </div>
    </div>
  );
}
