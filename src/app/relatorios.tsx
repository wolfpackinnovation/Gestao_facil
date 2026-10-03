import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { getAllSales, getSaleItems } from '@/services/sale-service';
import { getDespesas } from '@/services/despesa-service';
import { listClients } from '@/services/client-service';
import { getProdutos } from '@/services/estoque-storage';
import { getMaterials } from '@/services/material-service';
import { listAllLoteMovimentos } from '@/services/lote-service';
import { formatCurrency } from '@/utils/format';
import { convertToBase } from '@/utils/units';

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

export default function RelatoriosScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [prevSales, setPrevSales] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topProductsRevenue, setTopProductsRevenue] = useState<any[]>([]);
  const [totalFiados, setTotalFiados] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [allSalesData, despesasData, clientsData, productsData, materialsData, movimentosData] = await Promise.all([
      getAllSales(companyId),
      getDespesas(companyId),
      listClients(companyId),
      getProdutos(companyId),
      getMaterials(companyId),
      listAllLoteMovimentos(companyId).catch(() => []),
    ]);

    const { start, end } = getMonthRange(referenceDate);
    const startMs = start.getTime();
    const endMs = end.getTime();
    
    const salesData = allSalesData.filter((s: any) => {
      const d = s.createdAt?.toDate?.()?.getTime() ?? new Date(s.createdAt).getTime();
      return d >= startMs && d <= endMs;
    });

    const prevMonthDate = new Date(referenceDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const { start: pStart, end: pEnd } = getMonthRange(prevMonthDate);
    const prevSalesData = allSalesData.filter((s: any) => {
      const d = s.createdAt?.toDate?.()?.getTime() ?? new Date(s.createdAt).getTime();
      return d >= pStart.getTime() && d <= pEnd.getTime();
    });

    const fiadosSum = allSalesData
      .filter((s: any) => s.paymentMethod === 'fiado' && s.status !== 'concluída')
      .reduce((sum: number, s: any) => sum + (s.totalAmount - (s.paidAmount ?? 0)), 0);

    const itemsPromises = salesData.map((s: any) => s.id ? getSaleItems(s.id) : Promise.resolve([]));
    const allItems = (await Promise.all(itemsPromises)).flat();

    const pCounts: Record<string, number> = {};
    const pRevenue: Record<string, number> = {};
    for (const item of allItems) {
      if (item.productId) {
        pCounts[item.productId] = (pCounts[item.productId] ?? 0) + item.quantity;
        pRevenue[item.productId] = (pRevenue[item.productId] ?? 0) + item.subtotal;
      }
    }

    const pMap = new Map(productsData.map((p: any) => [p.id, p.nome]));
    const topProd = Object.entries(pCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        name: pMap.get(id) ?? 'Produto desconhecido',
        count,
      }));

    const topProdRev = Object.entries(pRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, rev]) => ({
        name: pMap.get(id) ?? 'Produto desconhecido',
        revenue: rev,
      }));

    setSales(salesData);
    setPrevSales(prevSalesData);
    setDespesas(despesasData);
    setClients(clientsData);
    setProducts(productsData);
    setMaterials(materialsData);
    setMovimentos(movimentosData);
    setTopProducts(topProd);
    setTopProductsRevenue(topProdRev);
    setTotalFiados(fiadosSum);
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

  const prevTotalRevenue = useMemo(
    () => prevSales.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
    [prevSales],
  );

  const despesasPeriodo = useMemo(() => {
    const refMonth = referenceDate.getMonth();
    const refYear = referenceDate.getFullYear();

    return despesas.filter((d: any) => {
      if (d.vencimento) {
        const parts = d.vencimento.split('/');
        if (parts.length === 3) {
          const [dd, mm, yyyy] = parts.map(Number);
          return mm - 1 === refMonth && yyyy === refYear;
        }
      }
      const dataParts = d.data?.slice(0, 10).split('-') || [];
      if (dataParts.length === 3) {
        const [yyyy, mm, dd] = dataParts.map(Number);
        return mm - 1 === refMonth && yyyy === refYear;
      }
      return false;
    });
  }, [despesas, referenceDate]);

  const prevDespesasPeriodo = useMemo(() => {
    const prev = new Date(referenceDate);
    prev.setMonth(prev.getMonth() - 1);
    const refMonth = prev.getMonth();
    const refYear = prev.getFullYear();

    return despesas.filter((d: any) => {
      if (d.vencimento) {
        const parts = d.vencimento.split('/');
        if (parts.length === 3) {
          const [dd, mm, yyyy] = parts.map(Number);
          return mm - 1 === refMonth && yyyy === refYear;
        }
      }
      const dataParts = d.data?.slice(0, 10).split('-') || [];
      if (dataParts.length === 3) {
        const [yyyy, mm, dd] = dataParts.map(Number);
        return mm - 1 === refMonth && yyyy === refYear;
      }
      return false;
    });
  }, [despesas, referenceDate]);

  const totalExpenses = useMemo(
    () => despesasPeriodo.reduce((sum: number, d: any) => sum + d.valor, 0),
    [despesasPeriodo],
  );

  const prevTotalExpenses = useMemo(
    () => prevDespesasPeriodo.reduce((sum: number, d: any) => sum + d.valor, 0),
    [prevDespesasPeriodo],
  );

  const totalMaterialValue = useMemo(() => {
    // precoCompra já é o valor total investido no estoque atual
    return materials.reduce((sum, m) => sum + (m.precoCompra || 0), 0);
  }, [materials]);

  const totalProductValue = useMemo(() => {
    return products.reduce((sum, p) => {
      const qty = Math.max(0, p.estoqueAtual || 0);
      return sum + (qty * (p.precoVenda || 0));
    }, 0);
  }, [products]);

  const totalPerdas = useMemo(() => {
    return movimentos.reduce((sum, mov) => {
      const d = mov.createdAt?.toDate ? mov.createdAt.toDate() : new Date(mov.createdAt);
      if (d.getMonth() === referenceDate.getMonth() && d.getFullYear() === referenceDate.getFullYear()) {
        if (mov.quantidade < 0 && (mov.tipo === 'perda' || mov.tipo === 'ajuste')) {
          const prod = products.find(p => p.id === mov.productId);
          const cost = mov.custoUnitario || prod?.custoPorUnidade || prod?.custo || 0;
          return sum + (Math.abs(mov.quantidade) * cost);
        }
      }
      return sum;
    }, 0);
  }, [movimentos, referenceDate, products]);

  const profit = totalRevenue - totalExpenses;
  const prevProfit = prevTotalRevenue - prevTotalExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  
  const revenueGrowth = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : (totalRevenue > 0 ? 100 : 0);
  const profitGrowth = prevProfit > 0 ? ((profit - prevProfit) / prevProfit) * 100 : (profit > 0 ? 100 : 0);

  const salesByDayOfWeek = useMemo(() => {
    const map: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const sale of sales) {
      const d = sale.createdAt?.toDate?.() ?? new Date(sale.createdAt);
      map[d.getDay()] += sale.totalAmount;
    }
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return Object.entries(map)
      .map(([dayIdx, total]) => ({ day: days[Number(dayIdx)], total }))
      .sort((a, b) => b.total - a.total);
  }, [sales]);

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
        return { clientId, name: client?.name ?? 'Cliente Avulso', ...data };
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
            <Pressable onPress={() => router.push('/financeiro-detalhe?type=recebidas')} style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Receitas</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#C4956A' }]}>
                {formatCurrency(totalRevenue)}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={revenueGrowth >= 0 ? 'arrow-up' : 'arrow-down'} size={12} color={revenueGrowth >= 0 ? '#10B981' : '#DC2626'} />
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.abs(revenueGrowth).toFixed(1)}% vs. mês ant.
                </ThemedText>
              </View>
            </Pressable>
            <Pressable onPress={() => router.push('/financeiro-detalhe?type=despesas')} style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Despesas</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#DC2626' }]}>
                {formatCurrency(totalExpenses)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{despesasPeriodo.length} despesas</ThemedText>
            </Pressable>
            <ThemedView style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Lucro</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: profit >= 0 ? '#C4956A' : '#DC2626' }]}>
                {formatCurrency(profit)}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={profitGrowth >= 0 ? 'arrow-up' : 'arrow-down'} size={12} color={profitGrowth >= 0 ? '#10B981' : '#DC2626'} />
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.abs(profitGrowth).toFixed(1)}% vs. mês ant.
                </ThemedText>
              </View>
            </ThemedView>
            <ThemedView style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Margem Líquida</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: profitMargin >= 0 ? '#10B981' : '#DC2626' }]}>
                {profitMargin.toFixed(1)}%
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Lucro final no bolso</ThemedText>
            </ThemedView>
            <Pressable onPress={() => router.push('/financeiro-detalhe?type=areceber')} style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Fiados Pendentes</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#F59E0B' }]}>
                {formatCurrency(totalFiados)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Total a receber</ThemedText>
            </Pressable>
            <ThemedView style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Ticket Médio</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#3B82F6' }]}>
                {sales.length > 0 ? formatCurrency(totalRevenue / sales.length) : 'R$ 0,00'}
              </ThemedText>
            </ThemedView>
            <Pressable onPress={() => router.push('/financeiro-detalhe?type=materiais')} style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Valor em Estoque</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#10B981' }]}>
                {formatCurrency(totalMaterialValue)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Dinheiro investido</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/financeiro-detalhe?type=produtos')} style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Valor em Produtos</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#8B5CF6' }]}>
                {formatCurrency(totalProductValue)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Lucro potencial bruto</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/financeiro-detalhe?type=perdas')} style={styles.summaryCard}>
              <ThemedText type="small" themeColor="textSecondary">Perdas</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#DC2626' }]}>
                {formatCurrency(totalPerdas)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Prejuízo com desperdício</ThemedText>
            </Pressable>
          </View>

          {/* Payment Methods */}
          {totalRevenue > 0 && (
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
          )}

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

          {/* Top Days of Week */}
          {salesByDayOfWeek.some(d => d.total > 0) && (
            <ThemedView style={styles.sectionGroup}>
              <ThemedText style={styles.sectionTitle}>Dias Mais Fortes da Semana</ThemedText>
              <ThemedView style={styles.card}>
                {salesByDayOfWeek.filter(d => d.total > 0).slice(0, 5).map((item, idx) => (
                  <View key={item.day} style={styles.clientRow}>
                    <ThemedView style={styles.rankCircle}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 12 }}>{idx + 1}</ThemedText>
                    </ThemedView>
                    <ThemedView style={{ flex: 1 }}>
                      <ThemedText type="default" numberOfLines={1}>{item.day}</ThemedText>
                    </ThemedView>
                    <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(item.total)}</ThemedText>
                  </View>
                ))}
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

          {/* Top Products */}
          {topProducts.length > 0 && (
            <ThemedView style={styles.sectionGroup}>
              <ThemedText style={styles.sectionTitle}>Produtos Mais Vendidos (Qtd)</ThemedText>
              <ThemedView style={styles.card}>
                {topProducts.map((p, idx) => (
                  <View key={p.name + idx} style={styles.clientRow}>
                    <ThemedView style={styles.rankCircle}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 12 }}>{idx + 1}</ThemedText>
                    </ThemedView>
                    <ThemedView style={{ flex: 1 }}>
                      <ThemedText type="default" numberOfLines={1}>{p.name}</ThemedText>
                    </ThemedView>
                    <ThemedText style={{ fontWeight: '700' }}>{p.count} unid.</ThemedText>
                  </View>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {/* Top Products Revenue */}
          {topProductsRevenue.length > 0 && (
            <ThemedView style={styles.sectionGroup}>
              <ThemedText style={styles.sectionTitle}>Produtos Mais Rentáveis</ThemedText>
              <ThemedView style={styles.card}>
                {topProductsRevenue.map((p, idx) => (
                  <View key={p.name + idx} style={styles.clientRow}>
                    <ThemedView style={styles.rankCircle}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 12 }}>{idx + 1}</ThemedText>
                    </ThemedView>
                    <ThemedView style={{ flex: 1 }}>
                      <ThemedText type="default" numberOfLines={1}>{p.name}</ThemedText>
                    </ThemedView>
                    <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(p.revenue)}</ThemedText>
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
