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
import {
  getProdutos,
  saveProduto,
  deleteProduto,
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

const emptyForm = {
  codigo: '',
  nome: '',
  categoria: CATEGORIAS[0],
  unidade: 'un' as UnidadeMedida,
  quantidade: '',
  custo: '',
  margemLucro: '',
  quebra: '',
  precoVenda: '',
  estoqueAtual: '',
  estoqueMinimo: '',
  dataValidade: '',
  fornecedor: '',
};

export default function EstoqueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const editTriggered = useRef(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [now] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState('todos');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStockDropdown, setShowStockDropdown] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementProduct, setMovementProduct] = useState<Produto | null>(null);
  const [movementQty, setMovementQty] = useState('');

  const isLowStock = (p: Produto) => p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo;
  const isExpiringSoon = (p: Produto) => {
    const [d, m, y] = p.dataValidade.split('/').map(Number);
    const expiry = new Date(y, m - 1, d);
    const diff = expiry.getTime() - now;
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };
  const isExpired = (p: Produto) => {
    const [d, m, y] = p.dataValidade.split('/').map(Number);
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
      list = list.filter(p => !isLowStock(p) && !isExpired(p) && p.estoqueAtual > 0)
    } else if (stockFilter === 'baixo') {
      list = list.filter(p => isLowStock(p))
    } else if (stockFilter === 'sem_estoque') {
      list = list.filter(p => p.estoqueAtual === 0)
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
      loadProdutos();
    }, [loadProdutos])
  );

  useEffect(() => {
    if (!loading && editId && !editTriggered.current && produtos.length > 0) {
      const product = produtos.find(p => p.id === editId);
      if (product) {
        openEdit(product);
        editTriggered.current = true;
      }
    }
  }, [loading, editId, produtos]);

  function openNew() {
    const nextCode = 'P' + String(produtos.length + 1).padStart(3, '0');
    setEditingId(null);
    setForm({ ...emptyForm, codigo: nextCode });
    setErrors({});
    setModalVisible(true);
  }

  function openEdit(produto: Produto) {
    setEditingId(produto.id);
    setForm({
      codigo: produto.codigo,
      nome: produto.nome,
      categoria: produto.categoria,
      unidade: produto.unidade,
      quantidade: produto.quantidade.toString(),
      custo: Math.round(produto.custo * 100).toString(),
      margemLucro: '',
      quebra: '',
      precoVenda: Math.round(produto.precoVenda * 100).toString(),
      estoqueAtual: produto.estoqueAtual.toString(),
      estoqueMinimo: produto.estoqueMinimo.toString(),
      dataValidade: produto.dataValidade,
      fornecedor: produto.fornecedor,
    });
    setErrors({});
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingId(null);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!form.quantidade || isNaN(Number(form.quantidade)) || Number(form.quantidade) <= 0)
      newErrors.quantidade = 'Informe uma quantidade válida';
    if (!form.custo || isNaN(Number(form.custo)) || Number(form.custo) <= 0)
      newErrors.custo = 'Informe um custo válido';
    if (form.margemLucro && (isNaN(Number(form.margemLucro)) || Number(form.margemLucro) < 0))
      newErrors.margemLucro = 'Valor inválido';
    if (form.quebra && (isNaN(Number(form.quebra)) || Number(form.quebra) < 0))
      newErrors.quebra = 'Valor inválido';
    if (form.precoVenda && (isNaN(Number(form.precoVenda)) || Number(form.precoVenda) < 0))
      newErrors.precoVenda = 'Valor inválido';
    if (!form.margemLucro && !form.precoVenda)
      newErrors.precoVenda = 'Informe a margem ou o preço de venda';
    const margemNum = Number(form.margemLucro) || 0;
    const quebraNum = Number(form.quebra) || 0;
    if (!form.estoqueAtual || isNaN(Number(form.estoqueAtual)) || Number(form.estoqueAtual) < 0)
      newErrors.estoqueAtual = 'Informe o estoque atual';
    if (
      form.estoqueMinimo &&
      (isNaN(Number(form.estoqueMinimo)) || Number(form.estoqueMinimo) < 0)
    )
      newErrors.estoqueMinimo = 'Valor inválido';
    if (!form.dataValidade.match(/^\d{2}\/\d{2}\/\d{4}$/))
      newErrors.dataValidade = 'Use o formato DD/MM/AAAA';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function calcPrecoVenda(): number {
    const custo = Number(form.custo) / 100;
    const margem = Number(form.margemLucro) || 0;
    const quebra = Number(form.quebra) || 0;
    if (!custo || custo <= 0) return 0;
    const custoAjustado = custo * (1 + quebra / 100);
    return custoAjustado * (1 + margem / 100);
  }

  async function handleSave() {
    if (!validate()) return;
    const produto: Produto = {
      id: editingId ?? generateId(),
      companyId,
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      quantidade: Number(form.quantidade),
      custo: Number(form.custo) / 100,
      precoVenda: form.precoVenda ? Number(form.precoVenda) / 100 : calcPrecoVenda(),
      estoqueAtual: Number(form.estoqueAtual),
      estoqueMinimo: Number(form.estoqueMinimo) || 0,
      dataValidade: form.dataValidade,
      fornecedor: form.fornecedor.trim(),
      createdAt: editingId
        ? produtos.find((p) => p.id === editingId)?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
    };
    await saveProduto(produto);
    await loadProdutos();
    closeModal();
  }

  function confirmDelete(id: string, nome: string) {
    Alert.alert('Excluir Produto', `Deseja excluir "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteProduto(id);
          await loadProdutos();
        },
      },
    ]);
  }

  function openMovement(type: 'entrada' | 'saida', product: Produto) {
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
    if (movementType === 'saida' && qty > movementProduct.estoqueAtual) {
      Alert.alert('Estoque insuficiente', `Você tem apenas ${movementProduct.estoqueAtual} ${movementProduct.unidade} em estoque.`);
      return;
    }
    const delta = movementType === 'entrada' ? qty : -qty;
    await saveProduto({
      ...movementProduct,
      estoqueAtual: movementProduct.estoqueAtual + delta,
    });
    setMovementModal(false);
    await loadProdutos();
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
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
    if (p.estoqueAtual === 0) return { label: 'Sem Estoque', color: '#ef4444' };
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
          <ThemedText type="small" themeColor="textSecondary" style={styles.cardCategory}>
            {item.categoria}
          </ThemedText>

          <ThemedView style={styles.cardInfoGrid}>
            <ThemedView style={styles.cardInfoItem}>
              <ThemedText style={styles.cardInfoLabel}>Quantidade</ThemedText>
              <ThemedText style={styles.cardInfoValue}>
                {formatQuantity(item.estoqueAtual)} {item.unidade}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.cardInfoItem}>
              <ThemedText style={styles.cardInfoLabel}>Preço</ThemedText>
              <ThemedText style={styles.cardInfoValue}>
                {formatCurrency(item.precoVenda)}/{item.unidade}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.cardInfoItem}>
              <ThemedText style={styles.cardInfoLabel}>Validade</ThemedText>
              <ThemedText style={styles.cardInfoValue}>
                {item.dataValidade}
              </ThemedText>
              {isExpired(item) && (
                <ThemedText type="small" style={{ color: '#ef4444' }}>
                  Vencido
                </ThemedText>
              )}
            </ThemedView>
          </ThemedView>
        </Pressable>

        <ThemedView style={styles.cardActions}>
          {item.estoqueAtual > 0 && (
            <>
              <Pressable
                onPress={() => openMovement('entrada', item)}
                style={[styles.actionButton, { backgroundColor: '#16A34A18' }]}
              >
                <ThemedText style={[styles.actionButtonText, { color: '#16A34A' }]}>Entrada</ThemedText>
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

  function renderInput(
    label: string,
    field: string,
    options?: {
      keyboardType?: 'default' | 'numeric' | 'decimal-pad';
      placeholder?: string;
      multiline?: boolean;
      prefix?: string;
      suffix?: string;
      numeric?: boolean;
      type?: 'text' | 'currency' | 'date';
    }
  ) {
    const adornment = (text: string, position: 'left' | 'right') => (
      <ThemedView
        style={[
          styles.inputAdornment,
          {
            backgroundColor: theme.backgroundElement,
            borderTopLeftRadius: position === 'left' ? Spacing.two - 1 : 0,
            borderBottomLeftRadius: position === 'left' ? Spacing.two - 1 : 0,
            borderTopRightRadius: position === 'right' ? Spacing.two - 1 : 0,
            borderBottomRightRadius: position === 'right' ? Spacing.two - 1 : 0,
          },
        ]}
      >
        <ThemedText type="default" themeColor="textSecondary">
          {text}
        </ThemedText>
      </ThemedView>
    );

    const displayValue =
      options?.type === 'currency' ? formatBRL((form as any)[field]) : (form as any)[field];

    function handleChange(value: string) {
      if (options?.type === 'currency') {
        value = value.replace(/\D/g, '');
      } else if (options?.type === 'date') {
        const digits = value.replace(/\D/g, '').slice(0, 8);
        const parts: string[] = [];
        if (digits.length > 0) parts.push(digits.slice(0, 2));
        if (digits.length > 2) parts.push(digits.slice(2, 4));
        if (digits.length > 4) parts.push(digits.slice(4, 8));
        value = parts.join('/');
      } else if (options?.numeric) {
        value = value.replace(/[^0-9.,]/g, '');
      }
      updateField(field, value);
    }

    return (
      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="smallBold" style={styles.fieldLabel}>
          {label}
        </ThemedText>
        <ThemedView
          style={[
            styles.inputRow,
            {
              borderColor: errors[field] ? '#ef4444' : theme.textSecondary + '55',
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: Spacing.two,
            },
          ]}
        >
          {options?.prefix && adornment(options.prefix, 'left')}
          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderWidth: 0 },
            ]}
            value={displayValue}
            onChangeText={handleChange}
            placeholderTextColor={theme.textSecondary}
            placeholder={options?.placeholder}
            keyboardType={options?.keyboardType ?? 'default'}
            multiline={options?.multiline}
          />
          {options?.suffix && adornment(options.suffix, 'right')}
        </ThemedView>
        {errors[field] && (
          <ThemedText type="small" style={{ color: '#ef4444' }}>
            {errors[field]}
          </ThemedText>
        )}
      </ThemedView>
    );
  }

  const summaryCards = [
    { label: 'Produtos', value: String(summary.totalCount), color: theme.text, filterKey: 'todos' },
    { label: 'Estoque baixo', value: String(summary.lowCount), color: '#eab308', filterKey: 'baixo' },
    { label: 'Vencendo', value: String(summary.expiringCount), color: '#f97316', filterKey: 'vencendo' },
    { label: 'Vencidos', value: String(summary.expiredCount), color: '#ef4444', filterKey: 'vencido' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            📦 Estoque
          </ThemedText>
          <Pressable onPress={openNew} style={[styles.addButton, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>
              + Novo
            </ThemedText>
          </Pressable>
        </ThemedView>

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
                { key: 'vencendo', label: 'Vencendo' },
                { key: 'vencido', label: 'Vencido' },
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
                <ThemedView style={styles.summaryRow}>
                  {summaryCards.map((card) => (
                    <Pressable
                      key={card.label}
                      onPress={() => {
                        setStockFilter(card.filterKey);
                        setActiveTab('estoque');
                      }}
                      style={[styles.summaryCard, { backgroundColor: theme.backgroundElement }, stockFilter === card.filterKey && card.filterKey !== 'todos' && { borderLeftWidth: 3, borderLeftColor: card.color }]}
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

                <ThemedView style={styles.filterRow}>
                  <Pressable
                    onPress={() => { setActiveTab('todos'); setCategoryFilter(null); setStockFilter('todos'); }}
                    style={[styles.filterChip, { backgroundColor: activeTab === 'todos' ? theme.text : theme.backgroundElement }]}
                  >
                    <ThemedText type="small" style={{ fontWeight: '600', color: activeTab === 'todos' ? theme.background : theme.text }}>Todos</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowCategoryDropdown(true)}
                    style={[styles.filterChip, { backgroundColor: categoryFilter ? theme.text : theme.backgroundElement }]}
                  >
                    <ThemedText type="small" style={{ color: categoryFilter ? theme.background : theme.text }}>
                      {categoryFilter ?? 'Categorias'}
                    </ThemedText>
                    <Ionicons name="chevron-down" size={14} color={categoryFilter ? theme.background : theme.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => setShowStockDropdown(true)}
                    style={[styles.filterChip, { backgroundColor: stockFilter !== 'todos' ? theme.text : theme.backgroundElement }]}
                  >
                    <ThemedText type="small" style={{ color: stockFilter !== 'todos' ? theme.background : theme.text }}>
                      {stockFilter === 'todos' ? 'Estoque' : stockFilter === 'normal' ? 'Normal' : stockFilter === 'baixo' ? 'Estoque Baixo' : stockFilter === 'sem_estoque' ? 'Sem Estoque' : stockFilter === 'vencendo' ? 'Vencendo' : 'Vencido'}
                    </ThemedText>
                    <Ionicons name="chevron-down" size={14} color={stockFilter !== 'todos' ? theme.background : theme.textSecondary} />
                  </Pressable>
                </ThemedView>
              </ThemedView>
            }
            ListEmptyComponent={
              <ThemedView style={styles.emptyState}>
                <ThemedText style={styles.emptyEmoji}>📋</ThemedText>
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
                {editingId ? 'Editar Produto' : 'Novo Produto'}
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
              {renderInput('Nome do Produto *', 'nome', { placeholder: 'Ex: Picanha' })}

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  Categoria *
                </ThemedText>
                <ThemedView style={styles.chipsRow}>
                  {CATEGORIAS.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => updateField('categoria', cat)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            form.categoria === cat ? theme.text : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: form.categoria === cat ? theme.background : theme.text,
                        }}
                      >
                        {cat}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  Unidade de Medida *
                </ThemedText>
                <ThemedView style={styles.chipsRow}>
                  {UNIDADES.map((uni) => (
                    <Pressable
                      key={uni}
                      onPress={() => updateField('unidade', uni)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            form.unidade === uni ? theme.text : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: form.unidade === uni ? theme.background : theme.text,
                        }}
                      >
                        {uni}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Quantidade *', 'quantidade', {
                    keyboardType: 'decimal-pad',
                    placeholder: 'Ex: 1',
                    numeric: true,
                  })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Custo *', 'custo', {
                    keyboardType: 'decimal-pad',
                    placeholder: 'Ex: 45,90',
                    prefix: 'R$',
                    type: 'currency',
                  })}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Margem de Lucro *', 'margemLucro', {
                    keyboardType: 'decimal-pad',
                    placeholder: 'Ex: 30',
                    suffix: '%',
                    numeric: true,
                  })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Quebra', 'quebra', {
                    keyboardType: 'decimal-pad',
                    placeholder: 'Ex: 5',
                    suffix: '%',
                    numeric: true,
                  })}
                </ThemedView>
              </ThemedView>

              {renderInput('Preço de Venda *', 'precoVenda', {
                keyboardType: 'decimal-pad',
                placeholder: 'Ex: 59,90',
                prefix: 'R$',
                type: 'currency',
              })}
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: -Spacing.three, marginBottom: Spacing.two }}>
                Preço sugerido: {formatCurrency(calcPrecoVenda())}
              </ThemedText>

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Estoque Atual *', 'estoqueAtual', {
                    keyboardType: 'numeric',
                    placeholder: 'Ex: 15',
                    numeric: true,
                  })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Estoque Mínimo', 'estoqueMinimo', {
                    keyboardType: 'numeric',
                    placeholder: 'Ex: 5',
                    numeric: true,
                  })}
                </ThemedView>
              </ThemedView>

              {renderInput('Data de Validade *', 'dataValidade', {
                placeholder: 'DD/MM/AAAA',
                type: 'date',
              })}

              {renderInput('Fornecedor (opcional)', 'fornecedor', {
                placeholder: 'Ex: Frigorífico X',
              })}

              <Pressable
                onPress={handleSave}
                style={[styles.saveButton, { backgroundColor: theme.text }]}
              >
                <ThemedText style={[styles.saveButtonText, { color: theme.background }]}>
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Movement Modal */}
      <Modal visible={movementModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMovementModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>
                {movementType === 'entrada' ? 'Entrada de Estoque' : 'Saída de Estoque'}
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
                  Estoque atual: {movementProduct?.estoqueAtual} {movementProduct?.unidade}
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
                style={[styles.saveButton, { backgroundColor: movementType === 'entrada' ? '#16A34A' : '#DC2626' }]}
              >
                <ThemedText style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>
                  {movementType === 'entrada' ? 'Adicionar ao Estoque' : 'Remover do Estoque'}
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
  },
  addButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
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
    borderRadius: Spacing.two,
    gap: Spacing.one,
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
    padding: Spacing.four,
    marginBottom: Spacing.three,
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
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
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  // Modal
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
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputAdornment: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
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
    gap: Spacing.three,
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
  },
  saveButtonText: {
    fontWeight: '600',
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
});
