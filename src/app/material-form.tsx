import { useCallback, useEffect, useState, useRef } from 'react';
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
  calcCustoPorUnidadeBase,
  type CategoriaMaterial,
} from '@/services/material-service';
import { createDespesa } from '@/services/despesa-service';
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
      const qty = mat.quantidadeCompra || 1;
      const calcQty = (mat.unidadeCompra === 'g' || mat.unidadeCompra === 'ml') ? (qty / 1000) : qty;
      const totalPaid = mat.precoCompra;
      setPreco(String(Math.round(totalPaid * 100)));
      setQuantidade(String(qty));
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

  const isSubmitting = useRef(false);

  async function handleSave() {
    if (saving || isSubmitting.current) return;
    isSubmitting.current = true;
    setSaving(true);

    if (!companyId) {
      isSubmitting.current = false;
      setSaving(false);
      return;
    }
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome do material.');
      isSubmitting.current = false;
      setSaving(false);
      return;
    }
    const parsedPreco = Number(preco) / 100;
    const parsedQtd = Number(quantidade.replace(',', '.'));
    
    if (!isFinite(parsedPreco) || parsedPreco <= 0) {
      Alert.alert('Preço inválido', 'Informe o valor total pago.');
      isSubmitting.current = false;
      setSaving(false);
      return;
    }
    if (!isFinite(parsedQtd) || parsedQtd <= 0) {
      Alert.alert('Quantidade inválida', 'Informe o tamanho da embalagem.');
      isSubmitting.current = false;
      setSaving(false);
      return;
    }
    if (!getUnit(unidade)) {
      Alert.alert('Unidade inválida', 'Selecione uma unidade de medida válida.');
      isSubmitting.current = false;
      setSaving(false);
      return;
    }

    const gastoTotal = parsedPreco;

    try {
      const payload = {
        companyId,
        nome: nome.trim(),
        categoria: 'Outros' as CategoriaMaterial,
        unidadeCompra: unidade,
        quantidadeCompra: parsedQtd,
        precoCompra: gastoTotal,
        custoPorUnidadeBase: calcCustoPorUnidadeBase(gastoTotal, parsedQtd, unidade),
      };
      if (isEdit && id) {
        await updateMaterial(id, payload);
        Alert.alert('Material atualizado', nome.trim());
      } else {
        const matId = await createMaterial(payload);
        await createDespesa({
          companyId,
          materialId: matId,
          descricao: `Estoque: ${nome.trim()}`,
          valor: gastoTotal,
          categoria: 'Compra de Produtos',
          data: new Date().toISOString().slice(0, 10),
          observacao: `Estoque inicial de ${parsedQtd} ${unidade}`,
          pago: true,
        });

        // Cria o lote inicial
        const { createLote, listAllLotesByProduct, gerarCodigoLote } = await import('@/services/lote-service');
        const allLotes = await listAllLotesByProduct(matId);
        const codigo = gerarCodigoLote(allLotes.map(l => l.codigo), nome.slice(0, 2).toUpperCase());
        await createLote({
          companyId,
          productId: matId,
          codigo,
          quantidadeInicial: parsedQtd,
          custoUnitario: parsedQtd > 0 ? gastoTotal / parsedQtd : 0,
          dataValidade: '',
          dataEntrada: new Date().toLocaleDateString('pt-BR'),
          fornecedor: '',
          observacao: 'Estoque inicial',
          origem: 'reposicao',
        });

        Alert.alert('Material criado', nome.trim());
      }
      handleBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar material.');
      isSubmitting.current = false;
      setSaving(false);
    }
    // We don't reset `isSubmitting` and `saving` on success because we navigate away (handleBack)
    // and resetting it might allow another click during the navigation transition.
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
              <ThemedText type="smallBold" style={styles.fieldLabel}>Valor total pago</ThemedText>
              <View style={styles.priceWrapper}>
                <TextInput
                  style={[styles.input, styles.priceInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="0,00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={formatBRL(preco)}
                  onChangeText={(t) => setPreco(t.replace(/\D/g, ''))}
                />
              </View>
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Quantidade que você comprou</ThemedText>
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
                    {getUnit(unidade)?.label.includes('(') 
                      ? getUnit(unidade)?.label.split('(')[1].replace(')', '') 
                      : getUnit(unidade)?.label || 'unidade'}
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
