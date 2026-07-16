import { useState, useCallback, useEffect } from 'react';
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
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import {
  formatCurrency,
  getProdutos,
  saveProduto,
  type Produto,
} from '@/services/estoque-storage';
import { formatCurrencyInput, parseCurrencyInput } from '@/utils/format';
import {
  getDesossas,
  createDesossa,
  updateDesossa,
  deleteDesossa,
  getCortesPorTipo,
  type DesossaRecord,
  type DesossaItem,
} from '@/services/desossa-service';
import { createDespesa, getDespesas, deleteDespesa } from '@/services/despesa-service';
import { createLote, listAllLotesByProduct, gerarCodigoLote } from '@/services/lote-service';

const TIPOS_ANIMAL = [
  { id: 'boi', label: 'Boi', emoji: '🐂' },
  { id: 'porco', label: 'Porco', emoji: '🐖' },
  { id: 'frango', label: 'Frango', emoji: '🐔' },
  { id: 'outro', label: 'Outro', emoji: '🐄' },
];

interface CorteForm {
  nome: string
  peso: string
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export default function CortesScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editId?: string }>();
  const [desossas, setDesossas] = useState<DesossaRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<'tipo' | 'cortes' | 'confirm'>('tipo');

  const [tipoAnimal, setTipoAnimal] = useState('boi');
  const [animalNome, setAnimalNome] = useState('');
  const [pesoAnimal, setPesoAnimal] = useState('');
  const [valorAnimal, setValorAnimal] = useState('');
  const [cortes, setCortes] = useState<CorteForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (params.editId && desossas.length > 0) {
      const record = desossas.find((d) => d.id === params.editId);
      if (record) openEdit(record);
    }
  }, [params.editId, desossas]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const d = await getDesossas(companyId);
    setDesossas(d);
    setLoading(false);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  function openNew() {
    setEditingId(null);
    setStep('tipo');
    setTipoAnimal('boi');
    setAnimalNome('');
    setPesoAnimal('');
    setValorAnimal('');
    setCortes([]);
    setErrors({});
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
  }

  function selectTipo(id: string) {
    setTipoAnimal(id);
    setAnimalNome('');
    setErrors({});
    const padroes = getCortesPorTipo(id);
    setCortes(
      padroes.map((c) => ({
        nome: c.nome,
        peso: '',
      }))
    );
    setStep('cortes');
  }

  function updateCorte(index: number, field: keyof CorteForm, value: string) {
    setCortes((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    const key = `${index}_${field}`;
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  }

  function addCustomCorte() {
    setCortes((prev) => [...prev, { nome: '', peso: '' }]);
  }

  function removeCorte(index: number) {
    setCortes((prev) => prev.filter((_, i) => i !== index));
  }

  function validateCortes(): boolean {
    const newErrors: Record<string, string> = {};
    if (!pesoAnimal || isNaN(Number(pesoAnimal)) || Number(pesoAnimal) <= 0)
      newErrors.pesoAnimal = 'Informe o peso total';
    if (!valorAnimal || parseCurrencyInput(valorAnimal) <= 0)
      newErrors.valorAnimal = 'Informe o valor pago';
    cortes.forEach((c, i) => {
      if (!c.peso || isNaN(Number(c.peso)) || Number(c.peso) < 0)
        newErrors[`${i}_peso`] = 'Inválido';
      if (!c.nome.trim()) newErrors[`${i}_nome`] = 'Obrigatório';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function goToConfirm() {
    if (validateCortes()) setStep('confirm');
  }

  async function criarProdutosELotesDaDesossa(nomeAnimal: string, items: { nome: string; peso: number; custo: number }[]) {
    const produtosExistentes = await getProdutos(companyId)
    const categoria = tipoAnimal === 'boi' ? 'Carnes' : tipoAnimal === 'porco' ? 'Carnes' : tipoAnimal === 'frango' ? 'Aves' : 'Outros'
    const hoje = new Date()
    const validade = new Date(hoje)
    validade.setDate(validade.getDate() + 30)
    const dataValidade = `${String(validade.getDate()).padStart(2, '0')}/${String(validade.getMonth() + 1).padStart(2, '0')}/${validade.getFullYear()}`
    const dataEntrada = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
    const fornecedorRef = animalNome.trim() || nomeAnimal

    for (const item of items) {
      if (item.peso <= 0) continue
      let produto = produtosExistentes.find(p => p.nome.toLowerCase() === item.nome.toLowerCase())
      if (!produto) {
        const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        const codigo = 'P' + String(produtosExistentes.length + 1).padStart(3, '0')
        const novoProduto: Produto = {
          id,
          companyId,
          codigo,
          nome: item.nome,
          categoria,
          unidade: 'kg',
          quantidade: 1,
          custo: item.custo / item.peso,
          precoVenda: (item.custo / item.peso) * 1.3,
          estoqueMinimo: 0,
          dataValidade,
          fornecedor: fornecedorRef,
          createdAt: new Date().toISOString(),
        }
        await saveProduto(novoProduto)
        produto = novoProduto
        produtosExistentes.push(novoProduto)
      }

      const lotesExistentes = await listAllLotesByProduct(produto.id)
      const codigosExistentes = lotesExistentes.map(l => l.codigo)
      const codigoLote = gerarCodigoLote(codigosExistentes, `L${animalNome.replace(/\s/g, '').slice(0, 3).toUpperCase() || 'LT'}`)
      await createLote({
        companyId,
        productId: produto.id,
        codigo: codigoLote,
        quantidadeInicial: item.peso,
        custoUnitario: item.custo / item.peso,
        dataValidade,
        dataEntrada,
        fornecedor: fornecedorRef,
        observacao: `Desossa ${nomeAnimal}`,
        origem: `desossa:${nomeAnimal}`,
      })
    }
  }

  async function handleSave() {
    if (saving) return;
    if (!validateCortes()) return;
    setSaving(true);

    const pesoTotalAnimal = Number(pesoAnimal);
    const valorTotalAnimal = parseCurrencyInput(valorAnimal);
    const custoMedioKg = valorTotalAnimal / pesoTotalAnimal;

    const items = cortes
      .filter((c) => Number(c.peso) > 0)
      .map((c) => {
        const peso = Number(c.peso);
        const custo = peso * custoMedioKg;
        return {
          nome: c.nome.trim(),
          peso,
          custo: Math.round(custo * 100) / 100,
          precoVenda: 0,
          dataValidade: '',
        };
      });

    if (items.length === 0) {
      Alert.alert('Aviso', 'Adicione pelo menos um corte com peso maior que zero.');
      return;
    }

    const pesoDistribuido = items.reduce((s, i) => s + i.peso, 0);
    const custoTotal = items.reduce((s, i) => s + i.custo, 0);

    try {
      const nome = animalNome.trim() || `${TIPOS_ANIMAL.find((t) => t.id === tipoAnimal)?.label ?? ''} ${new Date().toLocaleDateString('pt-BR')}`;

      if (editingId) {
        await updateDesossa(editingId, {
          animalNome: nome,
          pesoTotal: pesoDistribuido,
          custoTotal,
          items,
        });
        await loadData();
        closeModal();
        setSaving(false);
        router.replace('/cortes');
        Alert.alert('Desossa atualizada');
        return;
      }

      const desossaId = await createDesossa(
        companyId,
        tipoAnimal,
        nome,
        pesoDistribuido,
        custoTotal,
        items
      );

      await criarProdutosELotesDaDesossa(nome, items).catch((err) => {
        console.warn('Falha ao criar produtos/lotes da desossa:', err);
      });

      await loadData();
      closeModal();
      setSaving(false);

      Alert.alert(
        'Desossa salva',
        `Animal: ${nome}\nPeso: ${pesoTotalAnimal}kg\nValor: ${formatCurrency(valorTotalAnimal)}\n\nDeseja registrar esse valor como despesa?`,
        [
          { text: 'Não', style: 'cancel' },
          {
            text: 'Sim, registrar',
            onPress: async () => {
              try {
                await createDespesa({
                  companyId,
                  descricao: `Compra de ${nome}`,
                  valor: valorTotalAnimal,
                  categoria: 'Compra de Produtos',
                  data: new Date().toISOString().slice(0, 10),
                  observacao: `desossaId:${desossaId} | Desossa de ${tipoLabel(tipoAnimal)} - ${pesoTotalAnimal}kg`,
                  pago: true,
                });
                Alert.alert('Despesa registrada', `R$ ${valorTotalAnimal.toFixed(2)} em "Compra de Produtos"`);
              } catch {}
            },
          },
        ]
      );
      setSaving(false);
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Erro', err.message ?? 'Não foi possível realizar a desossa.');
    }
  }

  function openEdit(record: DesossaRecord) {
    setEditingId(record.id);
    setTipoAnimal(record.tipoAnimal);
    setAnimalNome(record.animalNome);
    setPesoAnimal(String(record.pesoTotal));
    setValorAnimal(formatCurrency(record.custoTotal));
    setCortes(
      record.items.map((i) => ({
        nome: i.nome,
        peso: String(i.peso),
      }))
    );
    setErrors({});
    setStep('cortes');
    setModalVisible(true);
  }

  function confirmDelete(record: DesossaRecord) {
    Alert.alert(
      'Desossa',
      `O que deseja fazer com "${record.animalNome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '✏️ Editar',
          onPress: () => openEdit(record),
        },
        {
          text: '🗑️ Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteDesossa(record.id);

            const despesas = await getDespesas(companyId);
            const linked = despesas.find((d) => d.observacao?.includes(`desossaId:${record.id}`));
            if (linked) {
              await deleteDespesa(linked.id);
            }

            await loadData();
          },
        },
      ]
    );
  }

  const tipoLabel = (tipo: string) =>
    TIPOS_ANIMAL.find((t) => t.id === tipo)?.label ?? tipo;

  function renderDesossa({ item }: { item: DesossaRecord }) {
    return (
      <Pressable
        onPress={() => router.push(`/desossa-detalhe?id=${item.id}` as any)}
        onLongPress={() => confirmDelete(item)}
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.7 },
        ]}
      >
        <ThemedView style={styles.cardHeader}>
          <ThemedView>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {formatDateBR(item.createdAt)} • {tipoLabel(item.tipoAnimal)}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              {item.animalNome}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.cardMeta}>
            <ThemedText style={styles.cardPeso}>
              {item.pesoTotal}kg
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatCurrency(item.custoTotal)}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Pressable>
    );
  }

  function renderInput(
    label: string,
    field: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { keyboardType?: 'default' | 'decimal-pad' | 'numeric'; placeholder?: string }
  ) {
    return (
      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="smallBold" style={styles.fieldLabel}>{label}</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement },
            errors[field] && styles.inputError,
          ]}
          value={value}
          onChangeText={onChange}
          placeholderTextColor={theme.textSecondary}
          placeholder={opts?.placeholder}
          keyboardType={opts?.keyboardType ?? 'default'}
        />
        {errors[field] && (
          <ThemedText type="small" style={{ color: '#ef4444' }}>{errors[field]}</ThemedText>
        )}
      </ThemedView>
    );
  }

  const LOSS_NAMES = ['osso', 'aparas', 'carcaça', 'pé', 'miúdos'];

  const pesoDistribuido = cortes.reduce((s, c) => s + (Number(c.peso) || 0), 0);
  const perdaCortes = cortes
    .filter((c) => LOSS_NAMES.some((name) => c.nome.toLowerCase().includes(name)))
    .reduce((s, c) => s + (Number(c.peso) || 0), 0);
  const pesoTotalAnimal = Number(pesoAnimal) || 0;
  const valorTotalAnimal = parseCurrencyInput(valorAnimal) || 0;
  const custoMedioKg = pesoTotalAnimal > 0 ? valorTotalAnimal / pesoTotalAnimal : 0;
  const kgFaltantes = Math.max(0, pesoTotalAnimal - pesoDistribuido);
  const perdaKg = perdaCortes + Math.max(0, kgFaltantes);
  const perdaPct = pesoTotalAnimal > 0 ? ((perdaKg / pesoTotalAnimal) * 100).toFixed(1) : '0';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <View style={[styles.topBar, { paddingTop: insets.top }]}>
          <Pressable onPress={() => router.back()} style={styles.topBackButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
          </Pressable>
          <ThemedText style={styles.topTitle}>Cortes</ThemedText>
          <View style={styles.topBackButton} />
        </View>

        <ThemedView style={styles.header}>
          <Pressable onPress={openNew} style={[styles.addButton, { backgroundColor: theme.primary }]}>
            <ThemedText style={[styles.addButtonText, { color: '#ffffff' }]}>
              + Nova Desossa
            </ThemedText>
          </Pressable>
        </ThemedView>

        {loading ? <Loading /> : desossas.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyEmoji}>✂️</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              Nenhuma desossa
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
              Registre a desossa de um animal em cortes.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={desossas}
            keyExtractor={(item) => item.id}
            renderItem={renderDesossa}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
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
              <Pressable
                  onPress={() => {
                    if (step === 'tipo') closeModal();
                    else if (step === 'cortes') setStep('tipo');
                    else setStep('cortes');
                  }}
              >
                <ThemedText type="default" themeColor="textSecondary">
                  {step === 'tipo' ? 'Cancelar' : 'Voltar'}
                </ThemedText>
              </Pressable>
              <ThemedText type="title" style={styles.modalTitle}>
                {step === 'tipo' ? 'Tipo de Animal' :
                 step === 'cortes' ? 'Cortes' : 'Confirmar'}
              </ThemedText>
              <ThemedView style={{ width: 50 }} />
            </ThemedView>

            {step === 'tipo' && (
              <ThemedView style={styles.stepContainer}>
                <ThemedText type="default" themeColor="textSecondary" style={styles.stepHint}>
                  Selecione o tipo de animal:
                </ThemedText>
                {TIPOS_ANIMAL.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => selectTipo(t.id)}
                    style={({ pressed }) => [
                      styles.tipoCard,
                        pressed && { opacity: 0.7 },
                    ]}
                  >
                    <ThemedText style={styles.tipoEmoji}>{t.emoji}</ThemedText>
                    <ThemedText type="subtitle">{t.label}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            )}

            {(step === 'cortes' || step === 'confirm') && (
              <>
                {step === 'cortes' && (
                  <ThemedView style={styles.cortesFixedTop}>
                    {renderInput('Identificação', 'animalNome', animalNome, setAnimalNome, {
                      placeholder: 'Ex: Boi 01, Lote 5',
                    })}

                    <ThemedText type="default" themeColor="textSecondary" style={styles.cortesHint}>
                      Informe os dados do animal inteiro:
                    </ThemedText>

                    <ThemedView style={styles.animalDataRow}>
                      <ThemedView style={styles.animalHalfField}>
                        {renderInput('Peso total (kg)', 'pesoAnimal', pesoAnimal, setPesoAnimal, {
                          keyboardType: 'decimal-pad',
                          placeholder: 'Ex: 250',
                        })}
                      </ThemedView>
                      <ThemedView style={styles.animalHalfField}>
                        {renderInput('Valor pago (R$)', 'valorAnimal', valorAnimal, (v) => setValorAnimal(formatCurrencyInput(v)), {
                          keyboardType: 'decimal-pad',
                          placeholder: 'Ex: 5.000',
                        })}
                      </ThemedView>
                    </ThemedView>

                    {pesoTotalAnimal > 0 && (
                      <ThemedView style={styles.summaryCard}>
                        <ThemedText style={styles.summaryTitle}>Resumo</ThemedText>
                        <ThemedView style={styles.summaryRow}>
                          <ThemedText type="small">Custo médio/kg</ThemedText>
                          <ThemedText type="small" style={{ fontWeight: '700' }}>
                            {formatCurrency(custoMedioKg)}
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.summaryRow}>
                          <ThemedText type="small">Peso distribuído</ThemedText>
                          <ThemedText type="small" style={{ fontWeight: '700' }}>
                            {pesoDistribuido.toFixed(2)}kg
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.summaryRow}>
                          <ThemedText type="small">Faltando distribuir</ThemedText>
                          <ThemedText type="small" style={{ fontWeight: '700', color: kgFaltantes > 0 ? '#f59e0b' : '#22c55e' }}>
                            {kgFaltantes.toFixed(2)}kg
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.summaryRow}>
                          <ThemedText type="small">Perda (ossos, aparas)</ThemedText>
                          <ThemedText type="small" style={{ fontWeight: '700', color: '#ef4444' }}>
                            {perdaKg.toFixed(2)}kg ({perdaPct}%)
                          </ThemedText>
                        </ThemedView>
                      </ThemedView>
                    )}
                  </ThemedView>
                )}

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                {step === 'cortes' && (
                  <>
                    <ThemedText type="default" themeColor="textSecondary" style={styles.cortesHint}>
                      Registre o peso (kg) de cada corte:
                    </ThemedText>

                    {cortes.map((corte, idx) => (
                      <ThemedView
                        key={idx}
                        style={styles.corteCard}
                      >
                        <ThemedView style={styles.corteHeader}>
                          <ThemedText type="smallBold">{corte.nome}</ThemedText>
                          {cortes.length > 1 && (
                            <Pressable onPress={() => removeCorte(idx)}>
                              <ThemedText type="small" style={{ color: '#ef4444' }}>Remover</ThemedText>
                            </Pressable>
                          )}
                        </ThemedView>

                        <ThemedView style={styles.corteRow}>
                          <ThemedView style={styles.corteFullField}>
                            <TextInput
                              style={[
                                styles.input,
                                { color: theme.text, backgroundColor: theme.backgroundElement },
                                errors[`${idx}_peso`] && styles.inputError,
                              ]}
                              value={corte.peso}
                              onChangeText={(v) => updateCorte(idx, 'peso', v)}
                              keyboardType="decimal-pad"
                              placeholder="Peso em kg"
                              placeholderTextColor={theme.textSecondary}
                            />
                            {errors[`${idx}_peso`] && (
                              <ThemedText type="small" style={{ color: '#ef4444' }}>
                                {errors[`${idx}_peso`]}
                              </ThemedText>
                            )}
                          </ThemedView>
                        </ThemedView>
                      </ThemedView>
                    ))}

                    <Pressable
                      onPress={addCustomCorte}
                      style={[styles.addCorteButton, { borderColor: theme.text }]}
                    >
                      <ThemedText style={[styles.addCorteText, { color: theme.text }]}>
                        + Adicionar Corte
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={editingId ? handleSave : goToConfirm}
                      disabled={saving}
                      style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: saving ? 0.5 : 1 }]}
                    >
                      <ThemedText style={[styles.primaryButtonText, { color: '#ffffff' }]}>
                        {saving ? 'Salvando...' : editingId ? 'Salvar Edição' : 'Revisar Desossa'}
                      </ThemedText>
                    </Pressable>
                  </>
                )}

                {step === 'confirm' && (
                  <>
                    <ThemedText type="default" style={styles.confirmSubtitle}>
                      Revise os dados antes de finalizar:
                    </ThemedText>

                    {(() => {
                      const custoMedio = pesoTotalAnimal > 0 ? valorTotalAnimal / pesoTotalAnimal : 0;
                      const confPesoVenda = cortes
                        .filter((c) => !LOSS_NAMES.some((name) => c.nome.toLowerCase().includes(name)))
                        .reduce((s, c) => s + (Number(c.peso) || 0), 0);
                      const confPerdaCortes = cortes
                        .filter((c) => LOSS_NAMES.some((name) => c.nome.toLowerCase().includes(name)))
                        .reduce((s, c) => s + (Number(c.peso) || 0), 0);
                      return (
                        <ThemedView style={styles.confirmCard}>
                          <ThemedText type="smallBold">{tipoLabel(tipoAnimal)}</ThemedText>
                          <ThemedText type="default">{animalNome || 'Sem identificação'}</ThemedText>
                          <ThemedView style={styles.totaisRow}>
                            <ThemedText type="default" style={{ fontWeight: '700' }}>
                              {pesoTotalAnimal}kg
                            </ThemedText>
                            <ThemedText type="default">
                              Valor: {formatCurrency(valorTotalAnimal)}
                            </ThemedText>
                            <ThemedText type="default">
                              Custo médio: {formatCurrency(custoMedio)}/kg
                            </ThemedText>
                          </ThemedView>
                          <ThemedView style={styles.totaisRow}>
                            <ThemedText type="small" themeColor="textSecondary">
                              Carne: {confPesoVenda.toFixed(2)}kg
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              Perda: {perdaKg.toFixed(2)}kg ({perdaPct}%)
                            </ThemedText>
                          </ThemedView>
                        </ThemedView>
                      );
                    })()}

                    {cortes
                      .filter((c) => Number(c.peso) > 0)
                      .map((corte, idx) => (
                        <ThemedView
                          key={idx}
                          style={styles.confirmItem}
                        >
                          <ThemedText type="default" style={{ fontWeight: '600' }}>{corte.nome}</ThemedText>
                          <ThemedView style={styles.confirmItemRow}>
                            <ThemedText type="small" themeColor="textSecondary">
                              {corte.peso}kg
                            </ThemedText>
                          </ThemedView>
                        </ThemedView>
                      ))}

                    <ThemedView style={styles.confirmButtons}>
                      <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: saving ? 0.5 : 1 }]}
                      >
                        <ThemedText style={[styles.primaryButtonText, { color: '#ffffff' }]}>
                          {saving ? 'Salvando...' : 'Finalizar Desossa'}
                        </ThemedText>
                      </Pressable>
                    </ThemedView>
                  </>
                )}
              </ScrollView>
            </>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  topBackButton: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  addButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
  listContent: {
    gap: Spacing.three,
    paddingBottom: 100,
  },
  card: {
    padding: Spacing.three,
    borderRadius: 14,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: { fontSize: 20, lineHeight: 24 },
  cardMeta: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  cardPeso: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  modalContainer: { flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  stepContainer: { paddingHorizontal: Spacing.four, gap: Spacing.three, paddingTop: Spacing.four },
  stepHint: { textAlign: 'center', marginBottom: Spacing.half, fontSize: 14 },
  tipoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  tipoEmoji: { fontSize: 32 },
  cortesFixedTop: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingHorizontal: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  fieldGroup: { gap: Spacing.half },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  inputError: { borderColor: '#ef4444' },
  cortesHint: { marginBottom: 2, fontSize: 14 },
  animalDataRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  animalHalfField: {
    flex: 1,
  },
  summaryCard: {
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: Spacing.half,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  corteCard: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  corteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  corteRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  corteHalfField: { flex: 1 },
  corteFullField: { flex: 1 },
  addCorteButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(128,128,128,0.3)',
    borderRadius: 10,
    padding: Spacing.three,
    alignItems: 'center',
  },
  addCorteText: { fontWeight: '600', opacity: 0.7 },
  somaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: Spacing.two,
  },
  primaryButtonText: { fontWeight: '700', fontSize: 16 },
  confirmSubtitle: { textAlign: 'center', marginBottom: Spacing.two, fontSize: 14 },
  confirmCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  totaisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  confirmItem: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  confirmItemRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.half,
  },
  confirmButtons: {
    marginTop: Spacing.three,
  },
});
