'use client';

import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  Pie,
  PieChart,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { NodeResourceModel } from '@/shared/model/node-resource.model';
import {
  useBreadcrumbs,
} from '@/frontend/states/zustand.states';
import { useEffect, useMemo } from 'react';
import ChartDiskRessources from './disk-chart';
import FullLoadingSpinner from '@/components/ui/full-loading-spinnter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Activity, Cpu, HardDrive, MemoryStick } from 'lucide-react';

export default function ResourcesNodes({
  resourcesNodes,
}: {
  resourcesNodes?: NodeResourceModel[];
}) {

  const getDiskUsageAbsolut = (node: NodeResourceModel) => node.diskUsageAbsolut ?? 0;
  const getDiskUsageCapacity = (node: NodeResourceModel) => node.diskUsageCapacity ?? 0;
  const toPercent = (used: number, capacity: number) => (capacity > 0 ? (used / capacity) * 100 : 0);

  const updatedNodeRessources = resourcesNodes;

  const setBreadcrumbs = useBreadcrumbs((state) => state.setBreadcrumbs);
  useEffect(
    () => setBreadcrumbs([{ name: 'Monitoring', url: '/monitoring' }]
    ), [setBreadcrumbs]);

  const clusterStats = useMemo(() => {
    if (!updatedNodeRessources) return {
      cpuUsage: 0, cpuCapacity: 1,
      ramUsage: 0, ramCapacity: 1,
      diskUsageAbsolut: 0, diskCapacity: 1
    };

    return updatedNodeRessources.reduce((acc, node) => ({
      cpuUsage: acc.cpuUsage + node.cpuUsage,
      cpuCapacity: acc.cpuCapacity + node.cpuCapacity,
      ramUsage: acc.ramUsage + node.ramUsage,
      ramCapacity: acc.ramCapacity + node.ramCapacity,
      diskUsageAbsolut: acc.diskUsageAbsolut + getDiskUsageAbsolut(node),
      diskCapacity: acc.diskCapacity + getDiskUsageCapacity(node),
    }), {
      cpuUsage: 0, cpuCapacity: 0,
      ramUsage: 0, ramCapacity: 0,
      diskUsageAbsolut: 0, diskCapacity: 0
    });
  }, [updatedNodeRessources]);

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "var(--chart-1)";
    if (percentage >= 80) return "var(--chart-4)";
    return "var(--chart-2)";
  };

  const pieChartConfig = {
    used: {
      label: "Used",
      color: "var(--chart-1)",
    },
    free: {
      label: "Remaining",
      color: "var(--muted)",
    },
  } satisfies ChartConfig;

  const getChartData = (used: number, capacity: number) => {
    const percentage = capacity > 0 ? (used / capacity) * 100 : 0;
    return [
      { status: 'used', value: used, fill: getUsageColor(percentage) },
      { status: 'free', value: Math.max(0, capacity - used), fill: 'var(--color-free)' },
    ];
  };

  if (!updatedNodeRessources) {
    return <FullLoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Cluster CPU */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Cluster CPU</CardTitle>
            <CardDescription>Total Cores Usage</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[250px]">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={getChartData(clusterStats.cpuUsage, clusterStats.cpuCapacity)} dataKey="value" nameKey="status" innerRadius={60} strokeWidth={5}>
                  <Label content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                            {((clusterStats.cpuUsage / clusterStats.cpuCapacity) * 100).toFixed(0)}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                            Used
                          </tspan>
                        </text>
                      )
                    }
                  }} />
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Cluster RAM */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Cluster RAM</CardTitle>
            <CardDescription>Total Memory Usage</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[250px]">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value) => KubeSizeConverter.convertBytesToReadableSize(value as number)} />} />
                <Pie data={getChartData(clusterStats.ramUsage, clusterStats.ramCapacity)} dataKey="value" nameKey="status" innerRadius={60} strokeWidth={5}>
                  <Label content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                            {((clusterStats.ramUsage / clusterStats.ramCapacity) * 100).toFixed(0)}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                            Used
                          </tspan>
                        </text>
                      )
                    }
                  }} />
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Cluster Storage */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Cluster Storage</CardTitle>
            <CardDescription>Node filesystem usage</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {updatedNodeRessources.some(node => node.diskUsageCapacity === undefined) && (
              <p className="text-center text-sm text-muted-foreground">Incomplete: some node filesystem metrics are unavailable.</p>
            )}
            {clusterStats.diskCapacity > 0 ? (
              <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[250px]">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value) => KubeSizeConverter.convertBytesToReadableSize(value as number)} />} />
                  <Pie data={getChartData(clusterStats.diskUsageAbsolut, clusterStats.diskCapacity)} dataKey="value" nameKey="status" innerRadius={60} strokeWidth={5}>
                    <Label content={({ viewBox }) => viewBox && "cx" in viewBox && "cy" in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                          {toPercent(clusterStats.diskUsageAbsolut, clusterStats.diskCapacity).toFixed(0)}%
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">Used</tspan>
                      </text>
                    ) : null} />
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : <p className="py-12 text-center text-muted-foreground">Storage metrics unavailable</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Node Resources</CardTitle>
          <CardDescription>Overview of all nodes in the cluster</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node Name</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>RAM</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {updatedNodeRessources.map((node) => (
                <TableRow key={node.name}>
                  <TableCell className="font-medium">{node.name}</TableCell>
                  <TableCell className="w-[25%]">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{((node.cpuUsage / node.cpuCapacity) * 100).toFixed(0)}%</span>
                        <span>{node.cpuUsage.toFixed(2)} / {node.cpuCapacity} Cores</span>
                      </div>
                      <Progress value={(node.cpuUsage / node.cpuCapacity) * 100} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell className="w-[25%]">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{((node.ramUsage / node.ramCapacity) * 100).toFixed(0)}%</span>
                        <span>{KubeSizeConverter.convertBytesToReadableSize(node.ramUsage)} / {KubeSizeConverter.convertBytesToReadableSize(node.ramCapacity)}</span>
                      </div>
                      <Progress value={(node.ramUsage / node.ramCapacity) * 100} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell className="w-[25%]">
                    <div className="space-y-1">
                      {(() => {
                        const diskUsed = getDiskUsageAbsolut(node);
                        const diskCapacity = getDiskUsageCapacity(node);
                        const diskUsedAndReserved = diskUsed;
                        const diskPercent = toPercent(diskUsedAndReserved, diskCapacity);
                        if (node.diskUsageCapacity === undefined) return <span className="text-muted-foreground">Unavailable</span>;
                        return (
                          <>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{diskPercent.toFixed(0)}%</span>
                              <span>{KubeSizeConverter.convertBytesToReadableSize(diskUsedAndReserved)} / {KubeSizeConverter.convertBytesToReadableSize(diskCapacity)}</span>
                            </div>
                            <Progress value={diskPercent} className="h-2" />
                          </>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <NodeDetailsSheet node={node} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NodeDetailsSheet({ node }: { node: NodeResourceModel }) {
  const chartData = [
    { browser: 'safari', usage: 1, fill: 'var(--color-safari)' },
  ];

  const chartConfig = {
    usage: {
      label: 'Usage',
    },
    safari: {
      label: 'Safari',
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig;

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm">View Details</Button>} />
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {node.name}
          </SheetTitle>
          <SheetDescription>
            Detailed resource usage metrics
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 py-6">
          {/* CPU Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4" /> CPU Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
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
                                className="fill-muted-foreground"
                              >
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
            </CardContent>
          </Card>

          {/* RAM Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MemoryStick className="h-4 w-4" /> Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
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
                                className="fill-muted-foreground"
                              >
                                {KubeSizeConverter.convertBytesToReadableSize(node.ramUsage)} / {KubeSizeConverter.convertBytesToReadableSize(node.ramCapacity)}
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
          </Card>

          {/* Disk Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Storage Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartDiskRessources nodeRessource={node} />
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
