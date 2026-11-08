import { createContext } from 'react';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';

export const AppDrawerAppContext = createContext<AppExtendedModel | undefined>(undefined);
