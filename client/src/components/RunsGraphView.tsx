import { BarChart, getFilteredChartTooltipPayload } from "@mantine/charts";
import { Paper, Stack, Text } from "@mantine/core";
import type { CompetitionClass, Run } from "@my-agility-qs/shared";
import dayjs from "dayjs";
import { useMemo } from "react";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";

// Class display order and colors
const CLASS_CONFIG: { class: CompetitionClass; label: string; color: string }[] = [
  { class: "Standard", label: "Std", color: "blue.6" },
  { class: "Jumpers", label: "JWW", color: "teal.6" },
  { class: "Premier Std", label: "Prem Std", color: "violet.6" },
  { class: "Premier JWW", label: "Prem JWW", color: "grape.6" },
  { class: "FAST", label: "FAST", color: "orange.6" },
  { class: "T2B", label: "T2B", color: "pink.6" },
];

interface RunsGraphViewProps {
  runs: Run[];
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

export const RunsGraphView: React.FC<RunsGraphViewProps> = ({ runs }) => {
  // Find which classes are present in the data
  const activeClasses = useMemo(() => {
    const classSet = new Set(runs.map((r) => r.class));
    return CLASS_CONFIG.filter((c) => classSet.has(c.class));
  }, [runs]);

  const { data, series } = useMemo(() => {
    if (runs.length === 0 || activeClasses.length === 0) return { data: [], series: [] };

    // Group by year — stacked by class
    const yearClassCounts = new Map<number, Map<CompetitionClass, number>>();
    for (const run of runs) {
      const year = dayjs(run.date).year();
      if (!yearClassCounts.has(year)) yearClassCounts.set(year, new Map());
      const classMap = yearClassCounts.get(year)!;
      classMap.set(run.class, (classMap.get(run.class) || 0) + 1);
    }

    const years = [...yearClassCounts.keys()].sort();
    const chartData = years.map((y) => {
      const entry: Record<string, string | number> = { period: String(y) };
      for (const cls of activeClasses) {
        entry[cls.label] = yearClassCounts.get(y)?.get(cls.class) || 0;
      }
      return entry;
    });

    // Recharts can't render bars with a single data point (bandwidth = 0).
    // Pad with empty neighbors so the bar has a calculable width.
    if (chartData.length === 1) {
      const year = years[0];
      const emptyEntry = (y: number) => {
        const entry: Record<string, string | number> = { period: String(y) };
        for (const cls of activeClasses) entry[cls.label] = 0;
        return entry;
      };
      chartData.unshift(emptyEntry(year - 1));
      chartData.push(emptyEntry(year + 1));
    }

    return {
      data: chartData,
      series: activeClasses.map((cls) => ({ name: cls.label, color: cls.color, stackId: "stack" })),
    };
  }, [runs, activeClasses]);

  // DEBUG: remove after fixing
  console.log("RunsGraphView", { runCount: runs.length, data, series, activeClasses: activeClasses.map(c => c.label), runClasses: [...new Set(runs.map(r => r.class))] });

  if (runs.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Stack align="center">
          <Text size="lg" c="dimmed">
            No runs match your filters
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
        <BarChart
          h={300}
          data={data}
          dataKey="period"
          series={series}
          tickLine="y"
          gridAxis="y"
          barProps={{ minPointSize: 5, maxBarSize: 80 }}
          tooltipProps={{
            content: ({ label, payload }: TooltipContentProps<number, string>) => {
              if (!payload?.length) return null;
              const filtered = (getFilteredChartTooltipPayload([...payload]) as TooltipPayloadItem[]).filter((p) => p.value > 0);
              if (filtered.length === 0) return null;
              return (
                <Paper px="md" py="xs" withBorder shadow="md" radius="md">
                  <Text size="sm" fw={500} mb={4}>{label}</Text>
                  {filtered.map((item) => (
                    <Text key={item.name} size="sm" c={item.color}>
                      {item.name}: {item.value} Q{item.value !== 1 ? "s" : ""}
                    </Text>
                  ))}
                </Paper>
              );
            },
          }}
        />
    </Paper>
  );
};
