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
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import {
  formatCurrency,
} from '@/services/estoque-storage';
import {
  getDesossas,
  createDesossa,
  deleteDesossa,
  getCortesPorTipo,
  type DesossaRecord,
  type DesossaItem,
} from '@/services/desossa-service';

const TIPOS_ANIMAL = [
  { id: 'boi', label: 'Boi', emoji: '🐂' },
  { id: 'porco', label: 'Porco', emoji: '🐖' },
  { id: 'frango', label: 'Frango', emoji: '🐔' },
  { id: 'outro', label: 'Outro', emoji: '🐄' },
];

interface CorteForm {
  nome: string
  peso: string
  custo: string
  margemLucro: string
  quebra: string
  dataValidade: string
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
  const [desossas, setDesossas] = useState<DesossaRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<'tipo' | 'cortes' | 'confirm'>('tipo');

  const [tipoAnimal, setTipoAnimal] = useState('boi');
  const [animalNome, setAnimalNome] = useState('');
  const [cortes, setCortes] = useState<CorteForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!companyId) return;
    const d = await getDesossas(companyId);
    setDesossas(d);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  function openNew() {
    setStep('tipo');
    setTipoAnimal('boi');
    setAnimalNome('');
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
        custo: '',
        margemLucro: '',
        quebra: '',
        dataValidade: '',
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
    setCortes((prev) => [...prev, { nome: '', peso: '', custo: '', margemLucro: '', quebra: '', dataValidade: '' }]);
  }

  function removeCorte(index: number) {
    setCortes((prev) => prev.filter((_, i) => i !== index));
  }

  function calcPrecoCorte(corte: CorteForm): number {
    const custo = Number(corte.custo);
    if (!custo || custo <= 0) return 0;
    const margem = Number(corte.margemLucro) || 0;
    const quebra = Number(corte.quebra) || 0;
    const custoAjustado = custo * (1 + quebra / 100);
    return Math.round(custoAjustado * (1 + margem / 100) * 100) / 100;
  }

  function validateCortes(): boolean {
    const newErrors: Record<string, string> = {};
    if (tipoAnimal === 'outro' && !animalNome.trim())
      newErrors.animalNome = 'Informe o tipo de animal';
    cortes.forEach((c, i) => {
      if (!c.peso || isNaN(Number(c.peso)) || Number(c.peso) < 0)
        newErrors[`${i}_peso`] = 'Inválido';
      if (!c.nome.trim()) newErrors[`${i}_nome`] = 'Obrigatório';
      if (!c.custo || isNaN(Number(c.custo)) || Number(c.custo) <= 0)
        newErrors[`${i}_custo`] = 'Informe o custo';
      if (!c.margemLucro || isNaN(Number(c.margemLucro)) || Number(c.margemLucro) < 0)
        newErrors[`${i}_margemLucro`] = 'Informe a margem';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function goToConfirm() {
    if (validateCortes()) setStep('confirm');
  }

  async function handleSave() {
    if (!validateCortes()) return;

    const items = cortes
      .filter((c) => Number(c.peso) > 0)
      .map((c) => ({
        nome: c.nome.trim(),
        peso: Number(c.peso),
        custo: Number(c.custo),
        precoVenda: calcPrecoCorte(c),
        dataValidade: c.dataValidade || new Date().toLocaleDateString('pt-BR'),
      }));

    if (items.length === 0) {
      Alert.alert('Aviso', 'Adicione pelo menos um corte com peso maior que zero.');
      return;
    }

    const pesoTotal = items.reduce((s, i) => s + i.peso, 0);
    const custoTotal = items.reduce((s, i) => s + i.custo, 0);

    try {
      const nome = animalNome.trim() || `${TIPOS_ANIMAL.find((t) => t.id === tipoAnimal)?.label ?? ''} ${new Date().toLocaleDateString('pt-BR')}`;
      await createDesossa(
        companyId,
        tipoAnimal,
        nome,
        pesoTotal,
        custoTotal,
        items
      );
      await loadData();
      closeModal();
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível realizar a desossa.');
    }
  }

  function confirmDelete(record: DesossaRecord) {
    Alert.alert(
      'Excluir Desossa',
      `Deseja excluir a desossa de "${record.animalNome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteDesossa(record.id);
            await loadData();
          },
        },
      ]
    );
  }

  const totalPeso = (items: DesossaItem[]) =>
    items.reduce((sum, i) => sum + i.peso, 0);

  const totalCusto = (items: DesossaItem[]) =>
    items.reduce((sum, i) => sum + i.custo, 0);

  const tipoLabel = (tipo: string) =>
    TIPOS_ANIMAL.find((t) => t.id === tipo)?.label ?? tipo;

  function renderDesossa({ item }: { item: DesossaRecord }) {
    return (
      <Pressable
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

        <ThemedView style={styles.cardItems}>
          {item.items.map((piece, idx) => (
            <ThemedView key={idx} style={styles.cardItemRow}>
              <ThemedText style={styles.cardItemNome} numberOfLines={1}>
                {piece.nome}
              </ThemedText>
              <ThemedText style={styles.cardItemPeso}>
                {piece.peso}kg
              </ThemedText>
              <ThemedText style={styles.cardItemCusto}>
                {formatCurrency(piece.custo)}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>

        <ThemedView style={styles.cardFooter}>
          <ThemedText type="small" themeColor="textSecondary">
            {item.items.length} cortes • Total: {totalPeso(item.items).toFixed(2)}kg
          </ThemedText>
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
            { color: theme.text, backgroundColor: theme.background },
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.header}>
          <Pressable onPress={openNew} style={[styles.addButton, { backgroundColor: theme.text }]}>
            <ThemedText style={[styles.addButtonText, { color: theme.background }]}>
              + Nova Desossa
            </ThemedText>
          </Pressable>
        </ThemedView>

        {desossas.length === 0 ? (
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
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {step === 'cortes' && tipoAnimal === 'outro' && (
                  renderInput('Tipo de Animal *', 'animalNome', animalNome, setAnimalNome, {
                    placeholder: 'Ex: Carneiro, Cabrito',
                  })
                )}

                {step === 'cortes' && (
                  <>
                    <ThemedText type="default" themeColor="textSecondary" style={styles.cortesHint}>
                      Informe o peso (kg) de cada corte obtido:
                    </ThemedText>

                    {cortes.map((corte, idx) => (
                      <ThemedView
                        key={idx}
                        style={styles.corteCard}
                      >
                        <ThemedView style={styles.corteHeader}>
                          <ThemedText type="smallBold">{corte.nome}</ThemedText>
                        </ThemedView>

                        <ThemedView style={styles.corteRow}>
                          <ThemedView style={styles.corteHalfField}>
                            <ThemedText type="smallBold" style={styles.fieldLabel}>Peso (kg)</ThemedText>
                            <TextInput
                              style={[
                                styles.input,
                                { color: theme.text, backgroundColor: theme.background },
                                errors[`${idx}_peso`] && styles.inputError,
                              ]}
                              value={corte.peso}
                              onChangeText={(v) => updateCorte(idx, 'peso', v)}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={theme.textSecondary}
                            />
                            {errors[`${idx}_peso`] && (
                              <ThemedText type="small" style={{ color: '#ef4444' }}>
                                {errors[`${idx}_peso`]}
                              </ThemedText>
                            )}
                          </ThemedView>
                          <ThemedView style={styles.corteHalfField}>
                            <ThemedText type="smallBold" style={styles.fieldLabel}>Custo (R$) *</ThemedText>
                            <TextInput
                              style={[
                                styles.input,
                                { color: theme.text, backgroundColor: theme.background },
                                errors[`${idx}_custo`] && styles.inputError,
                              ]}
                              value={corte.custo}
                              onChangeText={(v) => updateCorte(idx, 'custo', v)}
                              keyboardType="decimal-pad"
                              placeholder="Ex: 25"
                              placeholderTextColor={theme.textSecondary}
                            />
                            {errors[`${idx}_custo`] && (
                              <ThemedText type="small" style={{ color: '#ef4444' }}>
                                {errors[`${idx}_custo`]}
                              </ThemedText>
                            )}
                          </ThemedView>
                        </ThemedView>

                        <ThemedView style={styles.corteRow}>
                          <ThemedView style={styles.corteHalfField}>
                            <ThemedText type="smallBold" style={styles.fieldLabel}>Margem (%) *</ThemedText>
                            <TextInput
                              style={[
                                styles.input,
                                { color: theme.text, backgroundColor: theme.background },
                                errors[`${idx}_margemLucro`] && styles.inputError,
                              ]}
                              value={corte.margemLucro}
                              onChangeText={(v) => updateCorte(idx, 'margemLucro', v)}
                              keyboardType="decimal-pad"
                              placeholder="Ex: 30"
                              placeholderTextColor={theme.textSecondary}
                            />
                            {errors[`${idx}_margemLucro`] && (
                              <ThemedText type="small" style={{ color: '#ef4444' }}>
                                {errors[`${idx}_margemLucro`]}
                              </ThemedText>
                            )}
                          </ThemedView>
                          <ThemedView style={styles.corteHalfField}>
                            <ThemedText type="smallBold" style={styles.fieldLabel}>Quebra (%)</ThemedText>
                            <TextInput
                              style={[
                                styles.input,
                                { color: theme.text, backgroundColor: theme.background },
                              ]}
                              value={corte.quebra}
                              onChangeText={(v) => updateCorte(idx, 'quebra', v)}
                              keyboardType="decimal-pad"
                              placeholder="Ex: 5"
                              placeholderTextColor={theme.textSecondary}
                            />
                          </ThemedView>
                        </ThemedView>

                        <ThemedView style={styles.fieldGroup}>
                          <ThemedText type="smallBold" style={styles.fieldLabel}>Preço de Venda (R$)</ThemedText>
                          <ThemedView
                            style={[
                              styles.input,
                              {
                                backgroundColor: theme.backgroundElement,
                                justifyContent: 'center',
                                borderWidth: 0,
                              },
                            ]}
                          >
                            <ThemedText type="default" style={{ fontWeight: '600' }}>
                              {formatCurrency(calcPrecoCorte(corte))}
                            </ThemedText>
                          </ThemedView>
                        </ThemedView>

                        <ThemedView style={styles.fieldGroup}>
                          <ThemedText type="smallBold" style={styles.fieldLabel}>Validade</ThemedText>
                          <TextInput
                            style={[
                              styles.input,
                              { color: theme.text, backgroundColor: theme.background },
                            ]}
                            value={corte.dataValidade}
                            onChangeText={(v) => {
                              const digits = v.replace(/\D/g, '').slice(0, 8);
                              const parts: string[] = [];
                              if (digits.length > 0) parts.push(digits.slice(0, 2));
                              if (digits.length > 2) parts.push(digits.slice(2, 4));
                              if (digits.length > 4) parts.push(digits.slice(4, 8));
                              updateCorte(idx, 'dataValidade', parts.join('/'));
                            }}
                            placeholder="DD/MM/AAAA"
                            placeholderTextColor={theme.textSecondary}
                          />
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

                    {cortes.length > 0 && (() => {
                      const totalPeso = cortes.reduce((s, c) => s + (Number(c.peso) || 0), 0);
                      const totalCusto = cortes.reduce((s, c) => s + (Number(c.custo) || 0), 0);
                      const totalVenda = cortes.reduce((s, c) => s + calcPrecoCorte(c), 0);
                      const totalGanho = totalVenda - totalCusto;
                      return (
                        <ThemedView style={styles.somaRow}>
                          <ThemedText type="default" style={{ fontWeight: '700' }}>
                            {totalPeso.toFixed(2)}kg
                          </ThemedText>
                          <ThemedText type="default" style={{ fontWeight: '700' }}>
                            Custo: {formatCurrency(totalCusto)}
                          </ThemedText>
                          <ThemedText type="default" style={{ fontWeight: '700' }}>
                            Venda: {formatCurrency(totalVenda)}
                          </ThemedText>
                          <ThemedText type="default" style={{ fontWeight: '700', color: '#22c55e' }}>
                            Lucro Previsto: {formatCurrency(totalGanho)}
                          </ThemedText>
                        </ThemedView>
                      );
                    })()}

                    <Pressable onPress={goToConfirm} style={[styles.primaryButton, { backgroundColor: theme.text }]}>
                      <ThemedText style={[styles.primaryButtonText, { color: theme.background }]}>
                        Revisar Desossa
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
                      const totalPeso = cortes.reduce((s, c) => s + (Number(c.peso) || 0), 0);
                      const totalCusto = cortes.reduce((s, c) => s + (Number(c.custo) || 0), 0);
                      const totalVenda = cortes.reduce((s, c) => s + calcPrecoCorte(c), 0);
                      const totalGanho = totalVenda - totalCusto;
                      return (
                        <ThemedView style={styles.confirmCard}>
                          <ThemedText type="smallBold">{tipoLabel(tipoAnimal)}</ThemedText>
                          <ThemedText type="default">{animalNome || 'Sem identificação'}</ThemedText>
                          <ThemedView style={styles.totaisRow}>
                            <ThemedText type="default" style={{ fontWeight: '700' }}>
                              {totalPeso.toFixed(2)}kg
                            </ThemedText>
                            <ThemedText type="default">
                              Custo: {formatCurrency(totalCusto)}
                            </ThemedText>
                            <ThemedText type="default">
                              Venda: {formatCurrency(totalVenda)}
                            </ThemedText>
                            <ThemedText type="default" style={{ fontWeight: '700', color: '#22c55e' }}>
                              Lucro Previsto: {formatCurrency(totalGanho)}
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
                            <ThemedText type="small" themeColor="textSecondary">
                              Custo: {formatCurrency(Number(corte.custo))}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              Venda: {formatCurrency(calcPrecoCorte(corte))}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {corte.dataValidade || '—'}
                            </ThemedText>
                          </ThemedView>
                        </ThemedView>
                      ))}

                    <Pressable onPress={handleSave} style={[styles.primaryButton, { backgroundColor: theme.text }]}>
                      <ThemedText style={[styles.primaryButtonText, { color: theme.background }]}>
                        Finalizar Desossa
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </ScrollView>
            )}
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
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  cardMeta: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  cardPeso: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardItems: {
    gap: Spacing.half,
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  cardItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardItemNome: {
    flex: 1,
    fontSize: 14,
  },
  cardItemPeso: {
    width: 60,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '500',
  },
  cardItemCusto: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: Spacing.two,
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
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  stepHint: {
    marginBottom: Spacing.one,
  },
  tipoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  tipoEmoji: {
    fontSize: 36,
  },
  // Dados step
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
    fontSize: 12,
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
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  primaryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  // Dados resumo
  // Cortes step
  cortesHint: {
    marginBottom: Spacing.one,
  },
  corteCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  corteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  corteRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  corteHalfField: {
    flex: 1,
  },
  addCorteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addCorteText: {
    fontWeight: '600',
    fontSize: 15,
  },
  somaRow: {
    gap: Spacing.half,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  // Confirm step
  confirmSubtitle: {
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  confirmCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  confirmItem: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  confirmItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totaisRow: {
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
});
