import React, { useState, useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { DateNavigator } from '@/components/date-navigator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getSalesByDate, getAllSales } from '@/services/sale-service';
import { getDespesas, type Despesa } from '@/services/despesa-service';
import { formatCurrency } from '@/utils/format';

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
  const days: any[] = [];
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

function isPaid(sale: any): boolean {
  return sale.status === 'concluída' || (sale.paymentMethod && sale.paymentMethod !== 'fiado');
}

export default function FinanceiroScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [monthSales, setMonthSales] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [salesData, allSalesData, despesasData] = await Promise.all([
      getSalesInPeriod(companyId, referenceDate).catch(() => []),
      getAllSales(companyId).catch(() => []),
      getDespesas(companyId),
    ]);
    setMonthSales(salesData);
    setAllSales(allSalesData);
    setDespesas(despesasData);
    setLoading(false);
  }, [companyId, referenceDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const receitasRecebidas = useMemo(() => {
    return monthSales.filter(isPaid).reduce((sum, s) => sum + s.totalAmount, 0);
  }, [monthSales]);

  const receitasAReceber = useMemo(() => {
    return allSales
      .filter((s) => s.status !== 'concluída' && s.paymentMethod === 'fiado')
      .reduce((sum, s) => sum + (s.totalAmount - (s.paidAmount ?? 0)), 0);
  }, [allSales]);

  const despesasPeriodo = useMemo(() => filterDespesasByPeriod(despesas, referenceDate), [despesas, referenceDate]);
  const despesasPagas = useMemo(() =>
    despesasPeriodo.filter((d) => !d.vencimento).reduce((s, d) => s + d.valor, 0),
  [despesasPeriodo]);
  const despesasAPagar = useMemo(() =>
    despesasPeriodo.filter((d) => d.vencimento).reduce((s, d) => s + d.valor, 0),
  [despesasPeriodo]);

  const dailyRevenue = useMemo(() => {
    if (monthSales.length === 0) return [];
    const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
    const result: { day: number; value: number; label: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), d);
      const dayTotal = monthSales
        .filter((s) => {
          const sd = s.createdAt?.toDate?.() ?? new Date();
          return sd.getDate() === d && sd.getMonth() === referenceDate.getMonth() && sd.getFullYear() === referenceDate.getFullYear();
        })
        .reduce((sum: number, s: any) => sum + s.totalAmount, 0);
      if (dayTotal > 0) {
        const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        result.push({ day: d, value: dayTotal, label: weekDays[day.getDay()] });
      }
    }
    return result;
  }, [monthSales, referenceDate]);

  const maxDailyRevenue = Math.max(...dailyRevenue.map((r) => r.value), 1);

  const descontoTotal = useMemo(
    () => monthSales.reduce((sum, s) => sum + (s.desconto ?? 0), 0),
    [monthSales],
  );

  const lucroRealizado = receitasRecebidas - despesasPagas;

  const boletosPendentes = useMemo(() => {
    const now = new Date();
    return despesas
      .filter((d) => d.vencimento)
      .map((d) => {
        const [dd, mm, yyyy] = d.vencimento!.split('/').map(Number);
        const vencDate = new Date(yyyy, mm - 1, dd);
        const vencido = vencDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { ...d, vencido };
      })
      .sort((a, b) => {
        const aVenc = a.vencimento!.split('/').reverse().join('-');
        const bVenc = b.vencimento!.split('/').reverse().join('-');
        return aVenc.localeCompare(bVenc);
      });
  }, [despesas]);

  function changeMonth(delta: number) {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
  }

  const cards = [
    { key: 'recebidas', label: 'Receitas Recebidas', value: receitasRecebidas, color: '#C4956A' },
    { key: 'areceber', label: 'Receitas a Receber', value: receitasAReceber, color: '#F59E0B' },
    { key: 'despesas', label: 'Despesas Pagas', value: despesasPagas, color: '#DC2626' },
    { key: 'apagar', label: 'Despesas a Pagar', value: despesasAPagar, color: '#6B7280', route: '/pagamentos' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {loading ? <Loading /> : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <DateNavigator selectedDate={referenceDate} onDateChange={changeMonth} mode="month" />

            {/* Faturamento */}
            <ThemedView style={[styles.lucroCard, { backgroundColor: lucroRealizado >= 0 ? '#C4956A' : '#DC2626' }]}>
              <View style={styles.lucroCardDecor}>
                <View style={styles.lucroDecorCircle1} />
                <View style={styles.lucroDecorCircle2} />
              </View>
              <ThemedText style={styles.lucroLabel}>Faturamento</ThemedText>
              <ThemedText style={styles.lucroValue}>{formatCurrency(lucroRealizado)}</ThemedText>
              <ThemedText style={styles.lucroSub}>Total de receitas do período</ThemedText>
            </ThemedView>

            {/* Summary Cards */}
            <ThemedView style={styles.cardsGrid}>
              {cards.map((card) => (
                <Pressable
                  key={card.key}
                  onPress={() => router.push((card as any).route || '/financeiro-detalhe?type=' + card.key)}
                  style={styles.card}
                >
                  <ThemedText style={[styles.cardLabel, { color: card.color }]}>{card.label}</ThemedText>
                  <ThemedText style={[styles.cardValue, { color: card.color }]}>
                    {formatCurrency(card.value)}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>

            {descontoTotal > 0 && (
              <ThemedView style={[styles.card, { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <ThemedView>
                  <ThemedText style={[styles.cardLabel, { color: '#EF4444' }]}>Descontos Concedidos</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Total de descontos no período</ThemedText>
                </ThemedView>
                <ThemedText style={[styles.cardValue, { color: '#EF4444' }]}>
                  -{formatCurrency(descontoTotal)}
                </ThemedText>
              </ThemedView>
            )}

            {/* Boletos Pendentes */}
            {boletosPendentes.length > 0 && (
              <ThemedView style={styles.sectionGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                  <ThemedText style={styles.sectionTitle}>Boletos Pendentes</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600' }}>
                    {formatCurrency(boletosPendentes.reduce((s, d) => s + d.valor, 0))}
                  </ThemedText>
                </View>
                <ThemedView style={styles.chartCard}>
                  {boletosPendentes.map((boleto) => (
                    <View key={boleto.id} style={styles.debtRow}>
                      <ThemedView style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                          {boleto.descricao}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{ color: boleto.vencido ? '#DC2626' : undefined }}
                        >
                          Vence {boleto.vencimento}{boleto.vencido ? ' (vencido)' : ''}
                        </ThemedText>
                      </ThemedView>
                      <ThemedText style={{ fontWeight: '700', fontSize: 14, color: boleto.vencido ? '#DC2626' : '#F59E0B' }}>
                        {formatCurrency(boleto.valor)}
                      </ThemedText>
                    </View>
                  ))}
                </ThemedView>
              </ThemedView>
            )}

            {/* A Receber vs A Pagar */}
            {(receitasAReceber > 0 || despesasAPagar > 0) && (
              <ThemedView style={styles.sectionGroup}>
                <ThemedText style={styles.sectionTitle}>A Receber vs A Pagar</ThemedText>
                <ThemedView style={styles.chartCard}>
                  <View style={styles.barStack}>
                    <View style={{ flex: receitasAReceber || 1 }}>
                      <View style={[styles.barSegment, { backgroundColor: '#F59E0B', height: 8, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }]} />
                    </View>
                    <View style={{ flex: despesasAPagar || 1 }}>
                      <View style={[styles.barSegment, { backgroundColor: '#6B7280', height: 8 }]} />
                    </View>
                  </View>
                  <View style={styles.barLegend}>
                    <ThemedText style={styles.legendItem}>
                      <ThemedText style={{ color: '#F59E0B', fontWeight: '600' }}>●</ThemedText> A Receber {formatCurrency(receitasAReceber)}
                    </ThemedText>
                    <ThemedText style={styles.legendItem}>
                      <ThemedText style={{ color: '#6B7280', fontWeight: '600' }}>●</ThemedText> A Pagar {formatCurrency(despesasAPagar)}
                    </ThemedText>
                  </View>
                </ThemedView>
              </ThemedView>
            )}

            {/* Gráfico de Receitas vs Despesas */}
            {(receitasRecebidas > 0 || despesasPagas > 0) && (
              <ThemedView style={styles.sectionGroup}>
                <ThemedText style={styles.sectionTitle}>Receitas vs Despesas</ThemedText>
                <ThemedView style={styles.chartCard}>
                  <View style={styles.barStack}>
                    <View style={{ flex: receitasRecebidas || 1 }}>
                      <View style={[styles.barSegment, { backgroundColor: '#C4956A', height: 8, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }]} />
                    </View>
                    <View style={{ flex: despesasPagas || 1 }}>
                      <View style={[styles.barSegment, { backgroundColor: '#DC2626', height: 8 }]} />
                    </View>
                  </View>
                  <View style={styles.barLegend}>
                    <ThemedText style={styles.legendItem}>
                      <ThemedText style={{ color: '#C4956A', fontWeight: '600' }}>●</ThemedText> Receitas {formatCurrency(receitasRecebidas)}
                    </ThemedText>
                    <ThemedText style={styles.legendItem}>
                      <ThemedText style={{ color: '#DC2626', fontWeight: '600' }}>●</ThemedText> Despesas {formatCurrency(despesasPagas)}
                    </ThemedText>
                  </View>
                </ThemedView>
              </ThemedView>
            )}

            {/* Gráfico de Receitas Diárias */}
            {dailyRevenue.length > 0 && (
              <ThemedView style={styles.sectionGroup}>
                <ThemedText style={styles.sectionTitle}>Receitas Diárias</ThemedText>
                <ThemedView style={styles.chartCard}>
                  <View style={styles.chartBars}>
                    {dailyRevenue.map((r, idx) => (
                      <View key={r.day} style={styles.chartCol}>
                        <ThemedText style={styles.chartValue}>{formatCurrency(r.value)}</ThemedText>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: Math.max((r.value / maxDailyRevenue) * 85, 3),
                              backgroundColor: idx === dailyRevenue.length - 1 ? '#C4956A' : theme.textSecondary,
                            },
                          ]}
                        />
                        <ThemedText style={styles.chartLabel}>{r.label}</ThemedText>
                      </View>
                    ))}
                  </View>
                </ThemedView>
              </ThemedView>
            )}

            <View style={{ height: 80 }} />
          </ScrollView>
        )}

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

  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    width: '48%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  cardLabel: { fontSize: 12, fontWeight: '600' },
  cardValue: { fontSize: 20, fontWeight: '700' },

  lucroCard: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  lucroCardDecor: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 120,
    height: 120,
  },
  lucroDecorCircle1: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  lucroDecorCircle2: {
    position: 'absolute',
    right: 30,
    top: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lucroLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  lucroValue: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
    color: '#fff',
  },
  lucroSub: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginTop: Spacing.half, textAlign: 'center' },

  sectionGroup: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 1,
  },
  chartCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  barStack: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden' },
  barSegment: { borderRadius: 0 },
  barLegend: { flexDirection: 'row', gap: Spacing.four },
  legendItem: { fontSize: 12 },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
  },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.one },
  chartBar: { width: 24, borderRadius: Spacing.one },
  chartLabel: { fontSize: 11, lineHeight: 14, opacity: 0.5 },
  chartValue: { fontSize: 9, fontWeight: '600', opacity: 0.6, marginBottom: 2 },

  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },

  emptyText: { fontSize: 14, opacity: 0.5, textAlign: 'center', paddingVertical: Spacing.six },

});
