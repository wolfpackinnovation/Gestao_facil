import { useState, useCallback } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import {
  getProdutos,
  saveProduto,
  deleteProduto,
  formatCurrency,
  CATEGORIAS,
  UNIDADES,
  type Produto,
  type UnidadeMedida,
} from '@/services/estoque-storage';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const emptyForm = {
  codigo: '',
  nome: '',
  categoria: CATEGORIAS[0],
  unidade: 'un' as UnidadeMedida,
  quantidade: '',
  custo: '',
  estoqueAtual: '',
  estoqueMinimo: '',
  dataValidade: '',
  fornecedor: '',
};

export default function EstoqueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [now] = useState(() => Date.now());

  const loadProdutos = useCallback(async () => {
    if (!companyId) return;
    const data = await getProdutos(companyId);
    setProdutos(data);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadProdutos();
    }, [loadProdutos])
  );

  function openNew() {
    const nextCode = 'P' + String(produtos.length + 1).padStart(3, '0');
    setEditingId(null);
    setForm({ ...emptyForm, codigo: nextCode });
    setErrors({});
    setModalVisible(true);
  }

  function openEdit(produto: Produto) {
    setEditingId(produto.id);
    setForm({
      codigo: produto.codigo,
      nome: produto.nome,
      categoria: produto.categoria,
      unidade: produto.unidade,
      quantidade: produto.quantidade.toString(),
      custo: produto.custo.toString(),
      estoqueAtual: produto.estoqueAtual.toString(),
      estoqueMinimo: produto.estoqueMinimo.toString(),
      dataValidade: produto.dataValidade,
      fornecedor: produto.fornecedor,
    });
    setErrors({});
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingId(null);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!form.quantidade || isNaN(Number(form.quantidade)) || Number(form.quantidade) <= 0)
      newErrors.quantidade = 'Informe uma quantidade válida';
    if (!form.custo || isNaN(Number(form.custo)) || Number(form.custo) <= 0)
      newErrors.custo = 'Informe um custo válido';
    if (!form.estoqueAtual || isNaN(Number(form.estoqueAtual)) || Number(form.estoqueAtual) < 0)
      newErrors.estoqueAtual = 'Informe o estoque atual';
    if (
      form.estoqueMinimo &&
      (isNaN(Number(form.estoqueMinimo)) || Number(form.estoqueMinimo) < 0)
    )
      newErrors.estoqueMinimo = 'Valor inválido';
    if (!form.dataValidade.match(/^\d{2}\/\d{2}\/\d{4}$/))
      newErrors.dataValidade = 'Use o formato DD/MM/AAAA';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    const produto: Produto = {
      id: editingId ?? generateId(),
      companyId,
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      quantidade: Number(form.quantidade),
      custo: Number(form.custo),
      estoqueAtual: Number(form.estoqueAtual),
      estoqueMinimo: Number(form.estoqueMinimo) || 0,
      dataValidade: form.dataValidade,
      fornecedor: form.fornecedor.trim(),
      createdAt: editingId
        ? produtos.find((p) => p.id === editingId)?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
    };
    await saveProduto(produto);
    await loadProdutos();
    closeModal();
  }

  function confirmDelete(id: string, nome: string) {
    Alert.alert('Excluir Produto', `Deseja excluir "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteProduto(id);
          await loadProdutos();
        },
      },
    ]);
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  const isLowStock = (p: Produto) => p.estoqueMinimo > 0 && p.estoqueAtual <= p.estoqueMinimo;
  const isExpiringSoon = (p: Produto) => {
    const [d, m, y] = p.dataValidade.split('/').map(Number);
    const expiry = new Date(y, m - 1, d);
    const diff = expiry.getTime() - now;
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };
  const isExpired = (p: Produto) => {
    const [d, m, y] = p.dataValidade.split('/').map(Number);
    const expiry = new Date(y, m - 1, d);
    return expiry.getTime() < now;
  };

  function renderProduto({ item }: { item: Produto }) {
    const low = isLowStock(item);
    const expired = isExpired(item);
    const status = expired ? 'vencido' : low ? 'baixo' : '';

    return (
      <Pressable onPress={() => router.push('/produto-detalhe?id=' + item.id as any)}>
        <ThemedView style={[styles.dataRow, status === 'vencido' && styles.rowVencido]}>
          <ThemedText numberOfLines={1} style={styles.colCodigo}>{item.codigo}</ThemedText>
          <ThemedText numberOfLines={1} style={styles.colNome}>{item.nome}</ThemedText>
          <ThemedText style={[styles.colEstoque, low && { color: '#ef4444' }]}>
            {item.estoqueAtual}{item.unidade}
          </ThemedText>
          <ThemedText style={styles.colCusto}>{formatCurrency(item.custo)}</ThemedText>
          <ThemedText style={[styles.colValidade, expired && { color: '#ef4444' }]}>
            {item.dataValidade}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  function renderInput(
    label: string,
    field: string,
    options?: {
      keyboardType?: 'default' | 'numeric' | 'decimal-pad';
      placeholder?: string;
      multiline?: boolean;
    }
  ) {
    return (
      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="smallBold" style={styles.fieldLabel}>
          {label}
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.background },
            errors[field] && styles.inputError,
          ]}
          value={(form as any)[field]}
          onChangeText={(v) => updateField(field, v)}
          placeholderTextColor={theme.textSecondary}
          placeholder={options?.placeholder}
          keyboardType={options?.keyboardType ?? 'default'}
          multiline={options?.multiline}
        />
        {errors[field] && (
          <ThemedText type="small" style={{ color: '#ef4444' }}>
            {errors[field]}
          </ThemedText>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.header}>
          <Pressable onPress={openNew} style={[styles.addButton, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>
              + Novo
            </ThemedText>
          </Pressable>
        </ThemedView>

        {produtos.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>📋</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              Nenhum produto
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
              Cadastre seu primeiro produto no estoque.
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView style={styles.tableWrapper}>
            <ThemedView style={styles.tableHeader}>
              <ThemedText type="smallBold" style={styles.colCodigo}>Código</ThemedText>
              <ThemedText type="smallBold" style={styles.colNome}>Nome</ThemedText>
              <ThemedText type="smallBold" style={styles.colEstoque}>Estq</ThemedText>
              <ThemedText type="smallBold" style={styles.colCusto}>Custo</ThemedText>
              <ThemedText type="smallBold" style={styles.colValidade}>Validade</ThemedText>
            </ThemedView>
            <FlatList
              data={produtos}
              keyExtractor={(item) => item.id}
              renderItem={renderProduto}
              showsVerticalScrollIndicator={false}
            />
          </ThemedView>
        )}
      </SafeAreaView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <SafeAreaView style={styles.modalSafe}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                {editingId ? 'Editar Produto' : 'Novo Produto'}
              </ThemedText>
              <Pressable onPress={closeModal}>
                <ThemedText type="default" themeColor="textSecondary">
                  Cancelar
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderInput('Nome do Produto *', 'nome', { placeholder: 'Ex: Picanha' })}

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  Categoria *
                </ThemedText>
                <ThemedView style={styles.chipsRow}>
                  {CATEGORIAS.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => updateField('categoria', cat)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            form.categoria === cat ? theme.text : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: form.categoria === cat ? theme.background : theme.text,
                        }}
                      >
                        {cat}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.fieldGroup}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  Unidade de Medida *
                </ThemedText>
                <ThemedView style={styles.chipsRow}>
                  {UNIDADES.map((uni) => (
                    <Pressable
                      key={uni}
                      onPress={() => updateField('unidade', uni)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            form.unidade === uni ? theme.text : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: form.unidade === uni ? theme.background : theme.text,
                        }}
                      >
                        {uni}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Quantidade *', 'quantidade', {
                    keyboardType: 'decimal-pad',
                    placeholder: 'Ex: 1',
                  })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Custo (R$) *', 'custo', {
                    keyboardType: 'decimal-pad',
                    placeholder: 'Ex: 45.90',
                  })}
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.rowFields}>
                <ThemedView style={styles.halfField}>
                  {renderInput('Estoque Atual *', 'estoqueAtual', {
                    keyboardType: 'numeric',
                    placeholder: 'Ex: 15',
                  })}
                </ThemedView>
                <ThemedView style={styles.halfField}>
                  {renderInput('Estoque Mínimo', 'estoqueMinimo', {
                    keyboardType: 'numeric',
                    placeholder: 'Ex: 5',
                  })}
                </ThemedView>
              </ThemedView>

              {renderInput('Data de Validade *', 'dataValidade', {
                placeholder: 'DD/MM/AAAA',
              })}

              {renderInput('Fornecedor (opcional)', 'fornecedor', {
                placeholder: 'Ex: Frigorífico X',
              })}

              <Pressable
                onPress={handleSave}
                style={[styles.saveButton, { backgroundColor: theme.text }]}
              >
                <ThemedText style={[styles.saveButtonText, { color: theme.background }]}>
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </ThemedText>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  addButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  listContent: {
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardAlert: {
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  tableWrapper: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: '#cccccc',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eeeeee',
  },
  rowVencido: {
    backgroundColor: '#fef2f2',
  },
  colCodigo: {
    width: 55,
    fontSize: 12,
    fontWeight: '600',
    paddingRight: Spacing.one,
  },
  colNome: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingRight: Spacing.one,
  },
  colEstoque: {
    width: 60,
    fontSize: 12,
    textAlign: 'right',
    paddingRight: Spacing.one,
  },
  colCusto: {
    width: 65,
    fontSize: 12,
    textAlign: 'right',
    paddingRight: Spacing.one,
  },
  colValidade: {
    width: 70,
    fontSize: 11,
    textAlign: 'right',
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalSafe: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  modalTitle: {
    fontSize: 28,
    lineHeight: 32,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  fieldLabel: {
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.half,
  },
  rowFields: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  halfField: {
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  saveButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
