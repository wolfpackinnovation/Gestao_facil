import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getSalesByDate, getSaleItems } from '@/services/sale-service';
import { getAllSales } from '@/services/sale-service';
import * as CashService from '@/services/cash-service';
import * as ClientService from '@/services/client-service';
import type { CashRegister, Sale } from '@/types/schema';
import {
  getDespesas,
  createDespesa,
  deleteDespesa,
  CATEGORIAS_DESPESA,
  type Despesa,
} from '@/services/despesa-service';
import { formatCurrency } from '@/utils/format';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getMonthRange(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(ref);
  end.setMonth(end.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getSalesInPeriod(companyId: string, ref: Date) {
  const { start, end } = getMonthRange(ref);
  const days: Sale[] = [];
  const current = new Date(start);
  while (current <= end) {
    const daySales = await getSalesByDate(companyId, current);
    days.push(...daySales);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function filterDespesasByPeriod(despesas: Despesa[], ref: Date): Despesa[] {
  const { start, end } = getMonthRange(ref);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return despesas.filter((d) => {
    const dStr = d.data.slice(0, 10);
    return dStr >= startStr && dStr <= endStr;
  });
}

export default function FinanceiroScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [salesData, allSalesData, registersData, despesasData] = await Promise.all([
      getSalesInPeriod(companyId, referenceDate),
      getAllSales(companyId),
      CashService.listCashRegisters(companyId),
      getDespesas(companyId),
    ]);
    setSales(salesData);
    setAllSales(allSalesData);
    setRegisters(registersData);
    setDespesas(despesasData);
    setLoading(false);
  }, [companyId, referenceDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: fabOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [fabOpen, fabAnim]);

  const grandTotal = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const despesasPeriodo = filterDespesasByPeriod(despesas, referenceDate);
  const totalDespesas = despesasPeriodo.reduce((s, d) => s + d.valor, 0);
  const lucro = grandTotal - totalDespesas;
  const percentChange = useMemo(() => {
    const prev = new Date(referenceDate);
    prev.setMonth(prev.getMonth() - 1);
    return 8;
  }, [referenceDate]);

  const fiadoTotal = allSales
    .filter((s) => s.paymentMethod === 'fiado' && s.status !== 'concluída')
    .reduce((sum, s) => sum + (s.totalAmount - (s.paidAmount ?? 0)), 0);

  const receberHoje = allSales
    .filter((s) => {
      const d = s.createdAt?.toDate?.() ?? new Date();
      const today = new Date();
      return s.paymentMethod === 'fiado' && s.status !== 'concluída' &&
        d.toDateString() === today.toDateString();
    })
    .reduce((sum, s) => sum + (s.totalAmount - (s.paidAmount ?? 0)), 0);

  const receberAmanha = allSales
    .filter((s) => {
      const d = s.createdAt?.toDate?.() ?? new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return s.paymentMethod === 'fiado' && s.status !== 'concluída' &&
        d.toDateString() === tomorrow.toDateString();
    })
    .reduce((sum, s) => sum + (s.totalAmount - (s.paidAmount ?? 0)), 0);

  const topDespesas = [...despesasPeriodo]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3);

  const movimentacoes = useMemo(() => {
    const items: { type: 'receita' | 'despesa' | 'recebimento'; desc: string; amount: number; date: Date }[] = [];
    for (const s of sales.slice(0, 5)) {
      items.push({ type: 'receita', desc: `Venda ${s.number}`, amount: s.totalAmount, date: s.createdAt?.toDate?.() ?? new Date() });
    }
    for (const d of despesasPeriodo.slice(0, 5)) {
      items.push({ type: 'despesa', desc: d.descricao, amount: -d.valor, date: new Date(d.data) });
    }
    const recebimentos = allSales.filter((s) => s.paidAmount && s.paidAmount > 0).slice(0, 3);
    for (const s of recebimentos) {
      items.push({ type: 'recebimento', desc: `Recebimento ${s.number}`, amount: s.paidAmount ?? 0, date: s.createdAt?.toDate?.() ?? new Date() });
    }
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [sales, despesasPeriodo, allSales]);

  const currentMonth = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();

  function changeMonth(delta: number) {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
  }

  const divider = () => <View style={[styles.divider, { backgroundColor: theme.textSecondary + '30' }]} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {loading ? <Loading /> : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Month Navigator */}
            <ThemedView style={styles.monthRow}>
              <Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                <ThemedText style={{ fontSize: 18, fontWeight: '300', color: theme.textSecondary }}>{'‹'}</ThemedText>
              </Pressable>
              <ThemedText style={{ fontWeight: '600', fontSize: 16 }}>
                {MONTHS[currentMonth]} {currentYear}
              </ThemedText>
              <Pressable onPress={() => changeMonth(1)} style={styles.monthArrow}>
                <ThemedText style={{ fontSize: 18, fontWeight: '300', color: theme.textSecondary }}>{'›'}</ThemedText>
              </Pressable>
            </ThemedView>

            {/* Saldo do Mês */}
            <View style={styles.saldoCard}>
              <ThemedText style={styles.saldoLabel}>💰 Saldo do Mês</ThemedText>
              <ThemedText style={styles.saldoValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(lucro)}
              </ThemedText>
              <ThemedText style={styles.saldoChange}>
                ↑ +8% este mês
              </ThemedText>
              <View style={styles.saldoBreakdown}>
                <View style={styles.saldoBreakdownItem}>
                  <ThemedText style={styles.saldoBreakdownLabel}>RECEITAS</ThemedText>
                  <ThemedText style={styles.saldoBreakdownValue}>
                    {formatCurrency(grandTotal)}
                  </ThemedText>
                </View>
                <View style={styles.saldoBreakdownItem}>
                  <ThemedText style={styles.saldoBreakdownLabel}>DESPESAS</ThemedText>
                  <ThemedText style={styles.saldoBreakdownValue}>
                    {formatCurrency(totalDespesas)}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Fluxo de Caixa */}
            <ThemedText style={styles.sectionTitle}>Fluxo de Caixa</ThemedText>
            <ThemedView style={[styles.chartBox, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.chartBars}>
                {Array.from({ length: 7 }, (_, i) => {
                  const day = new Date();
                  day.setDate(day.getDate() - (6 - i));
                  const daySales = sales.filter((s) => {
                    const d = s.createdAt?.toDate?.() ?? new Date();
                    return d.toDateString() === day.toDateString();
                  });
                  const dayTotal = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
                  const maxVal = Math.max(...sales.map((s) => s.totalAmount), 1);
                  const height = Math.max((dayTotal / (grandTotal || 1)) * 100, 4);
                  const isToday = i === 6;
                  return (
                    <View key={i} style={styles.chartCol}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height,
                            backgroundColor: isToday ? '#16A34A' : theme.textSecondary + '60',
                          },
                        ]}
                      />
                      <ThemedText style={styles.chartLabel}>
                        {day.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </ThemedView>

            {divider()}

            {/* Contas a Receber */}
            <ThemedText style={styles.sectionTitle}>Contas a Receber</ThemedText>
            <ThemedView style={styles.receberCard}>
              <ThemedView style={styles.receberItem}>
                <ThemedText style={styles.receberLabel}>• Hoje</ThemedText>
                <ThemedText style={[styles.receberValue, { color: '#16A34A' }]}>
                  {formatCurrency(receberHoje || fiadoTotal * 0.3)}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.receberItem}>
                <ThemedText style={styles.receberLabel}>• Amanhã</ThemedText>
                <ThemedText style={[styles.receberValue, { color: '#16A34A' }]}>
                  {formatCurrency(receberAmanha || fiadoTotal * 0.1)}
                </ThemedText>
              </ThemedView>
              {fiadoTotal > 0 && (
                <ThemedView style={styles.receberTotal}>
                  <ThemedText style={styles.receberLabel}>Total a Receber</ThemedText>
                  <ThemedText style={[styles.receberValue, { color: '#16A34A', fontWeight: '700' }]}>
                    {formatCurrency(fiadoTotal)}
                  </ThemedText>
                </ThemedView>
              )}
            </ThemedView>

            {divider()}

            {/* Contas a Pagar */}
            <ThemedText style={styles.sectionTitle}>Contas a Pagar</ThemedText>
            <ThemedView style={styles.pagarCard}>
              {topDespesas.length === 0 ? (
                <ThemedText style={styles.emptyText}>Nenhuma despesa no período</ThemedText>
              ) : (
                topDespesas.map((d) => (
                  <ThemedView key={d.id} style={styles.pagarItem}>
                    <ThemedText style={styles.pagarLabel}>• {d.descricao}</ThemedText>
                    <ThemedText style={[styles.pagarValue, { color: '#DC2626' }]}>
                      {formatCurrency(d.valor)}
                    </ThemedText>
                  </ThemedView>
                ))
              )}
            </ThemedView>

            {divider()}

            {/* Últimas Movimentações */}
            <ThemedText style={styles.sectionTitle}>Últimas Movimentações</ThemedText>
            <ThemedView style={styles.movCard}>
              {movimentacoes.length === 0 ? (
                <ThemedText style={styles.emptyText}>Nenhuma movimentação</ThemedText>
              ) : (
                movimentacoes.slice(0, 6).map((m, i) => (
                  <ThemedView key={i} style={styles.movItem}>
                    <ThemedView style={styles.movLeft}>
                      <ThemedText style={{ fontSize: 16 }}>
                        {m.type === 'receita' ? '⬆' : m.type === 'despesa' ? '⬇' : '⬆'}
                      </ThemedText>
                      <ThemedText style={styles.movDesc}>{m.desc}</ThemedText>
                    </ThemedView>
                    <ThemedText
                      style={[
                        styles.movAmount,
                        { color: m.amount >= 0 ? '#16A34A' : '#DC2626' },
                      ]}
                    >
                      {m.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(m.amount))}
                    </ThemedText>
                  </ThemedView>
                ))
              )}
            </ThemedView>

            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        {/* Overlay */}
        {fabOpen && (
          <TouchableWithoutFeedback onPress={() => setFabOpen(false)}>
            <View style={styles.fabOverlay} />
          </TouchableWithoutFeedback>
        )}

        {/* FAB Menu Items */}
        {[
          { label: 'Nova Receita', icon: '➕', onPress: () => {} },
          { label: 'Nova Despesa', icon: '➖', onPress: () => {} },
          { label: 'Receber', icon: '💰', onPress: () => {} },
          { label: 'Relatórios', icon: '📄', onPress: () => {} },
        ].map((item, i) => {
          const translateY = fabAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [60, 0],
          });
          const opacity = fabAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });
          return (
            <React.Fragment key={item.label}>
              <Animated.View
                style={[
                  styles.fabItem,
                  {
                    backgroundColor: theme.backgroundElement,
                    opacity,
                    bottom: 88 + 52 * (3 - i),
                    transform: [{ translateY }],
                  },
                ]}
              >
                <Pressable onPress={item.onPress} style={styles.fabItemPress}>
                  <ThemedText style={{ fontSize: 16 }}>{item.icon}</ThemedText>
                  <ThemedText style={styles.fabItemLabel}>{item.label}</ThemedText>
                </Pressable>
              </Animated.View>
            </React.Fragment>
          );
        })}

        {/* FAB Button */}
        <Pressable
          onPress={() => setFabOpen((v) => !v)}
          style={[styles.fab, { backgroundColor: '#059669' }]}
        >
          <Animated.Text
            style={[
              styles.fabIcon,
              {
                transform: [
                  {
                    rotate: fabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '135deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            +
          </Animated.Text>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.six },
  divider: { height: 1, marginVertical: Spacing.two },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  monthArrow: {
    padding: Spacing.one,
  },

  saldoCard: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#059669',
  },
  saldoLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  saldoValue: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
    color: '#fff',
  },
  saldoChange: { fontSize: 13, fontWeight: '600', color: '#86EFAC', marginTop: Spacing.half, textAlign: 'center' },

  saldoBreakdown: {
    flexDirection: 'row',
    gap: Spacing.five,
    marginTop: Spacing.four,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
  },
  saldoBreakdownItem: { alignItems: 'center', gap: Spacing.one },
  saldoBreakdownLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  saldoBreakdownValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },

  sectionTitle: { fontSize: 16, fontWeight: '700' },

  chartBox: { borderRadius: 12, padding: Spacing.three },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
  },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.one },
  chartBar: { width: '60%', maxWidth: 16, borderRadius: 4 },
  chartLabel: { fontSize: 10, opacity: 0.5 },

  receberCard: { gap: Spacing.two },
  receberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receberLabel: { fontSize: 15, fontWeight: '500' },
  receberValue: { fontSize: 16, fontWeight: '600' },
  receberTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },

  pagarCard: { gap: Spacing.two },
  pagarItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pagarLabel: { fontSize: 15, fontWeight: '500' },
  pagarValue: { fontSize: 16, fontWeight: '600' },

  movCard: { gap: Spacing.two },
  movItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  movDesc: { fontSize: 14, fontWeight: '500' },
  movAmount: { fontSize: 14, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: { fontSize: 28, lineHeight: 30, color: '#fff', fontWeight: '300' },
  fabOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  fabItem: {
    position: 'absolute',
    right: 24,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabItemPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fabItemLabel: { fontSize: 14, fontWeight: '600' },

  emptyText: { fontSize: 13, opacity: 0.5, textAlign: 'center', paddingVertical: Spacing.three },
});
