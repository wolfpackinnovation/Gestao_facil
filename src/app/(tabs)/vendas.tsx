import { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getSalesByDate, getSaleItems, deleteSale } from '@/services/sale-service';
import * as ClientService from '@/services/client-service';
import { getProdutos } from '@/services/estoque-storage';
import type { Sale, SaleItem, Client } from '@/types/schema';
import { formatCurrency } from '@/utils/format';

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  'cartão': 'Cartão',
  pix: 'Pix',
  fiado: 'Fiado',
};

export default function VendasScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sales, setSales] = useState<Sale[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [saleFirstItem, setSaleFirstItem] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  function getProductName(productId: string): string {
    return products.find((p) => p.id === productId)?.nome ?? productId;
  }

  const companyId = user?.uid ?? '';
  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();

  const totalsByMethod: Record<string, number> = {};
  for (const sale of sales) {
    const method = sale.paymentMethod ?? 'outros';
    totalsByMethod[method] = (totalsByMethod[method] ?? 0) + sale.totalAmount;
  }
  const dayTotal = Object.values(totalsByMethod).reduce((a, b) => a + b, 0);
  const methodOrder = ['dinheiro', 'pix', 'cartão', 'fiado'];

  const loadSales = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [salesData, clientsData, productsData] = await Promise.all([
      getSalesByDate(companyId, selectedDate),
      ClientService.listClients(companyId),
      getProdutos(companyId),
    ]);
    setSales(salesData);
    setClients(clientsData);
    setProducts(productsData);

    const firstItemMap: Record<string, string> = {};
    await Promise.all(salesData.map(async (sale) => {
      const items = await getSaleItems(sale.id!);
      if (items.length > 0) {
        const product = productsData.find((p) => p.id === items[0].productId);
        firstItemMap[sale.id!] = product?.nome ?? items[0].productId;
      }
    }));
    setSaleFirstItem(firstItemMap);
    setLoading(false);
  }, [companyId, selectedDate]);

  function goToDate(days: number) {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  }

  useFocusEffect(
    useCallback(() => {
      loadSales();
    }, [loadSales])
  );

  async function viewSaleDetails(sale: Sale) {
    setSelectedSale(sale);
    const items = await getSaleItems(sale.id!);
    setSaleItems(items);
    setDetailVisible(true);
  }

  function confirmDelete(sale: Sale) {
    Alert.alert('Excluir Venda', `Deseja excluir a venda "${sale.number}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteSale(sale.id!);
          await loadSales();
        },
      },
    ]);
  }

  function renderSale({ item }: { item: Sale }) {
    const client = clients.find((c) => c.id === item.clientId);
    const productName = saleFirstItem[item.id!];
    return (
      <Pressable onPress={() => viewSaleDetails(item)} style={styles.saleRow}>
        <ThemedView style={{ flex: 1 }}>
          <ThemedText style={{ fontWeight: '600' }}>{item.number}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {productName ?? client?.name ?? 'Sem cliente'}
            {item.paymentMethod ? ` · ${item.paymentMethod}` : ''}
          </ThemedText>
        </ThemedView>
        <ThemedView style={{ alignItems: 'flex-end' }}>
          <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>{formatCurrency(item.totalAmount)}</ThemedText>
          <Pressable onPress={() => confirmDelete(item)}>
            <ThemedText type="small" style={{ color: '#ef4444' }}>Excluir</ThemedText>
          </Pressable>
        </ThemedView>
      </Pressable>
    );
  }

  const listHeader = (
    <ThemedView style={styles.headerContent}>
      {/* Date Navigation */}
       <ThemedView style={styles.dateNav}>
          <Pressable onPress={() => goToDate(-1)} style={styles.dateArrow}>
            <ThemedText style={{ fontSize: 18, fontWeight: '300', color: theme.textSecondary }}>{'‹'}</ThemedText>
          </Pressable>
          <ThemedView style={{ alignItems: 'center', gap: 2 }}>
            <ThemedText style={styles.dateText}>
              {formatDate(selectedDate)}
            </ThemedText>
            {isToday && (
              <ThemedText type="small" themeColor="textSecondary">Hoje</ThemedText>
            )}
          </ThemedView>
          <Pressable onPress={() => goToDate(1)} disabled={isToday} style={styles.dateArrow}>
            <ThemedText style={{ fontSize: 18, fontWeight: '300', color: theme.textSecondary, opacity: isToday ? 0.3 : 1 }}>{'›'}</ThemedText>
          </Pressable>
        </ThemedView>

      {/* Total do Dia */}
      <View style={styles.totalCard}>
        <ThemedText style={styles.totalCardLabel}>💰 Total do Dia</ThemedText>
        <ThemedText style={styles.totalCardValue} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(dayTotal)}
        </ThemedText>
        <View style={styles.totalBreakdown}>
          <View style={styles.totalBreakdownRow}>
            {methodOrder.slice(0, 2).map((method) => {
              const total = totalsByMethod[method] ?? 0;
              return (
                <View key={method} style={styles.totalBreakdownItem}>
                  <ThemedText style={styles.totalBreakdownLabel}>
                    {paymentLabels[method]?.toUpperCase()}
                  </ThemedText>
                  <ThemedText style={styles.totalBreakdownValue}>
                    {formatCurrency(total)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <View style={styles.totalBreakdownRow}>
            {methodOrder.slice(2, 4).map((method) => {
              const total = totalsByMethod[method] ?? 0;
              return (
                <View key={method} style={styles.totalBreakdownItem}>
                  <ThemedText style={styles.totalBreakdownLabel}>
                    {paymentLabels[method]?.toUpperCase()}
                  </ThemedText>
                  <ThemedText style={styles.totalBreakdownValue}>
                    {formatCurrency(total)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <ThemedText type="smallBold" themeColor="textSecondary">
        Vendas
      </ThemedText>
    </ThemedView>
  );

  const emptyState = (
    <ThemedView style={styles.emptyState}>
      <ThemedText style={styles.emptyEmoji}>🛒</ThemedText>
      <ThemedText type="subtitle" style={styles.emptyTitle}>Nenhuma venda</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">Registre sua primeira venda.</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {loading ? <Loading /> : (
          <FlatList
            data={sales}
            keyExtractor={(item) => item.id!}
            renderItem={renderSale}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={emptyState}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </SafeAreaView>

      {/* Sale Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailVisible(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>
              {selectedSale?.number ?? 'Detalhes'}
            </ThemedText>
            <Pressable onPress={() => setDetailVisible(false)}>
              <ThemedText type="default" themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </ThemedView>

          <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.four, gap: Spacing.three }}>
            {selectedSale && (
              <>
                <ThemedView style={styles.detailRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary">Total:</ThemedText>
                  <ThemedText style={{ fontWeight: '700', fontSize: 18 }}>{formatCurrency(selectedSale.totalAmount)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.detailRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary">Pagamento:</ThemedText>
                  <ThemedText>{selectedSale.paymentMethod}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.detailRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary">Status:</ThemedText>
                  <ThemedText>{selectedSale.status}</ThemedText>
                </ThemedView>

                <ThemedText type="subtitle" style={{ marginTop: Spacing.two }}>Itens</ThemedText>
                {saleItems.map((item, idx) => (
                  <ThemedView key={idx} style={styles.detailItem}>
                    <ThemedView style={{ flex: 1 }}>
                      <ThemedText style={{ fontWeight: '600' }}>{getProductName(item.productId)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.quantity} x {formatCurrency(item.unitPrice)}
                      </ThemedText>
                    </ThemedView>
                    <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(item.subtotal)}</ThemedText>
                  </ThemedView>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  headerContent: { gap: Spacing.four },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.four, paddingVertical: Spacing.two },
  dateArrow: { padding: Spacing.one },
  dateText: { fontSize: 16, fontWeight: '600', lineHeight: 22 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.five },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalTitle: { fontSize: 28, lineHeight: 32 },
  totalCard: {
    borderRadius: Spacing.four,
    paddingVertical: 36,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#059669',
  },
  totalCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  totalCardValue: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
    color: '#fff',
  },
  totalBreakdown: {
    marginTop: Spacing.four,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    gap: Spacing.four,
  },
  totalBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: Spacing.five,
  },
  totalBreakdownItem: { alignItems: 'center', gap: Spacing.one },
  totalBreakdownLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  totalBreakdownValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailItem: { paddingVertical: Spacing.two, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
});
