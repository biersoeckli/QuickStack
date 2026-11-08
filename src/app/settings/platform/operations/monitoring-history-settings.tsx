'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getMonitoringHistoryRetention, setMonitoringHistoryRetention } from './monitoring-history-actions';

const schema = z.object({ hours: z.coerce.number().int().min(1).max(168) });

export default function MonitoringHistorySettings() {
    const [loaded, setLoaded] = useState(false);
    const [message, setMessage] = useState('');
    const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { hours: '' },
    });
    useEffect(() => {
        void getMonitoringHistoryRetention().then(result => {
            if (result.status === 'success' && result.data !== undefined) {
                form.reset({ hours: result.data });
                setLoaded(true);
            } else setMessage('Unable to load retention settings.');
        }).catch(() => setMessage('Unable to load retention settings.'));
    }, [form]);
    return <Card>
        <CardHeader><CardTitle>App monitoring history</CardTitle><CardDescription>Keep measurements for 1 to 168 hours. Default: 24 hours.</CardDescription></CardHeader>
        <CardContent>
            <Form {...form}>
                <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(async ({ hours }) => {
                    try {
                        const result = await setMonitoringHistoryRetention(hours);
                        setMessage(result.status === 'success' ? 'Retention saved. Older samples are removed during the next collection.' : result.message ?? 'Unable to save retention.');
                    } catch {
                        setMessage('Unable to save retention.');
                    }
                })}>
                    <FormField control={form.control} name="hours" render={({ field }) => <FormItem>
                        <FormLabel>Retention (hours)</FormLabel>
                        <FormControl><Input type="number" min={1} max={168} step={1} {...field} value={String(field.value ?? '')} /></FormControl>
                        <FormMessage />
                    </FormItem>} />
                    <Button type="submit" disabled={!loaded || form.formState.isSubmitting}>Save retention</Button>
                    {message && <p role="status">{message}</p>}
                </form>
            </Form>
        </CardContent>
    </Card>;
}
