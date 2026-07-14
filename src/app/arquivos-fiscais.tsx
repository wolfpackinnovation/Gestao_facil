import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { DateNavigator } from '@/components/date-navigator';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { createFiscalDocument, listFiscalDocuments } from '@/services/fiscal-document-service';
import { formatCurrency } from '@/utils/format';
import { parseNFeXML } from '@/utils/parse-nfe-xml';
import type { FiscalDocument } from '@/types/schema';

const light = {
  bg: '#F8F9FB',
  card: '#FFFFFF',
  primary: '#C4956A',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
};

const dark = {
  bg: '#161616',
  card: '#1F1F1F',
  primary: '#C4956A',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: '#2D2D2D',
};

const FILTERS = ['Todos', 'Entradas', 'Saídas', 'XML', 'PDF'];

function docIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type.includes('Entrada')) return 'document-text-outline';
  if (type.includes('Venda')) return 'receipt-outline';
  if (type.includes('Devolução')) return 'return-down-back-outline';
  return 'document-outline';
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

export default function ArquivosFiscaisScreen() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? dark : light;
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const changeMonth = useCallback((delta: number) => {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }, []);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  const fabAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const docs = await listFiscalDocuments(companyId);
    setDocuments(docs);
    setLoading(false);
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const toggleFab = () => {
    const toValue = fabOpen ? 0 : 1;
    Animated.spring(fabAnim, {
      toValue,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
    setFabOpen(!fabOpen);
  };

  const fabRotate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const handleImportXML = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/xml',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file?.name?.toLowerCase().endsWith('.xml')) {
        Alert.alert('Formato inválido', 'Selecione um arquivo XML válido.');
        return;
      }
      const response = await fetch(file.uri);
      const xmlContent = await response.text();
      const parsed = parseNFeXML(xmlContent);
      if (!parsed) {
        Alert.alert('Erro', 'Não foi possível interpretar o XML. Verifique se é uma NF-e válida.');
        return;
      }
      await createFiscalDocument({
        companyId,
        type: parsed.type,
        party: parsed.party,
        value: parsed.value,
        date: parsed.date,
        number: parsed.number,
        status: parsed.status,
        status2: '',
        entrada: parsed.entrada,
        fileName: file.name,
        notes: `Importado de ${file.name}`,
      });
      Alert.alert('Sucesso', `Documento ${parsed.number} importado com sucesso.`);
      loadData();
    } catch {
      Alert.alert('Erro', 'Falha ao importar o arquivo XML.');
    }
  }, [companyId, loadData]);

  const handleImportPDF = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file?.name?.toLowerCase().endsWith('.pdf')) {
        Alert.alert('Formato inválido', 'Selecione um arquivo PDF válido.');
        return;
      }
      await createFiscalDocument({
        companyId,
        type: 'Documento PDF',
        party: '—',
        value: 0,
        date: new Date().toISOString().split('T')[0],
        number: file.name.replace(/\.pdf$/i, ''),
        status: 'PDF disponível',
        status2: '',
        entrada: false,
        fileName: file.name,
        notes: `Importado de ${file.name}`,
      });
      Alert.alert('Sucesso', `PDF "${file.name}" importado com sucesso.`);
      loadData();
    } catch {
      Alert.alert('Erro', 'Falha ao importar o arquivo PDF.');
    }
  }, [companyId, loadData]);

  const handleScanQR = useCallback(() => {
    router.push('/escanear-qr-fiscal');
  }, [router]);

  const handleAddManually = useCallback(() => {
    router.push('/adicionar-documento-fiscal');
  }, [router]);

  const fabActions = [
    { icon: 'document-outline' as const, label: 'Importar XML', onPress: handleImportXML },
    { icon: 'document-attach-outline' as const, label: 'Importar PDF', onPress: handleImportPDF },
    { icon: 'qr-code-outline' as const, label: 'Escanear QR Code', onPress: handleScanQR },
    { icon: 'create-outline' as const, label: 'Adicionar manualmente', onPress: handleAddManually },
  ];

  const filtered = documents.filter((doc) => {
    const q = search.toLowerCase();
    if (q && !doc.type.toLowerCase().includes(q) && !doc.party.toLowerCase().includes(q) && !doc.number.includes(q)) return false;
    if (activeFilter === 'Entradas' && !doc.entrada) return false;
    if (activeFilter === 'Saídas' && doc.entrada) return false;
    if (activeFilter === 'XML' && doc.status !== 'XML disponível') return false;
    if (activeFilter === 'PDF' && doc.status2 !== 'PDF disponível') return false;
    return true;
  });

  const totalArquivos = documents.length;
  const entradas = documents.filter((d) => d.entrada).length;
  const saidas = documents.filter((d) => !d.entrada).length;

  const lastImport = documents.length > 0
    ? `Hoje • 09:32`
    : '—';

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: c.bg }]}>
        <Loading />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <DateNavigator selectedDate={referenceDate} onDateChange={changeMonth} mode="month" />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: c.text }]}>Arquivos Fiscais</Text>
              <Text style={[styles.headerSub, { color: c.textSecondary }]}>
                Gerencie notas fiscais, XMLs e PDFs do estabelecimento.
              </Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: c.card }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIconWrap, { backgroundColor: `${c.primary}15` }]}>
                  <Ionicons name="document-text-outline" size={18} color={c.primary} />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>Total de arquivos</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{totalArquivos}</Text>
                </View>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIconWrap, { backgroundColor: '#22C55E20' }]}>
                  <Ionicons name="arrow-down-outline" size={18} color="#22C55E" />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>Entradas</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{entradas}</Text>
                </View>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIconWrap, { backgroundColor: '#EF444420' }]}>
                  <Ionicons name="arrow-up-outline" size={18} color="#EF4444" />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>Saídas</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{saidas}</Text>
                </View>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIconWrap, { backgroundColor: `${c.primary}15` }]}>
                  <Ionicons name="time-outline" size={18} color={c.primary} />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>Última importação</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{lastImport}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: c.card }]}>
            <Ionicons name="search-outline" size={18} color={c.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: c.text }]}
              placeholder="Buscar por número, fornecedor ou cliente..."
              placeholderTextColor={c.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === f ? c.primary : 'transparent',
                    borderColor: activeFilter === f ? c.primary : c.border,
                  },
                ]}
                onPress={() => setActiveFilter(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: activeFilter === f ? '#FFFFFF' : c.textSecondary },
                  ]}
                >
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={c.textSecondary} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>Nenhum documento</Text>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                Importe notas fiscais ou adicione manualmente.
              </Text>
            </View>
          ) : (
            filtered.map((doc) => (
              <View key={doc.id} style={[styles.docCard, { backgroundColor: c.card }]}>
                <View style={styles.docCardTop}>
                  <View style={styles.docLeft}>
                    <View style={[styles.docIconWrap, { backgroundColor: `${c.primary}15` }]}>
                      <Ionicons name={docIcon(doc.type)} size={20} color={c.primary} />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={[styles.docType, { color: c.text }]}>{doc.type}</Text>
                      <Text style={[styles.docParty, { color: c.textSecondary }]}>{doc.party}</Text>
                    </View>
                  </View>
                  <View style={styles.docRight}>
                    <Text style={[styles.docValue, { color: c.text }]}>{formatCurrency(doc.value)}</Text>
                  </View>
                </View>
                <View style={styles.docCardBottom}>
                  <View style={styles.docMeta}>
                    <Text style={[styles.docDate, { color: c.textSecondary }]}>
                      {formatDateBR(doc.date)}
                    </Text>
                    <View style={styles.docDot} />
                    <Text style={[styles.docNumber, { color: c.textSecondary }]}>
                      Nº {doc.number}
                    </Text>
                  </View>
                  <View style={styles.docStatusRow}>
                    {doc.status && (
                      <View style={[styles.statusBadge, { backgroundColor: `${doc.status.includes('disponível') ? '#22C55E' : '#F59E0B'}20` }]}>
                        <Text style={[styles.statusText, { color: doc.status.includes('disponível') ? '#22C55E' : '#F59E0B' }]}>
                          {doc.status}
                        </Text>
                      </View>
                    )}
                    {doc.status2 && (
                      <View style={[styles.statusBadge, { backgroundColor: `${doc.status2.includes('disponível') ? '#22C55E' : '#F59E0B'}20` }]}>
                        <Text style={[styles.statusText, { color: doc.status2.includes('disponível') ? '#22C55E' : '#F59E0B' }]}>
                          {doc.status2}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    style={styles.docMenu}
                    onPress={() => setMenuOpenId(menuOpenId === doc.id ? null : doc.id ?? null)}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={c.textSecondary} />
                  </Pressable>
                </View>

                {menuOpenId === doc.id && (
                  <View style={[styles.docMenuDropdown, { backgroundColor: c.card, borderColor: c.border }]}>
                    <Pressable style={styles.docMenuOption}>
                      <Ionicons name="eye-outline" size={16} color={c.text} />
                      <Text style={[styles.docMenuOptionText, { color: c.text }]}>Visualizar</Text>
                    </Pressable>
                    <Pressable style={styles.docMenuOption}>
                      <Ionicons name="download-outline" size={16} color={c.text} />
                      <Text style={[styles.docMenuOptionText, { color: c.text }]}>Baixar XML</Text>
                    </Pressable>
                    <Pressable style={styles.docMenuOption}>
                      <Ionicons name="print-outline" size={16} color={c.text} />
                      <Text style={[styles.docMenuOptionText, { color: c.text }]}>Imprimir DANFE</Text>
                    </Pressable>
                    <Pressable style={styles.docMenuOption}>
                      <Ionicons name="share-outline" size={16} color={c.text} />
                      <Text style={[styles.docMenuOptionText, { color: c.text }]}>Compartilhar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <View style={styles.fabContainer}>
        {fabOpen && (
          <View style={[styles.fabOptionsList, { backgroundColor: c.card, borderColor: c.border }]}>
            {fabActions.map((opt, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.fabOption,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  setFabOpen(false);
                  opt.onPress();
                }}
              >
                <Ionicons name={opt.icon} size={18} color={c.text} />
                <Text style={[styles.fabOptionLabel, { color: c.text }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          onPress={toggleFab}
          style={[styles.fab, { backgroundColor: c.primary }]}
        >
          <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </Animated.View>
        </Pressable>
      </View>
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
    gap: Spacing.two,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  headerLeft: {
    flex: 1,
    gap: Spacing.one,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextWrap: {
    gap: 2,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    padding: 0,
  },
  filtersRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.half,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  docCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  docCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    gap: 2,
    flex: 1,
  },
  docType: {
    fontSize: 15,
    fontWeight: '600',
  },
  docParty: {
    fontSize: 13,
    fontWeight: '400',
  },
  docRight: {
    alignItems: 'flex-end',
  },
  docValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  docCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  docDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(128,128,128,0.4)',
  },
  docNumber: {
    fontSize: 12,
    fontWeight: '500',
  },
  docStatusRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  docMenu: {
    padding: Spacing.one,
  },
  docMenuDropdown: {
    position: 'absolute',
    right: Spacing.three,
    top: 50,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.one,
    gap: 2,
    zIndex: 10,
    minWidth: 180,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  docMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
  },
  docMenuOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: Spacing.four,
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#C4956A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fabOptionsList: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.one,
    gap: 2,
    marginBottom: Spacing.two,
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fabOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
  },
  fabOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
