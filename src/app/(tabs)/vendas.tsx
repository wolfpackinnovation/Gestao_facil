import { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import * as SaleService from '@/services/sale-service';
import * as ClientService from '@/services/client-service';
import type { Sale, SaleItem, Client } from '@/types/schema';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function VendasScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const companyId = user?.uid ?? '';

  const loadSales = useCallback(async () => {
    const [salesData, clientsData] = await Promise.all([
      SaleService.listSales(companyId),
      ClientService.listClients(companyId),
    ]);
    setSales(salesData);
    setClients(clientsData);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadSales();
    }, [loadSales])
  );

  async function viewSaleDetails(sale: Sale) {
    setSelectedSale(sale);
    const items = await SaleService.getSaleItems(sale.id!);
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
          await SaleService.deleteSale(sale.id!);
          await loadSales();
        },
      },
    ]);
  }

  function renderSale({ item }: { item: Sale }) {
    const client = clients.find((c) => c.id === item.clientId);
    return (
      <Pressable onPress={() => viewSaleDetails(item)}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedView style={styles.cardHeader}>
            <ThemedText style={styles.cardName}>{item.number}</ThemedText>
            <ThemedText style={styles.cardAmount}>{formatCurrency(item.totalAmount)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.cardBody}>
            {client && (
              <ThemedView style={styles.cardRow}>
                <ThemedText type="small" themeColor="textSecondary">Cliente:</ThemedText>
                <ThemedText type="smallBold">{client.name}</ThemedText>
              </ThemedView>
            )}
            <ThemedView style={styles.cardRow}>
              <ThemedText type="small" themeColor="textSecondary">Pagamento:</ThemedText>
              <ThemedText type="smallBold">{item.paymentMethod}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.cardRow}>
              <ThemedText type="small" themeColor="textSecondary">Status:</ThemedText>
              <ThemedText type="smallBold">{item.status}</ThemedText>
            </ThemedView>
          </ThemedView>
          <Pressable onPress={() => confirmDelete(item)} style={styles.deleteButton}>
            <ThemedText type="small" style={{ color: '#ef4444' }}>Excluir</ThemedText>
          </Pressable>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.headerEmoji}>💳</ThemedText>
          <ThemedText type="title" style={styles.headerTitle}>Vendas</ThemedText>
          <Pressable onPress={() => router.push('/nova-venda')} style={[styles.addButton, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>+ Nova</ThemedText>
          </Pressable>
        </ThemedView>

        {sales.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>🛒</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>Nenhuma venda</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">Registre sua primeira venda.</ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={sales}
            keyExtractor={(item) => item.id!}
            renderItem={renderSale}
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
                  <ThemedView key={idx} type="backgroundElement" style={styles.detailItem}>
                    <ThemedView>
                      <ThemedText style={{ fontWeight: '600' }}>{item.productId}</ThemedText>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.three },
  headerEmoji: { fontSize: 32 },
  headerTitle: { fontSize: 32, lineHeight: 36 },
  addButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  addButtonText: { fontWeight: '600', fontSize: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three },
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { flex: 1, fontWeight: '600' },
  cardAmount: { fontWeight: '700', fontSize: 16 },
  cardBody: { gap: Spacing.one },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteButton: { alignSelf: 'flex-end', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalTitle: { fontSize: 28, lineHeight: 32 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailItem: { borderRadius: Spacing.three, padding: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
