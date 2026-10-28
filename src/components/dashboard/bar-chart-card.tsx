"use client"

import { BarChart3, Table2 } from "lucide-react"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type BarDatum = { label: string; value: number }

type Props = {
  title: string
  description?: string
  data: BarDatum[]
  /** What one unit is called in the tooltip and table header, e.g. "Items". */
  valueLabel: string
  /** horizontal = bars grow right (long category names); vertical = columns (time). */
  orientation?: "horizontal" | "vertical"
  emptyText?: string
}

/**
 * One single-series bar chart with a "View as table" switch (charts must
 * have a table fallback for screen readers and for reading exact
 * values). Single series = one color and no legend; the title says what it is.
 */
export function BarChartCard({ title, description, data, valueLabel, orientation = "vertical", emptyText = "No data yet." }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig
  const horizontal = orientation === "horizontal"
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const longest = Math.max(0, ...data.map((d) => d.label.length))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={(v) => v && setView(v as "chart" | "table")}
            aria-label={`${title}: show as chart or table`}
          >
            <ToggleGroupItem value="chart" aria-label="Show as chart">
              <BarChart3 aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Show as table">
              <Table2 aria-hidden="true" />
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.length === 0 || total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : view === "chart" ? (
          <ChartContainer
            config={config}
            className="w-full"
            style={{ height: horizontal ? Math.max(180, data.length * 34 + 24) : 260 }}
            // The SVG itself is hidden from screen readers; the table view and this label carry the data.
            aria-label={`${title}. ${data.map((d) => `${d.label}: ${d.value}`).join(", ")}`}
            role="img"
          >
            <BarChart
              accessibilityLayer
              data={data}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={horizontal ? { left: 4, right: 40, top: 4, bottom: 4 } : { left: 0, right: 8, top: 20, bottom: 0 }}
            >
              <CartesianGrid horizontal={!horizontal} vertical={horizontal} strokeDasharray="0" stroke="var(--border)" />
              {horizontal ? (
                <>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={Math.min(170, Math.max(70, longest * 7.2))}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                </>
              )}
              <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideLabel={false} />} />
              <Bar
                dataKey="value"
                name={valueLabel}
                fill="var(--color-value)"
                // 4px rounded data-end, square at the baseline; bars capped at 24px thick.
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={24}
              >
                <LabelList
                  dataKey="value"
                  position={horizontal ? "right" : "top"}
                  offset={6}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="max-h-80 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label={`${title} table`}>
            <Table containerClassName="overflow-visible">
              <caption className="sr-only">{title}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{horizontal ? "Category" : "Period"}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {valueLabel}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d) => (
                  <TableRow key={d.label}>
                    <TableCell>{d.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.value.toLocaleString("en-US")}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{total.toLocaleString("en-US")}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
