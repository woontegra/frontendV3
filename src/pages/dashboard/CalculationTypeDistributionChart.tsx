import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend as ReLegend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PIE_COLORS } from "./calculationTypeLabels";
import {
  buildCalculationTypeDistribution,
  distributionChartHeight,
  shouldUseDistributionBarChart,
  type CalculationTypeDistributionItem,
} from "./calculationTypeDistribution";
import type { SavedCase } from "./dashboardData";
import styles from "./CalculationTypeDistributionChart.module.css";

type Props = {
  savedCases: SavedCase[];
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: CalculationTypeDistributionItem }>;
};

function DistributionTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTitle}>{row.name}</p>
      <p className={styles.tooltipMeta}>{row.value.toLocaleString("tr-TR")} adet</p>
    </div>
  );
}

const BAR_SIZE = 20;

function yAxisWidth(data: CalculationTypeDistributionItem[]): number {
  const longest = data.reduce((max, row) => Math.max(max, row.name.length), 0);
  return Math.min(168, Math.max(80, longest * 6.2));
}

/** Bar sonu "NN adet" etiketleri için sağ boşluk (px) */
function chartRightMargin(data: CalculationTypeDistributionItem[]): number {
  const longestLabel = data.reduce((max, row) => Math.max(max, row.labelText.length), 0);
  return Math.min(88, Math.max(52, longestLabel * 7));
}

function xAxisMaxValue(data: CalculationTypeDistributionItem[]): number {
  const peak = data.reduce((max, row) => Math.max(max, row.value), 0);
  if (peak <= 0) {
    return 1;
  }
  return Math.ceil(peak * 1.08);
}

export default function CalculationTypeDistributionChart({ savedCases }: Props) {
  const data = useMemo(
    () => buildCalculationTypeDistribution(savedCases),
    [savedCases],
  );

  const useBarChart = shouldUseDistributionBarChart(data.length);
  const chartHeight = distributionChartHeight(data.length, useBarChart ? "bar" : "donut");

  if (data.length === 0) {
    return <div className={styles.empty}>Henüz hesaplama kaydı yok</div>;
  }

  if (useBarChart) {
    const axisWidth = yAxisWidth(data);
    const rightMargin = chartRightMargin(data);
    const xMax = xAxisMaxValue(data);

    return (
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={data}
            barCategoryGap="20%"
            margin={{ top: 6, right: rightMargin, left: 4, bottom: 6 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              domain={[0, xMax]}
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={axisWidth}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ReTooltip content={<DistributionTooltip />} cursor={{ fill: "rgba(96, 165, 250, 0.12)" }} />
            <Bar dataKey="value" name="Hesaplama" barSize={BAR_SIZE} radius={[0, 4, 4, 0]}>
              {data.map((row, index) => (
                <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
              <LabelList
                dataKey="labelText"
                position="right"
                offset={8}
                style={{ fontSize: 10, fill: "#64748b" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={1}
            label={false}
            labelLine={false}
          >
            {data.map((row, index) => (
              <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <ReTooltip content={<DistributionTooltip />} />
          <ReLegend
            verticalAlign="bottom"
            layout="horizontal"
            align="center"
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            iconSize={9}
            formatter={(value, entry) => {
              const row = entry?.payload as CalculationTypeDistributionItem | undefined;
              if (!row) {
                return value;
              }
              return `${row.name} (${row.value.toLocaleString("tr-TR")} adet)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
