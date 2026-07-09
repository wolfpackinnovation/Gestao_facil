import { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import * as SaleService from '@/services/sale-service';
import * as ProductService from '@/services/product-service';
import * as ClientService from '@/services/client-service';
import type { Product, Client } from '@/types/schema';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateSaleNumber(): string {
  const now = new Date();
  return `V${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Date.now() % 100000).padStart(5, '0')}`;
}

interface CartItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export default function NovaVendaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('dinheiro');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    Promise.all([
      ProductService.listAllProducts().then(setProducts),
      ClientService.listAllClients().then(setClients),
    ]);
  }, [companyId]);

  function addProductToCart(product: Product) {
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      setCart((prev) =>
        prev.map((c) =>
          c.productId === product.id
            ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.unitPrice }
            : c
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: product.id!,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          subtotal: product.price,
        },
      ]);
    }
    setShowProductPicker(false);
    setProductSearch('');
  }

  function updateCartQuantity(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        c.productId === productId
          ? { ...c, quantity: qty, subtotal: qty * c.unitPrice }
          : c
      )
    );
  }

  const totalCart = cart.reduce((sum, item) => sum + item.subtotal, 0);

  function goBack() {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.navigate('/(tabs)' as any)
    }
  }

  async function finishSale() {
    if (cart.length === 0) {
      Alert.alert('Carrinho vazio', 'Adicione pelo menos um produto.');
      return;
    }

    const saleData = {
      companyId,
      number: generateSaleNumber(),
      clientId: selectedClientId || undefined,
      totalAmount: totalCart,
      paymentMethod,
      status: 'concluída',
    };

    const items = cart.map((c) => ({
      productId: c.productId,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      subtotal: c.subtotal,
      discount: undefined,
    }));

    try {
      await SaleService.createSaleWithItems(saleData, items);
      Alert.alert('Venda registrada', `Venda ${saleData.number} concluída com sucesso!`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao registrar venda.');
    }
    goBack();
  }

  const filteredProducts = productSearch
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : products;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.header}>
          <Pressable onPress={goBack} style={styles.backButton}>
            <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Nova Venda</ThemedText>
          <ThemedView style={styles.backButton} />
        </ThemedView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Client Picker */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.fieldLabel}>Cliente</ThemedText>
            <Pressable
              onPress={() => setShowClientPicker(true)}
              style={[styles.pickerButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText style={selectedClientId ? undefined : { color: theme.textSecondary }}>
                {selectedClientId
                  ? clients.find((c) => c.id === selectedClientId)?.name
                  : 'Selecionar cliente (opcional)'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {/* Payment Method */}
          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="smallBold" style={styles.fieldLabel}>Forma de Pagamento</ThemedText>
            <ThemedView style={styles.chipsRow}>
              {['dinheiro', 'cartão', 'pix', 'fiado'].map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={[
                    styles.chip,
                    { backgroundColor: paymentMethod === method ? theme.text : theme.backgroundElement },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: paymentMethod === method ? theme.background : theme.text }}
                  >
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          {/* Products Section */}
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">Produtos</ThemedText>
            <Pressable
              onPress={() => { setProductSearch(''); setShowProductPicker(true); }}
              style={[styles.addProductButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small" style={{ fontWeight: '600' }}>+ Adicionar</ThemedText>
            </Pressable>
          </ThemedView>

          {cart.length === 0 ? (
            <ThemedView style={styles.emptyCart}>
              <ThemedText themeColor="textSecondary">Nenhum produto adicionado</ThemedText>
            </ThemedView>
          ) : (
            cart.map((item) => (
              <ThemedView key={item.productId} type="backgroundElement" style={styles.cartItem}>
                <ThemedView style={styles.cartItemInfo}>
                  <ThemedText style={{ fontWeight: '600' }}>{item.productName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatCurrency(item.unitPrice)} x {item.quantity}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.cartItemActions}>
                  <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(item.subtotal)}</ThemedText>
                  <ThemedView style={styles.qtyControls}>
                    <Pressable
                      onPress={() => updateCartQuantity(item.productId, item.quantity - 1)}
                      style={[styles.qtyBtn, { backgroundColor: theme.background }]}
                    >
                      <ThemedText style={{ fontWeight: '700' }}>-</ThemedText>
                    </Pressable>
                    <ThemedText style={{ minWidth: 24, textAlign: 'center' }}>{item.quantity}</ThemedText>
                    <Pressable
                      onPress={() => updateCartQuantity(item.productId, item.quantity + 1)}
                      style={[styles.qtyBtn, { backgroundColor: theme.background }]}
                    >
                      <ThemedText style={{ fontWeight: '700' }}>+</ThemedText>
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            ))
          )}

          {/* Total */}
          {cart.length > 0 && (
            <ThemedView style={styles.totalRow}>
              <ThemedText type="title">Total:</ThemedText>
              <ThemedText type="title" style={{ fontWeight: '700' }}>{formatCurrency(totalCart)}</ThemedText>
            </ThemedView>
          )}

          <Pressable
            onPress={finishSale}
            style={[styles.saveButton, { backgroundColor: theme.text }]}
          >
            <ThemedText style={[styles.saveButtonText, { color: theme.background }]}>
              Finalizar Venda
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Product Picker Modal */}
      <Modal visible={showProductPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProductPicker(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>Selecionar Produto</ThemedText>
            <Pressable onPress={() => setShowProductPicker(false)}>
              <ThemedText type="default" themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </ThemedView>

          <TextInput
            style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundElement, marginHorizontal: Spacing.four }]}
            placeholder="Buscar produto..."
            placeholderTextColor={theme.textSecondary}
            value={productSearch}
            onChangeText={setProductSearch}
          />

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id!}
            contentContainerStyle={{ paddingHorizontal: Spacing.four, gap: Spacing.two }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => addProductToCart(item)}
                style={[styles.productPickerItem, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedView style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: '600' }}>{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.unit} - Estoque: {item.stockQuantity}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(item.price)}</ThemedText>
              </Pressable>
            )}
            ListEmptyComponent={
              <ThemedText style={{ textAlign: 'center', marginTop: Spacing.four }} themeColor="textSecondary">
                Nenhum produto encontrado
              </ThemedText>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Client Picker Modal */}
      <Modal visible={showClientPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowClientPicker(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="title" style={styles.modalTitle}>Selecionar Cliente</ThemedText>
            <Pressable onPress={() => setShowClientPicker(false)}>
              <ThemedText type="default" themeColor="textSecondary">Fechar</ThemedText>
            </Pressable>
          </ThemedView>

          <FlatList
            data={clients}
            keyExtractor={(item) => item.id!}
            contentContainerStyle={{ paddingHorizontal: Spacing.four, gap: Spacing.two }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setSelectedClientId(item.id!); setShowClientPicker(false); }}
                style={[styles.productPickerItem, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText style={{ fontWeight: '600' }}>{item.name}</ThemedText>
                {item.email && <ThemedText type="small" themeColor="textSecondary">{item.email}</ThemedText>}
              </Pressable>
            )}
            ListEmptyComponent={
              <ThemedText style={{ textAlign: 'center', marginTop: Spacing.four }} themeColor="textSecondary">
                Nenhum cliente encontrado
              </ThemedText>
            }
          />
        </SafeAreaView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.three },
  backButton: { minWidth: 60 },
  headerTitle: { fontSize: 28, lineHeight: 32, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.six, gap: Spacing.three },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  pickerButton: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.half },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  addProductButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  emptyCart: { paddingVertical: Spacing.four, alignItems: 'center' },
  cartItem: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  cartItemInfo: { gap: Spacing.half },
  cartItemActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  qtyBtn: { width: 32, height: 32, borderRadius: Spacing.one, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.three },
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
  saveButtonText: { fontWeight: '600', fontSize: 16 },
  searchInput: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 16, marginBottom: Spacing.three },
  productPickerItem: { borderRadius: Spacing.three, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modalTitle: { fontSize: 28, lineHeight: 32 },
});
