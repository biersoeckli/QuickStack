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
import { StringUtils } from '@/shared/utils/string.utils';

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
    <div className="space-y-6">
      {resourcesNodes.map((node, index) => (<>
        <Card className="flex flex-col">
          <CardHeader className="pb-0 text-center">
            <CardTitle>{node.name}</CardTitle>
            <CardDescription>Node {index + 1}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <div key={index} className="grid grid-cols-1 md:grid-cols-3">
              <div className="space-y-2 px-4 pb-2">

                <ChartContainer
                  config={chartConfig}
                  className="mx-auto aspect-square max-h-[250px]"
                >
                  <RadialBarChart
                    data={chartData}
                    startAngle={0}
                    endAngle={360 * node.cpuUsage / node.cpuCapacity}
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
                                  y={(viewBox.cy || 0) - 10}
                                  className="fill-foreground text-4xl font-bold"
                                >
                                  {(node.cpuUsage / node.cpuCapacity * 100).toFixed(0)}%
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 14}
                                  className="fill-muted-foreground"
                                >
                                  CPU
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 30}
                                  className="fill-muted-foreground"                                      >
                                  Load: {(node.cpuUsage).toFixed(2)}
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </PolarRadiusAxis>
                  </RadialBarChart>
                </ChartContainer>

              </div >
              <div className="space-y-2 px-4 pb-2">

                <ChartContainer
                  config={chartConfig}
                  className="mx-auto aspect-square max-h-[250px]"
                >
                  <RadialBarChart
                    data={chartData}
                    startAngle={0}
                    endAngle={360 * node.ramUsage / node.ramCapacity}
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
                                  y={(viewBox.cy || 0) - 10}
                                  className="fill-foreground text-4xl font-bold"
                                >
                                  {(node.ramUsage / node.ramCapacity * 100).toFixed(0)}%
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 14}
                                  className="fill-muted-foreground"
                                >
                                  RAM
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 30}
                                  className="fill-muted-foreground"                                      >
                                  {(node.ramUsage / (1024 * 1024 * 1024)).toFixed(2)} / {StringUtils.convertBytesToReadableSize(node.ramCapacity)}
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </PolarRadiusAxis>
                  </RadialBarChart>
                </ChartContainer>
              </div>
              <div className="space-y-2 px-4 pb-2">
                <ChartDiskRessources nodeRessource={node} />
              </div>
            </div>
          </CardContent>
        </Card>
      </>))
      }
    </div >
  );
}
