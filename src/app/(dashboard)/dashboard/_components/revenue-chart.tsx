"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type TooltipContentProps } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import type { MonthlyRevenue } from "@/lib/data/metrics";

const chartConfig = {
  workshop: { label: "Taller", color: "var(--chart-1)" },
  pos: { label: "Mostrador", color: "var(--chart-3)" },
  ecommerce: { label: "E-commerce", color: "var(--chart-2)" },
} satisfies ChartConfig;

const SERIES = ["workshop", "pos", "ecommerce"] as const;

function RevenueTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as MonthlyRevenue;
  const total = row.workshop + row.pos + row.ecommerce;

  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{row.monthLong}</p>
      {SERIES.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: `var(--color-${key})` }}
            aria-hidden
          />
          <span className="text-muted-foreground">{chartConfig[key].label}</span>
          <span className="ml-auto font-medium text-foreground tabular-nums">
            {formatCurrency(row[key])}
          </span>
        </div>
      ))}
      <div className="mt-0.5 flex items-center border-t pt-1.5">
        <span className="text-muted-foreground">Total</span>
        <span className="ml-auto font-semibold text-foreground tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  return (
    <>
      <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickMargin={4}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <ChartTooltip cursor={{ fillOpacity: 0.6 }} content={(props) => <RevenueTooltip {...props} />} />
          <ChartLegend
            content={<ChartLegendContent />}
            itemSorter={(item) => SERIES.indexOf(item.dataKey as (typeof SERIES)[number])}
          />
          {/* Barras apiladas: base cuadrada, extremo superior redondeado y 2px de separación. */}
          <Bar
            dataKey="workshop"
            stackId="revenue"
            fill="var(--color-workshop)"
            stroke="var(--card)"
            strokeWidth={2}
            radius={[0, 0, 0, 0]}
            maxBarSize={44}
          />
          <Bar
            dataKey="pos"
            stackId="revenue"
            fill="var(--color-pos)"
            stroke="var(--card)"
            strokeWidth={2}
            radius={[0, 0, 0, 0]}
            maxBarSize={44}
          />
          <Bar
            dataKey="ecommerce"
            stackId="revenue"
            fill="var(--color-ecommerce)"
            stroke="var(--card)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ChartContainer>

      {/* Vista tabular accesible para lectores de pantalla. */}
      <table className="sr-only">
        <caption>Ingresos por canal, últimos 6 meses</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Taller</th>
            <th scope="col">Mostrador</th>
            <th scope="col">E-commerce</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.month}>
              <th scope="row">{row.monthLong}</th>
              <td>{formatCurrency(row.workshop)}</td>
              <td>{formatCurrency(row.pos)}</td>
              <td>{formatCurrency(row.ecommerce)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
