'use client';

import {
    Label,
    PolarRadiusAxis,
    RadialBar,
    RadialBarChart,
} from 'recharts';

import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { NodeResourceModel } from '@/shared/model/node-resource.model';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';

export default function ChartDiskRessources({
    nodeRessource,
}: {
    nodeRessource: NodeResourceModel;
}) {

    const chartData = [{
        diskUsed: nodeRessource.diskUsageAbsolut,
        diskReserved: nodeRessource.diskUsageReserved,
        diskSchedulable: nodeRessource.diskSpaceSchedulable
    }];

    const chartConfig = {
        diskUsed: {
            label: "Used",
            color: "hsl(var(--chart-1))",
        },
        diskReserved: {
            label: "Reserved (free but not usable)",
            color: "hsl(var(--chart-2))",
        },
        diskSchedulable: {
            label: "Schedulable",
            color: "hsl(var(--muted))",
        },
    } satisfies ChartConfig

    return (
        <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-w-[250px]"
        >
            <RadialBarChart
                data={chartData}
                innerRadius={80}
                outerRadius={110}
            >
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel formatter={(value, name) => {
                        // Convert the value from bytes to gigabytes
                        const formattedValue = KubeSizeConverter.convertBytesToReadableSize(value as number);
                        // Optionally, you can customize the label (name) here if needed
                        return <div className='flex gap-2'>
                            <div className='self-center rounded w-2 h-2' style={{ backgroundColor: (chartConfig as any)[name].color }}></div>
                            <div className='flex-1'>{(chartConfig as any)[name].label}:</div>
                            <div>{formattedValue}</div>
                        </div>
                    }} />}
                />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                    <Label
                        content={({ viewBox }) => {
                            if (
                                viewBox &&
                                'cx' in viewBox &&
                                'cy' in viewBox
                            ) {
                                return (
                                    <text
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                    >
                                        <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy || 0) - 10}
                                            className="fill-foreground text-4xl font-bold"
                                        >
                                            {((nodeRessource.diskUsageAbsolut + nodeRessource.diskUsageReserved) / nodeRessource.diskUsageCapacity * 100).toFixed(0)}%
                                        </tspan>
                                        <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy || 0) + 14}
                                            className="fill-muted-foreground"
                                        >
                                            Storage
                                        </tspan>
                                        <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy || 0) + 30}
                                            className="fill-muted-foreground">
                                            {KubeSizeConverter.convertBytesToReadableSize(nodeRessource.diskUsageAbsolut + nodeRessource.diskUsageReserved, 1, true)} / {KubeSizeConverter.convertBytesToReadableSize(nodeRessource.diskUsageCapacity, 1)}
                                        </tspan>
                                    </text>
                                );
                            }
                        }}
                    />
                </PolarRadiusAxis>
                <RadialBar
                    dataKey="diskUsed"
                    stackId="a"
                    cornerRadius={5}
                    fill="var(--color-diskUsed)"
                    className="stroke-transparent stroke-2"
                />
                <RadialBar
                    dataKey="diskReserved"
                    fill="var(--color-diskReserved)"
                    stackId="a"
                    cornerRadius={5}
                    className="stroke-transparent stroke-2"
                />
                <RadialBar
                    dataKey="diskSchedulable"
                    fill="var(--color-diskSchedulable)"
                    stackId="a"
                    cornerRadius={5}
                    className="stroke-transparent stroke-2"
                />
            </RadialBarChart>
        </ChartContainer>
    );
}


/*
 <CardContent className="flex-1 pb-0">
            <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square max-h-[250px]">

                <RadialBarChart
                    data={chartData}
                    innerRadius={80}
                    outerRadius={110} >

                    <PolarGrid
                        gridType="circle"
                        radialLines={false}
                        stroke="none"
                        className="first:fill-muted last:fill-background"
                        polarRadius={[86, 74]}
                    />

                    <RadialBar
                        dataKey="diskUsed"
                        stackId="a"
                        background
                        fill="var(--color-diskUsed)"
                        cornerRadius={10}
                    />

                    <RadialBar
                        dataKey="diskReserved"
                        stackId="a"
                        fill="var(--color-diskReserved)"
                        background
                        cornerRadius={10}
                    />

                    <PolarRadiusAxis
                        tick={false}
                        tickLine={false}
                        axisLine={false}
                    >
                        <Label
                            content={({ viewBox }) => {
                                if (
                                    viewBox &&
                                    'cx' in viewBox &&
                                    'cy' in viewBox
                                ) {
                                    return (
                                        <text
                                            x={viewBox.cx}
                                            y={viewBox.cy}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                        >
                                            <tspan
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                className="fill-foreground text-4xl font-bold"
                                            >
                                                {(nodeRessource.diskUsageAbsolut / nodeRessource.diskUsageCapacity * 100).toFixed(1)}
                                            </tspan>
                                            <tspan
                                                x={viewBox.cx}
                                                y={(viewBox.cy || 0) + 24}
                                                className="fill-muted-foreground"
                                            >
                                                %
                                            </tspan>
                                        </text>
                                    );
                                }
                            }}
                        />
                    </PolarRadiusAxis>
                </RadialBarChart>
            </ChartContainer>
        </CardContent>
*/