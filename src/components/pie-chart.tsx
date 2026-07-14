import { View, StyleSheet } from 'react-native';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';

type Slice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  data: Slice[];
  size?: number;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export function PieChart({ data, size = 140 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  let currentAngle = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const sliceAngle = (d.value / total) * 360;
      const path = describeArc(cx, cy, r, currentAngle, currentAngle + sliceAngle);
      const midAngle = currentAngle + sliceAngle / 2;
      const mid = polarToCartesian(cx, cy, r * 0.65, midAngle);
      currentAngle += sliceAngle;
      return { ...d, path, labelPos: mid, pct: ((d.value / total) * 100).toFixed(1) };
    });

  return (
    <ThemedView style={styles.container}>
      <View style={styles.chartWrapper}>
        <Svg width={size} height={size}>
          <G>
            {slices.map((s, i) => (
              <Path key={i} d={s.path} fill={s.color} />
            ))}
          </G>
          {slices.map((s, i) => (
            <SvgText
              key={`l-${i}`}
              x={s.labelPos.x}
              y={s.labelPos.y + 1}
              fill="#fff"
              fontSize={10}
              fontWeight="700"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {s.pct}%
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={styles.legend}>
        {slices.map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <ThemedText style={styles.legendLabel}>{s.label}</ThemedText>
            <ThemedText style={styles.legendValue}>{s.pct}%</ThemedText>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    gap: Spacing.two,
    flex: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    flex: 1,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
