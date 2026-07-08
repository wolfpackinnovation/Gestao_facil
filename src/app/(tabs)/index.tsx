import { useState, useCallback } from 'react';
import { Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import * as SaleService from '@/services/sale-service';
import * as ProductService from '@/services/product-service';
import * as ClientService from '@/services/client-service';
import * as CashService from '@/services/cash-service';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface DashboardData {
  todaySales: number
  totalProducts: number
  totalClients: number
  totalCash: number
  lowStockProducts: number
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    todaySales: 0,
    totalProducts: 0,
    totalClients: 0,
    totalCash: 0,
    lowStockProducts: 0,
  });

  const companyId = user?.uid ?? '';

  const loadDashboard = useCallback(async () => {
    try {
      const [sales, products, clients, registers] = await Promise.all([
        SaleService.getTodaySales(companyId),
        ProductService.listProducts(companyId),
        ClientService.listClients(companyId),
        CashService.listCashRegisters(companyId),
      ]);

      const todayTotal = sales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalCash = registers.reduce((sum, r) => sum + (r.currentBalance ?? 0), 0);
      const lowStock = products.filter(
        (p) => p.minStock != null && p.stockQuantity <= p.minStock
      ).length;

      setData({
        todaySales: todayTotal,
        totalProducts: products.length,
        totalClients: clients.length,
        totalCash,
        lowStockProducts: lowStock,
      });
    } catch {
      // Firestore may not be initialized yet
    }
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const cards = [
    {
      emoji: '💰',
      label: 'Vendas Hoje',
      value: formatCurrency(data.todaySales),
      route: '/(tabs)/vendas' as const,
    },
    {
      emoji: '📦',
      label: 'Produtos',
      value: `${data.totalProducts}`,
      route: '/(tabs)/estoque' as const,
    },
    {
      emoji: '👥',
      label: 'Clientes',
      value: `${data.totalClients}`,
      route: '/(tabs)/clientes' as const,
    },
    {
      emoji: '💵',
      label: 'Saldo em Caixa',
      value: formatCurrency(data.totalCash),
      route: '/(tabs)/caixa' as const,
    },
    {
      emoji: '⚠️',
      label: 'Estoque Baixo',
      value: `${data.lowStockProducts}`,
      route: '/(tabs)/estoque' as const,
      alert: data.lowStockProducts > 0,
    },
  ];

  const quickActions = [
    { emoji: '📦', label: 'Novo Produto', route: '/(tabs)/estoque' as const },
    { emoji: '💳', label: 'Nova Venda', route: '/(tabs)/vendas' as const },
    { emoji: '👤', label: 'Novo Cliente', route: '/(tabs)/clientes' as const },
    { emoji: '💵', label: 'Mov. Caixa', route: '/(tabs)/caixa' as const },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.greeting}>
            <ThemedText style={styles.greetingEmoji}>👋</ThemedText>
            <ThemedView>
              <ThemedText type="title" style={styles.greetingTitle}>GestaoFacil</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {user?.email ?? 'Bem-vindo!'}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedText type="code" style={styles.sectionTitle}>Resumo</ThemedText>
          <ThemedView style={styles.cardsGrid}>
            {cards.map((card, index) => (
              <Pressable
                key={index}
                onPress={() => router.push(card.route)}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement },
                  card.alert && { borderWidth: 1, borderColor: '#f59e0b' },
                ]}
              >
                <ThemedText style={styles.cardEmoji}>{card.emoji}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
                  {card.label}
                </ThemedText>
                <ThemedText style={styles.cardValue}>{card.value}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText type="code" style={styles.sectionTitle}>Ações Rápidas</ThemedText>
          <ThemedView style={styles.actionsRow}>
            {quickActions.map((action, index) => (
              <Pressable
                key={index}
                onPress={() => router.push(action.route)}
                style={[styles.actionCard, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText style={styles.actionEmoji}>{action.emoji}</ThemedText>
                <ThemedText type="small" style={{ textAlign: 'center' }}>{action.label}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    gap: Spacing.four,
  },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  greetingEmoji: {
    fontSize: 40,
  },
  greetingTitle: {
    fontSize: 32,
    lineHeight: 36,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  card: {
    width: '47%',
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardLabel: {
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  actionCard: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionEmoji: {
    fontSize: 28,
  },
});
