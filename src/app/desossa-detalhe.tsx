import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDesossa, deleteDesossa, type DesossaRecord } from '@/services/desossa-service';
import { getDespesas, deleteDespesa } from '@/services/despesa-service';
import { useAuth } from '@/contexts/auth';
import { formatCurrency } from '@/services/estoque-storage';

const TIPO_LABEL: Record<string, string> = {
  boi: 'Boi',
  porco: 'Porco',
  frango: 'Frango',
};

const LOSS_NAMES = ['osso', 'aparas', 'carcaça', 'pé', 'miúdos'];

export default function DesossaDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const [record, setRecord] = useState<DesossaRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDesossa(id).then((data) => {
      setRecord(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Loading />;
  if (!record) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <ThemedText>Registro não encontrado.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const perdaCortes = record.items
    .filter((i) => LOSS_NAMES.some((name) => i.nome.toLowerCase().includes(name)))
    .reduce((s, i) => s + i.peso, 0);
  const pesoDistribuido = record.items.reduce((s, i) => s + i.peso, 0);
  const faltante = Math.max(0, record.pesoTotal - pesoDistribuido);
  const perdaKg = perdaCortes + faltante;
  const perdaPct = record.pesoTotal > 0 ? ((perdaKg / record.pesoTotal) * 100).toFixed(1) : '0';
  const custoMedio = record.pesoTotal > 0 ? record.custoTotal / record.pesoTotal : 0;
  const dataCriacao = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString('pt-BR')
    : '---';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <View style={[styles.topBar, { paddingTop: insets.top }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
          </Pressable>
          <ThemedText style={styles.topTitle}>Detalhes</ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedView style={styles.headerCard}>
            <ThemedText style={styles.animalEmoji}>
              {record.tipoAnimal === 'boi' ? '🐂' : record.tipoAnimal === 'porco' ? '🐖' : record.tipoAnimal === 'frango' ? '🐔' : '🐄'}
            </ThemedText>
            <ThemedText type="title" style={styles.animalName}>
              {record.animalNome}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {TIPO_LABEL[record.tipoAnimal] ?? record.tipoAnimal} • {dataCriacao}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statsGrid}>
            <ThemedView style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.statValue}>{record.pesoTotal}kg</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Peso total</ThemedText>
            </ThemedView>
            <ThemedView style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.statValue}>{formatCurrency(record.custoTotal)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Valor pago</ThemedText>
            </ThemedView>
            <ThemedView style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.statValue}>{formatCurrency(custoMedio)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Custo médio/kg</ThemedText>
            </ThemedView>
            <ThemedView style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={[styles.statValue, { color: '#ef4444' }]}>{perdaKg.toFixed(2)}kg ({perdaPct}%)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Perda</ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.sectionCard}>
            <ThemedText style={styles.sectionTitle}>Cortes</ThemedText>
            {record.items.map((item, idx) => {
              const isLoss = LOSS_NAMES.some((name) => item.nome.toLowerCase().includes(name));
              return (
                <ThemedView
                  key={idx}
                  style={[styles.corteRow, isLoss && { opacity: 0.5 }]}
                >
                  <ThemedView style={styles.corteInfo}>
                    <ThemedText style={styles.corteName}>{item.nome}</ThemedText>
                    {isLoss && (
                      <ThemedText type="small" style={{ color: '#ef4444' }}>Perda</ThemedText>
                    )}
                  </ThemedView>
                  <ThemedView style={styles.corteValues}>
                    <ThemedText style={styles.cortePeso}>{item.peso}kg</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatCurrency(item.custo)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              );
            })}
          </ThemedView>

          <ThemedView style={styles.actions}>
            <Pressable
              onPress={() => router.replace(`/cortes?editId=${record.id}`)}
              style={[styles.editButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={styles.actionText}>✏️ Editar</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Excluir Desossa',
                  `Deseja excluir "${record.animalNome}"?`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Excluir',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteDesossa(record.id);
                        const despesas = await getDespesas(companyId);
                        const linked = despesas.find((d) => d.observacao?.includes(`desossaId:${record.id}`));
                        if (linked) await deleteDespesa(linked.id);
                        router.back();
                      },
                    },
                  ]
                );
              }}
              style={[styles.deleteButton]}
            >
              <ThemedText style={styles.deleteText}>🗑️ Excluir</ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    paddingTop: Spacing.two,
  },
  headerCard: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  animalEmoji: {
    fontSize: 48,
  },
  animalName: {
    fontSize: 28,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statCard: {
    width: '47%',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  corteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  corteInfo: {
    gap: Spacing.half,
    flex: 1,
  },
  corteName: {
    fontSize: 15,
    fontWeight: '600',
  },
  corteValues: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  cortePeso: {
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 16,
  },
});
