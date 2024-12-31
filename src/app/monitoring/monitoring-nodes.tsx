'use client';

import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';
import { NodeResourceModel } from '@/shared/model/node-resource.model';
import {
  useBreadcrumbs,
} from '@/frontend/states/zustand.states';
import { useEffect } from 'react';
import ChartDiskRessources from './disk-chart';

export default function ResourcesNodes({
  resourcesNodes,
}: {
  resourcesNodes: NodeResourceModel[];
}) {
  const chartData = [
    { browser: 'safari', usage: 1, fill: 'var(--color-safari)' },
  ];

  const chartConfig = {
    usage: {
      label: 'Usage',
    },
    safari: {
      label: 'Safari',
      color: 'hsl(var(--chart-2))',
    },
  } satisfies ChartConfig;

  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(
    () => setBreadcrumbs([{ name: 'Monitoring', url: '/monitoring' }]),
    []
  );

  return (
    <CardContent>
      <div className="grid grid-cols-1 gap-8">
        {resourcesNodes.map((node, index) => (<>
          <h3
            className={'p-4 rounded-t-lg font-semibold text-xl text-center'}
          >
            Node {index + 1}:<br />
            {node.name}
          </h3>
          <div key={index} className="grid grid-cols-1 md:grid-cols-3">

            <div className="space-y-2 px-4 pb-2">
              <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                  <CardTitle>CPU</CardTitle>
                  <CardDescription>Usage in %</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <RadialBarChart
                      data={chartData}
                      startAngle={0}
                      endAngle={360 * node.cpuUsageAbsolut / node.cpuUsageCapacity}
                      innerRadius={80}
                      outerRadius={110}
                    >
                      <PolarGrid
                        gridType="circle"
                        radialLines={false}
                        stroke="none"
                        className="first:fill-muted last:fill-background"
                        polarRadius={[86, 74]}
                      />
                      <RadialBar
                        dataKey="usage"
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
                                    {(node.cpuUsageAbsolut / node.cpuUsageCapacity * 100).toFixed(1)}
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
                <CardFooter className="flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    CPU Absolute: {node.cpuUsageAbsolut.toFixed(2)} cores
                  </div>
                  <div className="flex items-center gap-2 font-medium leading-none">
                    CPU Capacity: {node.cpuUsageCapacity.toFixed(2)} cores
                  </div>
                </CardFooter>
              </Card>
            </div>
            <div className="space-y-2 px-4 pb-2">
              <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                  <CardTitle>RAM</CardTitle>
                  <CardDescription>Usage in %</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <RadialBarChart
                      data={chartData}
                      startAngle={0}
                      endAngle={360 * node.ramUsageAbsolut / node.ramUsageCapacity}
                      innerRadius={80}
                      outerRadius={110}
                    >
                      <PolarGrid
                        gridType="circle"
                        radialLines={false}
                        stroke="none"
                        className="first:fill-muted last:fill-background"
                        polarRadius={[86, 74]}
                      />
                      <RadialBar
                        dataKey="usage"
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
                                    {(node.ramUsageAbsolut / node.ramUsageCapacity * 100).toFixed(1)}
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
                <CardFooter className="flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    RAM Absolute: {(node.ramUsageAbsolut / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </div>
                  <div className="flex items-center gap-2 font-medium leading-none">
                    RAM Capacity: {(node.ramUsageCapacity / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </div>
                </CardFooter>
              </Card>
            </div>
            <div className="space-y-2 px-4 pb-2">
              <ChartDiskRessources nodeRessource={node} />
            </div>
          </div>
        </>))}
      </div>
    </CardContent>
  );
}
