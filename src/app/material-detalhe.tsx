import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getMaterial,
  deleteMaterial,
  updateMaterial,
  calcCustoPorUnidadeBase,
  type Material,
} from '@/services/material-service';
import { createDespesa } from '@/services/despesa-service';
import {
  createLote,
  listAllLotesByProduct,
  updateLote,
  deleteLote,
  gerarCodigoLote,
} from '@/services/lote-service';
import type { Lote } from '@/types/schema';
import { formatCurrency, formatQuantity } from '@/utils/format';
import { UNITS, getUnit, convertUnits, getPriceUnit, calcTotalFromPrice, costToPriceUnit, costFromPriceUnit } from '@/utils/units';

function formatBRL(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const intPart = padded.slice(0, -2).replace(/^0+/, '') || '0';
  const decPart = padded.slice(-2);
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${decPart}`;
}

export default function MaterialDetalheScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [material, setMaterial] = useState<Material | null>(null);
  const [lotes, setLotes] = useState<Lote[]>([]);

  // Novo lote (reposição)
  const [novoLoteVisible, setNovoLoteVisible] = useState(false);
  const [novoLoteQty, setNovoLoteQty] = useState('');
  const [novoLoteUnit, setNovoLoteUnit] = useState('');
  const [novoLotePrecoUnit, setNovoLotePrecoUnit] = useState('');
  const [novoLoteFornecedor, setNovoLoteFornecedor] = useState('');
  const [novoLoteObs, setNovoLoteObs] = useState('');
  const [novoLoteSaving, setNovoLoteSaving] = useState(false);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  // Editar lote existente
  const [editLoteVisible, setEditLoteVisible] = useState(false);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);
  const [editLoteQty, setEditLoteQty] = useState('');
  const [editLoteUnit, setEditLoteUnit] = useState('');
  const [editUnitPickerVisible, setEditUnitPickerVisible] = useState(false);
  const [editLotePrecoUnit, setEditLotePrecoUnit] = useState('');
  const [editLoteObs, setEditLoteObs] = useState('');

  // Editar nome do material
  const [editNomeVisible, setEditNomeVisible] = useState(false);
  const [editNome, setEditNome] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const mat = await getMaterial(id);
    setMaterial(mat);
    if (mat) {
      setNovoLoteUnit(mat.unidadeCompra);
      const allLotes = await listAllLotesByProduct(mat.id);
      setLotes(allLotes.sort((a, b) => {
        const aAtivo = a.ativo && a.quantidadeAtual > 0;
        const bAtivo = b.ativo && b.quantidadeAtual > 0;
        if (aAtivo && !bAtivo) return -1;
        if (!aAtivo && bAtivo) return 1;
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt as any).getTime();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt as any).getTime();
        return dateB - dateA;
      }));
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleBack = useCallback(() => {
    router.replace('/materiais' as any);
  }, [router]);

  // ─── Métricas calculadas dos lotes ────────────────────────────────────────
  const lotesAtivos = lotes.filter(l => l.ativo && l.quantidadeAtual > 0);
  const totalQtd = lotesAtivos.reduce((sum, l) => sum + l.quantidadeAtual, 0);
  const totalValor = lotesAtivos.reduce((sum, l) => sum + l.quantidadeAtual * l.custoUnitario, 0);
  const custoMedio = totalQtd > 0 ? totalValor / totalQtd : 0;

  // ─── Excluir material ─────────────────────────────────────────────────────
  function handleOpenEditNome() {
    if (!material) return;
    setEditNome(material.nome);
    setEditNomeVisible(true);
  }

  async function handleSaveNome() {
    if (!material || !editNome.trim()) {
      Alert.alert('Erro', 'O nome não pode ficar vazio.');
      return;
    }
    try {
      await updateMaterial(material.id, { nome: editNome.trim() });
      setMaterial(prev => prev ? { ...prev, nome: editNome.trim() } : prev);
      setEditNomeVisible(false);
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível salvar o nome.');
    }
  }

  function handleDelete() {
    if (!material) return;
    Alert.alert(
      'Excluir Material',
      `Excluir "${material.nome}"? Receitas que usam este material podem ficar com custo zerado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMaterial(material.id);
              handleBack();
            } catch (e: any) {
              Alert.alert('Erro', e?.message ?? 'Erro ao excluir material.');
            }
          },
        },
      ],
    );
  }

  // ─── Criar novo lote (reposição) ──────────────────────────────────────────
  async function handleSaveNovoLote() {
    if (!material) return;
    const qty = parseFloat(novoLoteQty.replace(',', '.'));
    const precoUnit = novoLotePrecoUnit ? parseFloat(novoLotePrecoUnit.replace(/\D/g, '')) / 100 : 0;

    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erro', 'Informe uma quantidade válida.');
      return;
    }
    if (precoUnit <= 0) {
      Alert.alert('Erro', 'Informe o preço unitário da compra.');
      return;
    }

    setNovoLoteSaving(true);
    try {
      // Converte a quantidade para a unidade de compra do material
      const qtyNaUnidadeCompra = convertUnits(qty, novoLoteUnit, material.unidadeCompra);
      const totalGasto = precoUnit; // precoUnit is now total amount paid

      // Código automático do lote
      const existingCodes = lotes.map(l => l.codigo);
      const codigo = gerarCodigoLote(existingCodes, material.nome.slice(0, 2).toUpperCase());

      await createLote({
        companyId: material.companyId,
        productId: material.id,
        codigo,
        quantidadeInicial: qtyNaUnidadeCompra,
        custoUnitario: qtyNaUnidadeCompra > 0 ? totalGasto / qtyNaUnidadeCompra : 0,
        dataValidade: '',
        dataEntrada: new Date().toLocaleDateString('pt-BR'),
        fornecedor: novoLoteFornecedor.trim(),
        observacao: novoLoteObs.trim(),
        origem: 'reposicao',
      });

      // Atualiza o campo aggregado do material para compatibilidade
      const novaQtdTotal = totalQtd + qtyNaUnidadeCompra;
      const novoPrecoTotal = totalValor + totalGasto;
      await updateMaterial(material.id, {
        quantidadeCompra: novaQtdTotal,
        precoCompra: novoPrecoTotal,
        custoPorUnidadeBase: calcCustoPorUnidadeBase(novoPrecoTotal, novaQtdTotal, material.unidadeCompra),
      });

      // Registra despesa financeira
      if (totalGasto > 0) {
        await createDespesa({
          companyId: material.companyId,
          materialId: material.id,
          descricao: `Lote ${codigo} — ${material.nome}`,
          valor: totalGasto,
          categoria: 'Compra de Produtos',
          data: new Date().toISOString().slice(0, 10),
          observacao: novoLoteObs.trim() || `${qty} ${novoLoteUnit}`,
          pago: true,
        });
      }

      setNovoLoteVisible(false);
      setNovoLoteQty('');
      setNovoLotePrecoUnit('');
      setNovoLoteFornecedor('');
      setNovoLoteObs('');
      await loadData();
      Alert.alert('Lote criado!', `${codigo} adicionado ao estoque.`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao criar lote.');
    } finally {
      setNovoLoteSaving(false);
    }
  }

  // ─── Editar lote ─────────────────────────────────────────────────────────
  function handleOpenEditLote(lote: Lote) {
    setEditingLote(lote);
    setEditLoteQty(String(lote.quantidadeAtual).replace('.', ','));
    setEditLoteUnit(material?.unidadeCompra ?? 'un');
    const totalCurrentValue = lote.quantidadeAtual * lote.custoUnitario;
    setEditLotePrecoUnit(formatBRL(String(Math.round(totalCurrentValue * 100))));
    setEditLoteObs(lote.observacao || '');
    setEditLoteVisible(true);
  }

  async function handleSaveEditLote() {
    if (!editingLote || !material) return;
    const qtyInput = parseFloat(editLoteQty.replace(',', '.'));
    const precoInput = editLotePrecoUnit
      ? parseFloat(editLotePrecoUnit.replace(/\D/g, '')) / 100
      : 0;

    if (isNaN(qtyInput) || qtyInput < 0) {
      Alert.alert('Erro', 'Informe uma quantidade válida.');
      return;
    }

    try {
      const qty = convertUnits(qtyInput, editLoteUnit, material.unidadeCompra);
      const totalGasto = precoInput;
      const precoUnit = qty > 0 ? totalGasto / qty : editingLote.custoUnitario;

      await updateLote(editingLote.id!, {
        quantidadeAtual: qty,
        custoUnitario: precoUnit,
        observacao: editLoteObs.trim(),
        ativo: qty > 0,
      });

      // Recalcula campo aggregado do material
      const updatedLotes = lotes.map(l => l.id === editingLote.id ? { ...l, quantidadeAtual: qty, custoUnitario: precoUnit, ativo: qty > 0 } : l);
      const ativos = updatedLotes.filter(l => l.ativo && l.quantidadeAtual > 0);
      const newQtd = ativos.reduce((sum, l) => sum + l.quantidadeAtual, 0);
      const newPreco = ativos.reduce((sum, l) => sum + l.quantidadeAtual * l.custoUnitario, 0);
      await updateMaterial(material.id, {
        quantidadeCompra: newQtd,
        precoCompra: newPreco,
        custoPorUnidadeBase: calcCustoPorUnidadeBase(newPreco, newQtd, material.unidadeCompra),
      });

      setEditLoteVisible(false);
      setEditingLote(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    }
  }

  // ─── Excluir lote ─────────────────────────────────────────────────────────
  function handleExcluirLote(lote: Lote) {
    Alert.alert(
      `Excluir Lote ${lote.codigo}`,
      'O estoque deste lote será removido definitivamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLote(lote.id!);
              const remaining = lotes.filter(l => l.id !== lote.id && l.ativo && l.quantidadeAtual > 0);
              const newQtd = remaining.reduce((sum, l) => sum + l.quantidadeAtual, 0);
              const newPreco = remaining.reduce((sum, l) => sum + l.quantidadeAtual * l.custoUnitario, 0);
              if (material) {
                await updateMaterial(material.id!, {
                  quantidadeCompra: newQtd,
                  precoCompra: newPreco,
                  custoPorUnidadeBase: calcCustoPorUnidadeBase(newPreco, newQtd, material!.unidadeCompra),
                });
              }
              await loadData();
            } catch (e: any) {
              Alert.alert('Erro', 'Não foi possível excluir o lote.');
            }
          },
        },
      ],
    );
  }

  if (loading || !material) {
    return (
      <ThemedView style={styles.container}>
        <Loading />
      </ThemedView>
    );
  }

  const unidadeLabel = getPriceUnit(material.unidadeCompra);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* ── Header ── */}
        <ThemedView style={styles.backRow}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>{material.nome}</ThemedText>
          <View style={{ width: 60 }} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Resumo do estoque ── */}
          <ThemedView style={styles.resumoRow}>
            <ThemedView style={[styles.resumoCard, { borderColor: theme.primary + '40' }]}>
              <ThemedText type="small" themeColor="textSecondary">Estoque Total</ThemedText>
              <ThemedText style={[styles.resumoValue, { color: totalQtd > 0 ? '#22c55e' : '#ef4444' }]}>
                {formatQuantity(totalQtd)} {material.unidadeCompra}
              </ThemedText>
            </ThemedView>
            <ThemedView style={[styles.resumoCard, { borderColor: theme.primary + '40' }]}>
              <ThemedText type="small" themeColor="textSecondary">Custo Médio / {unidadeLabel}</ThemedText>
              <ThemedText style={[styles.resumoValue, { color: theme.primary }]}>
                {formatCurrency(costToPriceUnit(custoMedio, material.unidadeCompra))}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* ── Informações do material ── */}
          <ThemedView style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">Nome</ThemedText>
            <ThemedText style={styles.value}>{material.nome}</ThemedText>
          </ThemedView>

          {material.fornecedor && (
            <ThemedView style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">Fornecedor</ThemedText>
              <ThemedText style={styles.value}>{material.fornecedor}</ThemedText>
            </ThemedView>
          )}

          {material.observacao && (
            <ThemedView style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">Observação</ThemedText>
              <ThemedText style={styles.value}>{material.observacao}</ThemedText>
            </ThemedView>
          )}

          {/* ── Botões de ação ── */}
          <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
            <Pressable
              onPress={handleOpenEditNome}
              style={[styles.actionButton, { flex: 1, backgroundColor: theme.primary }]}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.one }}>Editar</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setNovoLoteVisible(true)}
              style={[styles.actionButton, { flex: 1, backgroundColor: '#10B981' }]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.one }}>Novo Lote</ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={handleDelete}
            style={[styles.deleteButton, { borderColor: '#DC2626' }]}
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <ThemedText style={{ color: '#DC2626', fontWeight: '700', marginLeft: Spacing.one }}>
              Excluir material
            </ThemedText>
          </Pressable>

          {/* ── Histórico de Lotes ── */}
          <View style={{ marginTop: Spacing.six }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
              <ThemedText type="subtitle" style={{ fontSize: 16 }}>Lotes em Estoque</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{lotes.length} total</ThemedText>
            </View>

            {lotes.length === 0 ? (
              <ThemedView style={[styles.card, { alignItems: 'center', paddingVertical: Spacing.six }]}>
                <Ionicons name="cube-outline" size={32} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two, textAlign: 'center' }}>
                  Nenhum lote registrado.{'\n'}Clique em "Novo Lote" para adicionar.
                </ThemedText>
              </ThemedView>
            ) : (
              lotes.map((lote) => (
                <ThemedView
                  key={lote.id}
                  style={[
                    styles.loteCard,
                    { borderLeftColor: lote.ativo && lote.quantidadeAtual > 0 ? '#22c55e' : '#94a3b8' },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      {/* Código e badge de status */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: 4 }}>
                        <ThemedText style={{ fontWeight: '700', fontSize: 15 }}>{lote.codigo}</ThemedText>
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 99,
                          backgroundColor: lote.ativo && lote.quantidadeAtual > 0 ? '#22c55e22' : '#ef444422',
                        }}>
                          <ThemedText style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color: lote.ativo && lote.quantidadeAtual > 0 ? '#22c55e' : '#ef4444',
                          }}>
                            {lote.ativo && lote.quantidadeAtual > 0 ? 'ATIVO' : 'ESGOTADO'}
                          </ThemedText>
                        </View>
                      </View>

                      {/* Quantidade */}
                      <ThemedText type="small" themeColor="textSecondary">
                        Qtd comprada: <ThemedText style={{ fontWeight: '600', color: theme.text }}>{formatQuantity(lote.quantidadeInicial)} {material.unidadeCompra}</ThemedText>
                      </ThemedText>

                      {/* Custo */}
                      <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                        Custo: <ThemedText style={{ fontWeight: '600', color: theme.primary }}>{formatCurrency(costToPriceUnit(lote.custoUnitario, material.unidadeCompra))}</ThemedText>/{unidadeLabel}
                      </ThemedText>

                      {/* Observação / Fornecedor */}
                      {lote.observacao && !lote.observacao.includes(`— ${material.nome}`) ? (
                        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                          {lote.observacao}
                        </ThemedText>
                      ) : null}
                      {lote.fornecedor ? (
                        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                          Fornecedor: {lote.fornecedor}
                        </ThemedText>
                      ) : null}

                      {/* Data de entrada */}
                      <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                        Entrada: {lote.dataEntrada}
                      </ThemedText>
                    </View>

                    {/* Ações */}
                    <View style={{ alignItems: 'flex-end', gap: Spacing.two }}>
                      <ThemedText style={{ fontWeight: '700', color: theme.primary }}>
                        {formatCurrency(lote.quantidadeInicial * lote.custoUnitario)}
                      </ThemedText>
                      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                        <Pressable onPress={() => handleOpenEditLote(lote)} style={styles.iconBtn}>
                          <Ionicons name="pencil" size={16} color={theme.text} />
                        </Pressable>
                        <Pressable onPress={() => handleExcluirLote(lote)} style={styles.iconBtn}>
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </ThemedView>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ══════ Modal: Novo Lote ══════ */}
      <Modal
        visible={novoLoteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNovoLoteVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[{ flex: 1, backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {unitPickerVisible ? (
              /* ── Seletor de unidade ── */
              <View style={{ flex: 1 }}>
                <View style={styles.modalHeader}>
                  <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>Unidade</ThemedText>
                  <Pressable onPress={() => setUnitPickerVisible(false)}>
                    <ThemedText themeColor="textSecondary">Voltar</ThemedText>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}>
                  {UNITS.map((u) => {
                    const selected = novoLoteUnit === u.code;
                    return (
                      <Pressable
                        key={u.code}
                        onPress={() => { setNovoLoteUnit(u.code); setUnitPickerVisible(false); }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: Spacing.three,
                          borderRadius: Spacing.two,
                          borderWidth: 1,
                          backgroundColor: selected ? theme.backgroundElement : theme.background,
                          borderColor: selected ? theme.primary : 'rgba(128,128,128,0.2)',
                        }}
                      >
                        <ThemedText style={{ color: selected ? theme.primary : theme.text }}>{u.label}</ThemedText>
                        {selected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              /* ── Formulário do lote ── */
              <>
                <View style={styles.modalHeader}>
                  <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>Novo Lote</ThemedText>
                  <Pressable onPress={() => setNovoLoteVisible(false)}>
                    <ThemedText themeColor="textSecondary">Cancelar</ThemedText>
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">

                  {/* Quantidade + Unidade */}
                  <View style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Quantidade comprada *</ThemedText>
                    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                      <TextInput
                        style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.backgroundElement }]}
                        placeholder="Ex: 10"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="decimal-pad"
                        value={novoLoteQty}
                        onChangeText={setNovoLoteQty}
                      />
                      <Pressable
                        onPress={() => setUnitPickerVisible(true)}
                        style={{ height: 48, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ThemedText style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>{novoLoteUnit}</ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  {/* Preço unitário */}
                  <View style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Valor total pago *</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundElement, borderRadius: Spacing.two, overflow: 'hidden' }}>
                      <View style={{ paddingHorizontal: Spacing.three }}>
                        <ThemedText themeColor="textSecondary">R$</ThemedText>
                      </View>
                      <TextInput
                        style={{ flex: 1, height: 48, paddingHorizontal: Spacing.two, fontSize: 20, fontWeight: '700', color: theme.text }}
                        placeholder="0,00"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                        value={novoLotePrecoUnit}
                        onChangeText={(v) => setNovoLotePrecoUnit(formatBRL(v))}
                      />
                    </View>
                  </View>

                  {/* Fornecedor */}
                  <View style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Fornecedor (opcional)</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                      placeholder="Nome do fornecedor"
                      placeholderTextColor={theme.textSecondary}
                      value={novoLoteFornecedor}
                      onChangeText={setNovoLoteFornecedor}
                    />
                  </View>

                  {/* Observação */}
                  <View style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Observação (opcional)</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                      placeholder="Qualquer anotação"
                      placeholderTextColor={theme.textSecondary}
                      value={novoLoteObs}
                      onChangeText={setNovoLoteObs}
                    />
                  </View>

                  <Pressable
                    onPress={handleSaveNovoLote}
                    disabled={novoLoteSaving}
                    style={[styles.saveButton, { backgroundColor: '#10B981', opacity: novoLoteSaving ? 0.6 : 1 }]}
                  >
                    {novoLoteSaving ? <ActivityIndicator size="small" color="#fff" /> : (
                      <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                        Adicionar Lote ao Estoque
                      </ThemedText>
                    )}
                  </Pressable>
                </ScrollView>
              </>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════ Modal: Editar Lote ══════ */}
      <Modal
        visible={editLoteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditLoteVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[{ flex: 1, backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {editUnitPickerVisible ? (
              /* ── Seletor de unidade ── */
              <View style={{ flex: 1 }}>
                <View style={styles.modalHeader}>
                  <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>Unidade</ThemedText>
                  <Pressable onPress={() => setEditUnitPickerVisible(false)}>
                    <ThemedText themeColor="textSecondary">Voltar</ThemedText>
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}>
                  {UNITS.map((u) => {
                    const selected = editLoteUnit === u.code;
                    return (
                      <Pressable
                        key={u.code}
                        onPress={() => { setEditLoteUnit(u.code); setEditUnitPickerVisible(false); }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: Spacing.three,
                          borderRadius: Spacing.two,
                          borderWidth: 1,
                          backgroundColor: selected ? theme.backgroundElement : theme.background,
                          borderColor: selected ? theme.primary : 'rgba(128,128,128,0.2)',
                        }}
                      >
                        <ThemedText style={{ color: selected ? theme.primary : theme.text }}>{u.label}</ThemedText>
                        {selected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>Editar Lote {editingLote?.codigo}</ThemedText>
                  <Pressable onPress={() => setEditLoteVisible(false)}>
                    <ThemedText themeColor="textSecondary">Cancelar</ThemedText>
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">
                  <View style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Quantidade Atual</ThemedText>
                    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                      <TextInput
                        style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.backgroundElement }]}
                        placeholder="Qtd atual em estoque"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="decimal-pad"
                        value={editLoteQty}
                        onChangeText={setEditLoteQty}
                      />
                      <Pressable
                        onPress={() => setEditUnitPickerVisible(true)}
                        style={{ height: 48, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ThemedText style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>{editLoteUnit}</ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Valor total pago</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundElement, borderRadius: Spacing.two, overflow: 'hidden' }}>
                      <View style={{ paddingHorizontal: Spacing.three }}>
                        <ThemedText themeColor="textSecondary">R$</ThemedText>
                      </View>
                      <TextInput
                        style={{ flex: 1, height: 48, paddingHorizontal: Spacing.two, fontSize: 20, fontWeight: '700', color: theme.text }}
                        placeholder="0,00"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                        value={editLotePrecoUnit}
                        onChangeText={(v) => setEditLotePrecoUnit(formatBRL(v))}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <ThemedText type="smallBold" style={styles.fieldLabel}>Observação</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                      placeholder="Observação opcional"
                      placeholderTextColor={theme.textSecondary}
                      value={editLoteObs}
                      onChangeText={setEditLoteObs}
                    />
                  </View>

                  <Pressable
                    onPress={handleSaveEditLote}
                    style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  >
                    <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                      Salvar Alterações
                    </ThemedText>
                  </Pressable>
                </ScrollView>
              </>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════ Modal: Editar Nome ══════ */}
      <Modal
        visible={editNomeVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditNomeVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[{ flex: 1, backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>Editar Material</ThemedText>
              <Pressable onPress={() => setEditNomeVisible(false)}>
                <ThemedText themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">
              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Nome do Material</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 18 }]}
                  placeholder="Ex: Açúcar refinado"
                  placeholderTextColor={theme.textSecondary}
                  value={editNome}
                  onChangeText={setEditNome}
                  autoFocus
                />
              </View>
              <Pressable
                onPress={handleSaveNome}
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                  Salvar Nome
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
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.six },
  resumoRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  resumoCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: 4,
  },
  resumoValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.one,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  loteCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    borderLeftWidth: 4,
    marginBottom: Spacing.two,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalForm: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  fieldLabel: {
    marginLeft: Spacing.one,
    color: '#888',
    fontSize: 12,
  },
  input: {
    height: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  saveButton: {
    height: 52,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
});
