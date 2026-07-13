import { useState, useCallback } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { DateNavigator } from '@/components/date-navigator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getSalesByDate, getSaleItems } from '@/services/sale-service';
import * as ClientService from '@/services/client-service';
import { getProdutos } from '@/services/estoque-storage';
import type { Sale, SaleItem, Client } from '@/types/schema';
import { formatCurrency } from '@/utils/format';

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  'cartão': 'Cartão',
  pix: 'Pix',
  fiado: 'Fiado',
};

const paymentIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  pix: 'phone-portrait-outline',
  dinheiro: 'cash-outline',
  'cartão': 'card-outline',
  fiado: 'receipt-outline',
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

  function renderSale({ item }: { item: Sale }) {
    const client = clients.find((c) => c.id === item.clientId);
    const productName = saleFirstItem[item.id!];
    const method = item.paymentMethod ?? 'dinheiro';
    return (
      <Pressable onPress={() => viewSaleDetails(item)} style={styles.saleRow}>
        <View style={styles.iconCircle}>
          <Ionicons name={paymentIcons[method]} size={20} color={theme.primary} />
        </View>
        <ThemedView style={{ flex: 1 }}>
          <ThemedText style={{ fontWeight: '600', fontSize: 14 }} numberOfLines={1} ellipsizeMode="tail">{item.number}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {productName ?? client?.name ?? 'Sem cliente'}
          </ThemedText>
        </ThemedView>
        <ThemedView style={{ alignItems: 'flex-end', flexDirection: 'row', gap: Spacing.two }}>
          <ThemedText style={{ fontWeight: '700', fontSize: 14 }}>{formatCurrency(item.totalAmount)}</ThemedText>
          <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
        </ThemedView>
      </Pressable>
    );
  }

  const listHeader = (
    <ThemedView style={styles.headerContent}>
      <DateNavigator selectedDate={selectedDate} onDateChange={goToDate} />

      {/* Total de vendas */}
      <View style={styles.totalCard}>
        <View style={styles.totalCardDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={styles.totalCardLeft}>
          <ThemedText style={styles.totalCardLabel}>Total de vendas</ThemedText>
          <ThemedText style={styles.totalCardValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(dayTotal)}
          </ThemedText>
          <ThemedText style={styles.totalCardSub}>
            {sales.length} {sales.length === 1 ? 'venda' : 'vendas'} · {methodOrder.filter(m => totalsByMethod[m] > 0).length} formas
          </ThemedText>
        </View>
      </View>

      {/* Formas de pagamento */}
      <ThemedView>
        <ThemedText style={styles.sectionTitle}>Formas de pagamento</ThemedText>
        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          {methodOrder.slice(0, 2).map((method) => {
            const total = totalsByMethod[method] ?? 0;
            return (
              <ThemedView key={method} style={styles.paymentCard}>
                <View style={styles.iconCircle}>
                  <Ionicons name={paymentIcons[method]} size={20} color={theme.primary} />
                </View>
                <ThemedText style={styles.paymentLabel} themeColor="textSecondary">{paymentLabels[method]}</ThemedText>
                <ThemedText style={styles.paymentValue}>{formatCurrency(total)}</ThemedText>
              </ThemedView>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three }}>
          {methodOrder.slice(2, 4).map((method) => {
            const total = totalsByMethod[method] ?? 0;
            return (
              <ThemedView key={method} style={styles.paymentCard}>
                <View style={styles.iconCircle}>
                  <Ionicons name={paymentIcons[method]} size={20} color={theme.primary} />
                </View>
                <ThemedText style={styles.paymentLabel} themeColor="textSecondary">{paymentLabels[method]}</ThemedText>
                <ThemedText style={styles.paymentValue}>{formatCurrency(total)}</ThemedText>
              </ThemedView>
            );
          })}
        </View>
      </ThemedView>

      {/* Últimas vendas */}
      <ThemedText style={styles.sectionTitle}>Últimas vendas</ThemedText>
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
  headerContent: { gap: Spacing.three },


  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 1,
    marginBottom: Spacing.three,
  },

  paymentCard: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentLabel: { fontSize: 14, fontWeight: '500' },
  paymentValue: { fontSize: 18, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.five },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.three,
  },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalTitle: { fontSize: 28, lineHeight: 32 },
  totalCard: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    paddingVertical: 36,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#7B4F2C',
    gap: Spacing.three,
    overflow: 'hidden',
  },
  totalCardDecor: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 120,
    height: 120,
  },
  decorCircle1: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decorCircle2: {
    position: 'absolute',
    right: 30,
    top: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  totalCardLeft: { flex: 1 },
  totalCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
  },
  totalCardValue: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    color: '#fff',
  },
  totalCardSub: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.half,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailItem: { paddingVertical: Spacing.two, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
});
