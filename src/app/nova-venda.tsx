import { useState, useEffect } from 'react';
import {
  Alert,
  Dimensions,
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
import { useRouter, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCurrencyInput, parseCurrencyInput } from '@/utils/format';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import * as SaleService from '@/services/sale-service';
import * as ClientService from '@/services/client-service';
import { getProdutos, type Produto } from '@/services/estoque-storage';
import { consumirEstoqueFEFO, reverterConsumo, type ConsumoFEFO } from '@/services/lote-service';
import type { Client } from '@/types/schema';

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
  consumos?: ConsumoFEFO[]
}

export default function NovaVendaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [products, setProducts] = useState<Produto[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('dinheiro');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityModalProduct, setQuantityModalProduct] = useState<Produto | null>(null);
  const [quantityInput, setQuantityInput] = useState('');
  const [descontoText, setDescontoText] = useState('');

  useEffect(() => {
    if (!companyId) return;
    getProdutos(companyId).then(setProducts);
    ClientService.listAllClients().then(setClients);
  }, [companyId]);

  function handleProductPress(product: Produto) {
    setShowProductPicker(false);
    setQuantityModalProduct(product);
    setQuantityInput('');
    setShowQuantityModal(true);
  }

  function confirmQuantityInput() {
    if (!quantityModalProduct) return;
    const qty = parseFloat(quantityInput.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) return;
    const estoqueDisp = quantityModalProduct.estoqueAtual ?? 0;
    if (qty > estoqueDisp) {
      Alert.alert('Estoque insuficiente', `Disponível: ${estoqueDisp} ${quantityModalProduct.unidade}`);
      return;
    }
    addProductToCart(quantityModalProduct, qty);
    setShowQuantityModal(false);
    setQuantityModalProduct(null);
    setQuantityInput('');
  }

  function adjustQuantity(delta: number) {
    const current = parseFloat(quantityInput.replace(',', '.')) || 0;
    const next = Math.max(0, current + delta);
    const max = quantityModalProduct?.estoqueAtual ?? Infinity;
    if (next > max) return;
    setQuantityInput(next > 0 ? String(next) : '');
  }

  const qtyValue = parseFloat(quantityInput.replace(',', '.')) || 0;
  const subtotalValue = quantityModalProduct ? qtyValue * quantityModalProduct.custo : 0;

  function addProductToCart(product: Produto, qty: number) {
    const existing = cart.find((c) => c.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const totalQty = currentQty + qty;
    const estoqueDisp = product.estoqueAtual ?? 0;
    if (totalQty > estoqueDisp) {
      Alert.alert('Estoque insuficiente', `Disponível: ${estoqueDisp} ${product.unidade}`);
      return;
    }
    if (existing) {
      setCart((prev) =>
        prev.map((c) =>
          c.productId === product.id
            ? { ...c, quantity: totalQty, subtotal: totalQty * c.unitPrice }
            : c
        )
      );
    } else {
      setCart((prev) => [
        {
          productId: product.id,
          productName: product.nome,
          quantity: qty,
          unitPrice: product.custo,
          subtotal: qty * product.custo,
        },
        ...prev,
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
    const product = products.find((p) => p.id === productId);
    if (product && qty > (product.estoqueAtual ?? 0)) {
      Alert.alert('Estoque insuficiente', `Disponível: ${product.estoqueAtual ?? 0} ${product.unidade}`);
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
  const desconto = parseCurrencyInput(descontoText);
  const totalComDesconto = totalCart - desconto;

  function goBack() {
    if (from) {
      router.push(from as any)
    } else {
      router.back()
    }
  }

  async function finishSale() {
    if (cart.length === 0) {
      Alert.alert('Carrinho vazio', 'Adicione pelo menos um produto.');
      return;
    }

    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      if ((product.estoqueAtual ?? 0) < item.quantity) {
        Alert.alert(
          'Estoque insuficiente',
          `${product.nome}: disponível ${product.estoqueAtual ?? 0} ${product.unidade}`
        );
        return;
      }
    }

    const saleData: any = {
      companyId,
      number: generateSaleNumber(),
      totalAmount: totalComDesconto,
      desconto,
      paymentMethod,
      status: paymentMethod === 'fiado' ? 'pendente' : 'concluída',
    };
    if (selectedClientId) {
      saleData.clientId = selectedClientId;
    }

    const items = cart.map((c) => ({
      productId: c.productId,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      subtotal: c.subtotal,
    }));

    try {
      const saleId = await SaleService.createSaleWithItems(saleData, items);

      const consumosPorProduto: Record<string, ConsumoFEFO[]> = {}
      let erroEstoque = false
      for (const item of cart) {
        const result = await consumirEstoqueFEFO(item.productId, item.quantity, {
          referenciaTipo: 'venda',
          referenciaId: saleId,
          tipo: 'venda',
          motivo: `Venda ${saleData.number}`,
          userId: companyId,
        });
        if (!result.sucesso) {
          Alert.alert('Erro de estoque', result.mensagem ?? 'Estoque insuficiente')
          erroEstoque = true
          for (const pid of Object.keys(consumosPorProduto)) {
            await reverterConsumo(pid, consumosPorProduto[pid], {
              tipo: 'entrada',
              motivo: 'Estorno por erro',
            });
          }
          break
        }
        consumosPorProduto[item.productId] = result.consumido
      }

      if (!erroEstoque) {
        Alert.alert('Venda registrada', `Venda ${saleData.number} concluída com sucesso!`);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao registrar venda.');
    }
    goBack();
  }

  const filteredProducts = productSearch
    ? products.filter((p) => p.nome.toLowerCase().includes(productSearch.toLowerCase()))
    : products;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
              <ThemedView key={item.productId} style={styles.cartItem}>
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
        </ScrollView>

        {/* Fixed Bottom Area */}
        <ThemedView style={styles.bottomArea}>
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
                    { backgroundColor: paymentMethod === method ? theme.primary : theme.backgroundElement },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: paymentMethod === method ? '#ffffff' : theme.text }}
                  >
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          {paymentMethod === 'fiado' && (
            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="smallBold" style={styles.fieldLabel}>Cliente</ThemedText>
              <Pressable
                onPress={() => setShowClientPicker(true)}
                style={[styles.pickerButton, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText style={selectedClientId ? undefined : { color: theme.textSecondary }}>
                  {selectedClientId
                    ? clients.find((c) => c.id === selectedClientId)?.name
                    : 'Selecionar cliente'}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {/* Desconto */}
          <ThemedView style={styles.descontoRow}>
            <ThemedText style={styles.descontoLabel}>Desconto</ThemedText>
            <TextInput
              style={[styles.descontoInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              placeholder="R$ 0,00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={formatCurrencyInput(descontoText)}
              onChangeText={(t) => setDescontoText(formatCurrencyInput(t))}
            />
          </ThemedView>

          {/* Total */}
          <ThemedView style={styles.totalRow}>
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <ThemedText style={styles.totalValue}>{formatCurrency(cart.length > 0 ? totalComDesconto : 0)}</ThemedText>
          </ThemedView>

          <Pressable
            onPress={finishSale}
            disabled={cart.length === 0}
            style={[styles.saveButton, { backgroundColor: cart.length > 0 ? theme.primary : theme.textSecondary }]}
          >
            <ThemedText style={[styles.saveButtonText, { color: '#ffffff' }]}>
              Finalizar Venda
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>

      {/* Product Picker Modal */}
      <Modal visible={showProductPicker} transparent animationType="slide" onRequestClose={() => setShowProductPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowProductPicker(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: theme.background }]}>
            <ThemedView style={styles.pickerHeader}>
              <ThemedText type="subtitle">Selecionar Produto</ThemedText>
              <Pressable onPress={() => setShowProductPicker(false)}>
                <ThemedText type="default" themeColor="textSecondary">Fechar</ThemedText>
              </Pressable>
            </ThemedView>

            <TextInput
              style={[styles.pickerSearchInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              placeholder="Buscar produto..."
              placeholderTextColor={theme.textSecondary}
              value={productSearch}
              onChangeText={setProductSearch}
            />

            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id!}
              contentContainerStyle={{ gap: Spacing.two }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleProductPress(item)}
                  style={styles.productPickerItem}
                >
                  <ThemedView style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '600' }}>{item.nome}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.unidade} - Estoque: {item.estoqueAtual}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={{ fontWeight: '700' }}>{formatCurrency(item.custo)}</ThemedText>
                </Pressable>
              )}
              ListEmptyComponent={
                <ThemedText style={{ textAlign: 'center', marginTop: Spacing.four }} themeColor="textSecondary">
                  Nenhum produto encontrado
                </ThemedText>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Quantity Input Modal */}
      <Modal visible={showQuantityModal} transparent animationType="slide" onRequestClose={() => setShowQuantityModal(false)}>
        <Pressable style={styles.quantityOverlay} onPress={() => setShowQuantityModal(false)}>
          <Pressable style={[styles.quantitySheet, { backgroundColor: theme.background }]}>
            <ThemedView style={styles.quantityHeader}>
              <ThemedText type="subtitle" style={{ flex: 1 }}>
                {quantityModalProduct?.nome}
              </ThemedText>
              <Pressable onPress={() => setShowQuantityModal(false)}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>

            <ThemedView style={styles.quantityStockRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Estoque disponível: <ThemedText type="smallBold">{quantityModalProduct?.estoqueAtual} {quantityModalProduct?.unidade}</ThemedText>
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatCurrency(quantityModalProduct?.custo ?? 0)} / {quantityModalProduct?.unidade}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.quantityStepper}>
              <Pressable
                onPress={() => adjustQuantity(-1)}
                style={[styles.qtyBtn, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText style={{ fontWeight: '700', fontSize: 20 }}>-</ThemedText>
              </Pressable>
              <TextInput
                style={[styles.quantityInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={quantityInput}
                onChangeText={setQuantityInput}
                autoFocus
              />
              <Pressable
                onPress={() => adjustQuantity(1)}
                style={[styles.qtyBtn, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText style={{ fontWeight: '700', fontSize: 20 }}>+</ThemedText>
              </Pressable>
            </ThemedView>

            <ThemedView style={styles.quantitySubtotalRow}>
              <ThemedText type="default" themeColor="textSecondary">Total</ThemedText>
              <ThemedText type="title" style={styles.quantitySubtotalValue}>{formatCurrency(subtotalValue)}</ThemedText>
            </ThemedView>

            <Pressable
              onPress={confirmQuantityInput}
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={[styles.saveButtonText, { color: '#ffffff' }]}>
                Adicionar
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Client Picker Modal */}
      <Modal visible={showClientPicker} transparent animationType="slide" onRequestClose={() => setShowClientPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowClientPicker(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: theme.background }]}>
            <ThemedView style={styles.pickerHeader}>
              <ThemedText type="subtitle">Selecionar Cliente</ThemedText>
              <Pressable onPress={() => setShowClientPicker(false)}>
                <ThemedText type="default" themeColor="textSecondary">Fechar</ThemedText>
              </Pressable>
            </ThemedView>

            <FlatList
              data={clients}
              keyExtractor={(item) => item.id!}
              contentContainerStyle={{ gap: Spacing.two }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setSelectedClientId(item.id!); setShowClientPicker(false); }}
                  style={styles.productPickerItem}
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
          </Pressable>
        </Pressable>
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
  scrollContent: { gap: Spacing.three },
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { letterSpacing: 0.5 },
  pickerButton: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.half },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  addProductButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  emptyCart: { paddingVertical: Spacing.four, alignItems: 'center' },
  cartItem: { paddingVertical: Spacing.three, gap: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  cartItemInfo: { gap: Spacing.half },
  cartItemActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  qtyBtn: { width: 32, height: 32, borderRadius: Spacing.one, alignItems: 'center', justifyContent: 'center' },
  descontoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two },
  descontoLabel: { fontSize: 16, fontWeight: '500' },
  descontoInput: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 18, textAlign: 'right', minWidth: 140 },
  bottomArea: { gap: Spacing.two, paddingTop: Spacing.two, paddingBottom: BottomTabInset, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.15)' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.three, borderTopWidth: 2, borderTopColor: 'rgba(128,128,128,0.2)', marginTop: Spacing.two },
  totalLabel: { fontSize: 20, fontWeight: '600' },
  totalValue: { fontSize: 24, fontWeight: '700' },
  saveButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.two },
  saveButtonText: { fontWeight: '600', fontSize: 16 },
  productPickerItem: { paddingVertical: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  quantityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  quantityOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  quantitySheet: { borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four, padding: Spacing.four, minHeight: Dimensions.get('screen').height * 0.55 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four, paddingTop: Spacing.three, paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, minHeight: Dimensions.get('screen').height * 0.6 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.three },
  pickerSearchInput: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 16, marginBottom: Spacing.three },
  quantityStockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.three },
  quantityStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  quantityInput: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two, fontSize: 24, textAlign: 'center', minWidth: 100 },
  quantitySubtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two, marginBottom: Spacing.two },
  quantitySubtotalValue: { fontSize: 28, fontWeight: '700' },
});
