import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Loading } from '@/utils/loading';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getTodaySales, getSalesByDate, getSaleItems, getAllSales } from '@/services/sale-service';
import { getPaymentsByDate, getAllPayments } from '@/services/payment-service';
import { getProdutos } from '@/services/estoque-storage';
import type { Produto } from '@/services/estoque-storage';
import type { Sale } from '@/types/schema';
import { formatCurrency, formatCurrencyInput } from '@/utils/format';
import { createDespesa } from '@/services/despesa-service';

function formatDayName(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'long' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const userName = user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuário';

  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [yesterdaySales, setYesterdaySales] = useState<Sale[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [todayPayments, setTodayPayments] = useState<any[]>([]);
  const [yesterdayPayments, setYesterdayPayments] = useState<any[]>([]);
  const [weekTotals, setWeekTotals] = useState<number[]>([]);
  const [products, setProducts] = useState<Produto[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Produto[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const [dividaModal, setDividaModal] = useState(false);
  const [dividaDesc, setDividaDesc] = useState('');
  const [dividaValor, setDividaValor] = useState('');

  const today = new Date();

  const [loading, setLoading] = useState(true);
  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [todayData, yesterdayData, todayPayData, yesterdayPayData, allProducts, allSales, allPayments] = await Promise.all([
      getTodaySales(companyId),
      getSalesByDate(companyId, yesterday),
      getPaymentsByDate(companyId, today),
      getPaymentsByDate(companyId, yesterday),
      getProdutos(companyId),
      getAllSales(companyId),
      getAllPayments(companyId),
    ]);

    const weekTotalsArr: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const daySales = allSales.filter((s) => {
        if (!s.createdAt) return false;
        return s.createdAt.toDate().toDateString() === d.toDateString();
      });
      const dayPayments = allPayments.filter((p) => {
        if (!p.createdAt) return false;
        return p.createdAt.toDate().toDateString() === d.toDateString();
      });
      weekTotalsArr.push(
        daySales.reduce((sum, s) => sum + s.totalAmount, 0) +
        dayPayments.reduce((sum, p) => sum + p.amount, 0)
      );
    }
    setWeekTotals(weekTotalsArr);

    const lowStock = allProducts.filter(
      (p) => p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo
    );

    setTodaySales(todayData);
    setYesterdaySales(yesterdayData);
    setTodayPayments(todayPayData);
    setYesterdayPayments(yesterdayPayData);
    setAllSales(allSales);
    setProducts(allProducts);
    setLowStockProducts(lowStock);

    const itemsPromises = todayData.map((s) => s.id ? getSaleItems(s.id) : Promise.resolve([]));
    const allItems = (await Promise.all(itemsPromises)).flat();

    const productCounts: Record<string, number> = {};
    for (const item of allItems) {
      productCounts[item.productId] = (productCounts[item.productId] ?? 0) + item.quantity;
    }

    const sorted = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const productMap = new Map(allProducts.map((p) => [p.id, p.nome]));
    setTopProducts(
      sorted.map(([id, count]) => ({
        name: productMap.get(id) ?? 'Produto',
        count,
      }))
    );
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: fabOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [fabOpen, fabAnim]);

  function toggleFab() {
    setFabOpen((v) => !v);
  }

  function handleAction(route: string) {
    setFabOpen(false);
    router.push(route as any);
  }

  function handleAddDivida() {
    setFabOpen(false);
    setDividaDesc('');
    setDividaValor('');
    setDividaModal(true);
  }

  async function handleSaveDivida() {
    if (!companyId || !dividaDesc.trim() || !dividaValor.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha a descrição e o valor.');
      return;
    }
    const valor = parseFloat(dividaValor.replace(/\D/g, '')) / 100;
    if (valor <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor válido.');
      return;
    }
    try {
      await createDespesa({
        companyId,
        descricao: dividaDesc.trim(),
        valor,
        categoria: 'Boletos',
        data: new Date().toISOString().slice(0, 10),
        observacao: '',
      });
      setDividaModal(false);
      Alert.alert('Dívida registrada', `R$ ${valor.toFixed(2)} em "${dividaDesc.trim()}"`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar dívida.');
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const todayTotal = useMemo(
    () =>
      todaySales.reduce((sum, s) => sum + s.totalAmount, 0) +
      todayPayments.reduce((sum, p) => sum + p.amount, 0),
    [todaySales, todayPayments]
  );

  const yesterdayTotal = useMemo(
    () =>
      yesterdaySales.reduce((sum, s) => sum + s.totalAmount, 0) +
      yesterdayPayments.reduce((sum, p) => sum + p.amount, 0),
    [yesterdaySales, yesterdayPayments]
  );

  const percentChange = useMemo(() => {
    if (yesterdayTotal === 0) return todayTotal > 0 ? 100 : 0;
    return Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100);
  }, [todayTotal, yesterdayTotal]);

  const monthSales = useMemo(
    () => allSales.filter((s) => {
      const d = s.createdAt?.toDate?.() ?? new Date();
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }),
    [allSales, today]
  );

  const monthSalesTotal = useMemo(
    () => monthSales.reduce((sum, s) => sum + s.totalAmount, 0),
    [monthSales]
  );

  const averageTicket = useMemo(() => {
    if (monthSales.length === 0) return 0;
    return monthSalesTotal / monthSales.length;
  }, [monthSalesTotal, monthSales.length]);

  if (loading) return <Loading />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Greeting + Date */}
          <View style={styles.headerSection}>
            <ThemedText style={styles.greeting}>Olá, {userName} 👋</ThemedText>
            <ThemedText style={styles.dateText}>
              {capitalize(formatDayName(today))}, {formatDate(today)}
            </ThemedText>
          </View>

          {/* Sales Today */}
          <View style={styles.totalCard}>
            <ThemedText style={styles.totalCardLabel}>💰 Vendas Hoje</ThemedText>
            <ThemedText style={styles.totalCardValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(todayTotal)}
            </ThemedText>
            <View style={styles.totalBreakdown}>
              <View style={styles.totalBreakdownItem}>
                <ThemedText style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>VENDAS</ThemedText>
                <ThemedText style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                  {formatCurrency(todaySales.reduce((s, v) => s + v.totalAmount, 0))}
                </ThemedText>
              </View>
              <View style={styles.totalBreakdownItem}>
                <ThemedText style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>RECEBIMENTOS</ThemedText>
                <ThemedText style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                  {formatCurrency(todayPayments.reduce((s, p) => s + p.amount, 0))}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.statValue}>{monthSales.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Vendas</ThemedText>
              </View>
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.statValue}>{formatCurrency(averageTicket)}</ThemedText>
                <ThemedText style={styles.statLabel}>Ticket Médio</ThemedText>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.statValue}>{products.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Produtos</ThemedText>
              </View>
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={[styles.statValue, lowStockProducts.length > 0 && { color: '#ef4444' }]}>
                  {lowStockProducts.length} {lowStockProducts.length === 1 ? 'Alerta' : 'Alertas'}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Estoque</ThemedText>
              </View>
            </View>
          </View>

          {/* Week Sales Chart */}
          <ThemedText style={styles.sectionTitle}>📊 Vendas da Semana</ThemedText>
          {weekTotals.length > 0 && <WeekChart data={weekTotals} />}

          {/* Alerts */}
          <ThemedText style={styles.sectionTitle}>⚠️ Atenção</ThemedText>
          <View style={[styles.alertBox, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.alertItem}>
              • {lowStockProducts.length} {lowStockProducts.length === 1 ? 'produto acabando' : 'produtos acabando'}
            </ThemedText>
            <ThemedText style={styles.alertItem}>• 0 contas vencem hoje</ThemedText>
            <ThemedText style={styles.alertItem}>• 0 cliente possui fiado atrasado</ThemedText>
          </View>

          {/* Top Products */}
          <ThemedText style={styles.sectionTitle}>🔥 Produtos mais vendidos</ThemedText>
          <View style={[styles.topProductsBox, { backgroundColor: theme.backgroundElement }]}>
            {topProducts.length === 0 ? (
              <ThemedText style={styles.emptyText}>Nenhum produto vendido hoje</ThemedText>
            ) : (
              topProducts.map((p, i) => (
                <ThemedText key={p.name} style={styles.topProductItem}>
                  {i + 1}. {p.name}
                </ThemedText>
              ))
            )}
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* Overlay */}
      {fabOpen && (
        <TouchableWithoutFeedback onPress={() => setFabOpen(false)}>
          <View style={styles.fabOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* FAB Menu Items */}
      {[
        { label: 'Nova Venda', icon: '💰', onPress: () => handleAction('/nova-venda') },
        { label: 'Novo Produto', icon: '📦', onPress: () => handleAction('/estoque') },
        { label: 'Adicionar Dívida', icon: '💳', onPress: handleAddDivida },
        { label: 'Receber Fiado', icon: '📝', onPress: () => handleAction('/clientes') },
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
        onPress={toggleFab}
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

      {/* Divida Modal */}
      <Modal visible={dividaModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDividaModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>Adicionar Dívida</ThemedText>
              <Pressable onPress={() => setDividaModal(false)}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">
              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Descrição</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="Ex: Conta de luz"
                  placeholderTextColor={theme.textSecondary}
                  value={dividaDesc}
                  onChangeText={setDividaDesc}
                />
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Valor</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 22, fontWeight: '700', textAlign: 'center' }]}
                  placeholder="R$ 0,00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={dividaValor}
                  onChangeText={(v) => setDividaValor(formatCurrencyInput(v))}
                />
              </ThemedView>

              <Pressable
                onPress={handleSaveDivida}
                style={[styles.saveButton, { backgroundColor: '#059669' }]}
              >
                <ThemedText style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>
                  Salvar Dívida
                </ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

function WeekChart({ data }: { data: number[] }) {
  const theme = useTheme();
  const bars = useMemo(() => {
    const today = new Date();
    const maxVal = Math.max(...data, 1);
    return data.map((value, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return {
        label: weekDays[d.getDay()],
        value,
        height: Math.max((value / maxVal) * 100, 3),
      };
    });
  }, [data]);

  return (
    <View style={[styles.chartBox, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.chartBars}>
        {bars.map((bar, idx) => (
          <View key={idx} style={styles.chartCol}>
            <View
              style={[
                styles.chartBar,
                {
                  height: bar.height,
                  backgroundColor: idx === 6 ? '#059669' : theme.textSecondary,
                },
              ]}
            />
            <ThemedText style={styles.chartLabel}>{bar.label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
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
  scrollContent: { gap: Spacing.four, paddingBottom: Spacing.six },

  headerSection: { paddingTop: Spacing.two },
  greeting: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  dateText: { fontSize: 15, lineHeight: 20, opacity: 0.6, marginTop: Spacing.half },

  divider: { height: 1, backgroundColor: 'rgba(128,128,128,0.2)', marginVertical: Spacing.three },

  totalCard: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#059669',
  },
  totalCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  totalCardValue: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
    color: '#fff',
  },
  totalBreakdown: {
    flexDirection: 'row',
    gap: Spacing.five,
    marginTop: Spacing.four,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
  },
  totalBreakdownItem: { alignItems: 'center', gap: Spacing.one },

  statsGrid: { gap: Spacing.three },
  statsRow: { flexDirection: 'row', gap: Spacing.three },
  statBox: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  statLabel: { fontSize: 13, lineHeight: 18, opacity: 0.6, marginTop: Spacing.half },

  sectionTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: Spacing.two },

  chartBox: { borderRadius: Spacing.three, padding: Spacing.three },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.one },
  chartBar: { width: 24, borderRadius: Spacing.one },
  chartLabel: { fontSize: 11, lineHeight: 14, opacity: 0.5 },

  alertBox: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  alertItem: { fontSize: 14, lineHeight: 22 },

  topProductsBox: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  topProductItem: { fontSize: 15, lineHeight: 24, fontWeight: '500' },
  emptyText: { fontSize: 13, lineHeight: 18, opacity: 0.5 },

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
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalForm: { paddingHorizontal: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: 'transparent', borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 16 },
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
});
