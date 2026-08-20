import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import {
  getRecipes,
  calcRecipeCost,
  type Recipe,
} from '@/services/recipe-service';
import { getMaterials, type Material } from '@/services/material-service';
import { formatCurrency } from '@/utils/format';

interface RecipesTabProps {
  onRequestMaterials?: () => void;
}

export default function RecipesTab({ onRequestMaterials }: RecipesTabProps) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [recipesData, materialsData] = await Promise.all([
      getRecipes(companyId).catch(() => []),
      getMaterials(companyId).catch(() => []),
    ]);
    setRecipes(recipesData);
    setMaterials(materialsData);
    setLoading(false);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const receitasCalculadas = useMemo(
    () =>
      recipes
        .filter((r) =>
          search.trim() === ''
            ? true
            : r.nome.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .map((r) => ({
          recipe: r,
          breakdown: calcRecipeCost(r, materials),
        })),
    [recipes, materials, search],
  );

  function renderItem({ item }: { item: { recipe: Recipe; breakdown: ReturnType<typeof calcRecipeCost> } }) {
    const { recipe, breakdown } = item;
    return (
      <Pressable
        onPress={() => router.push(`/receita-detalhe?id=${recipe.id}` as any)}
        style={styles.recipeRow}
      >
        <ThemedView style={styles.iconCircle}>
          <Ionicons name="restaurant-outline" size={22} color={theme.primary} />
        </ThemedView>
        <ThemedView style={{ flex: 1 }}>
          <ThemedText style={{ fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
            {recipe.nome}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Vender por {formatCurrency(breakdown.precoSugerido)}
          </ThemedText>
        </ThemedView>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </Pressable>
    );
  }

  const emptyState = (
    <ThemedView style={styles.emptyState}>
      <Ionicons name={search ? "search" : "restaurant"} size={48} color={theme.textSecondary} />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        {search ? 'Nada encontrado' : 'Nenhuma receita'}
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {search
          ? `Nenhuma receita contém "${search}".`
          : 'Comece cadastrando materiais e depois crie suas receitas com cálculo automático de preço.'}
      </ThemedText>
      {!search && (
        <Pressable
          onPress={() => (onRequestMaterials ? onRequestMaterials() : router.push('/materiais' as any))}
          style={[styles.secondaryButton, { borderColor: theme.primary }]}
        >
          <ThemedText style={{ color: theme.primary, fontWeight: '600' }}>
            Cadastrar materiais primeiro
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );

  const listHeader = (
    <ThemedView style={styles.headerContent}>
      <View style={[styles.searchWrapper, { borderColor: theme.primary, backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Buscar receita..."
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      {loading ? <Loading /> : (
        <FlatList
          data={receitasCalculadas}
          keyExtractor={(item) => item.recipe.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        onPress={() => router.push('/receita-form' as any)}
        style={[styles.fab, { backgroundColor: theme.primary }]}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContent: { gap: Spacing.three, paddingTop: Spacing.two },
  summaryRow: { flexDirection: 'row', gap: Spacing.two },
  summaryCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  summaryValue: { fontSize: 22, fontWeight: '700' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  listContent: { gap: Spacing.two, paddingBottom: 100 },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.two,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  emptyTitle: { textAlign: 'center' },
  secondaryButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
