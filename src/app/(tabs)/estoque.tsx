import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { usePremium } from '@/contexts/premium';
import { PremiumModal } from '@/components/premium-modal';
import {
  getProdutos,
  saveProduto,
  formatCurrency,
  CATEGORIAS,
  UNIDADES,
  type Produto,
  type UnidadeMedida,
} from '@/services/estoque-storage';
import { formatQuantity } from '@/utils/format';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}





export default function EstoqueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const { user } = useAuth();
  const { checkLimits } = usePremium();
  const companyId = user?.uid ?? '';
  
  const editTriggered = useRef(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [now] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState('todos');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStockDropdown, setShowStockDropdown] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementProduct, setMovementProduct] = useState<Produto | null>(null);

  const [movementQty, setMovementQty] = useState('');

  const isLowStock = (p: Produto) => (p.estoqueAtual ?? 0) > 0 && (p.estoqueAtual ?? 0) <= 1;
  const isExpiringSoon = (p: Produto) => {
    if (!p.proximaValidade) return false;
    const [d, m, y] = p.proximaValidade.split('/').map(Number);
    const expiry = new Date(y, m - 1, d);
    const diff = expiry.getTime() - now;
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };
  const isExpired = (p: Produto) => {
    if (!p.proximaValidade) return false;
    const [d, m, y] = p.proximaValidade.split('/').map(Number);
    const expiry = new Date(y, m - 1, d);
    return expiry.getTime() < now;
  };

  const filteredProdutos = useMemo(() => {
    let list = produtos

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.nome.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term)
      )
    }

    if (categoryFilter) {
      list = list.filter(p => p.categoria === categoryFilter)
    }

    if (stockFilter === 'normal') {
      list = list.filter(p => !isLowStock(p) && !isExpired(p) && (p.estoqueAtual ?? 0) > 0)
    } else if (stockFilter === 'baixo') {
      list = list.filter(p => isLowStock(p))
    } else if (stockFilter === 'sem_estoque') {
      list = list.filter(p => (p.estoqueAtual ?? 0) === 0)
    } else if (stockFilter === 'vencendo') {
      list = list.filter(p => isExpiringSoon(p) && !isExpired(p))
    } else if (stockFilter === 'vencido') {
      list = list.filter(p => isExpired(p))
    }

    return list
  }, [produtos, searchQuery, categoryFilter, stockFilter])

  const loadProdutos = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const data = await getProdutos(companyId);
    setProdutos(data);
    setLoading(false);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      editTriggered.current = false;
      checkLimits();
      loadProdutos();
    }, [loadProdutos, checkLimits])
  );

  async function openNew() {
    const limits = await checkLimits();
    if (!limits.canAddInventory) {
      setShowPremiumModal(true);
      return;
    }
    router.push('/receita-form' as any);
  }

  useEffect(() => {
    if (!loading && editId && !editTriggered.current && produtos.length > 0) {
      const product = produtos.find(p => p.id === editId);
      if (product) {
        // Redireciona para o detalhe ou form caso necessite no futuro
        editTriggered.current = true;
      }
    }
  }, [loading, editId, produtos]);

  async function openMovement(type: 'entrada' | 'saida', product: Produto) {
    setMovementType(type);
    setMovementProduct(product);
    setMovementQty('');
    setMovementModal(true);
  }

  async function handleSaveMovement() {
    if (!movementProduct || !movementQty) return;
    const qty = parseFloat(movementQty.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Quantidade inválida', 'Digite uma quantidade válida.');
      return;
    }
    if (movementType === 'saida' && qty > (movementProduct.estoqueAtual ?? 0)) {
      Alert.alert('Estoque insuficiente', `Você tem apenas ${movementProduct.estoqueAtual} ${movementProduct.unidade} em estoque.`);
      return;
    }

    const novaQtd = movementType === 'entrada'
      ? (movementProduct.quantidade || 0) + qty
      : (movementProduct.quantidade || 0) - qty;
    
    await saveProduto({
      ...movementProduct,
      quantidade: novaQtd
    });
    setMovementModal(false);
    await loadProdutos();
  }



  const summary = useMemo(() => {
    let lowCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    for (const p of produtos) {
      if (isLowStock(p)) lowCount++;
      if (isExpiringSoon(p)) expiringCount++;
      if (isExpired(p)) expiredCount++;
    }
    return { totalCount: produtos.length, lowCount, expiringCount, expiredCount };
  }, [produtos]);

  function getStatus(p: Produto): { label: string; color: string } {
    if ((p.estoqueAtual ?? 0) === 0) return { label: 'Sem Estoque', color: '#ef4444' };
    if (isExpired(p)) return { label: 'Vencido', color: '#ef4444' };
    if (isLowStock(p)) return { label: 'Estoque Baixo', color: '#eab308' };
    return { label: 'Ok', color: '#22c55e' };
  }

  function renderProduto({ item }: { item: Produto }) {
    const status = getStatus(item);

    return (
      <ThemedView style={styles.card}>
        <Pressable onPress={() => router.push('/produto-detalhe?id=' + item.id as any)}>
          <ThemedView style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>
              {item.nome}
            </ThemedText>
            <ThemedText style={[styles.cardStatus, { color: status.color }]}>
              {status.label}
            </ThemedText>
          </ThemedView>


          <ThemedView style={styles.cardInfoGrid}>
            <ThemedView style={styles.cardInfoItem}>
              <ThemedText style={styles.cardInfoLabel}>Quantidade</ThemedText>
              <ThemedText style={styles.cardInfoValue}>
                {formatQuantity(item.estoqueAtual ?? 0)} {item.unidade}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.cardInfoItem}>
              <ThemedText style={styles.cardInfoLabel}>Preço</ThemedText>
              <ThemedText style={styles.cardInfoValue}>
                {formatCurrency(item.precoVenda)}/{item.unidade}
              </ThemedText>
            </ThemedView>

          </ThemedView>
        </Pressable>

        <ThemedView style={styles.cardActions}>
          {(item.estoqueAtual ?? 0) > 0 && (
            <>
              <Pressable
                onPress={() => router.push(`/receita-form?id=${item.id}&produce=true` as any)}
                style={[styles.actionButton, { backgroundColor: '#C4956A18' }]}
              >
                <ThemedText style={[styles.actionButtonText, { color: '#C4956A' }]}>Adicionar Estoque</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => openMovement('saida', item)}
                style={[styles.actionButton, { backgroundColor: '#DC262618' }]}
              >
                <ThemedText style={[styles.actionButtonText, { color: '#DC2626' }]}>Saída</ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </ThemedView>
    );
  }

  function formatBRL(cents: string): string {
    const digits = cents.replace(/\D/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2).replace(/^0+/, '') || '0';
    const decPart = padded.slice(-2);
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatted},${decPart}`;
  }


  const summaryCards = [
    { label: 'Produtos', value: String(summary.totalCount), color: theme.text, filterKey: 'todos' },
    { label: 'Estoque baixo', value: String(summary.lowCount), color: '#eab308', filterKey: 'baixo' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <Modal visible={showCategoryDropdown} transparent animationType="fade" onRequestClose={() => setShowCategoryDropdown(false)}>
          <Pressable style={styles.dropdownOverlay} onPress={() => setShowCategoryDropdown(false)}>
            <ThemedView style={[styles.dropdownMenu, { backgroundColor: theme.background }]}>
              <ThemedText type="subtitle" style={styles.dropdownTitle}>Categorias</ThemedText>
              <Pressable
                onPress={() => { setCategoryFilter(null); setActiveTab('todos'); setShowCategoryDropdown(false); }}
                style={[styles.dropdownItem, !categoryFilter && { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText type="default" style={{ fontWeight: !categoryFilter ? '600' : '400' }}>Todas</ThemedText>
              </Pressable>
              {CATEGORIAS.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => { setCategoryFilter(cat); setActiveTab('categoria'); setShowCategoryDropdown(false); }}
                  style={[styles.dropdownItem, categoryFilter === cat && { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText type="default" style={{ fontWeight: categoryFilter === cat ? '600' : '400' }}>{cat}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          </Pressable>
        </Modal>

        <Modal visible={showStockDropdown} transparent animationType="fade" onRequestClose={() => setShowStockDropdown(false)}>
          <Pressable style={styles.dropdownOverlay} onPress={() => setShowStockDropdown(false)}>
            <ThemedView style={[styles.dropdownMenu, { backgroundColor: theme.background }]}>
              <ThemedText type="subtitle" style={styles.dropdownTitle}>Situação do Estoque</ThemedText>
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'normal', label: 'Normal' },
                { key: 'baixo', label: 'Estoque Baixo' },
                { key: 'sem_estoque', label: 'Sem Estoque' },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => { setStockFilter(opt.key); setActiveTab('estoque'); setShowStockDropdown(false); }}
                  style={[styles.dropdownItem, stockFilter === opt.key && { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText type="default" style={{ fontWeight: stockFilter === opt.key ? '600' : '400' }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          </Pressable>
        </Modal>

        {loading ? <Loading /> : (
          <FlatList
            data={filteredProdutos}
            keyExtractor={(item) => item.id}
            renderItem={renderProduto}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <ThemedView>
                <ThemedView style={styles.header}>
                  <ThemedText type="title" style={styles.headerTitle}>
                    Estoque
                  </ThemedText>
                  <Pressable onPress={openNew} style={styles.addButton}>
                    <ThemedText style={styles.addButtonText}>+ Novo Produto</ThemedText>
                  </Pressable>
                </ThemedView>

                <ThemedView style={styles.summaryRow}>
                  {summaryCards.map((card) => (
                    <Pressable
                      key={card.label}
                      onPress={() => {
                        setStockFilter(card.filterKey);
                        setActiveTab('estoque');
                      }}
                      style={[styles.summaryCard, stockFilter === card.filterKey && card.filterKey !== 'todos' && { borderLeftWidth: 3, borderLeftColor: card.color }]}
                    >
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.summaryLabel}
                      >
                        {card.label}
                      </ThemedText>
                      <ThemedText style={[styles.summaryValue, { color: card.color }]}>
                        {card.value}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>

                <ThemedView style={styles.searchRow}>
                  <Ionicons name="search" size={18} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Buscar produto..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </ThemedView>


              </ThemedView>
            }
            ListEmptyComponent={
              <ThemedView style={styles.emptyState}>
                <Ionicons name="clipboard" size={48} color={theme.textSecondary} />
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  {categoryFilter || stockFilter !== 'todos' || searchQuery ? 'Nenhum resultado' : 'Nenhum produto'}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                  {categoryFilter || stockFilter !== 'todos' || searchQuery
                    ? 'Tente ajustar os filtros ou a busca.'
                    : 'Cadastre seu primeiro produto no estoque.'}
                </ThemedText>
              </ThemedView>
            }
          />
        )}
      </SafeAreaView>



      {/* Movement Modal */}
      <Modal visible={movementModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMovementModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>
                {movementType === 'entrada' ? 'Adicionar Estoque' : 'Saída de Estoque'}
              </ThemedText>
              <Pressable onPress={() => setMovementModal(false)}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Produto</ThemedText>
                <ThemedText style={{ fontWeight: '600', fontSize: 16 }}>{movementProduct?.nome}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Estoque atual: {movementProduct?.estoqueAtual ?? 0} {movementProduct?.unidade}
                </ThemedText>
              </ThemedView>



              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Quantidade</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 22, fontWeight: '700', textAlign: 'center' }]}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={movementQty}
                  onChangeText={(v) => setMovementQty(v.replace(/[^0-9.,]/g, ''))}
                />
              </ThemedView>
              <Pressable
                onPress={handleSaveMovement}
                style={[styles.saveButton, { backgroundColor: movementType === 'entrada' ? '#C4956A' : '#DC2626' }]}
              >
                <ThemedText style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>
                  {movementType === 'entrada' ? 'Adicionar ao Estoque' : 'Remover do Estoque'}
                </ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {showPremiumModal && (
        <PremiumModal type="inventory" onClose={() => setShowPremiumModal(false)} />
      )}
    </ThemedView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 32,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#C4956A',
  },
  addButtonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#fff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - 2,
    borderRadius: Spacing.half,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  summaryCard: {
    width: '48%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  summaryLabel: {
    fontSize: 11,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.five,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  cardStatus: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: Spacing.two,
  },
  cardCategory: {
    fontSize: 13,
  },
  cardInfoGrid: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  cardInfoItem: {
    gap: 2,
  },
  cardInfoLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  cardInfoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.two,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalSafe: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  modalTitle: {
    fontSize: 28,
    lineHeight: 32,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  fieldLabel: {
    letterSpacing: 0.5,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.two + 2 : Spacing.two,
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputAdornment: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? Spacing.two + 2 : Spacing.two,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.half,
  },
  rowFields: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  halfField: {
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
    backgroundColor: '#C4956A',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    width: '80%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  dropdownTitle: {
    marginBottom: Spacing.two,
  },
  dropdownItem: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  loteBox: {
    backgroundColor: 'rgba(196, 149, 106, 0.05)',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196, 149, 106, 0.25)',
  },
  loteBoxHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.half,
  },
  loteBoxTitle: {
    color: '#C4956A',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
});
