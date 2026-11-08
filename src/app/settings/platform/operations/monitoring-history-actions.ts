'use server';

import appHistoryAdapter from '@/server/adapter/app-history.adapter';
import { getAdminUserSession, simpleAction } from '@/server/utils/action-wrapper.utils';
import { z } from 'zod';

const retentionSchema = z.number().int().min(1).max(168);

export const getMonitoringHistoryRetention = async () => simpleAction(async () => {
    await getAdminUserSession();
    return appHistoryAdapter.getRetentionHours();
});

export const setMonitoringHistoryRetention = async (hours: number) => simpleAction(async () => {
    await getAdminUserSession();
    await appHistoryAdapter.setRetentionHours(retentionSchema.parse(hours));
});
