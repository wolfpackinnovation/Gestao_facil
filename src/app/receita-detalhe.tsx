import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
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
import { getMaterials, type Material } from '@/services/material-service';
import { formatCurrency } from '@/utils/format';
import { formatQuantity, sameType } from '@/utils/units';

export default function ReceitaDetalheScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const handleBack = useCallback(() => {
    router.replace('/receitas?tab=receitas' as any);
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);

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
});
