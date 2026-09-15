import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getRecipe,
  deleteRecipe,
  calcRecipeCost,
  type Recipe,
} from '@/services/recipe-service';
import { getMaterials, updateMaterial, type Material } from '@/services/material-service';
import { getProdutos, saveProduto } from '@/services/estoque-storage';

import { formatCurrency } from '@/utils/format';
import { formatQuantity, sameType, convertToBase } from '@/utils/units';


export default function ReceitaDetalheScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const handleBack = useCallback(() => {
    router.replace('/estoque' as any);
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [productionModalVisible, setProductionModalVisible] = useState(false);
  const [productionQuantity, setProductionQuantity] = useState('');
  const [deductMaterials, setDeductMaterials] = useState(true);
  const [producing, setProducing] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const rec = await getRecipe(id).catch(() => null);
    if (rec) {
      setRecipe(rec);
      const matsData = await getMaterials(rec.companyId).catch(() => []);
      setMaterials(matsData);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const breakdown = useMemo(() => {
    if (!recipe) return null;
    return calcRecipeCost(recipe, materials);
  }, [recipe, materials]);

  const custoMateriais = useMemo(() => {
    if (!breakdown) return 0;
    return breakdown.itensDetalhados.reduce((sum, d) => sum + d.custo, 0);
  }, [breakdown]);

  function handleDelete() {
    if (!recipe) return;
    Alert.alert(
      'Excluir Receita',
      `Excluir "${recipe.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipe(recipe.id);
              handleBack();
            } catch (e: any) {
              Alert.alert('Erro', e?.message ?? 'Erro ao excluir receita.');
            }
          },
        },
      ],
    );
  }

  async function handleProduzir() {
    if (!recipe || !breakdown) return;
    const qty = parseFloat(productionQuantity.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erro', 'Por favor, informe uma quantidade válida maior que zero.');
      return;
    }

    setProducing(true);
    try {
      const mult = qty / recipe.rendimento;
      
      if (deductMaterials) {
        for (const item of recipe.itens) {
          const material = materials.find(m => m.id === item.materialId);
          if (material) {
            const consumedBase = convertToBase(item.quantidade, item.unidade) * mult;
            const consumedCompra = consumedBase / convertToBase(1, material.unidadeCompra);
            const newQty = Math.max(0, material.quantidadeCompra - consumedCompra);
            await updateMaterial(material.id, { quantidadeCompra: newQty });
          }
        }
      }

      const allProdutos = await getProdutos(recipe.companyId);
      let linkedProduto = allProdutos.find(p => p.nome.trim().toLowerCase() === recipe.nome.trim().toLowerCase());
      
      let productId = '';
      if (!linkedProduto) {
        productId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await saveProduto({
          id: productId,
          companyId: recipe.companyId,
          codigo: 'R' + Date.now().toString().slice(-4),
          nome: recipe.nome,
          categoria: 'Outros',
          unidade: recipe.unidadeRendimento as any,
          quantidade: qty,
          custo: breakdown.custoPorUnidade,
          precoVenda: breakdown.precoSugerido,
          estoqueMinimo: 0,
          dataValidade: '',
          fornecedor: 'Produção Própria',
          createdAt: new Date().toISOString()
        });
      } else {
        productId = linkedProduto.id;
        await saveProduto({
          ...linkedProduto,
          quantidade: (linkedProduto.quantidade || 0) + qty,
          custo: breakdown.custoPorUnidade,
          precoVenda: breakdown.precoSugerido,
        });
      }

      Alert.alert('Sucesso', 'Produção registrada e adicionada ao estoque com sucesso!');
      setProductionModalVisible(false);
      setProductionQuantity('');
      loadData(); // Reload materials if deducted
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Erro ao registrar produção.');
    } finally {
      setProducing(false);
    }
  }

  if (loading || !recipe || !breakdown) {
    return (
      <ThemedView style={styles.container}>
        <Loading />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.backRow}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>{recipe.nome}</ThemedText>
          <View style={{ width: 60 }} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={[styles.heroCard, { backgroundColor: theme.primary }]}>
            <View style={styles.heroDecor}>
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />
            </View>
            <ThemedText style={styles.heroLabel}>Vender por</ThemedText>
            <ThemedText style={styles.heroPrice}>{formatCurrency(breakdown.precoSugerido)}</ThemedText>
            <ThemedText style={styles.heroSub}>
              por {recipe.unidadeRendimento} · rende {recipe.rendimento} {recipe.unidadeRendimento}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Custo de material</ThemedText>
                <ThemedText style={styles.infoValue}>{formatCurrency(custoMateriais)}</ThemedText>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Juros no material</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {custoMateriais > 0 && recipe.custosAdicionais > 0
                    ? `${((recipe.custosAdicionais / custoMateriais) * 100).toFixed(1).replace(/\.0$/, '')}%`
                    : '0%'}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.infoRow, { marginTop: Spacing.one }]}>
              <View style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Juros de lucro</ThemedText>
                <ThemedText style={styles.infoValue}>{recipe.valorLucro}%</ThemedText>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <ThemedText type="small" themeColor="textSecondary">Preço de venda</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.primary }]}>
                  {formatCurrency(breakdown.precoSugerido)}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              Materiais ({breakdown.itensDetalhados.length})
            </ThemedText>
            <ThemedView style={styles.itemList}>
              {breakdown.itensDetalhados.map((d, idx) => {
                const incompatible = d.material && !sameType(d.item.unidade, d.material.unidadeCompra);
                return (
                  <View key={`${d.item.materialId}-${idx}`} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.itemName} numberOfLines={1}>
                        {d.material?.nome ?? 'Material removido'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatQuantity(d.item.quantidade, d.item.unidade)}
                        {d.material ? ` de ${formatQuantity(d.material.quantidadeCompra, d.material.unidadeCompra)}` : ''}
                      </ThemedText>
                      {incompatible && (
                        <ThemedText type="small" style={{ color: '#DC2626' }}>
                          unidades incompatíveis
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText style={styles.itemPrice}>{formatCurrency(d.custo)}</ThemedText>
                  </View>
                );
              })}
              {breakdown.itensDetalhados.length === 0 && (
                <ThemedText style={styles.empty}>Sem materiais cadastrados</ThemedText>
              )}
              <View style={[styles.itemRow, { backgroundColor: 'rgba(128,128,128,0.05)' }]}>
                <ThemedText style={{ fontWeight: '700', flex: 1 }}>Total materiais</ThemedText>
                <ThemedText style={styles.itemPrice}>{formatCurrency(custoMateriais)}</ThemedText>
              </View>
            </ThemedView>
          </ThemedView>

          {recipe.observacao && (
            <ThemedView style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Observação</ThemedText>
              <ThemedText type="small" style={{ lineHeight: 20 }}>{recipe.observacao}</ThemedText>
            </ThemedView>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => router.push(`/receita-form?id=${recipe.id}` as any)}
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <ThemedText style={{ fontWeight: '600', marginLeft: Spacing.one, color: '#fff' }}>Editar</ThemedText>
            </Pressable>
            
            <Pressable
              onPress={() => {
                setProductionQuantity(recipe.rendimento.toString());
                setProductionModalVisible(true);
              }}
              style={[styles.actionButton, { backgroundColor: '#10B981' }]}
            >
              <Ionicons name="cube-outline" size={18} color="#fff" />
              <ThemedText style={{ fontWeight: '600', marginLeft: Spacing.one, color: '#fff' }}>Adicionar em Estoque</ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={handleDelete}
            style={[styles.deleteButton, { borderColor: '#DC2626' }]}
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <ThemedText style={{ fontWeight: '600', color: '#DC2626', marginLeft: Spacing.one }}>
              Excluir receita
            </ThemedText>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={productionModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProductionModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>Adicionar em Estoque</ThemedText>
              <Pressable onPress={() => setProductionModalVisible(false)} disabled={producing}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  Quantidade Produzida ({recipe.unidadeRendimento}) *
                </ThemedText>
                <ThemedView style={[styles.inputRow, { borderColor: theme.textSecondary + '55', borderWidth: 1, borderRadius: Spacing.two }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                    value={productionQuantity}
                    onChangeText={setProductionQuantity}
                    placeholder="Ex: 10"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    editable={!producing}
                  />
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.switchRow}>
                <ThemedView style={{ flex: 1, gap: 4 }}>
                  <ThemedText style={{ fontWeight: '600' }}>Dar baixa nos materiais</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Desconta os materiais utilizados no estoque baseando-se no rendimento da receita.
                  </ThemedText>
                </ThemedView>
                <Switch
                  value={deductMaterials}
                  onValueChange={setDeductMaterials}
                  disabled={producing}
                />
              </ThemedView>
            </ScrollView>

            <ThemedView style={styles.modalFooter}>
              <Pressable
                style={[styles.saveButton, { backgroundColor: theme.primary, opacity: producing ? 0.7 : 1 }]}
                onPress={handleProduzir}
                disabled={producing}
              >
                {producing ? <Loading size="small" color="#fff" /> : <ThemedText style={styles.saveButtonText}>Confirmar</ThemedText>}
              </Pressable>
            </ThemedView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
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
  scrollContent: { gap: Spacing.three, paddingBottom: Spacing.six },
  heroCard: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroDecor: { position: 'absolute', right: 0, top: 0, width: 120, height: 120 },
  heroCircle1: { position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroCircle2: { position: 'absolute', right: 30, top: 30, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  heroPrice: { fontSize: 36, fontWeight: '700', color: '#fff', lineHeight: 44 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: Spacing.half },
  infoCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  infoDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  itemList: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  itemName: { fontWeight: '600', fontSize: 14 },
  itemPrice: { fontWeight: '700', fontSize: 14 },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  empty: { padding: Spacing.three, textAlign: 'center', opacity: 0.6 },
  actionsRow: { flexDirection: 'row', gap: Spacing.two },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  modalContainer: { flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalTitle: { fontSize: 18 },
  modalScrollContent: { padding: Spacing.four, gap: Spacing.four },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { fontSize: 12, letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  modalFooter: {
    padding: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  saveButton: {
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
