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
  formatCurrency,
  getTodosLotesDoProduto,
  type Produto,
  isLoteVencido,
  isLoteProximoVencimento,
  diasAteVencimento,
} from '@/services/estoque-storage'
import {
  createLote as criarLoteService,
  ajustarLote as ajustarLoteService,
  deleteLote,
  listLoteMovimentos,
  gerarCodigoLote,
} from '@/services/lote-service'
import type { Lote, LoteMovimento } from '@/types/schema'
import { formatQuantity } from '@/utils/format'

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function ProdutoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useTheme()
  const [produto, setProduto] = useState<Produto | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [movimentos, setMovimentos] = useState<LoteMovimento[]>([])
  const [loading, setLoading] = useState(true)
  const [loteModalVisible, setLoteModalVisible] = useState(false)
  const [ajusteModalVisible, setAjusteModalVisible] = useState(false)
  const [loteSelecionado, setLoteSelecionado] = useState<Lote | null>(null)
  const [novaQtd, setNovaQtd] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')

  const [loteForm, setLoteForm] = useState({
    codigo: '',
    quantidade: '',
    custoUnitario: '',
    dataValidade: '',
    dataEntrada: todayBR(),
    fornecedor: '',
    observacao: '',
  })
  const [loteErrors, setLoteErrors] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const p = await getProduto(id as string)
    setProduto(p)
    if (p) {
      const [allLotes, movs] = await Promise.all([
        getTodosLotesDoProduto(p.id),
        listLoteMovimentos(p.id, 50),
      ])
      setLotes(allLotes)
      setMovimentos(movs)
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

  const handleDeleteLote = (lote: Lote) => {
    if (lote.quantidadeAtual !== lote.quantidadeInicial) {
      Alert.alert('Atenção', 'Este lote já teve movimentações. Excluir pode causar inconsistências no histórico.')
    }
    Alert.alert('Excluir Lote', `Deseja excluir o lote "${lote.codigo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (lote.id) await deleteLote(lote.id)
          await loadData()
        },
      },
    ])
  }

  async function openLoteModal() {
    const codigosExistentes = lotes.map(l => l.codigo)
    setLoteForm({
      ...loteForm,
      codigo: gerarCodigoLote(codigosExistentes),
      dataEntrada: todayBR(),
    })
    setLoteErrors({})
    setLoteModalVisible(true)
  }

  function validateLote(): boolean {
    const errs: Record<string, string> = {}
    if (!loteForm.quantidade || isNaN(Number(loteForm.quantidade)) || Number(loteForm.quantidade) <= 0)
      errs.quantidade = 'Informe a quantidade'
    if (!loteForm.custoUnitario || isNaN(Number(loteForm.custoUnitario)) || Number(loteForm.custoUnitario) <= 0)
      errs.custoUnitario = 'Informe o custo'
    if (!loteForm.dataValidade.match(/^\d{2}\/\d{2}\/\d{4}$/))
      errs.dataValidade = 'Use o formato DD/MM/AAAA'
    if (!loteForm.dataEntrada.match(/^\d{2}\/\d{2}\/\d{4}$/))
      errs.dataEntrada = 'Use o formato DD/MM/AAAA'
    setLoteErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSaveLote() {
    if (!validateLote() || !produto) return
    await criarLoteService({
      companyId: produto.companyId,
      productId: produto.id,
      codigo: loteForm.codigo.trim() || gerarCodigoLote([]),
      quantidadeInicial: Number(loteForm.quantidade),
      custoUnitario: Number(loteForm.custoUnitario) / 100,
      dataValidade: loteForm.dataValidade,
      dataEntrada: loteForm.dataEntrada,
      fornecedor: loteForm.fornecedor.trim(),
      observacao: loteForm.observacao.trim() || undefined,
      origem: 'detalhe-produto',
    })
    setLoteModalVisible(false)
    setLoteForm({
      codigo: '',
      quantidade: '',
      custoUnitario: '',
      dataValidade: '',
      dataEntrada: todayBR(),
      fornecedor: '',
      observacao: '',
    })
    await loadData()
  }

  function openAjusteModal(lote: Lote) {
    setLoteSelecionado(lote)
    setNovaQtd(lote.quantidadeAtual.toString())
    setMotivoAjuste('')
    setAjusteModalVisible(true)
  }

  async function handleSaveAjuste() {
    if (!loteSelecionado) return
    const q = parseFloat(novaQtd.replace(',', '.'))
    if (isNaN(q) || q < 0) {
      Alert.alert('Quantidade inválida')
      return
    }
    if (loteSelecionado.id) {
      await ajustarLoteService(loteSelecionado.id, q, motivoAjuste || 'Ajuste manual')
    }
    setAjusteModalVisible(false)
    setLoteSelecionado(null)
    await loadData()
  }

  function renderLoteField(
    label: string,
    field: 'codigo' | 'quantidade' | 'custoUnitario' | 'dataValidade' | 'dataEntrada' | 'fornecedor' | 'observacao',
    options?: {
      keyboardType?: 'default' | 'numeric' | 'decimal-pad';
      placeholder?: string;
      multiline?: boolean;
      prefix?: string;
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
    )

    const displayValue =
      options?.type === 'currency' ? formatBRL((loteForm as any)[field]) : (loteForm as any)[field]

    function handleChange(value: string) {
      if (options?.type === 'currency') {
        value = value.replace(/\D/g, '')
      } else if (options?.type === 'date') {
        const digits = value.replace(/\D/g, '').slice(0, 8)
        const parts: string[] = []
        if (digits.length > 0) parts.push(digits.slice(0, 2))
        if (digits.length > 2) parts.push(digits.slice(2, 4))
        if (digits.length > 4) parts.push(digits.slice(4, 8))
        value = parts.join('/')
      } else if (options?.numeric) {
        value = value.replace(/[^0-9.,]/g, '')
      }
      setLoteForm((prev) => ({ ...prev, [field]: value }))
      if (loteErrors[field]) {
        setLoteErrors((prev) => {
          const copy = { ...prev }
          delete copy[field]
          return copy
        })
      }
    }

    return (
      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="smallBold" style={styles.fieldLabel}>{label}</ThemedText>
        <ThemedView
          style={[
            styles.inputRow,
            {
              borderColor: loteErrors[field] ? '#ef4444' : theme.textSecondary + '55',
              borderWidth: 1,
              borderRadius: Spacing.two,
            },
          ]}
        >
          {options?.prefix && adornment(options.prefix, 'left')}
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderWidth: 0 }]}
            value={displayValue}
            onChangeText={handleChange}
            placeholderTextColor={theme.textSecondary}
            placeholder={options?.placeholder}
            keyboardType={options?.keyboardType ?? 'default'}
            multiline={options?.multiline}
          />
        </ThemedView>
        {loteErrors[field] && (
          <ThemedText type="small" style={{ color: '#ef4444' }}>{loteErrors[field]}</ThemedText>
        )}
      </ThemedView>
    )
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
                <ThemedText type="small" themeColor="textSecondary">Custo Médio</ThemedText>
                <ThemedText style={styles.infoValue}>{formatCurrency(produto.custoMedio ?? 0)}</ThemedText>
              </ThemedView>
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

          {/* Lotes */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedView style={styles.sectionHeaderLeft}>
                <Ionicons name="layers-outline" size={18} color={theme.text} />
                <ThemedText type="subtitle">Lotes</ThemedText>
                <ThemedView style={styles.countBadge}>
                  <ThemedText style={styles.countBadgeText}>{lotes.length}</ThemedText>
                </ThemedView>
              </ThemedView>
              <Pressable onPress={openLoteModal} style={styles.addLoteButton}>
                <Ionicons name="add" size={16} color="#fff" />
                <ThemedText style={styles.addLoteButtonText}>Novo</ThemedText>
              </Pressable>
            </ThemedView>

            {lotes.length === 0 ? (
              <ThemedView style={styles.emptyLotes}>
                <Ionicons name="cube-outline" size={28} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  Nenhum lote cadastrado
                </ThemedText>
              </ThemedView>
            ) : (
              lotes.map((lote) => {
                const vencido = isLoteVencido(lote)
                const proxVenc = isLoteProximoVencimento(lote)
                const dias = diasAteVencimento(lote)
                return (
                  <ThemedView
                    key={lote.id}
                    style={[
                      styles.loteCard,
                      vencido && styles.loteVencido,
                      !vencido && proxVenc && styles.loteProxVenc,
                    ]}
                  >
                    <ThemedView style={styles.loteHeader}>
                      <ThemedView style={styles.loteCodigoArea}>
                        <ThemedText style={styles.loteCodigo}>{lote.codigo}</ThemedText>
                        {vencido && (
                          <ThemedView style={[styles.loteStatusDot, { backgroundColor: '#ef4444' }]} />
                        )}
                        {!vencido && proxVenc && (
                          <ThemedView style={[styles.loteStatusDot, { backgroundColor: '#f59e0b' }]} />
                        )}
                        {!vencido && !proxVenc && (
                          <ThemedView style={[styles.loteStatusDot, { backgroundColor: '#22c55e' }]} />
                        )}
                      </ThemedView>
                      <ThemedText style={styles.loteQtd}>
                        {formatQuantity(lote.quantidadeAtual)}
                        <ThemedText type="small" themeColor="textSecondary"> {produto.unidade}</ThemedText>
                      </ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.loteInfoRow}>
                      <ThemedView style={styles.loteInfoItem}>
                        <ThemedText type="small" themeColor="textSecondary">Custo</ThemedText>
                        <ThemedText style={styles.loteInfoValue}>{formatCurrency(lote.custoUnitario)}</ThemedText>
                      </ThemedView>
                      <ThemedView style={styles.loteInfoItem}>
                        <ThemedText type="small" themeColor="textSecondary">Validade</ThemedText>
                        <ThemedText style={[styles.loteInfoValue, vencido && { color: '#ef4444', fontWeight: '700' }]}>
                          {lote.dataValidade}
                        </ThemedText>
                      </ThemedView>
                      <ThemedView style={styles.loteInfoItem}>
                        <ThemedText type="small" themeColor="textSecondary">Entrada</ThemedText>
                        <ThemedText style={styles.loteInfoValue}>{lote.dataEntrada}</ThemedText>
                      </ThemedView>
                    </ThemedView>

                    <ThemedView style={styles.loteMetaRow}>
                      {lote.fornecedor ? (
                        <ThemedView style={styles.loteMetaTag}>
                          <Ionicons name="business-outline" size={12} color={theme.textSecondary} />
                          <ThemedText type="small" themeColor="textSecondary">{lote.fornecedor}</ThemedText>
                        </ThemedView>
                      ) : null}
                      {lote.origem ? (
                        <ThemedView style={styles.loteMetaTag}>
                          <Ionicons name="information-circle-outline" size={12} color={theme.textSecondary} />
                          <ThemedText type="small" themeColor="textSecondary">{lote.origem}</ThemedText>
                        </ThemedView>
                      ) : null}
                    </ThemedView>

                    {lote.observacao ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.loteObs}>
                        {lote.observacao}
                      </ThemedText>
                    ) : null}

                    {vencido && (
                      <ThemedView style={[styles.loteBadge, styles.loteBadgeExpired]}>
                        <Ionicons name="alert-circle" size={14} color="#ef4444" />
                        <ThemedText type="small" style={{ color: '#ef4444', fontWeight: '600' }}>
                          Vencido {dias !== null && dias < 0 ? `há ${Math.abs(dias)}d` : ''}
                        </ThemedText>
                      </ThemedView>
                    )}
                    {!vencido && proxVenc && dias !== null && (
                      <ThemedView style={[styles.loteBadge, styles.loteBadgeSoon]}>
                        <Ionicons name="time-outline" size={14} color="#f59e0b" />
                        <ThemedText type="small" style={{ color: '#f59e0b', fontWeight: '600' }}>
                          Vence em {dias}d
                        </ThemedText>
                      </ThemedView>
                    )}

                    <ThemedView style={styles.loteActions}>
                      <Pressable
                        onPress={() => openAjusteModal(lote)}
                        style={[styles.loteActionButton, { backgroundColor: theme.background }]}
                      >
                        <Ionicons name="pencil-outline" size={14} color={theme.text} />
                        <ThemedText type="small" style={{ fontWeight: '600' }}>Ajustar</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteLote(lote)}
                        style={styles.loteActionDelete}
                      >
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        <ThemedText type="small" style={{ color: '#ef4444', fontWeight: '600' }}>Excluir</ThemedText>
                      </Pressable>
                    </ThemedView>
                  </ThemedView>
                )
              })
            )}
          </ThemedView>

          {/* Histórico de Movimentações */}
          {movimentos.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedView style={styles.sectionHeaderLeft}>
                  <Ionicons name="swap-vertical-outline" size={18} color={theme.text} />
                  <ThemedText type="subtitle">Movimentações</ThemedText>
                </ThemedView>
              </ThemedView>
              {movimentos.slice(0, 10).map((m) => {
                const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt as any)
                const isEntrada = m.tipo === 'entrada'
                return (
                  <ThemedView key={m.id} style={styles.movItem}>
                    <ThemedView style={[styles.movIcon, { backgroundColor: isEntrada ? '#22c55e20' : '#ef444420' }]}>
                      <Ionicons
                        name={isEntrada ? 'arrow-down-outline' : 'arrow-up-outline'}
                        size={16}
                        color={isEntrada ? '#22c55e' : '#ef4444'}
                      />
                    </ThemedView>
                    <ThemedView style={styles.movContent}>
                      <ThemedView style={styles.movTopRow}>
                        <ThemedText type="small" style={{ fontWeight: '700', textTransform: 'capitalize' }}>
                          {m.tipo}
                        </ThemedText>
                        <ThemedText style={[styles.movQtd, { color: isEntrada ? '#22c55e' : '#ef4444' }]}>
                          {isEntrada ? '+' : '-'}{Number(m.quantidade).toFixed(2)}
                        </ThemedText>
                      </ThemedView>
                      <ThemedText type="small" themeColor="textSecondary">
                        {date.toLocaleString('pt-BR')}
                      </ThemedText>
                      {m.motivo ? (
                        <ThemedText type="small" themeColor="textSecondary">{m.motivo}</ThemedText>
                      ) : null}
                    </ThemedView>
                  </ThemedView>
                )
              })}
            </ThemedView>
          )}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.navigate('/(tabs)/estoque?editId=' + produto.id as any)}
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
        </ScrollView>
      </SafeAreaView>

      {/* Modal de Lote */}
      <Modal
        visible={loteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>Novo Lote</ThemedText>
              <Pressable onPress={() => setLoteModalVisible(false)}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderLoteField('Código do Lote *', 'codigo', { placeholder: 'Ex: LT001' })}
              {renderLoteField('Quantidade *', 'quantidade', {
                keyboardType: 'decimal-pad',
                placeholder: 'Ex: 10',
                numeric: true,
              })}
              {renderLoteField('Custo Unitário *', 'custoUnitario', {
                keyboardType: 'decimal-pad',
                placeholder: 'Ex: 45,90',
                prefix: 'R$',
                type: 'currency',
              })}
              {renderLoteField('Data de Validade *', 'dataValidade', {
                placeholder: 'DD/MM/AAAA',
                type: 'date',
              })}
              {renderLoteField('Data de Entrada *', 'dataEntrada', {
                placeholder: 'DD/MM/AAAA',
                type: 'date',
              })}
              {renderLoteField('Fornecedor (opcional)', 'fornecedor', {
                placeholder: 'Ex: Frigorífico X',
              })}
              {renderLoteField('Observação (opcional)', 'observacao', {
                placeholder: 'Ex: Nota fiscal 12345',
                multiline: true,
              })}

              <Pressable onPress={handleSaveLote} style={styles.saveButton}>
                <ThemedText style={styles.saveButtonText}>Cadastrar Lote</ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Ajuste */}
      <Modal
        visible={ajusteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAjusteModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setAjusteModalVisible(false)}>
          <Pressable style={[styles.ajusteSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.three }}>
              Ajustar Quantidade do Lote
            </ThemedText>
            {loteSelecionado && (
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.three }}>
                Lote {loteSelecionado.codigo} • Atual: {formatQuantity(loteSelecionado.quantidadeAtual)} {produto.unidade}
              </ThemedText>
            )}
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Nova quantidade</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, fontSize: 20, fontWeight: '700', textAlign: 'center' }]}
                value={novaQtd}
                onChangeText={setNovaQtd}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
              />
            </ThemedView>
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Motivo (opcional)</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                value={motivoAjuste}
                onChangeText={setMotivoAjuste}
                placeholder="Ex: Contagem de inventário"
                placeholderTextColor={theme.textSecondary}
              />
            </ThemedView>
            <Pressable onPress={handleSaveAjuste} style={styles.saveButton}>
              <ThemedText style={styles.saveButtonText}>Salvar Ajuste</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
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
