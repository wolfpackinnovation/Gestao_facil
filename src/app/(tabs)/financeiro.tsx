import { useState, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getSalesByDate } from '@/services/sale-service';
import * as CashService from '@/services/cash-service';
import type { CashRegister, Sale } from '@/types/schema';
import {
  getDespesas,
  createDespesa,
  deleteDespesa,
  CATEGORIAS_DESPESA,
  type Despesa,
  type CategoriaDespesa,
} from '@/services/despesa-service';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

const periods = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
] as const;

type Period = typeof periods[number]['key'];

function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'today') {
    return { start, end: now };
  }

  if (period === 'week') {
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - ((dayOfWeek + 6) % 7));
    return { start, end: now };
  }

  start.setDate(1);
  return { start, end: now };
}

async function getSalesInPeriod(companyId: string, period: Period) {
  const { start, end } = getPeriodRange(period);
  const days: Sale[] = [];
  const current = new Date(start);
  while (current <= end) {
    const daySales = await getSalesByDate(companyId, current);
    days.push(...daySales);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function filterDespesasByPeriod(despesas: Despesa[], period: Period): Despesa[] {
  const { start, end } = getPeriodRange(period);
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

  const [period, setPeriod] = useState<Period>('today');
  const [sales, setSales] = useState<Sale[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDespesa>('Outros');
  const [data, setData] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [observacao, setObservacao] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!companyId) return;
    const [salesData, registersData, despesasData] = await Promise.all([
      getSalesInPeriod(companyId, period),
      CashService.listCashRegisters(companyId),
      getDespesas(companyId),
    ]);
    setSales(salesData);
    setRegisters(registersData);
    setDespesas(despesasData);
  }, [companyId, period]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function toggleRegister(register: CashRegister) {
    try {
      if (register.isOpen) {
        await CashService.closeCashRegister(register.id!);
      } else {
        await CashService.openCashRegister(register.id!, register.currentBalance);
      }
      await loadData();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao alternar caixa.');
    }
  }

  function openNewDespesa() {
    const d = new Date();
    setDescricao('');
    setValor('');
    setCategoria('Outros');
    setData(d.toISOString().slice(0, 10));
    setObservacao('');
    setErrors({});
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!descricao.trim()) newErrors.descricao = 'Informe a descrição';
    if (!valor || isNaN(Number(valor)) || Number(valor) <= 0)
      newErrors.valor = 'Informe um valor válido';
    if (!data) newErrors.data = 'Informe a data';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    try {
      await createDespesa({
        companyId,
        descricao: descricao.trim(),
        valor: Number(valor),
        categoria,
        data: new Date(data).toISOString(),
        observacao: observacao.trim(),
      });
      await loadData();
      closeModal();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar despesa.');
    }
  }

  const grandTotal = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const fiadoTotal = sales
    .filter((s) => s.paymentMethod === 'fiado')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const openRegister = registers.find((r) => r.isOpen) ?? registers[0];
  const totalCash = registers.reduce((sum, r) => sum + (r.currentBalance ?? 0), 0);

  const despesasPeriodo = filterDespesasByPeriod(despesas, period);
  const totalDespesas = despesasPeriodo.reduce((s, d) => s + d.valor, 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Period Selector */}
          <ThemedView style={[styles.periodRow, { backgroundColor: theme.backgroundElement }]}>
            {periods.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={[
                  styles.periodChip,
                  period === p.key && { backgroundColor: theme.text },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: period === p.key ? theme.background : theme.text,
                    fontWeight: '600',
                  }}
                >
                  {p.label}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          {/* Cash Register */}
          {openRegister && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedView style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: '600' }}>{openRegister.name}</ThemedText>
                  <ThemedText style={{ fontWeight: '700', fontSize: 20, marginTop: Spacing.half }}>
                    {formatCurrency(openRegister.currentBalance ?? 0)}
                  </ThemedText>
                </ThemedView>
                <Pressable
                  onPress={() => toggleRegister(openRegister)}
                  style={[styles.actionBtn, { backgroundColor: openRegister.isOpen ? '#ef4444' : '#22c55e' }]}
                >
                  <ThemedText type="small" style={{ color: '#fff', fontWeight: '600' }}>
                    {openRegister.isOpen ? 'Fechar' : 'Abrir'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          )}

          {/* Receita */}
          <ThemedView style={[styles.receitaCard, { backgroundColor: '#f0fdf4' }]}>
            <ThemedView style={styles.receitaHeader}>
              <ThemedText type="smallBold" style={{ color: '#166534' }}>Receita</ThemedText>
              <ThemedText style={{ fontWeight: '700', fontSize: 22, color: '#166534' }}>
                {formatCurrency(grandTotal)}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* Despesas Section */}
          {despesasPeriodo.length > 0 && (
            <ThemedView style={[styles.despesasCard, { backgroundColor: '#fef2f2' }]}>
              <ThemedView style={styles.despesasHeader}>
                <ThemedText type="smallBold" style={{ color: '#991b1b' }}>Despesas</ThemedText>
                <ThemedText style={{ fontWeight: '700', fontSize: 18, color: '#991b1b' }}>
                  {formatCurrency(totalDespesas)}
                </ThemedText>
              </ThemedView>
              {despesasPeriodo.map((d) => (
                <Pressable
                  key={d.id}
                  onLongPress={() => {
                    Alert.alert('Excluir Despesa', `Excluir "${d.descricao}"?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteDespesa(d.id);
                          await loadData();
                        },
                      },
                    ]);
                  }}
                  style={styles.despesaItem}
                >
                  <ThemedView style={{ flex: 1 }}>
                    <ThemedText type="smallBold" style={{ color: '#991b1b' }}>{d.descricao}</ThemedText>
                    <ThemedText type="small" style={{ color: '#7f1d1d' }}>
                      {d.categoria} • {formatDateBR(d.data)}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={{ fontWeight: '700', color: '#991b1b' }}>
                    {formatCurrency(d.valor)}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          )}

          {/* Saldo Líquido */}
          <ThemedView style={styles.totalRow}>
            <ThemedText style={styles.totalLabel}>Saldo Líquido</ThemedText>
            <ThemedText style={[styles.totalValue, { color: grandTotal - totalDespesas >= 0 ? '#22c55e' : '#ef4444' }]}>
              {formatCurrency(grandTotal - totalDespesas)}
            </ThemedText>
          </ThemedView>

          {/* Receivables Alert */}
          {fiadoTotal > 0 && (
            <ThemedView style={[styles.alertCard, { backgroundColor: '#fef3c7' }]}>
              <ThemedText type="smallBold" style={{ color: '#92400e' }}>
                A Receber (Fiado)
              </ThemedText>
              <ThemedText style={{ fontWeight: '700', fontSize: 18, color: '#92400e' }}>
                {formatCurrency(fiadoTotal)}
              </ThemedText>
            </ThemedView>
          )}

          {/* Sales Count */}
          <ThemedView style={styles.statsRow}>
            <ThemedView style={styles.statItem}>
              <ThemedText type="small" themeColor="textSecondary">Vendas</ThemedText>
              <ThemedText style={{ fontWeight: '700', fontSize: 18 }}>{sales.length}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.statItem}>
              <ThemedText type="small" themeColor="textSecondary">Ticket Médio</ThemedText>
              <ThemedText style={{ fontWeight: '700', fontSize: 18 }}>
                {sales.length > 0 ? formatCurrency(grandTotal / sales.length) : formatCurrency(0)}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.statItem}>
              <ThemedText type="small" themeColor="textSecondary">Saldo Caixa</ThemedText>
              <ThemedText style={{ fontWeight: '700', fontSize: 18 }}>{formatCurrency(totalCash)}</ThemedText>
            </ThemedView>
          </ThemedView>
        </ScrollView>

        {/* FAB - Adicionar Despesa */}
        <Pressable
          onPress={openNewDespesa}
          style={[styles.fab, { backgroundColor: '#ef4444' }]}
        >
          <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            despesa
          </ThemedText>
        </Pressable>
      </SafeAreaView>

      {/* Modal Nova Despesa */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                Nova Despesa
              </ThemedText>
              <Pressable onPress={closeModal}>
                <ThemedText type="default" themeColor="textSecondary">
                  Cancelar
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Descrição *</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }, errors.descricao && styles.inputError]}
                  value={descricao}
                  onChangeText={(v) => { setDescricao(v); setErrors((e) => { const c = { ...e }; delete c.descricao; return c; }); }}
                  placeholder="Ex: Compra de carne"
                  placeholderTextColor={theme.textSecondary}
                />
                {errors.descricao && <ThemedText type="small" style={{ color: '#ef4444' }}>{errors.descricao}</ThemedText>}
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Valor (R$) *</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }, errors.valor && styles.inputError]}
                  value={valor}
                  onChangeText={(v) => { setValor(v); setErrors((e) => { const c = { ...e }; delete c.valor; return c; }); }}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 150.00"
                  placeholderTextColor={theme.textSecondary}
                />
                {errors.valor && <ThemedText type="small" style={{ color: '#ef4444' }}>{errors.valor}</ThemedText>}
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Categoria</ThemedText>
                <ThemedView style={styles.chipsRow}>
                  {CATEGORIAS_DESPESA.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCategoria(cat)}
                      style={[
                        styles.chip,
                        { backgroundColor: categoria === cat ? theme.text : theme.backgroundElement },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: categoria === cat ? theme.background : theme.text }}
                      >
                        {cat}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Data</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                  value={data}
                  onChangeText={setData}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                />
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Observação (opcional)</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                  value={observacao}
                  onChangeText={setObservacao}
                  placeholder="Ex: Nota fiscal 12345"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </ThemedView>

              <Pressable
                onPress={handleSave}
                style={[styles.saveButton, { backgroundColor: '#ef4444' }]}
              >
                <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                  Salvar Despesa
                </ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.six },
  periodRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  card: { borderRadius: Spacing.four, padding: Spacing.three },
  actionBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  receitaCard: { borderRadius: Spacing.three, padding: Spacing.three },
  receitaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.three, borderTopWidth: 2, borderTopColor: 'rgba(128,128,128,0.2)' },
  totalLabel: { fontSize: 20, fontWeight: '600' },
  totalValue: { fontSize: 24, fontWeight: '700' },
  alertCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.half },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  statItem: { flex: 1, alignItems: 'center', gap: Spacing.half },
  fab: {
    position: 'absolute',
    bottom: Spacing.four,
    right: Spacing.four,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  despesasCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  despesasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  despesaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  // Modal
  modalContainer: { flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalTitle: { fontSize: 28, lineHeight: 32 },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: 'transparent', borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 16 },
  inputError: { borderColor: '#ef4444' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.half },
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
});
