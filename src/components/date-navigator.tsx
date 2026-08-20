import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatMonth(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

interface DateNavigatorProps {
  selectedDate: Date;
  onDateChange: (delta: number) => void;
  today?: Date;
  mode?: 'day' | 'month';
}

export function DateNavigator({ selectedDate, onDateChange, today, mode = 'day' }: DateNavigatorProps) {
  const theme = useTheme();
  const referenceDate = today ?? new Date();
  const isToday = mode === 'day' && selectedDate.toDateString() === referenceDate.toDateString();
  const canAdvance = mode === 'month' || !isToday;

  return (
    <ThemedView style={styles.container}>
      <Pressable onPress={() => onDateChange(-1)} style={styles.arrow}>
        <ThemedText style={{ fontSize: 24, fontWeight: '300', color: theme.textSecondary }}>{'‹'}</ThemedText>
      </Pressable>
      <ThemedView style={{ alignItems: 'center', gap: 2 }}>
        <ThemedText style={styles.dateText}>
          {mode === 'month' ? formatMonth(selectedDate) : formatDate(selectedDate)}
        </ThemedText>
        {isToday && (
          <ThemedText type="small" themeColor="textSecondary">Hoje</ThemedText>
        )}
      </ThemedView>
      <Pressable onPress={() => onDateChange(1)} disabled={!canAdvance} style={styles.arrow}>
        <ThemedText style={{ fontSize: 24, fontWeight: '300', color: theme.textSecondary, opacity: canAdvance ? 1 : 0.3 }}>{'›'}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
    paddingVertical: Spacing.one,
  },
  arrow: {
    padding: Spacing.two,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
});
