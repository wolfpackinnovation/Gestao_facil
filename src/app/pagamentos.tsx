import { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { DateNavigator } from '@/components/date-navigator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import {
  getDespesas,
  createDespesa,
  updateDespesa,
  CATEGORIAS_DESPESA,
  type CategoriaDespesa,
  type Despesa,
} from '@/services/despesa-service';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput, formatDateInput } from '@/utils/format';

function getMonthRange(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(ref);
  end.setMonth(end.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function filterDividasByPeriod(dividas: Despesa[], ref: Date): Despesa[] {
  const { start, end } = getMonthRange(ref);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return dividas.filter((d) => {
    const [dd, mm, yyyy] = d.vencimento!.split('/');
    const vencStr = `${yyyy}-${mm}-${dd}`;
    return vencStr >= startStr && vencStr <= endStr;
  });
}

export default function PagamentosScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [fabOpen, setFabOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDespesa>('Outros');
  const [observacao, setObservacao] = useState('');
  const [vencimento, setVencimento] = useState('');

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const data = await getDespesas(companyId);
    setDespesas(data);
    setLoading(false);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  function handleOpenNew() {
    setFabOpen(false);
    setDescricao('');
    setValor('');
    setCategoria('Outros');
    setObservacao('');
    setVencimento('');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!companyId || !descricao.trim() || !valor.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha a descrição e o valor.');
      return;
    }
    const parsedValor = parseCurrencyInput(valor);
    if (parsedValor <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor válido.');
      return;
    }
    try {
      await createDespesa({
        companyId,
        descricao: descricao.trim(),
        valor: parsedValor,
        categoria,
        data: new Date().toISOString().slice(0, 10),
        observacao: observacao.trim(),
        vencimento: vencimento.trim() || undefined,
      });
      setModalVisible(false);
      await loadData();
      Alert.alert('Despesa registrada', `R$ ${parsedValor.toFixed(2)} em "${descricao.trim()}"`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar despesa.');
    }
  }

  function changeMonth(delta: number) {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
  }

  const dividas = useMemo(() => despesas.filter((d) => d.vencimento), [despesas]);
  const dividasPeriodo = useMemo(() => filterDividasByPeriod(dividas, referenceDate), [dividas, referenceDate]);
  const totalPeriodo = useMemo(() => dividasPeriodo.reduce((sum, d) => sum + d.valor, 0), [dividasPeriodo]);
  const totalPendente = useMemo(() => dividasPeriodo.filter((d) => !d.pago).reduce((sum, d) => sum + d.valor, 0), [dividasPeriodo]);

  async function handlePagar(item: Despesa) {
    Alert.alert(
      'Confirmar Pagamento',
      `Pagar ${formatCurrency(item.valor)} de "${item.descricao}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar',
          onPress: async () => {
            try {
              await updateDespesa(item.id, { pago: true });
              await loadData();
            } catch (e: any) {
              Alert.alert('Erro', e?.message ?? 'Erro ao registrar pagamento.');
            }
          },
        },
      ],
    );
  }

  function renderItem({ item }: { item: Despesa }) {
    const vencido = (() => {
      if (!item.vencimento) return false;
      const [dd, mm, yyyy] = item.vencimento.split('/').map(Number);
      const vencDate = new Date(yyyy, mm - 1, dd);
      return vencDate < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    })();
    return (
      <ThemedView style={[styles.expenseItem, item.pago && { opacity: 0.5 }]}>
        <ThemedView style={styles.expenseRow}>
          <ThemedText style={styles.expenseDesc} numberOfLines={1}>{item.descricao}</ThemedText>
          <ThemedView style={{ alignItems: 'flex-end' }}>
            <ThemedText style={[styles.expenseValue, item.pago && { textDecorationLine: 'line-through', opacity: 0.6 }]}>
              {formatCurrency(item.valor)}
            </ThemedText>
            {item.vencimento && !item.pago && (
              <ThemedText type="small" style={{ color: vencido ? '#DC2626' : '#F59E0B' }}>
                Vence {item.vencimento}{vencido ? ' (vencido)' : ''}
              </ThemedText>
            )}
            {item.pago && (
              <ThemedText type="small" style={{ color: '#22C55E' }}>Pago</ThemedText>
            )}
          </ThemedView>
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">Categoria: {item.categoria}</ThemedText>
        {!item.pago && (
          <Pressable onPress={() => handlePagar(item)} style={styles.payButton}>
            <ThemedText style={styles.payButtonText}>Pagar</ThemedText>
          </Pressable>
        )}
      </ThemedView>
    );
  }

  const sortedDespesas = [...dividasPeriodo].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {loading ? <Loading /> : (
          <FlatList
            data={sortedDespesas}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <ThemedView style={styles.headerGroup}>
                <DateNavigator selectedDate={referenceDate} onDateChange={changeMonth} mode="month" />
                <ThemedView style={styles.summaryRow}>
                  <ThemedView style={styles.summaryCard}>
                    <ThemedText style={[styles.summaryLabel, { color: '#C4956A' }]}>Total do Mês</ThemedText>
                    <ThemedText style={[styles.summaryValue, { color: '#C4956A' }]}>{formatCurrency(totalPeriodo)}</ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.summaryCard}>
                    <ThemedText style={[styles.summaryLabel, { color: '#6B7280' }]}>Pendente</ThemedText>
                    <ThemedText style={[styles.summaryValue, { color: '#6B7280' }]}>{formatCurrency(totalPendente)}</ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            }
            ListEmptyComponent={
              <ThemedText style={styles.emptyText}>Nenhuma despesa no período</ThemedText>
            }
          />
        )}

        {fabOpen && (
          <Pressable style={styles.fabOverlay} onPress={() => setFabOpen(false)} />
        )}

        {fabOpen && (
          <View style={[styles.fabItem, { backgroundColor: theme.backgroundElement }]}>
            <Pressable onPress={handleOpenNew} style={styles.fabItemPress}>
              <ThemedText style={{ fontSize: 16 }}>➕</ThemedText>
              <ThemedText style={styles.fabItemLabel}>Nova Despesa</ThemedText>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => setFabOpen((v) => !v)}
          style={[styles.fab, { backgroundColor: '#C4956A' }]}
        >
          <ThemedText style={styles.fabIcon}>+</ThemedText>
        </Pressable>

        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalContainer, { backgroundColor: theme.background }]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <ThemedView style={styles.modalHeader}>
                <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>Nova Despesa</ThemedText>
                <Pressable onPress={() => setModalVisible(false)}>
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
                    value={descricao}
                    onChangeText={setDescricao}
                  />
                </ThemedView>

                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Valor</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 22, fontWeight: '700', textAlign: 'center' }]}
                    placeholder="R$ 0,00"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={valor}
                    onChangeText={(v) => setValor(formatCurrencyInput(v))}
                  />
                </ThemedView>

                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Categoria</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriaRow} contentContainerStyle={{ gap: Spacing.one }}>
                    {CATEGORIAS_DESPESA.map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setCategoria(cat)}
                        style={[
                          styles.categoriaChip,
                          { backgroundColor: categoria === cat ? '#C4956A' : theme.backgroundElement },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.categoriaChipText,
                            { color: categoria === cat ? '#fff' : theme.text },
                          ]}
                        >
                          {cat}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </ThemedView>

                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Data de Vencimento (opcional)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={theme.textSecondary}
                    value={vencimento}
                    onChangeText={(v) => setVencimento(formatDateInput(v))}
                    keyboardType="numbers-and-punctuation"
                  />
                </ThemedView>

                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Observação (opcional)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                    placeholder="Observações..."
                    placeholderTextColor={theme.textSecondary}
                    value={observacao}
                    onChangeText={setObservacao}
                    multiline
                    numberOfLines={3}
                  />
                </ThemedView>

                <Pressable
                  onPress={handleSave}
                  style={[styles.saveButton, { backgroundColor: '#C4956A' }]}
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
  headerGroup: { gap: Spacing.two, marginBottom: Spacing.two },
  summaryRow: { flexDirection: 'row', gap: Spacing.two },
  summaryCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  listContent: { gap: Spacing.two, paddingBottom: 100 },
  expenseItem: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.one,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expenseDesc: { fontSize: 15, fontWeight: '600', flex: 1 },
  expenseValue: { fontSize: 16, fontWeight: '700' },
  expenseMeta: { flexDirection: 'row', gap: Spacing.two },
  payButton: {
    backgroundColor: '#22C55E',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
    alignItems: 'center',
    marginTop: Spacing.half,
  },
  payButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
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
    bottom: 88,
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
