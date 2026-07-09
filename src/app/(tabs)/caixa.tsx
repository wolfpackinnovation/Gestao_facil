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
import { useAuth } from '@/contexts/auth';
import * as CashService from '@/services/cash-service';
import type { CashRegister, CashMovement } from '@/types/schema';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface MovementForm {
  type: 'entrada' | 'saida'
  amount: string
  description: string
}

const emptyMovement: MovementForm = {
  type: 'entrada',
  amount: '',
  description: '',
};

export default function CaixaScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [registerModal, setRegisterModal] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [movementModal, setMovementModal] = useState(false);
  const [newRegisterName, setNewRegisterName] = useState('');
  const [movementForm, setMovementForm] = useState<MovementForm>({ ...emptyMovement });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const companyId = user?.uid ?? '';

  const loadRegisters = useCallback(async () => {
    const data = await CashService.listCashRegisters(companyId);
    setRegisters(data);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadRegisters();
    }, [loadRegisters])
  );

  async function loadMovements(register: CashRegister) {
    setSelectedRegister(register);
    const data = await CashService.listCashMovements(register.id!);
    setMovements(data);
    setRegisterModal(true);
  }

  async function createRegister() {
    if (!newRegisterName.trim()) {
      Alert.alert('Erro', 'Informe um nome para o caixa.');
      return;
    }
    await CashService.createCashRegister({
      companyId,
      name: newRegisterName.trim(),
      currentBalance: 0,
      isOpen: false,
    });
    setNewRegisterName('');
    await loadRegisters();
  }

  async function toggleRegister(register: CashRegister) {
    if (register.isOpen) {
      await CashService.closeCashRegister(register.id!);
    } else {
      await CashService.openCashRegister(register.id!, register.currentBalance);
    }
    await loadRegisters();
  }

  async function confirmDeleteRegister(register: CashRegister) {
    Alert.alert('Excluir Caixa', `Deseja excluir "${register.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await CashService.deleteCashRegister(register.id!);
          await loadRegisters();
        },
      },
    ]);
  }

  function openMovement() {
    setMovementForm({ ...emptyMovement });
    setErrors({});
    setMovementModal(true);
  }

  async function saveMovement() {
    const amount = Number(movementForm.amount);
    if (!amount || amount <= 0) {
      setErrors({ amount: 'Valor inválido' });
      return;
    }
    if (!selectedRegister) return;

    const movementAmount = movementForm.type === 'entrada' ? amount : -amount;
    const newBalance = (selectedRegister.currentBalance ?? 0) + movementAmount;

    await CashService.createCashMovement({
      cashRegisterId: selectedRegister.id!,
      userId: user?.uid ?? '',
      type: movementForm.type,
      amount: movementAmount,
      balanceAfter: newBalance,
      description: movementForm.description.trim() || undefined,
    });

    await CashService.updateCashRegister(selectedRegister.id!, {
      currentBalance: newBalance,
    } as any);

    setMovementModal(false);
    await loadMovements(selectedRegister);
    await loadRegisters();
  }

  function renderRegister({ item }: { item: CashRegister }) {
    return (
      <Pressable onPress={() => loadMovements(item)}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedView style={styles.cardHeader}>
            <ThemedText style={styles.cardName}>{item.name}</ThemedText>
            <ThemedView style={[styles.statusBadge, { backgroundColor: item.isOpen ? '#22c55e' : '#ef4444' }]}>
              <ThemedText type="small" style={{ color: '#fff', fontWeight: '600' }}>
                {item.isOpen ? 'Aberto' : 'Fechado'}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedText style={{ fontWeight: '700', fontSize: 20, marginVertical: Spacing.two }}>
            {formatCurrency(item.currentBalance ?? 0)}
          </ThemedText>

          <ThemedView style={styles.cardActions}>
            <Pressable
              onPress={() => toggleRegister(item)}
              style={[styles.actionBtn, { backgroundColor: theme.text }]}
            >
              <ThemedText type="small" style={{ color: theme.background, fontWeight: '600' }}>
                {item.isOpen ? 'Fechar Caixa' : 'Abrir Caixa'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => confirmDeleteRegister(item)} style={styles.deleteButton}>
              <ThemedText type="small" style={{ color: '#ef4444' }}>Excluir</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>
      </Pressable>
    );
  }

  function renderMovement({ item }: { item: CashMovement }) {
    const isEntry = item.amount > 0;
    return (
      <ThemedView type="backgroundElement" style={styles.movementCard}>
        <ThemedView style={styles.movementInfo}>
          <ThemedText style={{ fontWeight: '600' }}>
            {item.type === 'entrada' ? 'Entrada' : 'Saída'}
          </ThemedText>
          {item.description && (
            <ThemedText type="small" themeColor="textSecondary">{item.description}</ThemedText>
          )}
        </ThemedView>
        <ThemedView style={{ alignItems: 'flex-end' }}>
          <ThemedText style={{ fontWeight: '700', color: isEntry ? '#22c55e' : '#ef4444' }}>
            {isEntry ? '+' : ''}{formatCurrency(item.amount)}
          </ThemedText>
          {item.balanceAfter != null && (
            <ThemedText type="small" themeColor="textSecondary">
              Saldo: {formatCurrency(item.balanceAfter)}
            </ThemedText>
          )}
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedText style={styles.headerEmoji}>💵</ThemedText>

        {/* New Register Input */}
        <ThemedView style={styles.newRegisterRow}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, flex: 1 }]}
            placeholder="Nome do novo caixa..."
            placeholderTextColor={theme.textSecondary}
            value={newRegisterName}
            onChangeText={setNewRegisterName}
          />
          <Pressable onPress={createRegister} style={[styles.addButton, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>Criar</ThemedText>
          </Pressable>
        </ThemedView>

        {registers.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>📒</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>Nenhum caixa</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">Crie um caixa para começar.</ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={registers}
            keyExtractor={(item) => item.id!}
            renderItem={renderRegister}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </SafeAreaView>

      {/* Register Detail Modal */}
      <Modal visible={registerModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRegisterModal(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>{selectedRegister?.name}</ThemedText>
            <Pressable onPress={() => setRegisterModal(false)}>
              <ThemedText type="default" themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </ThemedView>

          {selectedRegister && (
            <ThemedView style={styles.registerSummary}>
              <ThemedText style={{ fontWeight: '700', fontSize: 24 }}>
                {formatCurrency(selectedRegister.currentBalance ?? 0)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Saldo Atual</ThemedText>
            </ThemedView>
          )}

          <Pressable
            onPress={openMovement}
            style={[styles.addButton, { backgroundColor: theme.text, alignSelf: 'center', marginBottom: Spacing.three }]}
          >
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>+ Novo Movimento</ThemedText>
          </Pressable>

          <FlatList
            data={movements}
            keyExtractor={(item) => item.id!}
            renderItem={renderMovement}
            contentContainerStyle={{ paddingHorizontal: Spacing.four, gap: Spacing.two }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <ThemedText style={{ textAlign: 'center', marginTop: Spacing.four }} themeColor="textSecondary">
                Nenhum movimento registrado
              </ThemedText>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Movement Form Modal */}
      <Modal visible={movementModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMovementModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>Novo Movimento</ThemedText>
              <Pressable onPress={() => setMovementModal(false)}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Tipo</ThemedText>
                <ThemedView style={styles.chipsRow}>
                  {(['entrada', 'saida'] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setMovementForm((prev) => ({ ...prev, type }))}
                      style={[
                        styles.chip,
                        { backgroundColor: movementForm.type === type ? theme.text : theme.backgroundElement },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: movementForm.type === type ? theme.background : theme.text }}
                      >
                        {type === 'entrada' ? 'Entrada' : 'Saída'}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Valor *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.background },
                    errors.amount && styles.inputError,
                  ]}
                  value={movementForm.amount}
                  onChangeText={(v) => {
                    setMovementForm((prev) => ({ ...prev, amount: v }));
                    setErrors({});
                  }}
                  placeholder="0,00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                />
                {errors.amount && (
                  <ThemedText type="small" style={{ color: '#ef4444' }}>{errors.amount}</ThemedText>
                )}
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Descrição</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                  value={movementForm.description}
                  onChangeText={(v) => setMovementForm((prev) => ({ ...prev, description: v }))}
                  placeholder="Ex: Venda do dia, Pagamento fornecedor..."
                  placeholderTextColor={theme.textSecondary}
                />
              </ThemedView>

              <Pressable
                onPress={saveMovement}
                style={[styles.saveButton, { backgroundColor: theme.text }]}
              >
                <ThemedText style={[styles.saveButtonText, { color: theme.background }]}>
                  Registrar Movimento
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
  headerEmoji: { fontSize: 32, paddingVertical: Spacing.three },
  newRegisterRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  input: { borderWidth: 1, borderColor: 'transparent', borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 16 },
  inputError: { borderColor: '#ef4444' },
  addButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  addButtonText: { fontWeight: '600', fontSize: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { flex: 1, fontWeight: '600' },
  statusBadge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.one },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actionBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  deleteButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  modalContainer: { flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalTitle: { fontSize: 28, lineHeight: 32 },
  modalScrollContent: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  registerSummary: { alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.half },
  movementCard: { borderRadius: Spacing.three, padding: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  movementInfo: { flex: 1, gap: Spacing.half },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.half },
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
  saveButtonText: { fontWeight: '600', fontSize: 16 },
});
