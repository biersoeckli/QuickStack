import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import AppVolumeMonitoring from './app-volumes-monitoring';
import { AppVolumeMonitoringUsageModel } from '@/shared/model/app-volume-monitoring-usage.model';

afterEach(cleanup);

it('counts shared volumes once and marks incomplete totals', () => {
    const base: AppVolumeMonitoringUsageModel = {
        projectId: 'p', projectName: 'Project', appName: 'App', appId: 'a', mountPath: '/data',
        pvcName: 'pvc-1', status: 'available', usedBytes: 1024, capacityBytes: 4096,
        availableBytes: 3072, isBaseVolume: true,
    };
    render(React.createElement(AppVolumeMonitoring, { volumesUsage: [
        base,
        { ...base, appId: 'b', appName: 'Other', isBaseVolume: false },
        { ...base, appId: 'c', pvcName: 'pvc-2', status: 'unavailable', usedBytes: undefined, capacityBytes: undefined, availableBytes: undefined },
    ] }));
    expect(screen.getByText(/Total used.*incomplete/).textContent).toContain('1 KiB');
    expect(screen.getByText(/Total used.*incomplete/).textContent).toContain('4 KiB');
    expect(screen.getByText('Unavailable (unavailable)')).toBeTruthy();
    expect(screen.getAllByText(/25%/)).toHaveLength(2);
});
