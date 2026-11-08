'use client';

import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DrawerTabScrollArea({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="min-h-0 min-w-0 flex-1 px-6 pt-2" contentClassName="w-full min-w-0! max-w-full">
      <div className="min-w-0 pb-4">{children}</div>
    </ScrollArea>
  );
}
