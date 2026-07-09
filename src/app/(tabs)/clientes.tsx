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
import { useFocusEffect, useRouter } from 'expo-router';

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
  const router = useRouter();
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
      <Pressable onPress={() => router.push('/cliente-detalhe?id=' + item.id as any)}>
        <ThemedView style={styles.dataRow}>
          <ThemedText numberOfLines={1} style={styles.colNome}>{item.name}</ThemedText>
          <ThemedText numberOfLines={1} style={styles.colEmail}>{item.email || '---'}</ThemedText>
          <ThemedText style={styles.colPhone}>{item.phone || '---'}</ThemedText>
          <ThemedText style={styles.colCidade}>
            {item.city ? `${item.city}${item.state ? `/${item.state}` : ''}` : '---'}
          </ThemedText>
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
            <ThemedView style={styles.tableHeader}>
              <ThemedText type="smallBold" style={styles.colNome}>Nome</ThemedText>
              <ThemedText type="smallBold" style={styles.colEmail}>Email</ThemedText>
              <ThemedText type="smallBold" style={styles.colPhone}>Telefone</ThemedText>
              <ThemedText type="smallBold" style={styles.colCidade}>Cidade</ThemedText>
            </ThemedView>
            <FlatList
              data={clients}
              keyExtractor={(item) => item.id!}
              renderItem={renderClient}
              showsVerticalScrollIndicator={false}
            />
          </ThemedView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eeeeee',
  },
  colNome: { flex: 1.5, fontSize: 13, fontWeight: '500', paddingRight: Spacing.one },
  colEmail: { flex: 1.5, fontSize: 12, paddingRight: Spacing.one },
  colPhone: { width: 100, fontSize: 12, paddingRight: Spacing.one },
  colCidade: { flex: 1, fontSize: 12, textAlign: 'right' },
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
