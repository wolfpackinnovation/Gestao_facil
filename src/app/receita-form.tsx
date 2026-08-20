import { useCallback, useEffect, useMemo, useState } from 'react';
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
  getRecipe,
  createRecipe,
  updateRecipe,
  calcRecipeCost,
  type CategoriaReceita,
  type Recipe,
  type RecipeItem,
} from '@/services/recipe-service';
import { getMaterials, type Material } from '@/services/material-service';
import { convertToBase, sameType, formatQuantity } from '@/utils/units';
import { formatCurrency } from '@/utils/format';

type DraftItem = RecipeItem;

export default function ReceitaFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const handleBack = useCallback(() => {
    router.replace('/receitas?tab=receitas' as any);
  }, [router]);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [nome, setNome] = useState('');
  const [rendimento, setRendimento] = useState('');
  const [unidadeRendimento, setUnidadeRendimento] = useState('un');
  const [percentualCustosAdicionais, setPercentualCustosAdicionais] = useState('');
  const [lucroEsperado, setLucroEsperado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState<DraftItem[]>([]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const mats = await getMaterials(companyId).catch(() => []);
    setMaterials(mats);
    if (isEdit && id) {
      const rec = await getRecipe(id).catch(() => null);
      if (rec) {
        setNome(rec.nome);
        setRendimento(String(rec.rendimento || ''));
        setUnidadeRendimento(rec.unidadeRendimento);
        setLucroEsperado(String(rec.valorLucro || ''));
        setObservacao(rec.observacao || '');
        setItens(rec.itens || []);
        if (rec.custosAdicionais && rec.custoTotal) {
          const custoMateriais = (rec.custoTotal ?? 0) - (rec.custosAdicionais ?? 0);
          if (custoMateriais > 0) {
            const pct = ((rec.custosAdicionais ?? 0) / custoMateriais) * 100;
            setPercentualCustosAdicionais(String(pct.toFixed(1)));
          }
        }
      }
    }
    setLoading(false);
  }, [companyId, id, isEdit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function filterNumeric(text: string): string {
    return text.replace(/[^0-9.,]/g, '');
  }

  const custoMateriais = useMemo(() => {
    let total = 0;
    for (const item of itens) {
      const mat = materials.find((m) => m.id === item.materialId);
      if (!mat) continue;
      if (!sameType(item.unidade, mat.unidadeCompra)) continue;
      const qtyBase = convertToBase(item.quantidade, item.unidade);
      total += qtyBase * mat.custoPorUnidadeBase;
    }
    return total;
  }, [itens, materials]);

  const percentualNum = Number(percentualCustosAdicionais.replace(',', '.')) || 0;
  const custosAdicionaisCalculado = custoMateriais * (percentualNum / 100);

  const draftRecipe: Pick<Recipe, 'itens' | 'rendimento' | 'custosAdicionais' | 'modoLucro' | 'valorLucro'> = useMemo(() => ({
    itens,
    rendimento: Number(rendimento.replace(',', '.')) || 1,
    custosAdicionais: custosAdicionaisCalculado,
    modoLucro: 'markup',
    valorLucro: Number(lucroEsperado.replace(',', '.')) || 0,
  }), [itens, rendimento, custosAdicionaisCalculado, lucroEsperado]);

  const breakdown = useMemo(
    () => calcRecipeCost(draftRecipe, materials),
    [draftRecipe, materials],
  );

  function addItem(materialId: string) {
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;
    setItens((prev) => [
      ...prev,
      { materialId, quantidade: 1, unidade: mat.unidadeCompra },
    ]);
    setPickerVisible(false);
  }

  function removeItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!companyId) return;
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome da receita.');
      return;
    }
    if (itens.length === 0 && percentualNum === 0) {
      Alert.alert('Receita vazia', 'Adicione pelo menos um material ou custo adicional.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        nome: nome.trim(),
        categoria: 'Outros' as CategoriaReceita,
        rendimento: Number(rendimento.replace(',', '.')) || 1,
        unidadeRendimento,
        custosAdicionais: custosAdicionaisCalculado,
        modoLucro: 'markup' as const,
        valorLucro: Number(lucroEsperado.replace(',', '.')) || 0,
        observacao: observacao.trim() || undefined,
        itens,
        custoTotal: breakdown.custoTotal,
        custoPorUnidade: breakdown.custoPorUnidade,
        precoSugerido: breakdown.precoSugerido,
      };
      if (isEdit && id) {
        await updateRecipe(id, payload);
        Alert.alert('Receita atualizada', nome.trim());
      } else {
        await createRecipe(payload);
        Alert.alert('Receita criada', nome.trim());
      }
      handleBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao salvar receita.');
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
                {isEdit ? 'Editar receita' : 'Nova receita'}
              </ThemedText>
              <View style={{ width: 60 }} />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Nome da receita</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="Ex: Bolo de chocolate"
                placeholderTextColor={theme.textSecondary}
                value={nome}
                onChangeText={setNome}
              />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Adicionar quantidades</ThemedText>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => setPickerVisible(true)}
                  style={[styles.actionBtn, { borderColor: theme.primary }]}
                >
                  <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                  <ThemedText style={{ color: theme.primary, fontWeight: '600', marginLeft: Spacing.one }}>
                    Existente
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/material-form' as any)}
                  style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                >
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <ThemedText style={{ color: '#fff', fontWeight: '600', marginLeft: Spacing.one }}>
                    Novo material
                  </ThemedText>
                </Pressable>
              </View>

              {materials.length === 0 && itens.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  Cadastre materiais para poder adicioná-los à receita.
                </ThemedText>
              )}

              {itens.map((item, idx) => {
                const mat = materials.find((m) => m.id === item.materialId);
                if (!mat) return null;
                const compatible = sameType(item.unidade, mat.unidadeCompra);
                const itemCost = compatible
                  ? convertToBase(item.quantidade, item.unidade) * mat.custoPorUnidadeBase
                  : 0;
                return (
                  <ThemedView key={`${item.materialId}-${idx}`} style={styles.itemCard}>
                    <ThemedText style={{ fontWeight: '700' }} numberOfLines={1}>{mat.nome}</ThemedText>
                    <ThemedView style={styles.itemRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatQuantity(item.quantidade, item.unidade)}
                        {compatible ? ` · ${formatCurrency(itemCost)}` : ''}
                      </ThemedText>
                      <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color="#DC2626" />
                      </Pressable>
                    </ThemedView>
                  </ThemedView>
                );
              })}
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Rende quantas unidades</ThemedText>
              <TextInput
                style={[styles.input, styles.rendimentoInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="1"
                placeholderTextColor={theme.textSecondary}
                value={rendimento}
                onChangeText={(t) => setRendimento(filterNumeric(t))}
                keyboardType="decimal-pad"
              />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Custos adicionais</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                % sobre materiais — mão de obra, água, luz, gás, etc.
              </ThemedText>
              <TextInput
                style={[styles.input, styles.percentInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="0%"
                placeholderTextColor={theme.textSecondary}
                value={percentualCustosAdicionais}
                onChangeText={(t) => setPercentualCustosAdicionais(filterNumeric(t))}
                keyboardType="decimal-pad"
              />
              {percentualNum > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  equivale a {formatCurrency(custosAdicionaisCalculado)}
                </ThemedText>
              )}
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Lucro esperado (%)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Porcentagem sobre o custo total
              </ThemedText>
              <TextInput
                style={[styles.input, styles.percentInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="50%"
                placeholderTextColor={theme.textSecondary}
                value={lucroEsperado}
                onChangeText={(t) => setLucroEsperado(filterNumeric(t))}
                keyboardType="decimal-pad"
              />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Anotações</ThemedText>
              <TextInput
                style={[styles.input, styles.textarea, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="Modo de preparo, dicas, observações..."
                placeholderTextColor={theme.textSecondary}
                value={observacao}
                onChangeText={setObservacao}
                multiline
              />
            </ThemedView>

            <ThemedView style={styles.preview}>
              <ThemedText style={styles.sectionTitle}>Prévia do cálculo</ThemedText>
              <View style={styles.previewRow}>
                <ThemedText themeColor="textSecondary">Custo dos materiais</ThemedText>
                <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(custoMateriais)}</ThemedText>
              </View>
              <View style={styles.previewRow}>
                <ThemedText themeColor="textSecondary">Custos adicionais ({percentualNum.toFixed(1).replace(/\.0$/, '')}%)</ThemedText>
                <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(custosAdicionaisCalculado)}</ThemedText>
              </View>
              <View style={styles.previewRow}>
                <ThemedText themeColor="textSecondary">Custo total</ThemedText>
                <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(breakdown.custoTotal)}</ThemedText>
              </View>
              <View style={styles.previewRow}>
                <ThemedText themeColor="textSecondary">Custo por unidade</ThemedText>
                <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(breakdown.custoPorUnidade)}</ThemedText>
              </View>
              <View style={styles.previewRow}>
                <ThemedText themeColor="textSecondary">Preço sugerido</ThemedText>
                <ThemedText style={{ fontWeight: '700', color: '#22C55E' }}>
                  {formatCurrency(breakdown.precoSugerido)}
                </ThemedText>
              </View>
            </ThemedView>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
            >
              <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar receita'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={styles.modalHeader}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>Escolher material</ThemedText>
            <Pressable onPress={() => setPickerVisible(false)}>
              <ThemedText themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.two }}>
            {materials.length === 0 && (
              <ThemedText themeColor="textSecondary">Nenhum material cadastrado.</ThemedText>
            )}
            {materials.map((m) => {
              const alreadyAdded = itens.some((i) => i.materialId === m.id);
              return (
                <Pressable
                  key={m.id}
                  disabled={alreadyAdded}
                  onPress={() => addItem(m.id)}
                  style={[
                    styles.materialPick,
                    { backgroundColor: alreadyAdded ? theme.backgroundElement : theme.background, borderColor: 'rgba(128,128,128,0.2)' },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '700' }}>{m.nome}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatQuantity(m.quantidadeCompra, m.unidadeCompra)} · {formatCurrency(m.precoCompra)}
                    </ThemedText>
                  </View>
                  {alreadyAdded && (
                    <ThemedText type="small" style={{ color: '#22C55E', fontWeight: '600' }}>
                      Adicionado
                    </ThemedText>
                  )}
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
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  itemCard: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rendimentoInput: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  percentInput: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  preview: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 1, marginBottom: Spacing.one },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    paddingTop: Spacing.six,
  },
  materialPick: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
});
