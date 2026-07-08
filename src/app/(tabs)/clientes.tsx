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
import type { Client } from '@/types/schema';

import { useAuth } from '@/contexts/auth';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  cpfCnpj: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
};

export default function ClientesScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const companyId = user?.uid ?? '';

  const loadClients = useCallback(async () => {
    const data = search
      ? await ClientService.searchClients(companyId, search)
      : await ClientService.listClients(companyId);
    setClients(data);
  }, [companyId, search]);

  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setErrors({});
    setModalVisible(true);
  }

  function openEdit(client: Client) {
    setEditingId(client.id ?? null);
    setForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      cpfCnpj: client.cpfCnpj ?? '',
      address: client.address ?? '',
      city: client.city ?? '',
      state: client.state ?? '',
      zipCode: client.zipCode ?? '',
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
    const data = {
      companyId,
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      cpfCnpj: form.cpfCnpj.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zipCode: form.zipCode.trim() || undefined,
    };

    if (editingId) {
      await ClientService.updateClient(editingId, data);
    } else {
      await ClientService.createClient(data);
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
    return (
      <Pressable onPress={() => openEdit(item)}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedView style={styles.cardHeader}>
            <ThemedText style={styles.cardName}>{item.name}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.cardBody}>
            {item.email ? (
              <ThemedView style={styles.cardRow}>
                <ThemedText type="small" themeColor="textSecondary">Email:</ThemedText>
                <ThemedText type="smallBold">{item.email}</ThemedText>
              </ThemedView>
            ) : null}
            {item.phone ? (
              <ThemedView style={styles.cardRow}>
                <ThemedText type="small" themeColor="textSecondary">Telefone:</ThemedText>
                <ThemedText type="smallBold">{item.phone}</ThemedText>
              </ThemedView>
            ) : null}
            {item.cpfCnpj ? (
              <ThemedView style={styles.cardRow}>
                <ThemedText type="small" themeColor="textSecondary">CPF/CNPJ:</ThemedText>
                <ThemedText type="smallBold">{item.cpfCnpj}</ThemedText>
              </ThemedView>
            ) : null}
            {item.city ? (
              <ThemedView style={styles.cardRow}>
                <ThemedText type="small" themeColor="textSecondary">Cidade:</ThemedText>
                <ThemedText type="smallBold">{item.city}{item.state ? `/${item.state}` : ''}</ThemedText>
              </ThemedView>
            ) : null}
          </ThemedView>

          <Pressable
            onPress={() => confirmDelete(item.id!, item.name)}
            style={styles.deleteButton}
          >
            <ThemedText type="small" style={{ color: '#ef4444' }}>Excluir</ThemedText>
          </Pressable>
        </ThemedView>
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
          <ThemedText style={styles.headerEmoji}>👥</ThemedText>
          <ThemedText type="title" style={styles.headerTitle}>Clientes</ThemedText>
          <Pressable onPress={openNew} style={[styles.addButton, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>+ Novo</ThemedText>
          </Pressable>
        </ThemedView>

        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          placeholder="Buscar cliente..."
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
        />

        {clients.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>📋</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>Nenhum cliente</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
              Cadastre seu primeiro cliente.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id!}
            renderItem={renderClient}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </SafeAreaView>

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

              {renderInput('CPF/CNPJ', 'cpfCnpj', { placeholder: '000.000.000-00' })}
              {renderInput('Endereço', 'address', { placeholder: 'Rua, número, bairro' })}

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Cidade', 'city', { placeholder: 'São Paulo' })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Estado', 'state', { placeholder: 'SP' })}
                </ThemedView>
              </ThemedView>

              {renderInput('CEP', 'zipCode', { placeholder: '00000-000' })}

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.three },
  headerEmoji: { fontSize: 32 },
  headerTitle: { fontSize: 32, lineHeight: 36 },
  addButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  addButtonText: { fontWeight: '600', fontSize: 14 },
  searchInput: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 16, marginBottom: Spacing.three },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { flex: 1, fontWeight: '600' },
  cardBody: { gap: Spacing.one },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteButton: { alignSelf: 'flex-end', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
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
});
