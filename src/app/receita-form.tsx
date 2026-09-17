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
import { convertToBase, sameType, formatQuantity, UNITS } from '@/utils/units';
import { formatCurrency } from '@/utils/format';
import { saveProduto, getProdutos } from '@/services/estoque-storage';
import { updateMaterial } from '@/services/material-service';

type DraftItem = RecipeItem & { _tempQty?: string };


export default function ReceitaFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const { id, produce } = useLocalSearchParams<{ id?: string; produce?: string }>();
  const isEdit = Boolean(id);
  const isProduce = produce === 'true';

  const handleBack = useCallback(() => {
    router.replace('/estoque' as any);
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
  const [precoVendaFinal, setPrecoVendaFinal] = useState('');
  const [custoFixo, setCustoFixo] = useState('');
  const [itens, setItens] = useState<DraftItem[]>([]);
  const [tipoProduto, setTipoProduto] = useState<'receita' | 'revenda'>('receita');
  
  const [dataValidade, setDataValidade] = useState('');
  const [estoqueAtualStr, setEstoqueAtualStr] = useState('');

  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const mats = await getMaterials(companyId).catch(() => []);
    setMaterials(mats);
    if (isEdit && id) {
      const rec = await getRecipe(id).catch(() => null);
      if (rec) {
        setNome(rec.nome);
        setRendimento(isProduce ? '' : String(rec.rendimento ?? ''));
        setUnidadeRendimento(rec.unidadeRendimento);
        setLucroEsperado(String(rec.valorLucro ?? ''));
        setItens(rec.itens.map(i => ({ ...i, _tempQty: String(i.quantidade) })) || []);
        if (rec.custoFixo && rec.custoFixo > 0 && rec.itens.length === 0) {
          setTipoProduto('revenda');
        } else {
          setTipoProduto('receita');
        }
        if (rec.custoFixo) {
          setCustoFixo(formatBRLInput(rec.custoFixo.toFixed(2)));
        }
        if (rec.percentualCustosAdicionais !== undefined) {
          setPercentualCustosAdicionais(String(rec.percentualCustosAdicionais).replace('.', ','));
        } else if (rec.custosAdicionais && rec.custoTotal) {
          // custoMateriais sem custo fixo
          const custoMateriais = (rec.custoTotal ?? 0) - (rec.custosAdicionais ?? 0) - (rec.custoFixo ?? 0);
          if (custoMateriais > 0) {
            const pct = ((rec.custosAdicionais ?? 0) / custoMateriais) * 100;
            setPercentualCustosAdicionais(Number(pct.toFixed(2)).toString().replace('.', ','));
          }
        }
      }
      const produtos = await getProdutos(companyId);
      const existingProd = produtos.find(p => p.id === id);
      if (existingProd) {
        if (isProduce) {
          setEstoqueAtualStr(`${existingProd.quantidade} ${existingProd.unidade}`);
        }
        if (existingProd.precoVenda) {
          setPrecoVendaFinal(formatBRLInput(existingProd.precoVenda.toFixed(2)));
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

  function formatBRLInput(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const integerPart = padded.slice(0, -2);
    const decimalPart = padded.slice(-2);
    const formattedInteger = parseInt(integerPart, 10).toLocaleString('pt-BR');
    return `${formattedInteger},${decimalPart}`;
  }

  const custoFixoNum = tipoProduto === 'revenda' ? Number(custoFixo.replace(/\D/g, '')) / 100 : 0;
  
  const custoMateriais = useMemo(() => {
    let total = 0;
    if (tipoProduto === 'receita') {
      for (const item of itens) {
        const mat = materials.find((m) => m.id === item.materialId);
        if (!mat) continue;
        if (!sameType(item.unidade, mat.unidadeCompra)) continue;
        const qtyBase = convertToBase(item.quantidade, item.unidade);
        total += qtyBase * mat.custoPorUnidadeBase;
      }
    }
    return total;
  }, [itens, materials, tipoProduto]);

  const percentualNum = tipoProduto === 'receita' ? (Number(percentualCustosAdicionais.replace(',', '.')) || 0) : 0;
  const custosAdicionaisCalculado = custoMateriais * (percentualNum / 100);

  const draftRecipe: Pick<Recipe, 'itens' | 'rendimento' | 'custosAdicionais' | 'custoFixo' | 'modoLucro' | 'valorLucro'> = useMemo(() => ({
    itens: tipoProduto === 'receita' ? itens : [],
    rendimento: Number(rendimento.replace(',', '.')) || 1,
    custosAdicionais: custosAdicionaisCalculado,
    custoFixo: custoFixoNum,
    modoLucro: 'markup',
    valorLucro: Number(lucroEsperado.replace(',', '.')) || 0,
  }), [itens, rendimento, custosAdicionaisCalculado, custoFixoNum, lucroEsperado, tipoProduto]);

  const breakdown = useMemo(
    () => calcRecipeCost(draftRecipe, materials),
    [draftRecipe, materials],
  );

  function addItem(materialId: string) {
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;
    setItens((prev) => [
      ...prev,
      { materialId, quantidade: 1, unidade: mat.unidadeCompra, _tempQty: '1' },
    ]);
    setPickerVisible(false);
  }

  function removeItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (saving) return;
    if (!companyId) return;
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome do produto.');
      return;
    }
    setSaving(true);
    try {
      const payloadItens = tipoProduto === 'receita' ? itens.map(({ materialId, quantidade, unidade }) => ({ materialId, quantidade, unidade })) : [];
      const payload = {
        companyId,
        nome: nome.trim(),
        categoria: 'Outros' as CategoriaReceita,
        rendimento: Number(rendimento.replace(',', '.')) || 1,
        unidadeRendimento,
        custosAdicionais: custosAdicionaisCalculado,
        percentualCustosAdicionais: percentualNum,
        custoFixo: custoFixoNum,
        modoLucro: 'markup' as const,
        valorLucro: Number(lucroEsperado.replace(',', '.')) || 0,
        itens: payloadItens,
        custoTotal: breakdown.custoTotal,
        custoPorUnidade: breakdown.custoPorUnidade,
        precoSugerido: breakdown.precoSugerido,
      };
      let recipeId = id;
      if (isEdit && id) {
        await updateRecipe(id, payload);
        Alert.alert('Produto atualizado', nome.trim());
      } else {
        recipeId = await createRecipe(payload);
        Alert.alert('Produto criado', nome.trim());
      }

      if (recipeId) {
        const produtos = await getProdutos(companyId);
        const existingProd = produtos.find(p => p.id === recipeId);
        
        let newQty = payload.rendimento;
        if (isEdit) {
          newQty = (existingProd?.quantidade ?? 0) + (isProduce ? payload.rendimento : 0);
        }
        await saveProduto({
          id: recipeId,
          companyId,
          codigo: existingProd?.codigo || ('R' + String(produtos.length + 1).padStart(3, '0')),
          nome: payload.nome,
          categoria: 'Outros',
          unidade: payload.unidadeRendimento as import('@/services/estoque-storage').UnidadeMedida,
          quantidade: newQty,
          custo: payload.custoPorUnidade,
          precoVenda: Number(precoVendaFinal.replace(/\./g, '').replace(',', '.')) || payload.precoSugerido,
          estoqueMinimo: existingProd?.estoqueMinimo ?? 0,
          dataValidade: dataValidade || existingProd?.dataValidade || '',
          fornecedor: existingProd?.fornecedor ?? '',
          createdAt: existingProd?.createdAt ?? new Date().toISOString(),
          precoSugerido: payload.precoSugerido,
          custosAdicionais: payload.custosAdicionais,
          percentualCustosAdicionais: payload.percentualCustosAdicionais,
          percentualLucro: Number(lucroEsperado.replace(',', '.')) || 0,
          custoTotal: payload.custoTotal,
          custoPorUnidade: payload.custoPorUnidade,
          custoMateriais: custoMateriais,
        });

        if ((!isEdit || isProduce) && payload.rendimento > 0) {
          for (const item of payload.itens) {
            const material = materials.find(m => m.id === item.materialId);
            if (material) {
              const consumedBase = convertToBase(item.quantidade, item.unidade);
              const consumedCompra = consumedBase / convertToBase(1, material.unidadeCompra);
              const updatedQty = Math.max(0, material.quantidadeCompra - consumedCompra);
              await updateMaterial(material.id, { 
                quantidadeCompra: updatedQty,
                custoPorUnidadeBase: material.custoPorUnidadeBase
              });
            }
          }
        }
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
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                {isProduce ? 'Adicionar Estoque' : (isEdit ? 'Editar produto' : 'Novo produto')}
              </ThemedText>
              <View style={{ width: 60 }} />
            </ThemedView>

            {isProduce && estoqueAtualStr && (
              <View style={{ marginHorizontal: Spacing.four, marginBottom: Spacing.four, alignItems: 'center' }}>
                <View style={{ backgroundColor: theme.backgroundElement, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(128,128,128,0.15)' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#C4956A' }} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '500' }}>
                    Estoque atual: <ThemedText style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{estoqueAtualStr}</ThemedText>
                  </ThemedText>
                </View>
              </View>
            )}

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Nome do produto</ThemedText>
              <TextInput
                style={[styles.input, { color: isProduce ? theme.textSecondary : theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="Ex: Coca-Cola 2L ou Bolo de Cenoura"
                placeholderTextColor={theme.textSecondary}
                value={nome}
                onChangeText={setNome}
                editable={!isProduce}
              />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Tipo de Produto</ThemedText>
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <Pressable
                  onPress={() => setTipoProduto('receita')}
                  style={[styles.typeButton, tipoProduto === 'receita' ? styles.typeButtonActive : styles.typeButtonInactive]}
                >
                  <ThemedText style={{ color: tipoProduto === 'receita' ? '#fff' : theme.text, fontWeight: '600' }}>Produção (Receita)</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setTipoProduto('revenda')}
                  style={[styles.typeButton, tipoProduto === 'revenda' ? styles.typeButtonActive : styles.typeButtonInactive]}
                >
                  <ThemedText style={{ color: tipoProduto === 'revenda' ? '#fff' : theme.text, fontWeight: '600' }}>Revenda (Custo Fixo)</ThemedText>
                </Pressable>
              </View>
            </ThemedView>

            {tipoProduto === 'revenda' && (
              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Custo Fixo / Compra</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Para produtos de revenda que não usam insumos
                </ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="R$ 0,00"
                  placeholderTextColor="#9CA3AF"
                  value={custoFixo ? `R$ ${custoFixo}` : ''}
                  onChangeText={(t) => setCustoFixo(formatBRLInput(t))}
                  keyboardType="decimal-pad"
                />
              </ThemedView>
            )}

            {tipoProduto === 'receita' && (
              <>

            <ThemedView style={styles.fieldGroup}>
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>Insumos e matérias-primas (Opcional)</ThemedText>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                        <TextInput
                          style={[styles.input, { width: 85, height: 42, paddingVertical: 4, paddingHorizontal: 8, textAlign: 'center', fontSize: 16, fontWeight: '700', color: theme.text, backgroundColor: theme.backgroundElement }]}
                          value={item._tempQty ?? String(item.quantidade)}
                          keyboardType="decimal-pad"
                          onChangeText={(val) => {
                            setItens(prev => {
                              const arr = [...prev];
                              arr[idx] = { ...arr[idx], _tempQty: val, quantidade: Number(val.replace(',', '.')) || 0 };
                              return arr;
                            });
                          }}
                        />
                        <Pressable
                          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.primary, minWidth: 48, alignItems: 'center' }}
                          onPress={() => setEditingUnitIndex(idx)}
                        >
                          <ThemedText style={{ color: theme.primary, fontWeight: '700', fontSize: 15 }}>{item.unidade}</ThemedText>
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {compatible ? formatCurrency(itemCost) : 'Incompatível'}
                        </ThemedText>
                        <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                          <Ionicons name="close-circle" size={20} color="#DC2626" />
                        </Pressable>
                      </View>
                    </ThemedView>
                  </ThemedView>
                );
              })}
            </ThemedView>

            </>
            )}

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>
                {isProduce ? 'Quantidade a adicionar' : (tipoProduto === 'receita' ? 'Rende quantas unidades' : 'Quantidade')}
              </ThemedText>
              <TextInput
                style={[styles.input, styles.rendimentoInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder={isProduce ? "Ex: 10" : "1"}
                placeholderTextColor="#9CA3AF"
                value={rendimento}
                onChangeText={(t) => setRendimento(filterNumeric(t))}
                keyboardType="decimal-pad"
              />
            </ThemedView>

            {tipoProduto === 'receita' && (
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Custos adicionais (Opcional)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                % sobre materiais — mão de obra, água, luz, gás, etc.
              </ThemedText>
              <TextInput
                style={[styles.input, styles.percentInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="0%"
                placeholderTextColor="#9CA3AF"
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
            )}

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Lucro esperado (%)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Porcentagem sobre o custo total
              </ThemedText>
              <TextInput
                style={[styles.input, styles.percentInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="50%"
                placeholderTextColor="#9CA3AF"
                value={lucroEsperado}
                onChangeText={(t) => setLucroEsperado(filterNumeric(t))}
                keyboardType="decimal-pad"
              />
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Preço de Venda Final (Opcional)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Deixe em branco para usar o preço sugerido
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder={formatCurrency(breakdown.precoSugerido)}
                placeholderTextColor="#9CA3AF"
                value={precoVendaFinal ? `R$ ${precoVendaFinal}` : ''}
                onChangeText={(t) => setPrecoVendaFinal(formatBRLInput(t))}
                keyboardType="decimal-pad"
              />
            </ThemedView>



            <ThemedView style={styles.preview}>
              <ThemedText style={styles.sectionTitle}>Prévia do cálculo</ThemedText>

              <View style={styles.previewRow}>
                <ThemedText themeColor="textSecondary">Rendimento (Quantidade)</ThemedText>
                <ThemedText style={{ fontWeight: '700' }}>{rendimento} {unidadeRendimento}</ThemedText>
              </View>

              {tipoProduto === 'receita' && (
                <>
                  <View style={styles.previewRow}>
                    <ThemedText themeColor="textSecondary">Custo dos materiais</ThemedText>
                    <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(custoMateriais)}</ThemedText>
                  </View>
                  <View style={styles.previewRow}>
                    <ThemedText themeColor="textSecondary">Custos adicionais ({percentualNum.toFixed(1).replace(/\.0$/, '')}%)</ThemedText>
                    <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(custosAdicionaisCalculado)}</ThemedText>
                  </View>
                </>
              )}
              
              <View style={styles.previewRow}>
                <ThemedText themeColor="textSecondary">{tipoProduto === 'receita' ? 'Custo total' : 'Custo de compra'}</ThemedText>
                <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(breakdown.custoTotal)}</ThemedText>
              </View>

              {tipoProduto === 'receita' && (
                <View style={styles.previewRow}>
                  <ThemedText themeColor="textSecondary">Custo por unidade</ThemedText>
                  <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(breakdown.custoPorUnidade)}</ThemedText>
                </View>
              )}

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
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Salvar produto'}
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
          <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.two }} showsVerticalScrollIndicator={false}>
            {materials.length === 0 && (
              <ThemedText themeColor="textSecondary">Nenhum material cadastrado.</ThemedText>
            )}
            {materials.map((m) => {
              const alreadyAdded = itens.some((i) => i.materialId === m.id);
              return (
                <Pressable
                  key={m.id}
                  disabled={alreadyAdded || m.quantidadeCompra <= 0}
                  onPress={() => addItem(m.id)}
                  style={[
                    styles.materialPick,
                    { backgroundColor: alreadyAdded ? theme.backgroundElement : theme.background, borderColor: 'rgba(128,128,128,0.2)' },
                    m.quantidadeCompra <= 0 && { opacity: 0.6 }
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '700' }}>{m.nome}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatQuantity(m.quantidadeCompra, m.unidadeCompra)} · {formatCurrency(m.precoCompra)}
                    </ThemedText>
                  </View>
                  {alreadyAdded ? (
                    <ThemedText type="small" style={{ color: '#22C55E', fontWeight: '600' }}>
                      Adicionado
                    </ThemedText>
                  ) : m.quantidadeCompra <= 0 ? (
                    <ThemedText type="small" style={{ color: '#ef4444', fontWeight: '600' }}>
                      Indisponível
                    </ThemedText>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editingUnitIndex !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingUnitIndex(null)}>
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={styles.modalHeader}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>Escolher unidade</ThemedText>
            <Pressable onPress={() => setEditingUnitIndex(null)}>
              <ThemedText themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.two }}>
            {UNITS.map((u) => {
              const currentItem = editingUnitIndex !== null ? itens[editingUnitIndex] : null;
              const selected = currentItem?.unidade === u.code;
              return (
                <Pressable
                  key={u.code}
                  onPress={() => {
                    if (editingUnitIndex !== null) {
                      setItens((prev) => {
                        const copy = [...prev];
                        copy[editingUnitIndex].unidade = u.code;
                        return copy;
                      });
                    }
                    setEditingUnitIndex(null);
                  }}
                  style={[
                    styles.materialPick,
                    { backgroundColor: selected ? theme.backgroundElement : theme.background, borderColor: selected ? theme.primary : 'rgba(128,128,128,0.2)' },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '700' }}>{u.code}</ThemedText>
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
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  typeButtonActive: {
    backgroundColor: '#C4956A',
    borderColor: '#C4956A',
  },
  typeButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: 'gray',
  },
});
