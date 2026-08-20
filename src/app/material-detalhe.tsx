import { useCallback, useState } from 'react';
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
  getMaterial,
  deleteMaterial,
  type Material,
} from '@/services/material-service';
import { formatCurrency } from '@/utils/format';

export default function MaterialDetalheScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [material, setMaterial] = useState<Material | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const mat = await getMaterial(id);
    setMaterial(mat);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleBack = useCallback(() => {
    router.replace('/receitas?tab=materiais' as any);
  }, [router]);

  function handleDelete() {
    if (!material) return;
    Alert.alert(
      'Excluir Material',
      `Excluir "${material.nome}"? Receitas que usam este material podem ficar com custo zerado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMaterial(material.id);
              handleBack();
            } catch (e: any) {
              Alert.alert('Erro', e?.message ?? 'Erro ao excluir material.');
            }
          },
        },
      ],
    );
  }

  if (loading || !material) {
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
          <ThemedText style={styles.headerTitle} numberOfLines={1}>{material.nome}</ThemedText>
          <View style={{ width: 60 }} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">Nome</ThemedText>
            <ThemedText style={styles.value}>{material.nome}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">Conteúdo da embalagem</ThemedText>
            <ThemedText style={styles.value}>
              {material.quantidadeCompra} {material.unidadeCompra}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">Preço pago</ThemedText>
            <ThemedText style={[styles.value, { color: theme.primary }]}>
              {formatCurrency(material.precoCompra)}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">Custo por unidade base</ThemedText>
            <ThemedText style={styles.value}>
              {formatCurrency(material.custoPorUnidadeBase)} / {material.unidadeCompra}
            </ThemedText>
          </ThemedView>

          {material.fornecedor && (
            <ThemedView style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">Fornecedor</ThemedText>
              <ThemedText style={styles.value}>{material.fornecedor}</ThemedText>
            </ThemedView>
          )}

          {material.observacao && (
            <ThemedView style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">Observação</ThemedText>
              <ThemedText style={styles.value}>{material.observacao}</ThemedText>
            </ThemedView>
          )}

          <Pressable
            onPress={() => router.push(`/material-form?id=${material.id}` as any)}
            style={[styles.editButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.one }}>
              Editar
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            style={[styles.deleteButton, { borderColor: '#DC2626' }]}
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <ThemedText style={{ color: '#DC2626', fontWeight: '700', marginLeft: Spacing.one }}>
              Excluir material
            </ThemedText>
          </Pressable>
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
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.one,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
});
