import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DateNavigator } from '@/components/date-navigator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { PieChart } from '@/components/pie-chart';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { PremiumGate } from '@/components/premium-gate';
import { getSalesByDate } from '@/services/sale-service';
import { getDespesas } from '@/services/despesa-service';
import { listClients } from '@/services/client-service';
import { getProdutos } from '@/services/estoque-storage';
import { formatCurrency } from '@/utils/format';

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  'cartão': 'Cartão',
  pix: 'Pix',
  fiado: 'Fiado',
};

const paymentIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  pix: 'phone-portrait-outline',
  dinheiro: 'cash-outline',
  'cartão': 'card-outline',
  fiado: 'receipt-outline',
};

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

export default function RelatoriosScreen() {
  const colors = useTheme();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [salesData, despesasData, clientsData, productsData] = await Promise.all([
      getSalesInPeriod(companyId, referenceDate),
      getDespesas(companyId),
      listClients(companyId),
      getProdutos(companyId),
    ]);
    setSales(salesData);
    setDespesas(despesasData);
    setClients(clientsData);
    setProducts(productsData);
    setLoading(false);
  }, [companyId, referenceDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  function changeMonth(delta: number) {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
  }

  const totalRevenue = useMemo(
    () => sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
    [sales],
  );

  const despesasPeriodo = useMemo(() => {
    const { start, end } = getMonthRange(referenceDate);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    return despesas.filter((d: any) => {
      const dStr = d.data.slice(0, 10);
      return dStr >= startStr && dStr <= endStr;
    });
  }, [despesas, referenceDate]);

  const totalExpenses = useMemo(
    () => despesasPeriodo.reduce((sum: number, d: any) => sum + d.valor, 0),
    [despesasPeriodo],
  );

  const profit = totalRevenue - totalExpenses;

  const totalsByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sale of sales) {
      const method = sale.paymentMethod ?? 'outros';
      map[method] = (map[method] ?? 0) + sale.totalAmount;
    }
    return map;
  }, [sales]);

  const salesByClient = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const sale of sales) {
      const clientId = sale.clientId ?? 'unknown';
      if (!map[clientId]) map[clientId] = { count: 0, total: 0 };
      map[clientId].count++;
      map[clientId].total += sale.totalAmount;
    }
    return Object.entries(map)
      .map(([clientId, data]) => {
        const client = clients.find((c: any) => c.id === clientId);
        return { clientId, name: client?.name ?? 'Sem cliente', ...data };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [sales, clients]);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of despesasPeriodo) {
      const cat = d.categoria ?? 'Outros';
      map[cat] = (map[cat] ?? 0) + d.valor;
    }
    return Object.entries(map)
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [despesasPeriodo]);

  const lowStockProducts = useMemo(
    () => products.filter((p: any) => p.estoqueAtual > 0 && p.estoqueAtual <= 1),
    [products],
  );

  const dailyRevenue = useMemo(() => {
    if (sales.length === 0) return [];
    const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
    const result: { day: number; value: number; label: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayTotal = sales
        .filter((s: any) => {
          const sd = s.createdAt?.toDate?.() ?? new Date(s.createdAt);
          return sd.getDate() === d && sd.getMonth() === referenceDate.getMonth() && sd.getFullYear() === referenceDate.getFullYear();
        })
        .reduce((sum: number, s: any) => sum + s.totalAmount, 0);
      if (dayTotal > 0) {
        result.push({ day: d, value: dayTotal, label: String(d) });
      }
    }
    return result;
  }, [sales, referenceDate]);

  const maxDailyRevenue = Math.max(...dailyRevenue.map((r) => r.value), 1);

  const methodOrder = ['dinheiro', 'pix', 'cartão', 'fiado'];

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Loading />
      </ThemedView>
    );
  }

  return (
    <PremiumGate>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >


          <DateNavigator selectedDate={referenceDate} onDateChange={changeMonth} mode="month" />

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <ThemedView style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Receitas</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#C4956A' }]}>
                {formatCurrency(totalRevenue)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{sales.length} vendas</ThemedText>
            </ThemedView>
            <ThemedView style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Despesas</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#DC2626' }]}>
                {formatCurrency(totalExpenses)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{despesasPeriodo.length} despesas</ThemedText>
            </ThemedView>
            <ThemedView style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Lucro</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: profit >= 0 ? '#C4956A' : '#DC2626' }]}>
                {formatCurrency(profit)}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Ticket Médio</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#3B82F6' }]}>
                {sales.length > 0 ? formatCurrency(totalRevenue / sales.length) : 'R$ 0,00'}
              </ThemedText>
            </ThemedView>
          </View>

          {/* Payment Methods */}
          <ThemedView style={styles.sectionGroup}>
            <ThemedText style={styles.sectionTitle}>Formas de Pagamento</ThemedText>
            <ThemedView style={styles.card}>
              <PieChart
                data={[
                  { label: 'Dinheiro', value: totalsByMethod.dinheiro ?? 0, color: '#22C55E' },
                  { label: 'Cartão', value: totalsByMethod['cartão'] ?? 0, color: '#3B82F6' },
                  { label: 'Pix', value: totalsByMethod.pix ?? 0, color: '#C4956A' },
                  { label: 'Fiado', value: totalsByMethod.fiado ?? 0, color: '#F59E0B' },
                ]}
              />
              {methodOrder.map((method) => {
                const total = totalsByMethod[method] ?? 0;
                if (total === 0 && totalsByMethod[method] === undefined) return null;
                const totalAll = Object.values(totalsByMethod).reduce((a, b) => a + b, 0);
                const pct = totalAll > 0 ? (total / totalAll) * 100 : 0;
                return (
                  <View key={method} style={styles.paymentRow}>
                    <View style={styles.paymentLeft}>
                      <Ionicons name={paymentIcons[method]} size={18} color={colors.text} />
                      <ThemedText type="default">{paymentLabels[method]}</ThemedText>
                    </View>
                    <ThemedView style={{ alignItems: 'flex-end' }}>
                      <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(total)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{pct.toFixed(1)}%</ThemedText>
                    </ThemedView>
                  </View>
                );
              })}
            </ThemedView>
          </ThemedView>

          {/* Daily Revenue Chart */}
          {dailyRevenue.length > 0 && (
            <ThemedView style={styles.sectionGroup}>
              <ThemedText style={styles.sectionTitle}>Receitas Diárias</ThemedText>
              <ThemedView style={styles.card}>
                <View style={styles.dailyChart}>
                  {dailyRevenue.map((r) => (
                    <View key={r.day} style={styles.dailyCol}>
                      <View
                        style={[
                          styles.dailyBar,
                          {
                            height: Math.max((r.value / maxDailyRevenue) * 80, 4),
                            backgroundColor: '#C4956A',
                          },
                        ]}
                      />
                      <ThemedText style={styles.dailyLabel}>{r.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </ThemedView>
            </ThemedView>
          )}

          {/* Top Clients */}
          {salesByClient.length > 0 && (
            <ThemedView style={styles.sectionGroup}>
              <ThemedText style={styles.sectionTitle}>Top Clientes</ThemedText>
              <ThemedView style={styles.card}>
                {salesByClient.map((item, idx) => (
                  <View key={item.clientId} style={styles.clientRow}>
                    <ThemedView style={styles.rankCircle}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 12 }}>{idx + 1}</ThemedText>
                    </ThemedView>
                    <ThemedView style={{ flex: 1 }}>
                      <ThemedText type="default" numberOfLines={1}>{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{item.count} compras</ThemedText>
                    </ThemedView>
                    <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(item.total)}</ThemedText>
                  </View>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {/* Expenses by Category */}
          {expensesByCategory.length > 0 && (
            <ThemedView style={styles.sectionGroup}>
              <ThemedText style={styles.sectionTitle}>Despesas por Categoria</ThemedText>
              <ThemedView style={styles.card}>
                {expensesByCategory.slice(0, 5).map((item) => {
                  const pct = totalExpenses > 0 ? (item.valor / totalExpenses) * 100 : 0;
                  return (
                    <View key={item.categoria} style={styles.expenseRow}>
                      <ThemedView style={{ flex: 1 }}>
                        <ThemedText type="default" numberOfLines={1}>{item.categoria}</ThemedText>
                        <View style={styles.expenseBarBg}>
                          <View style={[styles.expenseBarFill, { width: `${pct}%`, backgroundColor: '#DC2626' }]} />
                        </View>
                      </ThemedView>
                      <ThemedView style={{ alignItems: 'flex-end', marginLeft: Spacing.two }}>
                        <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(item.valor)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">{pct.toFixed(1)}%</ThemedText>
                      </ThemedView>
                    </View>
                  );
                })}
              </ThemedView>
            </ThemedView>
          )}

          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <ThemedView style={styles.sectionGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <Ionicons name="alert-circle" size={18} color="#F59E0B" />
                <ThemedText style={styles.sectionTitle}>Estoque Baixo</ThemedText>
              </View>
              <ThemedView style={styles.card}>
                {lowStockProducts.slice(0, 5).map((p: any) => (
                  <View key={p.id} style={styles.lowStockRow}>
                    <ThemedText style={{ flex: 1 }} numberOfLines={1}>{p.nome}</ThemedText>
                    <ThemedText
                      style={{
                        fontWeight: '700',
                        color: p.estoqueAtual <= 0 ? '#DC2626' : '#F59E0B',
                      }}
                    >
                      {p.estoqueAtual} {p.unidade}
                    </ThemedText>
                  </View>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          <View style={{ height: BottomTabInset + Spacing.five }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    gap: Spacing.three,
  },
  headerSection: {
    paddingVertical: Spacing.four,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  summaryCard: {
    width: '48%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  sectionGroup: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 1,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  dailyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 100,
  },
  dailyCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  dailyBar: {
    width: '100%',
    borderRadius: 2,
    minWidth: 4,
  },
  dailyLabel: {
    fontSize: 9,
    opacity: 0.5,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rankCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  expenseBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.1)',
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  expenseBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  lowStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
});
