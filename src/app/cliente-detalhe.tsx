import { useState, useEffect } from 'react'
import { StyleSheet, Pressable, Alert, ScrollView, TextInput, Modal, Platform, KeyboardAvoidingView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SymbolView } from 'expo-symbols'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Loading } from '@/utils/loading'
import { useTheme } from '@/hooks/use-theme'
import { MaxContentWidth, Spacing } from '@/constants/theme'
import { getClient, deleteClient } from '@/services/client-service'
import { getAllSales, updateSale, deleteSale } from '@/services/sale-service'
import { getClientPayments } from '@/services/payment-service'
import { remove } from '@/services/db'
import { Collections } from '@/services/collections'
import { useAuth } from '@/contexts/auth'
import { formatCurrency, formatCurrencyInput } from '@/utils/format'
import type { Client } from '@/types/schema'

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function ClienteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useTheme()
  const { user } = useAuth()
  const companyId = user?.uid ?? ''
  const [cliente, setCliente] = useState<Client | null>(null)
  const [transactions, setTransactions] = useState<
    { type: 'compra' | 'recebimento'; description: string; amount: number; date: Date; concluded?: boolean; saleId?: string; paymentId?: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editingTx, setEditingTx] = useState<any>(null)

  function loadData() {
    if (!id || !companyId) return
    setLoading(true)
    Promise.all([
      getClient(id),
      getAllSales(companyId),
      getClientPayments(companyId, id),
    ]).then(([client, sales, payments]) => {
      setCliente(client)
      const purchaseTx = sales
        .filter((s) => s.clientId === id && s.paymentMethod === 'fiado')
        .map((s) => ({
          type: 'compra' as const,
          description: `Venda ${s.number}`,
          amount: s.totalAmount - (s.paidAmount ?? 0),
          date: s.createdAt?.toDate() ?? new Date(),
          concluded: s.status === 'concluída',
          saleId: s.id,
        }))
      const paymentTx = payments.map((p) => ({
        type: 'recebimento' as const,
        description: 'Recebimento',
        amount: p.amount,
        date: p.createdAt?.toDate() ?? new Date(),
        paymentId: p.id,
      }))
      const combined = [...purchaseTx, ...paymentTx].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      )
      setTransactions(combined)
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [id, companyId])

  const totalDebt = transactions
    .filter((t) => t.type === 'compra' && !t.concluded)
    .reduce((s, t) => s + t.amount, 0)

  function handleEdit(tx: any) {
    setEditValue(formatCurrencyInput(String(tx.amount * 100)))
    setEditingTx(tx)
    setEditModal(true)
  }

  async function handleSaveEdit() {
    if (!editingTx) return
    const valor = parseFloat(editValue.replace(/\D/g, '')) / 100
    if (valor < 0) {
      Alert.alert('Valor inválido', 'Digite um valor válido.')
      return
    }
    try {
      if (editingTx.type === 'compra' && editingTx.saleId) {
        await updateSale(editingTx.saleId, { totalAmount: valor })
      } else if (editingTx.type === 'recebimento' && editingTx.paymentId) {
        await remove(Collections.payments, editingTx.paymentId)
      }
      setEditModal(false)
      loadData()
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar.')
    }
  }

  function handleDeleteTx(tx: any) {
    const label = tx.type === 'compra' ? 'esta venda' : 'este recebimento'
    Alert.alert('Excluir', `Deseja excluir ${label}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            if (tx.type === 'compra' && tx.saleId) {
              await deleteSale(tx.saleId)
            } else if (tx.type === 'recebimento' && tx.paymentId) {
              await remove(Collections.payments, tx.paymentId)
            }
            loadData()
          } catch (e: any) {
            Alert.alert('Erro', e?.message ?? 'Erro ao excluir.')
          }
        },
      },
    ])
  }

  function handleTxOptions(tx: any) {
    Alert.alert(tx.description, 'O que deseja fazer?', [
      { text: 'Editar valor', onPress: () => handleEdit(tx) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDeleteTx(tx) },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const handleDeleteClient = () => {
    Alert.alert('Excluir Cliente', `Deseja excluir "${cliente?.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteClient(cliente!.id!)
          router.navigate('/(tabs)/clientes' as any)
        },
      },
    ])
  }

  if (!cliente) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Loading />
        </SafeAreaView>
      </ThemedView>
    )
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.backRow}>
          <Pressable onPress={() => router.navigate('/(tabs)/clientes' as any)} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
        </ThemedView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.clientName}>
            {cliente.name}
          </ThemedText>

          {/* Saldo */}
          <ThemedView style={[styles.balanceCard, { backgroundColor: totalDebt > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
            <ThemedText style={[styles.balanceLabel, { color: totalDebt > 0 ? '#DC2626' : '#16A34A' }]}>
              {totalDebt > 0 ? 'EM ABERTO' : 'EM DIA'}
            </ThemedText>
            <ThemedText style={[styles.balanceValue, { color: totalDebt > 0 ? '#DC2626' : '#16A34A' }]}>
              {formatCurrency(totalDebt)}
            </ThemedText>
          </ThemedView>

          {/* Informações */}
          <ThemedView style={styles.infoGrid}>
            {cliente.email && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Email</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.email}</ThemedText>
              </ThemedView>
            )}
            {cliente.phone && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Telefone</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.phone}</ThemedText>
              </ThemedView>
            )}
            {cliente.cpfCnpj && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">CPF/CNPJ</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.cpfCnpj}</ThemedText>
              </ThemedView>
            )}
            <ThemedView style={styles.divider} />
            {cliente.address && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Endereço</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.address}</ThemedText>
              </ThemedView>
            )}
            {cliente.city && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Cidade</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>
                  {cliente.city}{cliente.state ? `/${cliente.state}` : ''}
                </ThemedText>
              </ThemedView>
            )}
            {cliente.zipCode && (
              <ThemedView style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">CEP</ThemedText>
                <ThemedText type="default" style={styles.infoValue}>{cliente.zipCode}</ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Histórico */}
          <ThemedText style={styles.sectionTitle}>Histórico de Transações</ThemedText>
          {loading ? (
            <Loading />
          ) : transactions.length === 0 ? (
            <ThemedText style={styles.emptyText}>Nenhuma transação encontrada</ThemedText>
          ) : (
            <ThemedView style={styles.transactionList}>
              {transactions.map((t, i) => (
                <ThemedView key={i} style={styles.transactionItem}>
                  <ThemedView style={styles.transactionRow}>
                    <Pressable style={{ flex: 1 }} onPress={() => handleTxOptions(t)}>
                      <ThemedText style={styles.transactionDesc}>{t.description}</ThemedText>
                      <ThemedText style={styles.transactionDate}>{formatDate(t.date)}</ThemedText>
                    </Pressable>
                    <ThemedText
                      style={[
                        styles.transactionAmount,
                        { color: t.type === 'recebimento' ? '#16A34A' : theme.textSecondary },
                      ]}
                    >
                      {t.concluded ? '' : t.type === 'recebimento' ? '+' : '-'}{formatCurrency(t.amount)}
                    </ThemedText>
                    <Pressable onPress={() => handleTxOptions(t)} style={styles.txAction}>
                      <ThemedText style={styles.txActionIcon}>⋮</ThemedText>
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              ))}
            </ThemedView>
          )}

          <Pressable
            onPress={handleDeleteClient}
            style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
          >
            <ThemedText type="default" style={{ color: '#ef4444' }}>
              Excluir Cliente
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Modal */}
      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>Editar Valor</ThemedText>
              <Pressable onPress={() => setEditModal(false)}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>
            <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">
              <TextInput
                style={[styles.editInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="R$ 0,00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={editValue}
                onChangeText={(v) => setEditValue(formatCurrencyInput(v))}
              />
              <Pressable onPress={handleSaveEdit} style={[styles.saveButton, { backgroundColor: '#059669' }]}>
                <ThemedText style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>Salvar</ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
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
  clientName: {
    fontSize: 28,
    lineHeight: 32,
  },
  balanceCard: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  transactionList: {
    gap: Spacing.two,
  },
  transactionItem: {
    paddingVertical: Spacing.one,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 1,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAction: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
  },
  txActionIcon: {
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.4,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  modalForm: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  editInput: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
})
