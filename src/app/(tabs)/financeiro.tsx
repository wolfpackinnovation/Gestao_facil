import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getSalesByDate, getAllSales } from '@/services/sale-service';
import { getDespesas, createDespesa, CATEGORIAS_DESPESA, type CategoriaDespesa, type Despesa } from '@/services/despesa-service';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput, formatDateInput } from '@/utils/format';

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
  const [fabOpen, setFabOpen] = useState(false);
  const [despesaModal, setDespesaModal] = useState(false);
  const [despesaDesc, setDespesaDesc] = useState('');
  const [despesaValor, setDespesaValor] = useState('');
  const [despesaCategoria, setDespesaCategoria] = useState<CategoriaDespesa>('Outros');
  const [despesaObservacao, setDespesaObservacao] = useState('');
  const [despesaVencimento, setDespesaVencimento] = useState('');
  const fabAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: fabOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [fabOpen, fabAnim]);

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
        result.push({ day: d, value: dayTotal, label: String(d) });
      }
    }
    return result;
  }, [monthSales, referenceDate]);

  const maxDailyRevenue = Math.max(...dailyRevenue.map((r) => r.value), 1);

  const lucroRealizado = receitasRecebidas - despesasPagas;

  const currentMonth = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();

  function changeMonth(delta: number) {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
  }

  function handleAddDespesa() {
    setFabOpen(false);
    setDespesaDesc('');
    setDespesaValor('');
    setDespesaCategoria('Outros');
    setDespesaObservacao('');
    setDespesaVencimento('');
    setDespesaModal(true);
  }

  async function handleSaveDespesa() {
    if (!companyId || !despesaDesc.trim() || !despesaValor.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha a descrição e o valor.');
      return;
    }
    const valor = parseCurrencyInput(despesaValor);
    if (valor <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor válido.');
      return;
    }
    try {
      await createDespesa({
        companyId,
        descricao: despesaDesc.trim(),
        valor,
        categoria: despesaCategoria,
        data: new Date().toISOString().slice(0, 10),
        observacao: despesaObservacao.trim(),
        vencimento: despesaVencimento.trim() || undefined,
      });
      setDespesaModal(false);
      await loadData();
      Alert.alert('Despesa registrada', `R$ ${valor.toFixed(2)} em "${despesaDesc.trim()}"`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar despesa.');
    }
  }

  const cards = [
    { key: 'recebidas', label: 'Receitas Recebidas', value: receitasRecebidas, color: '#16A34A' },
    { key: 'areceber', label: 'Receitas a Receber', value: receitasAReceber, color: '#F59E0B' },
    { key: 'despesas', label: 'Despesas Pagas', value: despesasPagas, color: '#DC2626' },
    { key: 'apagar', label: 'Despesas a Pagar', value: despesasAPagar, color: '#6B7280' },
  ];

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

            {/* Lucro Realizado */}
            <ThemedView style={[styles.lucroCard, { backgroundColor: lucroRealizado >= 0 ? '#16A34A' : '#DC2626' }]}>
              <ThemedText style={styles.lucroLabel}>Lucro Realizado</ThemedText>
              <ThemedText style={styles.lucroValue}>{formatCurrency(lucroRealizado)}</ThemedText>
              <ThemedText style={styles.lucroSub}>Receitas recebidas - Despesas pagas</ThemedText>
            </ThemedView>

            {/* Summary Cards */}
            <ThemedView style={styles.cardsGrid}>
              {cards.map((card) => (
                <Pressable
                  key={card.key}
                  onPress={() => router.push('/financeiro-detalhe?type=' + card.key as any)}
                  style={[styles.card, { backgroundColor: card.color + '12' }]}
                >
                  <ThemedText style={[styles.cardLabel, { color: card.color }]}>{card.label}</ThemedText>
                  <ThemedText style={[styles.cardValue, { color: card.color }]}>
                    {formatCurrency(card.value)}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>

            {/* Gráfico de Receitas vs Despesas */}
            {(receitasRecebidas > 0 || despesasPagas > 0) && (
              <ThemedView style={styles.chartCard}>
                <ThemedText style={styles.chartTitle}>Receitas vs Despesas</ThemedText>
                <View style={styles.barStack}>
                  <View style={{ flex: receitasRecebidas || 1 }}>
                    <View style={[styles.barSegment, { backgroundColor: '#16A34A', height: 8, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }]} />
                  </View>
                  <View style={{ flex: despesasPagas || 1 }}>
                    <View style={[styles.barSegment, { backgroundColor: '#DC2626', height: 8 }]} />
                  </View>
                </View>
                <View style={styles.barLegend}>
                  <ThemedText style={styles.legendItem}>
                    <ThemedText style={{ color: '#16A34A', fontWeight: '600' }}>●</ThemedText> Receitas {formatCurrency(receitasRecebidas)}
                  </ThemedText>
                  <ThemedText style={styles.legendItem}>
                    <ThemedText style={{ color: '#DC2626', fontWeight: '600' }}>●</ThemedText> Despesas {formatCurrency(despesasPagas)}
                  </ThemedText>
                </View>
              </ThemedView>
            )}

            {/* Gráfico de Receitas Diárias */}
            {dailyRevenue.length > 0 && (
              <ThemedView style={styles.chartCard}>
                <ThemedText style={styles.chartTitle}>Receitas Diárias</ThemedText>
                <View style={styles.dailyChart}>
                  {dailyRevenue.map((r) => (
                    <View key={r.day} style={styles.dailyCol}>
                      <View
                        style={[
                          styles.dailyBar,
                          {
                            height: Math.max((r.value / maxDailyRevenue) * 80, 4),
                            backgroundColor: '#16A34A',
                          },
                        ]}
                      />
                      <ThemedText style={styles.dailyLabel}>{r.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </ThemedView>
            )}

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
          { label: 'Nova Despesa', icon: '➖', onPress: handleAddDespesa },
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
                    bottom: 88,
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

        {/* Despesa Modal */}
        <Modal visible={despesaModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDespesaModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalContainer, { backgroundColor: theme.background }]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>Nova Despesa</ThemedText>
                <Pressable onPress={() => setDespesaModal(false)}>
                  <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
                </Pressable>
              </ThemedView>

              <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">
                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Nome</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                    placeholder="Ex: Conta de luz"
                    placeholderTextColor={theme.textSecondary}
                    value={despesaDesc}
                    onChangeText={setDespesaDesc}
                  />
                </ThemedView>

                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Valor</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 22, fontWeight: '700', textAlign: 'center' }]}
                    placeholder="R$ 0,00"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={despesaValor}
                    onChangeText={(v) => setDespesaValor(formatCurrencyInput(v))}
                  />
                </ThemedView>

                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Categoria</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriaRow} contentContainerStyle={{ gap: Spacing.one }}>
                    {CATEGORIAS_DESPESA.map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setDespesaCategoria(cat)}
                        style={[
                          styles.categoriaChip,
                          {
                            backgroundColor: despesaCategoria === cat ? '#059669' : theme.backgroundElement,
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.categoriaChipText,
                            { color: despesaCategoria === cat ? '#fff' : theme.text },
                          ]}
                        >
                          {cat}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </ThemedView>

                {despesaCategoria === 'Boletos' && (
                  <ThemedView style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Data de Vencimento</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={theme.textSecondary}
                      value={despesaVencimento}
                      onChangeText={(v) => setDespesaVencimento(formatDateInput(v))}
                      keyboardType="numbers-and-punctuation"
                    />
                  </ThemedView>
                )}

                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Observação (opcional)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                    placeholder="Observações..."
                    placeholderTextColor={theme.textSecondary}
                    value={despesaObservacao}
                    onChangeText={setDespesaObservacao}
                    multiline
                    numberOfLines={3}
                  />
                </ThemedView>

                <Pressable
                  onPress={handleSaveDespesa}
                  style={[styles.saveButton, { backgroundColor: '#059669' }]}
                >
                  <ThemedText style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>
                    Salvar Despesa
                  </ThemedText>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
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

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  monthArrow: { padding: Spacing.one },

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

  chartCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  chartTitle: { fontSize: 14, fontWeight: '700' },
  barStack: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden' },
  barSegment: { borderRadius: 0 },
  barLegend: { flexDirection: 'row', gap: Spacing.four },
  legendItem: { fontSize: 12 },
  dailyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 100,
  },
  dailyCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  dailyBar: { width: '100%', borderRadius: 2, minWidth: 4 },
  dailyLabel: { fontSize: 9, opacity: 0.5 },

  emptyText: { fontSize: 14, opacity: 0.5, textAlign: 'center', paddingVertical: Spacing.six },

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
  categoriaRow: { flexDirection: 'row', marginTop: Spacing.one },
  categoriaChip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 20, marginRight: Spacing.one },
  categoriaChipText: { fontSize: 13, fontWeight: '600' },
});
