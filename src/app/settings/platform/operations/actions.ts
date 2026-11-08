'use server';

import appHistoryService from '@/server/services/standalone-services/app-history.service';
import { getAdminUserSession, simpleAction } from '@/server/utils/action-wrapper.utils';
import { z } from 'zod';

const retentionSchema = z.number().int().min(1).max(168);

export const getMonitoringHistoryRetention = async () => simpleAction(async () => {
    await getAdminUserSession();
    return appHistoryService.getRetentionHours();
});

export const setMonitoringHistoryRetention = async (hours: number) => simpleAction(async () => {
    await getAdminUserSession();
    await appHistoryService.setRetentionHours(retentionSchema.parse(hours));
});
