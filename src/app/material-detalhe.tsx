import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
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
  updateMaterial,
  type Material,
} from '@/services/material-service';
import { formatCurrency, formatQuantity } from '@/utils/format';

export default function MaterialDetalheScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [material, setMaterial] = useState<Material | null>(null);

  const [replenishModalVisible, setReplenishModalVisible] = useState(false);
  const [replenishQty, setReplenishQty] = useState('');
  const [replenishPrice, setReplenishPrice] = useState('');
  const [replenishing, setReplenishing] = useState(false);

  function formatBRL(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2).replace(/^0+/, '') || '0';
    const decPart = padded.slice(-2);
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatted},${decPart}`;
  }

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
    router.replace('/materiais' as any);
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

  async function handleReplenish() {
    if (!material) return;
    const qty = parseFloat(replenishQty.replace(',', '.'));
    const price = replenishPrice ? parseFloat(replenishPrice.replace(/\D/g, '')) / 100 : 0;
    
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erro', 'Por favor, informe uma quantidade válida.');
      return;
    }
    
    setReplenishing(true);
    try {
      const novaQtd = material.quantidadeCompra + qty;
      const novoPreco = material.precoCompra + price;
      
      await updateMaterial(material.id, {
        quantidadeCompra: novaQtd,
        precoCompra: novoPreco,
      });
      
      setReplenishModalVisible(false);
      setReplenishQty('');
      setReplenishPrice('');
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', 'Erro ao repor o material.');
    } finally {
      setReplenishing(false);
    }
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
              {formatQuantity(material.quantidadeCompra)} {material.unidadeCompra}
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

          <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
            <Pressable
              onPress={() => router.push(`/material-form?id=${material.id}` as any)}
              style={[styles.editButton, { flex: 1, backgroundColor: theme.primary, marginTop: 0 }]}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.one }}>
                Editar
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setReplenishModalVisible(true)}
              style={[styles.editButton, { flex: 1, backgroundColor: '#10B981', marginTop: 0 }]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <ThemedText style={{ color: '#fff', fontWeight: '700', marginLeft: Spacing.one }}>
                Repor
              </ThemedText>
            </Pressable>
          </View>

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

      <Modal
        visible={replenishModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReplenishModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[{ flex: 1, backgroundColor: theme.background }]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.four, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' }}>
              <ThemedText type="title" style={{ fontSize: 18 }}>Repor Estoque</ThemedText>
              <Pressable onPress={() => setReplenishModalVisible(false)} disabled={replenishing}>
                <ThemedText type="default" themeColor="textSecondary">Cancelar</ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
              <ThemedView style={{ gap: Spacing.one }}>
                <ThemedText type="smallBold" style={{ fontSize: 12, letterSpacing: 0.5 }}>
                  Quantidade Adicional ({material.unidadeCompra}) *
                </ThemedText>
                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', borderColor: theme.textSecondary + '55', borderWidth: 1, borderRadius: Spacing.two, overflow: 'hidden' }}>
                  <TextInput
                    style={{ flex: 1, height: 48, paddingHorizontal: Spacing.three, fontSize: 16, color: theme.text, backgroundColor: theme.background }}
                    value={replenishQty}
                    onChangeText={setReplenishQty}
                    placeholder="Ex: 5"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    editable={!replenishing}
                  />
                </ThemedView>
              </ThemedView>

              <ThemedView style={{ gap: Spacing.one }}>
                <ThemedText type="smallBold" style={{ fontSize: 12, letterSpacing: 0.5 }}>
                  Custo da nova compra (Opcional)
                </ThemedText>
                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', borderColor: theme.textSecondary + '55', borderWidth: 1, borderRadius: Spacing.two, overflow: 'hidden' }}>
                  <ThemedView style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, backgroundColor: theme.backgroundElement }}>
                    <ThemedText type="default" themeColor="textSecondary">R$</ThemedText>
                  </ThemedView>
                  <TextInput
                    style={{ flex: 1, height: 48, paddingHorizontal: Spacing.three, fontSize: 16, color: theme.text, backgroundColor: theme.background }}
                    value={formatBRL(replenishPrice)}
                    onChangeText={(val) => setReplenishPrice(val.replace(/\D/g, ''))}
                    placeholder="0,00"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    editable={!replenishing}
                  />
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  Esse valor será somado ao custo total do material e o custo por unidade será recalculado.
                </ThemedText>
              </ThemedView>
            </ScrollView>

            <ThemedView style={{ padding: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)' }}>
              <Pressable
                style={[{ height: 48, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, opacity: replenishing ? 0.7 : 1 }]}
                onPress={handleReplenish}
                disabled={replenishing}
              >
                {replenishing ? <Loading size="small" color="#fff" /> : <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Confirmar Reposição</ThemedText>}
              </Pressable>
            </ThemedView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

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
