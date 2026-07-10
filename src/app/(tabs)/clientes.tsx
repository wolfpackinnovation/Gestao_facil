import { useState, useCallback } from 'react';
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
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
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

export default function ClientesScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [debts, setDebts] = useState<Record<string, number>>({});
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [receiveModal, setReceiveModal] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [transactions, setTransactions] = useState<{ type: 'compra' | 'recebimento'; description: string; amount: number; date: Date }[]>([]);

  const companyId = user?.uid ?? '';

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
    const [clientsData, allSales] = await Promise.all([
      search
        ? ClientService.searchClients(companyId, search)
        : ClientService.listClients(companyId),
      getAllSales(companyId),
    ]);
    setClients(clientsData);

    const debtMap: Record<string, number> = {};
    for (const sale of allSales) {
      if (sale.paymentMethod === 'fiado' && sale.status !== 'concluída' && sale.clientId) {
        debtMap[sale.clientId] = (debtMap[sale.clientId] ?? 0) + (sale.totalAmount - (sale.paidAmount ?? 0));
      }
    }
    setDebts(debtMap);
  }, [companyId, search]);

  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

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

  function renderClient({ item }: { item: Client }) {
    const debt = debts[item.id!] ?? 0;
    return (
      <Pressable onPress={() => { setDetailClient(item); loadTransactions(item); }} style={styles.dataRow}>
        <ThemedText style={styles.colCodigo}>cod: {item.codigo ?? '---'}</ThemedText>
        <ThemedView style={styles.nameRow}>
          <ThemedText style={styles.colNome} numberOfLines={1}>{item.name}</ThemedText>
          {debt > 0 && (
            <Pressable
              onPress={() => { setDetailClient(item); loadTransactions(item); setReceiveAmount(''); setReceiveModal(true); }}
              style={styles.listReceiveButton}
            >
              <ThemedText style={styles.listReceiveButtonText}>Receber</ThemedText>
            </Pressable>
          )}
        </ThemedView>
        <ThemedText style={[styles.colDebt, debt > 0 && { color: '#ef4444' }]}>
          dívida: {formatCurrency(debt)}
        </ThemedText>
      </Pressable>
    );
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.header}>
          <TextInput
            style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholder="Buscar cliente..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          <Pressable onPress={openNew} style={[styles.addButton, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>+ Novo</ThemedText>
          </Pressable>
        </ThemedView>

        {clients.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>📋</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>Nenhum cliente</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
              Cadastre seu primeiro cliente.
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView style={styles.tableWrapper}>
            <FlatList
              data={clients}
              keyExtractor={(item) => item.id!}
              renderItem={renderClient}
              showsVerticalScrollIndicator={false}
            />
          </ThemedView>
        )}
      </SafeAreaView>

      {/* Detail Modal */}
      <Modal visible={!!detailClient} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailClient(null)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>{detailClient?.name}</ThemedText>
            <Pressable onPress={() => setDetailClient(null)}>
              <ThemedText type="default" themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </ThemedView>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <ThemedView style={styles.detailCard}>
              <ThemedText type="small" themeColor="textSecondary">Código</ThemedText>
              <ThemedText style={{ fontWeight: '500' }}>{detailClient?.codigo || '---'}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.detailCard}>
              <ThemedText type="small" themeColor="textSecondary">Email</ThemedText>
              <ThemedText style={{ fontWeight: '500' }}>{detailClient?.email || '---'}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.detailCard}>
              <ThemedText type="small" themeColor="textSecondary">Telefone</ThemedText>
              <ThemedText style={{ fontWeight: '500' }}>{detailClient?.phone || '---'}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.detailCard}>
              <ThemedText type="small" themeColor="textSecondary">Endereço</ThemedText>
              <ThemedText style={{ fontWeight: '500' }}>
                {detailClient?.address ? `${detailClient.address}${detailClient?.addressNumber ? `, ${detailClient.addressNumber}` : ''}` : '---'}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.detailCard}>
              <ThemedText type="small" themeColor="textSecondary">Cidade / Estado</ThemedText>
              <ThemedText style={{ fontWeight: '500' }}>
                {detailClient?.city ? `${detailClient.city}${detailClient.state ? `/${detailClient.state}` : ''}` : '---'}
              </ThemedText>
            </ThemedView>
            <ThemedView style={[styles.detailCard, { borderTopWidth: 2, borderTopColor: 'rgba(128,128,128,0.2)', marginTop: Spacing.two }]}>
              <ThemedText type="small" themeColor="textSecondary">Dívida Total</ThemedText>
              <ThemedText style={{ fontWeight: '700', fontSize: 20, color: '#ef4444' }}>
                {formatCurrency(debts[detailClient?.id ?? ''] ?? 0)}
              </ThemedText>
            </ThemedView>
            {(debts[detailClient?.id ?? ''] ?? 0) > 0 && (
              <Pressable onPress={() => { setReceiveAmount(''); setReceiveModal(true); }} style={styles.receiveButton}>
                <ThemedText style={styles.receiveButtonText}>Receber</ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                const id = detailClient?.id;
                const name = detailClient?.name;
                setDetailClient(null);
                if (id) confirmDelete(id, name ?? '');
              }}
              style={styles.deleteButton}
            >
              <ThemedText style={styles.deleteButtonText}>Excluir Cliente</ThemedText>
            </Pressable>

            <ThemedView style={[styles.detailCard, { borderTopWidth: 2, borderTopColor: 'rgba(128,128,128,0.2)', marginTop: Spacing.six }]}>
              <ThemedText type="smallBold" style={{ letterSpacing: 0.5 }}>HISTÓRICO</ThemedText>
            </ThemedView>
            {transactions.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">Nenhuma transação</ThemedText>
            ) : (
              transactions.map((tx, idx) => (
                <ThemedView key={idx} style={styles.txRow}>
                  <ThemedView style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '500', fontSize: 14 }}>{tx.description}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {tx.date.toLocaleDateString('pt-BR')}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={{ fontWeight: '600', color: tx.type === 'recebimento' ? '#22c55e' : '#ef4444' }}>
                    {tx.type === 'recebimento' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </ThemedText>
                </ThemedView>
              ))
            )}
          </ScrollView>
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
                  <Pressable onPress={handleReceivePayment} style={[styles.receiveConfirm, { backgroundColor: theme.text }]}>
                    <ThemedText style={{ fontWeight: '600', color: theme.background }}>Confirmar</ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          )}
        </SafeAreaView>
      </Modal>

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
                style={[styles.saveButton, { backgroundColor: theme.text }]}
              >
                <ThemedText style={[styles.saveButtonText, { color: theme.background }]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  searchInput: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 16,
  },
  addButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  addButtonText: { fontWeight: '600', fontSize: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
  tableWrapper: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: '#cccccc',
  },
  dataRow: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  colCodigo: { fontSize: 12, fontWeight: '600', opacity: 0.5, marginBottom: Spacing.half },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.half,
  },
  colNome: { fontSize: 16, fontWeight: '600', flex: 1 },
  colDebt: { fontSize: 13, fontWeight: '500' },
  listReceiveButton: {
    backgroundColor: '#22c55e',
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  listReceiveButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
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
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
  saveButtonText: { fontWeight: '600', fontSize: 16 },
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
  receiveConfirm: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
});
