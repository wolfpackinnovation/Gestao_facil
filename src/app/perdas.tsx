import { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { getProdutos, type Produto } from '@/services/estoque-storage';
import { listAllLoteMovimentos } from '@/services/lote-service';
import type { LoteMovimento } from '@/types/schema';
import { formatQuantity, formatCurrency } from '@/utils/format';
import { DateNavigator } from '@/components/date-navigator';

export default function PerdasScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [perdas, setPerdas] = useState<LoteMovimento[]>([]);
  const [produtos, setProdutos] = useState<Record<string, Produto>>({});

  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const [allMovs, prods] = await Promise.all([
        listAllLoteMovimentos(user.uid),
        getProdutos(user.uid)
      ]);

      const perdasList = allMovs.filter(m => m.tipo === 'perda' || m.tipo === 'ajuste');
      
      const prodsMap = prods.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, Produto>);

      setPerdas(perdasList);
      setProdutos(prodsMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  function changeMonth(delta: number) {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
  }

  const perdasOrdenadas = useMemo(() => {
    return perdas
      .filter(m => {
        const d = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
        return d.getMonth() === referenceDate.getMonth() && d.getFullYear() === referenceDate.getFullYear();
      })
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
        const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
        return db - da;
      });
  }, [perdas, referenceDate]);

  const totalPerdaMensal = useMemo(() => {
    return perdasOrdenadas.reduce((sum, mov) => {
      if (mov.quantidade < 0) { // isPerda
        const prod = produtos[mov.productId];
        const cost = mov.custoUnitario || prod?.custoPorUnidade || prod?.custo || 0;
        return sum + (Math.abs(mov.quantidade) * cost);
      }
      return sum;
    }, 0);
  }, [perdasOrdenadas, produtos]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Carregando...</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          <DateNavigator selectedDate={referenceDate} onDateChange={changeMonth} mode="month" />
          
          <ThemedView style={[styles.card, { backgroundColor: '#ef444415', borderColor: '#ef444430', marginBottom: Spacing.two }]}>
            <ThemedText style={{ color: '#ef4444', fontWeight: '600' }}>Prejuízo no período</ThemedText>
            <ThemedText style={{ fontSize: 24, fontWeight: '700', color: '#ef4444' }}>
              {formatCurrency(totalPerdaMensal)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ color: '#ef444490' }}>Baseado no custo dos produtos perdidos</ThemedText>
          </ThemedView>

          {perdasOrdenadas.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color={theme.textSecondary} />
              <ThemedText style={{ marginTop: Spacing.two, color: theme.textSecondary }}>Nenhuma perda registrada.</ThemedText>
            </ThemedView>
          ) : (
            perdasOrdenadas.map((mov) => {
              const prod = produtos[mov.productId];
              const qty = Math.abs(mov.quantidade);
              const isPerda = mov.quantidade < 0;

              return (
                <ThemedView key={mov.id} style={[styles.card, { borderColor: isPerda ? 'rgba(239,68,68,0.3)' : 'rgba(128,128,128,0.2)' }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.prodInfo}>
                      <ThemedText style={styles.prodName}>{prod ? prod.nome : 'Produto excluído'}</ThemedText>
                      {prod && <ThemedText type="small" themeColor="textSecondary">Cód: {prod.codigo}</ThemedText>}
                    </View>
                    <View style={[styles.badge, isPerda ? styles.badgePerda : styles.badgeAjuste]}>
                      <ThemedText style={[styles.badgeText, isPerda ? styles.textPerda : styles.textAjuste]}>
                        {isPerda ? '-' : '+'}{formatQuantity(qty)} {prod?.unidade || 'un'}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.footerRow}>
                      <Ionicons name="cash-outline" size={14} color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        Custo: {formatCurrency((mov.custoUnitario || prod?.custoPorUnidade || prod?.custo || 0) * qty)}
                      </ThemedText>
                    </View>
                    <View style={[styles.footerRow, { marginTop: 4 }]}>
                      <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        {mov.createdAt?.toDate ? mov.createdAt.toDate().toLocaleString('pt-BR') : new Date(mov.createdAt).toLocaleString('pt-BR')}
                      </ThemedText>
                    </View>
                    {mov.motivo && (
                      <View style={[styles.footerRow, { marginTop: 4 }]}>
                        <Ionicons name="information-circle-outline" size={14} color={theme.textSecondary} />
                        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                          {mov.motivo}
                        </ThemedText>
                      </View>
                    )}
                    {mov.loteId && mov.loteId !== 'sem-lote' && (
                      <View style={[styles.footerRow, { marginTop: 4 }]}>
                        <Ionicons name="cube-outline" size={14} color={theme.textSecondary} />
                        <ThemedText type="small" themeColor="textSecondary">
                          Lote
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </ThemedView>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
    marginTop: Spacing.six,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  prodInfo: {
    flex: 1,
    gap: 2,
  },
  prodName: {
    fontWeight: '700',
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Spacing.half,
  },
  badgePerda: {
    backgroundColor: '#ef444420',
  },
  badgeAjuste: {
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 14,
  },
  textPerda: {
    color: '#ef4444',
  },
  textAjuste: {
    color: 'gray',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.1)',
    paddingTop: Spacing.two,
    gap: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
