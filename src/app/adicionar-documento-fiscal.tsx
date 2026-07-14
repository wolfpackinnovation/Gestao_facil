import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { createFiscalDocument } from '@/services/fiscal-document-service';

export default function AdicionarDocumentoFiscalScreen() {
  const scheme = useColorScheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [type, setType] = useState('');
  const [party, setParty] = useState('');
  const [valueText, setValueText] = useState('');
  const [number, setNumber] = useState('');
  const [entrada, setEntrada] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function formatCurrencyInput(text: string): string {
    const digits = text.replace(/\D/g, '');
    const val = parseInt(digits, 10) || 0;
    return (val / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  function parseCurrencyInput(text: string): number {
    const cleaned = text.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  async function handleSave() {
    if (!type.trim() || !party.trim() || !number.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha tipo, fornecedor/cliente e número do documento.');
      return;
    }

    setSaving(true);
    try {
      await createFiscalDocument({
        companyId,
        type: type.trim(),
        party: party.trim(),
        value: parseCurrencyInput(valueText),
        date: new Date().toISOString().split('T')[0],
        number: number.trim(),
        status: 'Pendente',
        status2: '',
        entrada,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Sucesso', 'Documento fiscal adicionado com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar o documento.');
    } finally {
      setSaving(false);
    }
  }

  const c = scheme === 'dark'
    ? { bg: '#161616', card: '#1F1F1F', text: '#FFFFFF', textSecondary: '#9CA3AF', border: '#2D2D2D', primary: '#C4956A' }
    : { bg: '#F8F9FB', card: '#FFFFFF', text: '#1F2937', textSecondary: '#6B7280', border: '#E5E7EB', primary: '#C4956A' };

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={c.text} />
              </Pressable>
              <ThemedText style={[styles.title, { color: c.text }]}>
                Adicionar Documento Fiscal
              </ThemedText>
              <View style={styles.backBtn} />
            </View>

            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.label, { color: c.textSecondary }]}>Tipo de documento</ThemedText>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                  placeholder="Ex: Nota Fiscal de Entrada"
                  placeholderTextColor={c.textSecondary}
                  value={type}
                  onChangeText={setType}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.label, { color: c.textSecondary }]}>Fornecedor / Cliente</ThemedText>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                  placeholder="Nome da empresa"
                  placeholderTextColor={c.textSecondary}
                  value={party}
                  onChangeText={setParty}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.label, { color: c.textSecondary }]}>Nº do documento</ThemedText>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                  placeholder="Número da nota"
                  placeholderTextColor={c.textSecondary}
                  value={number}
                  onChangeText={setNumber}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.label, { color: c.textSecondary }]}>Valor (R$)</ThemedText>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                  placeholder="0,00"
                  placeholderTextColor={c.textSecondary}
                  value={valueText}
                  onChangeText={setValueText}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.switchRow}>
                <ThemedText style={[styles.label, { color: c.textSecondary }]}>Entrada</ThemedText>
                <Switch
                  value={entrada}
                  onValueChange={setEntrada}
                  trackColor={{ false: c.border, true: c.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.label, { color: c.textSecondary }]}>Observações</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                  placeholder="Observações (opcional)"
                  placeholderTextColor={c.textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <ThemedText style={styles.saveBtnText}>
                {saving ? 'Salvando...' : 'Salvar documento'}
              </ThemedText>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  flex: { flex: 1 },
  scrollContent: { gap: Spacing.three, paddingTop: Spacing.three },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  fieldGroup: { gap: Spacing.one },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    fontWeight: '400',
  },
  textArea: { height: 80, paddingTop: Spacing.three },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
