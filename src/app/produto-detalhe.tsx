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
  type Produto,
} from '@/services/estoque-storage'

import { formatQuantity } from '@/utils/format'
import { getRecipe, type Recipe } from '@/services/recipe-service'
import { getMaterials, updateMaterial, type Material } from '@/services/material-service'
import { convertToBase } from '@/utils/units'

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



          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push('/receita-form?id=' + produto.id as any)}
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
