import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import {
  getMaterial,
  createMaterial,
  updateMaterial,
  type CategoriaMaterial,
} from '@/services/material-service';
import { UNITS, getUnit } from '@/utils/units';
import { formatCurrency } from '@/utils/format';

export default function MaterialFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const handleBack = useCallback(() => {
    router.replace('/materiais' as any);
  }, [router]);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('kg');

  const loadMaterial = useCallback(async () => {
    if (!id) return;
    const mat = await getMaterial(id);
    if (mat) {
      setNome(mat.nome);
      setPreco(String(Math.round(mat.precoCompra * 100)));
      setQuantidade(String(mat.quantidadeCompra || 1));
      setUnidade(mat.unidadeCompra);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (isEdit) loadMaterial();
  }, [isEdit, loadMaterial]);

  function formatBRL(cents: string): string {
    const digits = cents.replace(/\D/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2).replace(/^0+/, '') || '0';
    const decPart = padded.slice(-2);
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatted},${decPart}`;
  }

  function filterNumeric(text: string): string {
    return text.replace(/[^0-9.,]/g, '');
  }

  async function handleSave() {
    if (!companyId) return;
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome do material.');
      return;
    }
    const parsedPreco = Number(preco) / 100;
    const parsedQtd = Number(quantidade.replace(',', '.'));
    if (!isFinite(parsedPreco) || parsedPreco <= 0) {
      Alert.alert('Preço inválido', 'Informe o preço pago pela embalagem.');
      return;
    }
    if (!isFinite(parsedQtd) || parsedQtd <= 0) {
      Alert.alert('Quantidade inválida', 'Informe o conteúdo da embalagem.');
      return;
    }
    if (!getUnit(unidade)) {
      Alert.alert('Unidade inválida', 'Selecione uma unidade de medida válida.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        companyId,
        nome: nome.trim(),
        categoria: 'Outros' as CategoriaMaterial,
        unidadeCompra: unidade,
        quantidadeCompra: parsedQtd,
        precoCompra: parsedPreco,
      };
      if (isEdit && id) {
        await updateMaterial(id, payload);
        Alert.alert('Material atualizado', nome.trim());
      } else {
        await createMaterial(payload);
        Alert.alert('Material criado', nome.trim());
      }
      handleBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar material.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Loading />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <ThemedView style={styles.backRow}>
              <Pressable onPress={handleBack} style={styles.backButton}>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                  size={24}
                />
                <ThemedText type="smallBold">Voltar</ThemedText>
              </Pressable>
              <ThemedText style={styles.headerTitle}>
                {isEdit ? 'Editar material' : 'Novo material'}
              </ThemedText>
              <View style={{ width: 60 }} />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Nome do material</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="Ex: Farinha de trigo"
                placeholderTextColor={theme.textSecondary}
                value={nome}
                onChangeText={setNome}
              />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Preço</ThemedText>
              <View style={styles.priceWrapper}>
                <TextInput
                  style={[styles.input, styles.priceInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="0,00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={formatBRL(preco)}
                  onChangeText={(t) => setPreco(t.replace(/\D/g, ''))}
                />
                {preco.trim() !== '' && Number(preco) > 0 && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.pricePreview}>
                    = {formatCurrency(Number(preco) / 100)}
                  </ThemedText>
                )}
              </View>
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Conteúdo total da embalagem</ThemedText>
              <View style={styles.contentRow}>
                <TextInput
                  style={[styles.input, styles.contentInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="1"
                  placeholderTextColor={theme.textSecondary}
                  value={quantidade}
                  onChangeText={(t) => setQuantidade(filterNumeric(t))}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  onPress={() => setUnitPickerVisible(true)}
                  style={[styles.unitButton, { borderColor: theme.primary }]}
                >
                  <ThemedText style={[styles.unitButtonText, { color: theme.primary }]}>
                    {unidade}
                  </ThemedText>
                  <ThemedText style={[styles.unitButtonHint, { color: theme.textSecondary }]}>
                    unidade
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
            >
              <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar material'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={unitPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUnitPickerVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>Unidade da embalagem</ThemedText>
            <Pressable onPress={() => setUnitPickerVisible(false)}>
              <ThemedText themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.unitList}>
            {UNITS.map((u) => {
              const selected = unidade === u.code;
              return (
                <Pressable
                  key={u.code}
                  onPress={() => {
                    setUnidade(u.code);
                    setUnitPickerVisible(false);
                  }}
                  style={[
                    styles.unitRow,
                    {
                      backgroundColor: selected ? theme.backgroundElement : theme.background,
                      borderColor: selected ? theme.primary : 'rgba(128,128,128,0.2)',
                    },
                  ]}
                >
                  <View>
                    <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>{u.code}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{u.label}</ThemedText>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  form: { gap: Spacing.four, paddingVertical: Spacing.four, paddingBottom: Spacing.six },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 16,
  },
  priceInput: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  priceWrapper: { gap: Spacing.one },
  pricePreview: { textAlign: 'center' },
  contentRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  contentInput: { width: 80, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  unitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  unitButtonText: { fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  unitButtonHint: { fontSize: 11 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    paddingTop: Spacing.six,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  unitList: { padding: Spacing.three, gap: Spacing.two },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
});
