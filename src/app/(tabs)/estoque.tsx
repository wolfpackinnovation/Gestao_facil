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
import {
  getProdutos,
  saveProduto,
  formatCurrency,
  CATEGORIAS,
  UNIDADES,
  type Produto,
  type UnidadeMedida,
} from '@/services/estoque-storage';
import { createLote, listAllLotesByProduct, gerarCodigoLote } from '@/services/lote-service';
import type { Lote } from '@/types/schema';
import { formatQuantity } from '@/utils/format';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const produtoEmptyForm = {
  codigo: '',
  nome: '',
  categoria: CATEGORIAS[0],
  unidade: 'un' as UnidadeMedida,
  quantidade: '1',
  margemLucro: '',
  quebra: '',
  precoVenda: '',
  estoqueMinimo: '',
  custoInicial: '',
  dataValidadeInicial: '',
  fornecedorInicial: '',
  quantidadeInicial: '',
};

const loteEmptyForm = {
  codigo: '',
  quantidade: '',
  custoUnitario: '',
  dataValidade: '',
  dataEntrada: '',
  fornecedor: '',
  observacao: '',
};

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function EstoqueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const editTriggered = useRef(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoModalVisible, setProdutoModalVisible] = useState(false);
  const [loteModalVisible, setLoteModalVisible] = useState(false);
  const [loteProductId, setLoteProductId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...produtoEmptyForm });
  const [loteForm, setLoteForm] = useState({ ...loteEmptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loteErrors, setLoteErrors] = useState<Record<string, string>>({});
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
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  const [movementQty, setMovementQty] = useState('');

  const isLowStock = (p: Produto) => p.estoqueMinimo > 0 && (p.estoqueAtual ?? 0) <= p.estoqueMinimo;
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
      loadProdutos();
    }, [loadProdutos])
  );

  function openNew() {
    const nextCode = 'P' + String(produtos.length + 1).padStart(3, '0');
    setEditingId(null);
    setForm({ ...produtoEmptyForm, codigo: nextCode });
    setErrors({});
    setProdutoModalVisible(true);
  }

  function openEdit(produto: Produto) {
    setEditingId(produto.id);
    setForm({
      codigo: produto.codigo,
      nome: produto.nome,
      categoria: produto.categoria,
      unidade: produto.unidade,
      quantidade: (produto.quantidade ?? 1).toString(),
      margemLucro: '',
      quebra: '',
      precoVenda: Math.round(produto.precoVenda * 100).toString(),
      estoqueMinimo: produto.estoqueMinimo.toString(),
      custoInicial: '',
      dataValidadeInicial: '',
      fornecedorInicial: '',
      quantidadeInicial: '',
    });
    setErrors({});
    setProdutoModalVisible(true);
  }

  useEffect(() => {
    if (!loading && editId && !editTriggered.current && produtos.length > 0) {
      const product = produtos.find(p => p.id === editId);
      if (product) {
        openEdit(product);
        editTriggered.current = true;
      }
    }
  }, [loading, editId, produtos]);

  function closeProdutoModal() {
    setProdutoModalVisible(false);
    setEditingId(null);
  }

  function validateProduto(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (editingId) {
      if (!form.quantidade || isNaN(Number(form.quantidade)) || Number(form.quantidade) <= 0)
        newErrors.quantidade = 'Informe uma quantidade válida';
    }
    if (form.margemLucro && (isNaN(Number(form.margemLucro)) || Number(form.margemLucro) < 0))
      newErrors.margemLucro = 'Valor inválido';
    if (form.quebra && (isNaN(Number(form.quebra)) || Number(form.quebra) < 0))
      newErrors.quebra = 'Valor inválido';
    if (form.precoVenda && (isNaN(Number(form.precoVenda)) || Number(form.precoVenda) < 0))
      newErrors.precoVenda = 'Valor inválido';
    if (!form.margemLucro && !form.precoVenda)
      newErrors.precoVenda = 'Informe a margem ou o preço de venda';
    if (!form.estoqueMinimo || isNaN(Number(form.estoqueMinimo)) || Number(form.estoqueMinimo) < 0)
      newErrors.estoqueMinimo = 'Informe o estoque mínimo';

    if (!editingId) {
      if (!form.custoInicial || isNaN(Number(form.custoInicial)) || Number(form.custoInicial) <= 0)
        newErrors.custoInicial = 'Informe o custo do lote';
      if (!form.quantidadeInicial || isNaN(Number(form.quantidadeInicial)) || Number(form.quantidadeInicial) <= 0)
        newErrors.quantidadeInicial = 'Informe a quantidade';
      if (!form.dataValidadeInicial.match(/^\d{2}\/\d{2}\/\d{4}$/))
        newErrors.dataValidadeInicial = 'Use o formato DD/MM/AAAA';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function calcPrecoVenda(): number {
    const custo = Number(form.custoInicial) / 100;
    const margem = Number(form.margemLucro) || 0;
    const quebra = Number(form.quebra) || 0;
    if (!custo || custo <= 0) return 0;
    const custoAjustado = custo * (1 + quebra / 100);
    return custoAjustado * (1 + margem / 100);
  }

  async function handleSaveProduto() {
    if (!validateProduto()) return;
    const id = editingId ?? generateId();
    const existing = editingId ? produtos.find(p => p.id === editingId) : null;
    const isNew = !editingId
    const produto: Produto = {
      id,
      companyId,
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      quantidade: isNew ? 1 : Number(form.quantidade),
      custo: form.custoInicial ? Number(form.custoInicial) / 100 : (existing?.custo ?? 0),
      precoVenda: form.precoVenda ? Number(form.precoVenda) / 100 : calcPrecoVenda(),
      estoqueMinimo: Number(form.estoqueMinimo) || 0,
      dataValidade: form.dataValidadeInicial || existing?.dataValidade || '',
      fornecedor: form.fornecedorInicial.trim() || existing?.fornecedor || '',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await saveProduto(produto);

    if (isNew && Number(form.quantidadeInicial) > 0) {
      const todosLotes = await listAllLotesByProduct(id);
      const codigosExistentes = todosLotes.map(l => l.codigo);
      const codigoLote = gerarCodigoLote(codigosExistentes);
      await createLote({
        companyId,
        productId: id,
        codigo: codigoLote,
        quantidadeInicial: Number(form.quantidadeInicial),
        custoUnitario: Number(form.custoInicial) / 100,
        dataValidade: form.dataValidadeInicial,
        dataEntrada: todayBR(),
        fornecedor: form.fornecedorInicial.trim(),
        origem: 'cadastro-inicial',
      });
    }

    await loadProdutos();
    closeProdutoModal();
  }

  async function openLoteModal(productId: string) {
    setLoteProductId(productId);
    const todosLotes = await listAllLotesByProduct(productId);
    const codigosExistentes = todosLotes.map(l => l.codigo);
    setLoteForm({
      ...loteEmptyForm,
      codigo: gerarCodigoLote(codigosExistentes),
      dataEntrada: todayBR(),
    });
    setLoteErrors({});
    setLoteModalVisible(true);
  }

  function closeLoteModal() {
    setLoteModalVisible(false);
    setLoteProductId(null);
  }

  function validateLote(): boolean {
    const newErrors: Record<string, string> = {};
    if (!loteForm.quantidade || isNaN(Number(loteForm.quantidade)) || Number(loteForm.quantidade) <= 0)
      newErrors.quantidade = 'Informe a quantidade';
    if (!loteForm.custoUnitario || isNaN(Number(loteForm.custoUnitario)) || Number(loteForm.custoUnitario) <= 0)
      newErrors.custoUnitario = 'Informe o custo';
    if (!loteForm.dataValidade.match(/^\d{2}\/\d{2}\/\d{4}$/))
      newErrors.dataValidade = 'Use o formato DD/MM/AAAA';
    if (!loteForm.dataEntrada.match(/^\d{2}\/\d{2}\/\d{4}$/))
      newErrors.dataEntrada = 'Use o formato DD/MM/AAAA';
    setLoteErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSaveLote() {
    if (!validateLote() || !loteProductId) return;
    await createLote({
      companyId,
      productId: loteProductId,
      codigo: loteForm.codigo.trim() || gerarCodigoLote([]),
      quantidadeInicial: Number(loteForm.quantidade),
      custoUnitario: Number(loteForm.custoUnitario) / 100,
      dataValidade: loteForm.dataValidade,
      dataEntrada: loteForm.dataEntrada,
      fornecedor: loteForm.fornecedor.trim(),
      observacao: loteForm.observacao.trim() || undefined,
    });
    await loadProdutos();
    closeLoteModal();
  }

  async function openMovement(type: 'entrada' | 'saida', product: Produto) {
    setMovementType(type);
    setMovementProduct(product);
    setMovementQty('');
    setSelectedLoteId(null);
    setLotesLoading(true);
    setMovementModal(true);
    const all = await listAllLotesByProduct(product.id);
    setLotes(all.filter(l => l.ativo && l.quantidadeAtual > 0));
    setLotesLoading(false);
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

    if (selectedLoteId) {
      const { ajustarLote } = await import('@/services/lote-service');
      const lote = lotes.find(l => l.id === selectedLoteId);
      if (lote) {
        const novaQtd = movementType === 'entrada' ? lote.quantidadeAtual + qty : lote.quantidadeAtual - qty;
        if (movementType === 'saida' && qty > lote.quantidadeAtual) {
          Alert.alert('Estoque insuficiente no lote', `Lote ${lote.codigo} tem apenas ${lote.quantidadeAtual} ${movementProduct.unidade}.`);
          return;
        }
        await ajustarLote(selectedLoteId, novaQtd, movementType === 'entrada' ? 'Entrada manual' : 'Saída manual');
      }
    } else {
      const { consumirEstoqueFEFO } = await import('@/services/lote-service');
      if (movementType === 'entrada') {
        const today = new Date();
        const dataBR = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        const validade = new Date(today);
        validade.setDate(validade.getDate() + 30);
        const validadeBR = `${String(validade.getDate()).padStart(2, '0')}/${String(validade.getMonth() + 1).padStart(2, '0')}/${validade.getFullYear()}`;
        const todosLotes = await listAllLotesByProduct(movementProduct.id);
        const codigoLote = gerarCodigoLote(todosLotes.map(l => l.codigo));
        await createLote({
          companyId,
          productId: movementProduct.id,
          codigo: codigoLote,
          quantidadeInicial: qty,
          custoUnitario: movementProduct.custoMedio ?? movementProduct.custo,
          dataValidade: validadeBR,
          dataEntrada: dataBR,
          fornecedor: '',
          origem: 'entrada-manual',
        });
      } else {
        const result = await consumirEstoqueFEFO(movementProduct.id, qty, {
          tipo: 'saida',
          motivo: 'Saída manual',
        });
        if (!result.sucesso) {
          Alert.alert('Erro', result.mensagem ?? 'Não foi possível dar saída no estoque.');
          return;
        }
      }
    }
    setMovementModal(false);
    await loadProdutos();
  }

  function updateField(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  function updateLoteField(field: string, value: any) {
    setLoteForm((prev) => ({ ...prev, [field]: value }));
    if (loteErrors[field]) {
      setLoteErrors((prev) => {
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
          <ThemedText type="small" themeColor="textSecondary" style={styles.cardCategory}>
            {item.categoria}
          </ThemedText>

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
            <ThemedView style={styles.cardInfoItem}>
              <ThemedText style={styles.cardInfoLabel}>Validade</ThemedText>
              <ThemedText style={styles.cardInfoValue}>
                {item.proximaValidade || '---'}
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
          {(item.estoqueAtual ?? 0) > 0 && (
            <>
              <Pressable
                onPress={() => openMovement('entrada', item)}
                style={[styles.actionButton, { backgroundColor: '#C4956A18' }]}
              >
                <ThemedText style={[styles.actionButtonText, { color: '#C4956A' }]}>Entrada</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => openMovement('saida', item)}
                style={[styles.actionButton, { backgroundColor: '#DC262618' }]}
              >
                <ThemedText style={[styles.actionButtonText, { color: '#DC2626' }]}>Saída</ThemedText>
              </Pressable>
            </>
          )}
          <Pressable
            onPress={() => openLoteModal(item.id)}
            style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>+ Lote</ThemedText>
          </Pressable>
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
    },
    state: 'produto' | 'lote' = 'produto'
  ) {
    const valueField = state === 'produto' ? form : loteForm;
    const errorsMap = state === 'produto' ? errors : loteErrors;
    const onChange = (v: any) => state === 'produto' ? updateField(field, v) : updateLoteField(field, v);

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
      options?.type === 'currency' ? formatBRL((valueField as any)[field]) : (valueField as any)[field];

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
      onChange(value);
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
              borderColor: errorsMap[field] ? '#ef4444' : theme.textSecondary + '55',
              borderWidth: 1,
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
        {errorsMap[field] && (
          <ThemedText type="small" style={{ color: '#ef4444' }}>
            {errorsMap[field]}
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
                <ThemedView style={styles.header}>
                  <ThemedText type="title" style={styles.headerTitle}>
                    📦 Estoque
                  </ThemedText>
                  <Pressable onPress={openNew} style={styles.addButton}>
                    <ThemedText style={styles.addButtonText}>+ Novo</ThemedText>
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

                <ThemedView style={styles.filterRow}>
                  <Pressable
                    onPress={() => { setActiveTab('todos'); setCategoryFilter(null); setStockFilter('todos'); }}
                    style={[styles.filterChip, { backgroundColor: activeTab === 'todos' ? '#C4956A' : theme.backgroundElement }]}
                  >
                    <ThemedText type="small" style={{ fontWeight: '600', color: activeTab === 'todos' ? '#fff' : theme.text }}>Todos</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowCategoryDropdown(true)}
                    style={[styles.filterChip, { backgroundColor: categoryFilter ? '#C4956A' : theme.backgroundElement }]}
                  >
                    <ThemedText type="small" style={{ color: categoryFilter ? '#fff' : theme.text }}>
                      {categoryFilter ?? 'Categorias'}
                    </ThemedText>
                    <Ionicons name="chevron-down" size={14} color={categoryFilter ? '#fff' : theme.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => setShowStockDropdown(true)}
                    style={[styles.filterChip, { backgroundColor: stockFilter !== 'todos' ? '#C4956A' : theme.backgroundElement }]}
                  >
                    <ThemedText type="small" style={{ color: stockFilter !== 'todos' ? '#fff' : theme.text }}>
                      {stockFilter === 'todos' ? 'Estoque' : stockFilter === 'normal' ? 'Normal' : stockFilter === 'baixo' ? 'Estoque Baixo' : stockFilter === 'sem_estoque' ? 'Sem Estoque' : stockFilter === 'vencendo' ? 'Vencendo' : 'Vencido'}
                    </ThemedText>
                    <Ionicons name="chevron-down" size={14} color={stockFilter !== 'todos' ? '#fff' : theme.textSecondary} />
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

      {/* Modal de Produto */}
      <Modal
        visible={produtoModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProdutoModal}
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
              <Pressable onPress={closeProdutoModal}>
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
                            form.categoria === cat ? theme.primary : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: form.categoria === cat ? '#ffffff' : theme.text,
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
                            form.unidade === uni ? theme.primary : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: form.unidade === uni ? '#ffffff' : theme.text,
                        }}
                      >
                        {uni}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </ThemedView>

              {!editingId ? null : renderInput('Unidades por Embalagem *', 'quantidade', {
                keyboardType: 'decimal-pad',
                placeholder: 'Ex: 1 (quantas unidades tem em 1 embalagem)',
                numeric: true,
              })}

              {!editingId && (
                <ThemedView style={styles.loteBox}>
                  <ThemedText type="smallBold" style={styles.loteBoxTitle}>
                    📦 Primeiro Lote (entrada de estoque)
                  </ThemedText>

                  <ThemedView style={styles.rowFields}>
                    <ThemedView style={styles.halfField}>
                      {renderInput('Quantidade *', 'quantidadeInicial', {
                        keyboardType: 'decimal-pad',
                        placeholder: 'Ex: 10',
                        numeric: true,
                      }, 'produto')}
                    </ThemedView>
                    <ThemedView style={styles.halfField}>
                      {renderInput('Custo unitário *', 'custoInicial', {
                        keyboardType: 'decimal-pad',
                        placeholder: 'Ex: 45,90',
                        prefix: 'R$',
                        type: 'currency',
                      }, 'produto')}
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.rowFields}>
                    <ThemedView style={styles.halfField}>
                      {renderInput('Margem *', 'margemLucro', {
                        keyboardType: 'decimal-pad',
                        placeholder: 'Ex: 30',
                        suffix: '%',
                        numeric: true,
                      }, 'produto')}
                    </ThemedView>
                    <ThemedView style={styles.halfField}>
                      {renderInput('Quebra', 'quebra', {
                        keyboardType: 'decimal-pad',
                        placeholder: 'Ex: 5',
                        suffix: '%',
                        numeric: true,
                      }, 'produto')}
                    </ThemedView>
                  </ThemedView>

                  {renderInput('Preço de Venda *', 'precoVenda', {
                    keyboardType: 'decimal-pad',
                    placeholder: 'Ex: 59,90',
                    prefix: 'R$',
                    type: 'currency',
                  }, 'produto')}
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: -Spacing.three, marginBottom: Spacing.two }}>
                    Preço sugerido: {formatCurrency(calcPrecoVenda())}
                  </ThemedText>

                  {renderInput('Data de Validade *', 'dataValidadeInicial', {
                    placeholder: 'DD/MM/AAAA',
                    type: 'date',
                  }, 'produto')}

                  {renderInput('Fornecedor (opcional)', 'fornecedorInicial', {
                    placeholder: 'Ex: Frigorífico X',
                  }, 'produto')}
                </ThemedView>
              )}

              {editingId && (
                <>
                  <ThemedView style={styles.rowFields}>
                    <ThemedView style={styles.halfField}>
                      {renderInput('Margem de Lucro', 'margemLucro', {
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

                  <ThemedView type="backgroundElement" style={styles.infoBox}>
                    <Ionicons name="information-circle" size={18} color={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                      Estoque, validade e custo são controlados pelos lotes. Cadastre novos lotes para adicionar estoque.
                    </ThemedText>
                  </ThemedView>
                </>
              )}

              {renderInput('Estoque Mínimo *', 'estoqueMinimo', {
                keyboardType: 'decimal-pad',
                placeholder: 'Ex: 5',
                numeric: true,
              })}

              <Pressable
                onPress={handleSaveProduto}
                style={styles.saveButton}
              >
                <ThemedText style={styles.saveButtonText}>
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Lote */}
      <Modal
        visible={loteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeLoteModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                Novo Lote
              </ThemedText>
              <Pressable onPress={closeLoteModal}>
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
              {renderInput('Código do Lote *', 'codigo', {
                placeholder: 'Ex: LT001',
              }, 'lote')}

              {renderInput('Quantidade *', 'quantidade', {
                keyboardType: 'decimal-pad',
                placeholder: 'Ex: 10',
                numeric: true,
              }, 'lote')}

              {renderInput('Custo Unitário *', 'custoUnitario', {
                keyboardType: 'decimal-pad',
                placeholder: 'Ex: 45,90',
                prefix: 'R$',
                type: 'currency',
              }, 'lote')}

              {renderInput('Data de Validade *', 'dataValidade', {
                placeholder: 'DD/MM/AAAA',
                type: 'date',
              }, 'lote')}

              {renderInput('Data de Entrada *', 'dataEntrada', {
                placeholder: 'DD/MM/AAAA',
                type: 'date',
              }, 'lote')}

              {renderInput('Fornecedor (opcional)', 'fornecedor', {
                placeholder: 'Ex: Frigorífico X',
              }, 'lote')}

              {renderInput('Observação (opcional)', 'observacao', {
                placeholder: 'Ex: Nota fiscal 12345',
                multiline: true,
              }, 'lote')}

              <Pressable
                onPress={handleSaveLote}
                style={styles.saveButton}
              >
                <ThemedText style={styles.saveButtonText}>
                  Cadastrar Lote
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
                  Estoque atual: {movementProduct?.estoqueAtual ?? 0} {movementProduct?.unidade}
                </ThemedText>
              </ThemedView>

              {movementType === 'saida' && !lotesLoading && lotes.length > 1 && (
                <ThemedView style={styles.fieldGroup}>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Lote (opcional - padrão FEFO)</ThemedText>
                  <ThemedView style={styles.chipsRow}>
                    <Pressable
                      onPress={() => setSelectedLoteId(null)}
                      style={[styles.chip, { backgroundColor: !selectedLoteId ? theme.primary : theme.backgroundElement }]}
                    >
                      <ThemedText type="small" style={{ color: !selectedLoteId ? '#fff' : theme.text }}>
                        FEFO (auto)
                      </ThemedText>
                    </Pressable>
                    {lotes.map((l) => (
                      <Pressable
                        key={l.id}
                        onPress={() => setSelectedLoteId(l.id ?? null)}
                        style={[styles.chip, { backgroundColor: selectedLoteId === l.id ? theme.primary : theme.backgroundElement }]}
                      >
                        <ThemedText type="small" style={{ color: selectedLoteId === l.id ? '#fff' : theme.text }}>
                          {l.codigo} ({l.quantidadeAtual})
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ThemedView>
                </ThemedView>
              )}

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
  emptyEmoji: {
    fontSize: 48,
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
    backgroundColor: '#C4956A',
  },
  saveButtonText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#fff',
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
    backgroundColor: 'rgba(196, 149, 106, 0.08)',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(196, 149, 106, 0.3)',
  },
  loteBoxTitle: {
    color: '#C4956A',
    marginBottom: Spacing.half,
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
