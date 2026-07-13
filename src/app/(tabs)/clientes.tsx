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
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as ClientService from '@/services/client-service';
import { getAllSales, updateSale } from '@/services/sale-service';
import { createPayment, getClientPayments } from '@/services/payment-service';
import type { Client } from '@/types/schema';

import { useAuth } from '@/contexts/auth';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '@/utils/format';

function generateClientCode(clients: Client[]): string {
  const max = clients.reduce((max, c) => {
    const num = parseInt((c.codigo ?? 'C0').slice(1), 10);
    return num > max ? num : max;
  }, 0);
  return `C${String(max + 1).padStart(3, '0')}`;
}

const emptyForm = {
  codigo: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  addressNumber: '',
  city: '',
  state: '',
};

function formatLastPurchase(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 30) return `há ${diffDays} dias`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'há 1 mês';
  return `há ${diffMonths} meses`;
}

export default function ClientesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [debts, setDebts] = useState<Record<string, number>>({});
  const [lastPurchases, setLastPurchases] = useState<Record<string, Date | null>>({});
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [receiveModal, setReceiveModal] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [transactions, setTransactions] = useState<{ type: 'compra' | 'recebimento'; description: string; amount: number; date: Date }[]>([]);
  const [filter, setFilter] = useState<'todos' | 'devendo' | 'emdia'>('todos');

  const companyId = user?.uid ?? '';
  const [loading, setLoading] = useState(true);

  async function loadTransactions(client: Client) {
    const [sales, payments] = await Promise.all([
      getAllSales(companyId),
      getClientPayments(companyId, client.id!),
    ]);
    const purchaseTx = sales
      .filter((s) => s.clientId === client.id && s.paymentMethod === 'fiado')
      .map((s) => ({
        type: 'compra' as const,
        description: `Venda ${s.number}`,
        amount: s.totalAmount,
        date: s.createdAt?.toDate() ?? new Date(),
      }));
    const paymentTx = payments.map((p) => ({
      type: 'recebimento' as const,
      description: 'Recebimento',
      amount: p.amount,
      date: p.createdAt?.toDate() ?? new Date(),
    }));
    const combined = [...purchaseTx, ...paymentTx].sort((a, b) => b.date.getTime() - a.date.getTime());
    setTransactions(combined);
  }

  const loadClients = useCallback(async () => {
    setLoading(true);
    const [clientsData, allSales] = await Promise.all([
      ClientService.listClients(companyId),
      getAllSales(companyId),
    ]);
    setClients(clientsData);

    const debtMap: Record<string, number> = {};
    const lastPurchaseMap: Record<string, Date | null> = {};
    for (const sale of allSales) {
      if (sale.paymentMethod === 'fiado' && sale.clientId) {
        if (sale.status !== 'concluída') {
          debtMap[sale.clientId] = (debtMap[sale.clientId] ?? 0) + (sale.totalAmount - (sale.paidAmount ?? 0));
        }
        const saleDate = sale.createdAt?.toDate();
        if (saleDate) {
          const existing = lastPurchaseMap[sale.clientId];
          if (!existing || saleDate > existing) {
            lastPurchaseMap[sale.clientId] = saleDate;
          }
        }
      }
    }
    setDebts(debtMap);
    setLastPurchases(lastPurchaseMap);
    setLoading(false);
  }, [companyId, search]);

  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

  const totalReceivable = useMemo(
    () => Object.values(debts).reduce((sum, v) => sum + v, 0),
    [debts]
  );

  const inadimplentes = useMemo(
    () => clients.filter((c) => (debts[c.id!] ?? 0) > 0).length,
    [clients, debts]
  );

  const filteredClients = useMemo(() => {
    const term = search.toLowerCase();
    return clients
      .filter((c) => {
        if (search) {
          const matches =
            c.name.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(term);
          if (!matches) return false;
        }
        if (filter === 'devendo') return (debts[c.id!] ?? 0) > 0;
        if (filter === 'emdia') return (debts[c.id!] ?? 0) === 0;
        return true;
      })
      .sort((a, b) => (debts[b.id!] ?? 0) - (debts[a.id!] ?? 0));
  }, [clients, debts, filter, search]);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, codigo: generateClientCode(clients) });
    setErrors({});
    setModalVisible(true);
  }

  function openEdit(client: Client) {
    setEditingId(client.id ?? null);
    setForm({
      codigo: client.codigo ?? '',
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      addressNumber: client.addressNumber ?? '',
      city: client.city ?? '',
      state: client.state ?? '',
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
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    const data: Record<string, any> = {
      companyId,
      name: form.name.trim(),
    };
    if (form.codigo.trim()) data.codigo = form.codigo.trim();
    const optionalFields = ['email', 'phone', 'address', 'addressNumber', 'city', 'state'] as const;
    for (const field of optionalFields) {
      const val = form[field].trim();
      if (val) data[field] = val;
    }

    if (editingId) {
      await ClientService.updateClient(editingId, data);
    } else {
      await ClientService.createClient(data as any);
    }
    await loadClients();
    closeModal();
  }

  function confirmDelete(id: string, nome: string) {
    Alert.alert('Excluir Cliente', `Deseja excluir "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await ClientService.deleteClient(id);
          await loadClients();
        },
      },
    ]);
  }

  async function handleReceivePayment() {
    if (!detailClient?.id) return;
    const amount = parseCurrencyInput(receiveAmount);
    if (amount <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor válido.');
      return;
    }

    const allSales = await getAllSales(companyId);
    const pendingSales = allSales
      .filter((s) => s.clientId === detailClient.id && s.paymentMethod === 'fiado' && s.status !== 'concluída')
      .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));

    let remaining = amount;
    for (const sale of pendingSales) {
      if (remaining <= 0) break;
      const owed = sale.totalAmount - (sale.paidAmount ?? 0);
      if (owed <= 0) continue;
      if (remaining >= owed) {
        await updateSale(sale.id!, { status: 'concluída', paidAmount: sale.totalAmount });
        remaining -= owed;
      } else {
        await updateSale(sale.id!, { paidAmount: (sale.paidAmount ?? 0) + remaining });
        remaining = 0;
      }
    }

    await createPayment({ companyId, clientId: detailClient.id, amount });

    setReceiveModal(false);
    setReceiveAmount('');
    setDetailClient(null);
    await loadClients();
    Alert.alert('Recebimento', `Valor recebido: ${formatCurrency(amount)}`);
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

  function handleClientPress(client: Client) {
    setDetailClient(client);
    loadTransactions(client);
  }

  function renderInput(
    label: string,
    field: string,
    options?: { keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'; placeholder?: string }
  ) {
    return (
      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="smallBold" style={styles.fieldLabel}>{label}</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.background },
            errors[field] && styles.inputError,
          ]}
          value={(form as any)[field]}
          onChangeText={(v) => updateField(field, v)}
          placeholderTextColor={theme.textSecondary}
          placeholder={options?.placeholder}
          keyboardType={options?.keyboardType ?? 'default'}
        />
        {errors[field] && (
          <ThemedText type="small" style={{ color: '#ef4444' }}>{errors[field]}</ThemedText>
        )}
      </ThemedView>
    );
  }

  function renderClient({ item }: { item: Client }) {
    const debt = debts[item.id!] ?? 0;
    const hasDebt = debt > 0;
    const lastPurchase = lastPurchases[item.id!];

    return (
      <View style={styles.clientItem}>
        <View style={styles.clientRow}>
          <ThemedText style={[styles.clientDot, { color: hasDebt ? '#ef4444' : '#22c55e', fontSize: 10 }]}>●</ThemedText>
          <View style={styles.clientInfo}>
            <ThemedText style={styles.clientName}>{item.name}</ThemedText>
            {item.phone ? (
              <ThemedText style={styles.clientPhone}>📞 {item.phone}</ThemedText>
            ) : null}
            {lastPurchase ? (
              <ThemedText style={styles.clientLastPurchase}>
                Última compra: {formatLastPurchase(lastPurchase)}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.clientDebt, hasDebt && { color: '#ef4444' }]}>
              Em aberto: {formatCurrency(debt)}
            </ThemedText>
          </View>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push(`/cliente-detalhe?id=${item.id}`)}
            style={styles.outlineButton}
          >
            <ThemedText style={styles.outlineButtonText}>Detalhes</ThemedText>
          </Pressable>
          {hasDebt && (
            <Pressable
              onPress={() => {
                setDetailClient(item);
                loadTransactions(item);
                setReceiveAmount('');
                setReceiveModal(true);
              }}
              style={styles.actionButton}
            >
              <ThemedText style={styles.actionButtonText}>Receber</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>👤 Clientes</ThemedText>
            <Pressable onPress={openNew} style={styles.addButton}>
              <ThemedText style={styles.addButtonText}>+ Novo</ThemedText>
            </Pressable>
          </View>

          {loading ? <Loading /> : (
            <>
              {/* Stats */}
              <View style={styles.statCard}>
                <ThemedText style={styles.statLabel}>Saldo a Receber</ThemedText>
                <ThemedText style={styles.statValue}>{formatCurrency(totalReceivable)}</ThemedText>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCardSmall}>
                  <ThemedText style={styles.statLabel}>Clientes</ThemedText>
                  <ThemedText style={styles.statValue}>{clients.length}</ThemedText>
                </View>
                <View style={styles.statCardSmall}>
                  <ThemedText style={styles.statLabel}>Inadimplentes</ThemedText>
                  <ThemedText style={[styles.statValue, { color: '#ef4444' }]}>{inadimplentes}</ThemedText>
                </View>
              </View>

              {/* Search */}
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Buscar cliente..."
                  placeholderTextColor={theme.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {/* Filter Chips */}
              <View style={styles.filterRow}>
                {(['todos', 'devendo', 'emdia'] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[styles.filterChip, { backgroundColor: filter === f ? '#7B4F2C' : theme.backgroundElement }]}
                  >
                    <ThemedText type="small" style={{ fontWeight: '600', color: filter === f ? '#fff' : theme.text }}>
                      {f === 'todos' ? 'Todos' : f === 'devendo' ? 'Devendo' : 'Em dia'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {/* Client List */}
              {filteredClients.length === 0 ? (
                <ThemedView style={styles.emptyState}>
                  <ThemedText style={styles.emptyEmoji}>📋</ThemedText>
                  <ThemedText type="subtitle" style={styles.emptyTitle}>
                    {filter === 'todos' ? 'Nenhum cliente' : filter === 'devendo' ? 'Nenhum cliente devendo' : 'Nenhum cliente em dia'}
                  </ThemedText>
                </ThemedView>
              ) : (
                filteredClients.map((client, idx) => (
                  <View key={client.id}>
                    {renderClient({ item: client })}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Receive Sheet */}
      {receiveModal && (
        <ThemedView style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => setReceiveModal(false)} />
          <ThemedView style={[styles.receiveSheet, { backgroundColor: theme.background }]}>
            <ThemedView style={styles.receiveHandle} />
            <ThemedText style={{ fontWeight: '700', fontSize: 18, marginBottom: Spacing.three }}>
              Receber de {detailClient?.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.one }}>
              Dívida total: {formatCurrency(debts[detailClient?.id ?? ''] ?? 0)}
            </ThemedText>
            <TextInput
              style={[styles.receiveInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              placeholder="R$ 0,00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={receiveAmount}
              onChangeText={(v) => setReceiveAmount(formatCurrencyInput(v))}
            />
            <ThemedView style={styles.receiveActions}>
              <Pressable onPress={() => setReceiveModal(false)} style={styles.receiveCancel}>
                <ThemedText style={{ fontWeight: '600' }}>Cancelar</ThemedText>
              </Pressable>
              <Pressable onPress={handleReceivePayment} style={styles.receiveConfirm}>
                <ThemedText style={{ fontWeight: '600', color: theme.background }}>Confirmar</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      )}

      {/* New/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                {editingId ? 'Editar Cliente' : 'Novo Cliente'}
              </ThemedText>
              <Pressable onPress={closeModal}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderInput('Nome *', 'name', { placeholder: 'Nome do cliente' })}

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Email', 'email', { keyboardType: 'email-address', placeholder: 'email@exemplo.com' })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Telefone', 'phone', { keyboardType: 'phone-pad', placeholder: '(11) 99999-9999' })}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.rowFields}>
                <ThemedView style={{ flex: 2 }}>
                  {renderInput('Endereço', 'address', { placeholder: 'Rua, bairro' })}
                </ThemedView>
                <ThemedView style={{ flex: 1 }}>
                  {renderInput('Nº', 'addressNumber', { placeholder: 'Número' })}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Cidade', 'city', { placeholder: 'São Paulo' })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Estado', 'state', { placeholder: 'SP' })}
                </ThemedView>
              </ThemedView>

              <Pressable
                onPress={handleSave}
                style={styles.saveButton}
              >
                <ThemedText style={styles.saveButtonText}>
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
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
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  scrollContent: { paddingBottom: Spacing.six },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  addButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two, backgroundColor: '#7B4F2C' },
  addButtonText: { fontWeight: '600', fontSize: 14, color: '#fff' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    marginBottom: Spacing.three,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: Spacing.two },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two - 2,
    borderRadius: Spacing.half,
  },
  statCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  statLabel: { fontSize: 13, opacity: 0.6, marginBottom: Spacing.half },
  statValue: { fontSize: 24, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  statCardSmall: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  clientItem: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  clientDot: { fontSize: 16, marginTop: 2 },
  clientInfo: { flex: 1, gap: 2 },
  clientName: { fontSize: 16, fontWeight: '600' },
  clientPhone: { fontSize: 13, opacity: 0.7, marginTop: 1 },
  clientLastPurchase: { fontSize: 13, opacity: 0.7, marginTop: 1 },
  clientDebt: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#7B4F2C',
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  actionButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  outlineButton: {
    flex: 1,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7B4F2C',
  },
  outlineButtonText: { color: '#7B4F2C', fontWeight: '600', fontSize: 13 },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  detailCard: { gap: Spacing.half, paddingVertical: Spacing.two },
  modalContainer: { flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalTitle: { fontSize: 28, lineHeight: 32 },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: 'transparent', borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 16 },
  inputError: { borderColor: '#ef4444' },
  rowFields: { flexDirection: 'row', gap: Spacing.three },
  halfField: { flex: 1 },
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two, backgroundColor: '#7B4F2C' },
  saveButtonText: { fontWeight: '600', fontSize: 16, color: '#fff' },
  deleteButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.six, borderWidth: 1, borderColor: '#ef4444' },
  deleteButtonText: { color: '#ef4444', fontWeight: '600', fontSize: 16 },
  receiveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.three, backgroundColor: '#22c55e' },
  receiveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  receiveSheet: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    gap: Spacing.three,
  },
  receiveHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  receiveInput: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  receiveActions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  receiveCancel: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, borderWidth: 1, borderColor: 'rgba(128,128,128,0.3)' },
  receiveConfirm: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, backgroundColor: '#7B4F2C' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
});
