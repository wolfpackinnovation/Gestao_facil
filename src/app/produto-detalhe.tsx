import { useState, useEffect } from 'react'
import { StyleSheet, Pressable, Alert, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SymbolView } from 'expo-symbols'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useTheme } from '@/hooks/use-theme'
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme'
import { getProduto, deleteProduto, formatCurrency, type Produto, type UnidadeMedida } from '@/services/estoque-storage'
import { formatQuantity } from '@/utils/format'

const unidadeLabel: Record<UnidadeMedida, string> = {
  un: 'Unidade',
  kg: 'Quilograma',
  g: 'Grama',
  L: 'Litro',
  mL: 'Mililitro',
}

export default function ProdutoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useTheme()
  const [produto, setProduto] = useState<Produto | null>(null)

  useEffect(() => {
    if (id) {
      getProduto(id).then(setProduto)
    }
  }, [id])

  if (!produto) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Carregando...</ThemedText>
        </SafeAreaView>
      </ThemedView>
    )
  }

  const [d, m, y] = produto.dataValidade.split('/').map(Number)
  const expiry = new Date(y, m - 1, d)
  const now = Date.now()
  const expired = expiry.getTime() < now

  const handleDelete = () => {
    Alert.alert('Excluir Produto', `Deseja excluir "${produto.nome}"?`, [
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
          <ThemedView style={styles.nameLeft}>
            <ThemedText type="small" themeColor="textSecondary">Código</ThemedText>
            <ThemedText type="default" style={styles.codigoText}>{produto.codigo}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.nameRow}>
            <ThemedText type="title" style={styles.productName}>
              {produto.nome}
            </ThemedText>
            <ThemedView style={styles.unitBadge}>
              <ThemedText style={styles.unitText}>{produto.unidade}</ThemedText>
            </ThemedView>
          </ThemedView>

          {expired && (
            <ThemedView type="backgroundElement" style={styles.badgeDanger}>
              <ThemedText type="small" style={styles.badgeDangerText}>Produto Vencido</ThemedText>
            </ThemedView>
          )}

          <ThemedView style={styles.infoGrid}>
            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Categoria</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>{produto.categoria}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Unidade</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>{unidadeLabel[produto.unidade] ?? produto.unidade}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.divider} />

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Estoque Atual</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>
                {formatQuantity(produto.estoqueAtual)} {produto.unidade}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Estoque Mínimo</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>
                {formatQuantity(produto.estoqueMinimo)} {produto.unidade}
              </ThemedText>
            </ThemedView>

            {produto.estoqueMinimo > 0 && produto.estoqueAtual <= produto.estoqueMinimo && (
              <ThemedView type="backgroundElement" style={styles.badgeWarning}>
                <ThemedText type="small" style={styles.badgeWarningText}>Estoque baixo</ThemedText>
              </ThemedView>
            )}

            <ThemedView style={styles.divider} />

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Custo</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>
                {formatCurrency(produto.custo)}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Quantidade por Unidade</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>
                {formatQuantity(produto.quantidade)} {produto.unidade}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.divider} />

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Data de Validade</ThemedText>
              <ThemedText type="default" style={[styles.infoValue, expired && { color: '#ef4444' }]}>
                {produto.dataValidade}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Fornecedor</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>
                {produto.fornecedor || '---'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.divider} />

            <ThemedView style={styles.infoItem}>
              <ThemedText type="small" themeColor="textSecondary">Data de Entrada</ThemedText>
              <ThemedText type="default" style={styles.infoValue}>
                {new Date(produto.createdAt).toLocaleDateString('pt-BR')}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.navigate('/(tabs)/estoque?editId=' + produto.id as any)}
              style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}
            >
              <ThemedText type="default" style={{ color: theme.text, fontWeight: '600' }}>
                Editar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
            >
              <ThemedText type="default" style={{ color: '#ef4444' }}>
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
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  backRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingVertical: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
  },
  nameLeft: {
    gap: Spacing.half,
  },
  codigoText: {
    fontWeight: '700',
    fontSize: 18,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  productName: {
    flex: 1,
    fontSize: 28,
    lineHeight: 32,
  },
  unitBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoGrid: {
    gap: Spacing.three,
  },
  infoItem: {
    gap: Spacing.half,
  },
  infoValue: {
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#cccccc',
    marginVertical: Spacing.one,
  },
  badgeDanger: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
  },
  badgeDangerText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  badgeWarning: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.one,
  },
  badgeWarningText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
})
