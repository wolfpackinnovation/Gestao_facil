import { useState, useCallback } from 'react'
import { StyleSheet, Pressable, Alert, ScrollView, View, Modal, KeyboardAvoidingView, Platform, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import Ionicons from '@expo/vector-icons/Ionicons'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useTheme } from '@/hooks/use-theme'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import {
  getProduto,
  deleteProduto,
  saveProduto,
  formatCurrency,
  type Produto,
} from '@/services/estoque-storage'

import { formatQuantity } from '@/utils/format'
import { getRecipe, type Recipe } from '@/services/recipe-service'
import { getMaterials, updateMaterial, type Material } from '@/services/material-service'
import { convertToBase } from '@/utils/units'
import { listAllLotesByProduct, deleteLote, updateLote, consumirEstoqueFEFO, createLoteMovimento } from '@/services/lote-service'
import type { Lote } from '@/types/schema'

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function ProdutoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useTheme()
  const [produto, setProduto] = useState<Produto | null>(null)
  const [loading, setLoading] = useState(true)

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [deductMaterials, setDeductMaterials] = useState(true)
  const [lotes, setLotes] = useState<Lote[]>([])

  // Editar lote existente
  const [editLoteVisible, setEditLoteVisible] = useState(false);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);
  const [editLoteQty, setEditLoteQty] = useState('');
  const [editLoteCusto, setEditLoteCusto] = useState('');
  const [editLoteObs, setEditLoteObs] = useState('');

  // Editar Produto
  const [editProdVisible, setEditProdVisible] = useState(false);
  const [editProdName, setEditProdName] = useState('');

  // Registrar Desperdício
  const [desperdicioVisible, setDesperdicioVisible] = useState(false);
  const [desperdicioQty, setDesperdicioQty] = useState('');
  const [desperdicioMotivo, setDesperdicioMotivo] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const p = await getProduto(id as string)
    setProduto(p)
    if (p) {
      const rec = await getRecipe(p.id).catch(() => null)
      setRecipe(rec)
      if (rec) {
        const mats = await getMaterials(p.companyId).catch(() => [])
        setMaterials(mats)
      }
      const allLotes = await listAllLotesByProduct(p.id).catch(() => [])
      setLotes(allLotes.sort((a, b) => {
        const aAtivo = a.ativo && a.quantidadeAtual > 0;
        const bAtivo = b.ativo && b.quantidadeAtual > 0;
        if (aAtivo && !bAtivo) return -1;
        if (!aAtivo && bAtivo) return 1;
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt as any).getTime();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt as any).getTime();
        return dateB - dateA;
      }))
    }
    setLoading(false)
  }, [id])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  function formatBRL(cents: string): string {
    const digits = cents.replace(/\D/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2).replace(/^0+/, '') || '0';
    const decPart = padded.slice(-2);
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatted},${decPart}`;
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Carregando...</ThemedText>
        </SafeAreaView>
      </ThemedView>
    )
  }

  if (!produto) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Produto não encontrado.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    )
  }

  const handleDelete = () => {
    Alert.alert('Excluir Produto', `Deseja excluir "${produto.nome}"? Todos os lotes e movimentações também serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteProduto(produto.id)
          router.navigate('/(tabs)/estoque' as any)
        },
      },
    ])
  }

  function handleOpenEditLote(lote: Lote) {
    setEditingLote(lote);
    setEditLoteQty(String(lote.quantidadeAtual).replace('.', ','));
    setEditLoteCusto(formatBRL(String(Math.round(lote.custoUnitario * 100))));
    setEditLoteObs(lote.observacao || '');
    setEditLoteVisible(true);
  }

  async function handleSaveEditLote() {
    if (!editingLote || !produto) return;
    const qty = parseFloat(editLoteQty.replace(',', '.'));
    const custo = editLoteCusto ? parseFloat(editLoteCusto.replace(/\D/g, '')) / 100 : editingLote.custoUnitario;

    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erro', 'Informe uma quantidade válida.');
      return;
    }

    if (!editingLote?.id) return;

    try {
      await updateLote(editingLote.id, {
        quantidadeAtual: qty,
        custoUnitario: custo,
        observacao: editLoteObs.trim(),
        ativo: qty > 0,
      });

      // Recalcula campo aggregado do produto
      const updatedLotes = lotes.map(l => l.id === editingLote.id ? { ...l, quantidadeAtual: qty, custoUnitario: custo, ativo: qty > 0 } : l);
      const ativos = updatedLotes.filter(l => l.ativo && l.quantidadeAtual > 0);
      const newQtd = ativos.reduce((sum, l) => sum + l.quantidadeAtual, 0);
      
      await saveProduto({
        ...produto,
        estoqueAtual: newQtd,
      });

      setEditLoteVisible(false);
      setEditingLote(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    }
  }

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
            if (!lote.id) return;
            try {
              await deleteLote(lote.id);
              const remaining = lotes.filter(l => l.id !== lote.id && l.ativo && l.quantidadeAtual > 0);
              const newQtd = remaining.reduce((sum, l) => sum + l.quantidadeAtual, 0);
              if (produto) {
                await saveProduto({
                  ...produto,
                  estoqueAtual: newQtd,
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

  async function handleSaveEditProd() {
    if (!produto || !editProdName.trim()) {
      Alert.alert('Erro', 'O nome do produto não pode ficar vazio.');
      return;
    }
    try {
      await saveProduto({
        ...produto,
        nome: editProdName.trim(),
      });
      // Se houver receita associada, atualiza o nome nela também
      if (recipe) {
        import('@/services/recipe-service').then(({ updateRecipe }) => {
          updateRecipe(recipe.id, { nome: editProdName.trim() });
        });
      }
      setEditProdVisible(false);
      await loadData();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o nome.');
    }
  }

  async function handleRegistrarDesperdicio() {
    if (!produto) return;
    const qty = parseFloat(desperdicioQty.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erro', 'Informe uma quantidade válida maior que zero.');
      return;
    }
    
    if ((produto.estoqueAtual ?? 0) < qty) {
      Alert.alert('Erro', 'Quantidade excede o estoque atual.');
      return;
    }

    try {
      const res = await consumirEstoqueFEFO(produto.id, qty, {
        tipo: 'perda',
        motivo: desperdicioMotivo.trim() || 'Desperdício/Avaria',
      });

      // Atualiza o produto base para cobrir o que não tinha lote (legado)
      const novaQuantidade = Math.max(0, (produto.quantidade ?? 0) - res.faltante);
      await saveProduto({
        ...produto,
        quantidade: novaQuantidade,
      });

      if (res.faltante > 0) {
        await createLoteMovimento({
          companyId: produto.companyId,
          productId: produto.id,
          loteId: 'sem-lote',
          tipo: 'perda',
          quantidade: -res.faltante,
          motivo: desperdicioMotivo.trim() || 'Desperdício/Avaria',
        });
      }

      setDesperdicioVisible(false);
      setDesperdicioQty('');
      setDesperdicioMotivo('');
      Alert.alert('Sucesso', 'Perda registrada com sucesso!');
      await loadData();
    } catch (e: any) {
      Alert.alert('Erro', 'Ocorreu um erro ao registrar o desperdício.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.backRow}>
          <Pressable onPress={() => router.navigate('/(tabs)/estoque' as any)} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
        </ThemedView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <ThemedView style={styles.headerCard}>
            <ThemedText type="small" themeColor="textSecondary">Código</ThemedText>
            <ThemedText style={styles.codigoText}>{produto.codigo}</ThemedText>
            <ThemedView style={styles.nameRow}>
              <ThemedText type="title" style={styles.productName}>
                {produto.nome}
              </ThemedText>
              <ThemedView style={styles.unitBadge}>
                <ThemedText style={styles.unitText}>{produto.unidade}</ThemedText>
              </ThemedView>
            </ThemedView>
            {produto.categoria && (
              <ThemedView style={styles.categoriaBadge}>
                <ThemedText type="small" style={styles.categoriaText}>{produto.categoria}</ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Info Grid */}
          <ThemedView style={styles.infoCard}>
            <ThemedView style={styles.infoRow}>
              <ThemedView style={styles.infoBlock}>
                <ThemedText type="small" themeColor="textSecondary">Estoque Atual</ThemedText>
                <ThemedText style={[styles.infoValueLarge, (produto.estoqueAtual ?? 0) > 0 && (produto.estoqueAtual ?? 0) <= 1 && { color: '#f59e0b' }]}>
                  {formatQuantity(produto.estoqueAtual ?? 0)} <ThemedText type="small" themeColor="textSecondary">{produto.unidade}</ThemedText>
                </ThemedText>
              </ThemedView>
            </ThemedView>
            {((produto.estoqueAtual ?? 0) > 0 && (produto.estoqueAtual ?? 0) <= 1) && (
              <ThemedView style={styles.badgeWarning}>
                <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                <ThemedText type="small" style={styles.badgeWarningText}>Estoque baixo</ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          <ThemedView style={styles.infoCard}>
            <ThemedView style={styles.infoRow}>

              <ThemedView style={styles.infoBlock}>
                <ThemedText type="small" themeColor="textSecondary">Preço de Venda</ThemedText>
                <ThemedText style={styles.infoValue}>{formatCurrency(produto.precoVenda)}/{produto.unidade}</ThemedText>
              </ThemedView>
            </ThemedView>
            <ThemedView style={styles.infoDivider} />
            <ThemedView style={styles.infoRow}>
              <ThemedView style={styles.infoBlock}>
                <ThemedText type="small" themeColor="textSecondary">Cadastrado em</ThemedText>
                <ThemedText style={styles.infoValue}>{new Date(produto.createdAt).toLocaleDateString('pt-BR')}</ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          {(() => {
            const latestLote = lotes && lotes.length > 0 ? [...lotes].sort((a, b) => {
              const aAtivo = a.ativo && a.quantidadeAtual > 0;
              const bAtivo = b.ativo && b.quantidadeAtual > 0;
              if (aAtivo && !bAtivo) return -1;
              if (!aAtivo && bAtivo) return 1;
              const d1 = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt as any).getTime();
              const d2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt as any).getTime();
              return d2 - d1;
            })[0] : null;
            const hasLoteData = Boolean(latestLote);
            
            const dispRendimento = hasLoteData 
              ? `${formatQuantity(latestLote!.quantidadeInicial)} ${produto.unidade}`
              : (recipe && recipe.rendimento !== undefined ? `${formatQuantity(recipe.rendimento)} ${recipe.unidadeRendimento}` : null);
              
            const pct = hasLoteData 
              ? (latestLote!.custosAdicionaisSnapshot ?? 0)
              : (produto.percentualCustosAdicionais ?? 0);
              
            const custoTotal = hasLoteData 
              ? (latestLote!.custoUnitario * latestLote!.quantidadeInicial)
              : (produto.custoTotal ?? produto.custo);
              
            const custoMateriais = hasLoteData 
              ? (custoTotal / (1 + pct / 100))
              : produto.custoMateriais;
              
            const custosAdicionais = hasLoteData 
              ? (custoTotal - (custoMateriais || 0))
              : produto.custosAdicionais;
              
            const custoPorUnidade = hasLoteData 
              ? latestLote!.custoUnitario
              : produto.custoPorUnidade;

            return produto.precoSugerido !== undefined && (
              <ThemedView style={styles.infoCard}>
                <ThemedText style={{ fontSize: 13, fontWeight: '700', marginBottom: Spacing.one, letterSpacing: 0.5 }}>
                  PRÉVIA DO CÁLCULO {hasLoteData ? '(ÚLTIMO LOTE)' : '(RECEITA PADRÃO)'}
                </ThemedText>
                
                {dispRendimento && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText style={{ fontSize: 13 }} themeColor="textSecondary">Rendimento</ThemedText>
                    <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{dispRendimento}</ThemedText>
                  </View>
                )}
                {custoMateriais !== undefined && custoMateriais > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText style={{ fontSize: 13 }} themeColor="textSecondary">Custo dos materiais</ThemedText>
                    <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{formatCurrency(custoMateriais)}</ThemedText>
                  </View>
                )}
                {custosAdicionais !== undefined && custosAdicionais > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText style={{ fontSize: 13 }} themeColor="textSecondary">
                      Custos adicionais {pct > 0 ? `(${pct.toFixed(1).replace(/\.0$/, '')}%)` : ''}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{formatCurrency(custosAdicionais)}</ThemedText>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <ThemedText style={{ fontSize: 13 }} themeColor="textSecondary">Custo total</ThemedText>
                  <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{formatCurrency(custoTotal)}</ThemedText>
                </View>
                {custoPorUnidade !== undefined && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText style={{ fontSize: 13 }} themeColor="textSecondary">Custo por unidade</ThemedText>
                    <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{formatCurrency(custoPorUnidade)}</ThemedText>
                  </View>
                )}
                {produto.percentualLucro !== undefined && produto.percentualLucro > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText style={{ fontSize: 13 }} themeColor="textSecondary">
                    Lucro esperado ({produto.percentualLucro.toFixed(1).replace(/\.0$/, '')}%)
                  </ThemedText>
                  <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency((produto.precoSugerido ?? 0) - (produto.custoPorUnidade ?? 0))}
                  </ThemedText>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>Preço sugerido</ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: '700', color: '#22c55e' }}>{formatCurrency(produto.precoSugerido)}</ThemedText>
              </View>
            </ThemedView>
          );
        })()}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => setDesperdicioVisible(true)}
              style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="warning-outline" size={16} color="#f59e0b" />
              <ThemedText type="default" style={{ color: '#f59e0b', fontWeight: '600' }}>
                Perda
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditProdName(produto.nome);
                setEditProdVisible(true);
              }}
              style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="create-outline" size={16} color={theme.text} />
              <ThemedText type="default" style={{ color: theme.text, fontWeight: '600' }}>
                Editar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <ThemedText type="default" style={{ color: '#ef4444', fontWeight: '600' }}>
                Excluir
              </ThemedText>
            </Pressable>
          </View>

          {/* ── Histórico de Lotes ── */}
          <View style={{ marginTop: Spacing.six }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three }}>
              <ThemedText type="default" style={{ fontWeight: '600' }}>Lotes em Estoque</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{lotes.length} total</ThemedText>
            </View>

            {lotes.length === 0 ? (
              <ThemedView style={[styles.infoCard, { alignItems: 'center', paddingVertical: Spacing.six }]}>
                <Ionicons name="cube-outline" size={32} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two, textAlign: 'center' }}>
                  Nenhum lote registrado.
                </ThemedText>
              </ThemedView>
            ) : (
              lotes.map((lote) => (
                <ThemedView
                  key={lote.id}
                  style={[
                    styles.infoCard,
                    { borderLeftWidth: 4, borderLeftColor: lote.ativo && lote.quantidadeAtual > 0 ? '#22c55e' : '#94a3b8' },
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
                        Qtd produzida: <ThemedText style={{ fontWeight: '600', color: theme.text }}>{formatQuantity(lote.quantidadeInicial)} {produto.unidade}</ThemedText>
                      </ThemedText>

                      {/* Data de entrada */}
                      <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                        Adicionado em: {lote.dataEntrada}
                      </ThemedText>
                    </View>

                    {/* Ações */}
                    <View style={{ alignItems: 'flex-end', gap: Spacing.two }}>
                      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                        <Pressable onPress={() => router.push(`/receita-form?id=${produto.id}&loteId=${lote.id}` as any)} style={{ padding: Spacing.two, backgroundColor: theme.primary + '15', borderRadius: Spacing.half }}>
                          <Ionicons name="pencil" size={16} color={theme.primary} />
                        </Pressable>
                        <Pressable onPress={() => handleExcluirLote(lote)} style={{ padding: Spacing.two, backgroundColor: '#ef444415', borderRadius: Spacing.half }}>
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

      {/* Modal Editar Lote */}
      <Modal visible={editLoteVisible} animationType="fade" transparent onRequestClose={() => setEditLoteVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.four }}>
          <ThemedView style={{ backgroundColor: theme.background, borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.three }}>
            <ThemedText style={{ fontSize: 20, fontWeight: '700' }}>Editar Lote {editingLote?.codigo}</ThemedText>

            <View style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Quantidade atual ({produto.unidade})</ThemedText>
              <TextInput
                style={[{ padding: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)', color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 16 }]}
                keyboardType="decimal-pad"
                value={editLoteQty}
                onChangeText={setEditLoteQty}
              />
            </View>

            <View style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Custo Unitário</ThemedText>
              <TextInput
                style={[{ padding: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)', color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 16 }]}
                keyboardType="decimal-pad"
                value={editLoteCusto ? `R$ ${editLoteCusto}` : ''}
                onChangeText={(t) => setEditLoteCusto(formatBRL(t))}
              />
            </View>

            <View style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Observação (opcional)</ThemedText>
              <TextInput
                style={[{ padding: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)', color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 16 }]}
                value={editLoteObs}
                onChangeText={setEditLoteObs}
                placeholder="Ex: Ajuste de quebra"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
              <Pressable onPress={() => setEditLoteVisible(false)} style={{ flex: 1, padding: Spacing.three, alignItems: 'center', borderRadius: Spacing.two, backgroundColor: theme.backgroundElement }}>
                <ThemedText style={{ fontWeight: '600' }}>Cancelar</ThemedText>
              </Pressable>
              <Pressable onPress={handleSaveEditLote} style={{ flex: 1, padding: Spacing.three, alignItems: 'center', borderRadius: Spacing.two, backgroundColor: theme.primary }}>
                <ThemedText style={{ fontWeight: '600', color: '#fff' }}>Salvar</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Editar Produto */}
      <Modal visible={editProdVisible} animationType="fade" transparent onRequestClose={() => setEditProdVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.four }}>
          <ThemedView style={{ backgroundColor: theme.background, borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.three }}>
            <ThemedText style={{ fontSize: 20, fontWeight: '700' }}>Editar Produto</ThemedText>

            <View style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Nome do produto</ThemedText>
              <TextInput
                style={[{ padding: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)', color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 16 }]}
                value={editProdName}
                onChangeText={setEditProdName}
                placeholder="Ex: Coca-Cola 2L"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
              <Pressable onPress={() => setEditProdVisible(false)} style={{ flex: 1, padding: Spacing.three, alignItems: 'center', borderRadius: Spacing.two, backgroundColor: theme.backgroundElement }}>
                <ThemedText style={{ fontWeight: '600' }}>Cancelar</ThemedText>
              </Pressable>
              <Pressable onPress={handleSaveEditProd} style={{ flex: 1, padding: Spacing.three, alignItems: 'center', borderRadius: Spacing.two, backgroundColor: theme.primary }}>
                <ThemedText style={{ fontWeight: '600', color: '#fff' }}>Salvar</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Desperdício */}
      <Modal visible={desperdicioVisible} animationType="fade" transparent onRequestClose={() => setDesperdicioVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.four }}>
          <ThemedView style={{ backgroundColor: theme.background, borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.three }}>
            <ThemedText style={{ fontSize: 20, fontWeight: '700', color: '#f59e0b' }}>Registrar Perda / Desperdício</ThemedText>

            <View style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Quantidade a abater ({produto.unidade})</ThemedText>
              <TextInput
                style={[{ padding: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)', color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 16 }]}
                keyboardType="decimal-pad"
                value={desperdicioQty}
                onChangeText={setDesperdicioQty}
                placeholder="1"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={{ gap: Spacing.one }}>
              <ThemedText type="smallBold">Motivo (opcional)</ThemedText>
              <TextInput
                style={[{ padding: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)', color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 16 }]}
                value={desperdicioMotivo}
                onChangeText={setDesperdicioMotivo}
                placeholder="Ex: Produto estragou, validade, etc."
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
              <Pressable onPress={() => setDesperdicioVisible(false)} style={{ flex: 1, padding: Spacing.three, alignItems: 'center', borderRadius: Spacing.two, backgroundColor: theme.backgroundElement }}>
                <ThemedText style={{ fontWeight: '600' }}>Cancelar</ThemedText>
              </Pressable>
              <Pressable onPress={handleRegistrarDesperdicio} style={{ flex: 1, padding: Spacing.three, alignItems: 'center', borderRadius: Spacing.two, backgroundColor: '#f59e0b' }}>
                <ThemedText style={{ fontWeight: '600', color: '#fff' }}>Registrar</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  backRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingVertical: Spacing.one,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
  },

  /* ===== Header Card ===== */
  headerCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  codigoText: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 2,
  },
  productName: {
    flex: 1,
    fontSize: 20,
    lineHeight: 24,
  },
  unitBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.one,
    backgroundColor: '#C4956A20',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  categoriaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.half,
    backgroundColor: 'rgba(128,128,128,0.1)',
    marginTop: 2,
  },
  categoriaText: {
    letterSpacing: 0.3,
    fontSize: 12,
  },

  /* ===== Info Cards ===== */
  infoCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  infoBlock: {
    flex: 1,
    gap: 2,
  },
  infoValue: {
    fontWeight: '600',
  },
  infoValueLarge: {
    fontWeight: '700',
    fontSize: 18,
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  badgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Spacing.one,
    backgroundColor: '#f59e0b18',
    alignSelf: 'flex-start',
  },
  badgeWarningText: {
    color: '#f59e0b',
    fontWeight: '600',
  },

  /* ===== Ações ===== */
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#ef444430',
    backgroundColor: '#ef444408',
  },

  /* ===== Sections ===== */
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  countBadge: {
    backgroundColor: 'rgba(128,128,128,0.12)',
    paddingHorizontal: Spacing.two - 2,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addLoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
    borderRadius: Spacing.half,
    backgroundColor: '#C4956A',
  },
  addLoteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyLotes: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    borderStyle: 'dashed',
  },

  /* ===== Lote Card ===== */
  loteCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one + 2,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  loteVencido: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  loteProxVenc: {
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  loteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loteCodigoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  loteCodigo: {
    fontWeight: '700',
    fontSize: 14,
  },
  loteStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  loteQtd: {
    fontWeight: '700',
    fontSize: 15,
  },
  loteInfoRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  loteInfoItem: {
    flex: 1,
    gap: 1,
  },
  loteInfoValue: {
    fontWeight: '600',
    fontSize: 13,
  },
  loteMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  loteMetaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  loteObs: {
    fontStyle: 'italic',
  },
  loteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Spacing.half,
    alignSelf: 'flex-start',
  },
  loteBadgeExpired: {
    backgroundColor: '#ef444418',
  },
  loteBadgeSoon: {
    backgroundColor: '#f59e0b18',
  },
  loteActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: 2,
  },
  loteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: 6,
    borderRadius: Spacing.half,
  },
  loteActionDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: 6,
    borderRadius: Spacing.half,
    backgroundColor: '#ef444418',
  },

  /* ===== Movimentos ===== */
  movItem: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  movIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movContent: {
    flex: 1,
    gap: 1,
  },
  movTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movQtd: {
    fontWeight: '700',
    fontSize: 14,
  },

  /* ===== Modal ===== */
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
    paddingVertical: Spacing.two,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
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
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
    backgroundColor: '#C4956A',
  },
  saveButtonText: {
    fontWeight: '600',
    fontSize: 15,
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  ajusteSheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
})
