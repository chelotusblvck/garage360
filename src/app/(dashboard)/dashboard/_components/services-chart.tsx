"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { SERVICE_TYPE_LABEL } from "@/lib/labels";
import type { ServiceType } from "@/lib/validations/schemas";

const chartConfig = {
  count: { label: "Servicios", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ServicesChart({ data }: { data: { type: ServiceType; count: number }[] }) {
  const rows = [...data]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({ ...row, label: SERVICE_TYPE_LABEL[row.type] }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap="22%">
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={96}
          tick={{ fontSize: 12 }}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={{ fillOpacity: 0.6 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as (typeof rows)[number];
            return (
              <div className="flex items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                <span className="size-2.5 rounded-[2px] bg-(--color-count)" aria-hidden />
                <span className="text-muted-foreground">{row.label}</span>
                <span className="ml-2 font-medium text-foreground tabular-nums">
                  {row.count} servicios
                </span>
              </div>
            );
          }}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={28}>
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            className="fill-foreground text-xs font-medium tabular-nums"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
