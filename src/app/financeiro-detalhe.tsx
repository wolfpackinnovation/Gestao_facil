import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, Pressable, ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Loading } from '@/utils/loading';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/auth';
import { getSalesByDate, getAllSales } from '@/services/sale-service';
import { getDespesas, updateDespesa } from '@/services/despesa-service';
import { listClients } from '@/services/client-service';
import { getMaterials } from '@/services/material-service';
import { getProdutos } from '@/services/estoque-storage';
import { listAllLoteMovimentos } from '@/services/lote-service';
import { formatCurrency, formatQuantity } from '@/utils/format';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function isPaid(sale: any): boolean {
  return sale.status === 'concluída' || (sale.paymentMethod && sale.paymentMethod !== 'fiado');
}

export default function FinanceiroDetalheScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const companyId = user?.uid ?? '';
  const [loading, setLoading] = useState(true);
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [monthSales, setMonthSales] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [produtosEstoque, setProdutosEstoque] = useState<any[]>([]);
  const [movimentos, setMovimentos] = useState<any[]>([]);

  const currentMonth = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [salesData, allSalesData, despesasData, clientsData, materialsData, produtosData, movimentosData] = await Promise.all([
      getSalesInPeriod(companyId, referenceDate).catch(() => []),
      getAllSales(companyId).catch(() => []),
      getDespesas(companyId),
      listClients(companyId),
      getMaterials(companyId).catch(() => []),
      getProdutos(companyId).catch(() => []),
      listAllLoteMovimentos(companyId).catch(() => []),
    ]);
    setMonthSales(salesData);
    setAllSales(allSalesData);
    setDespesas(despesasData);
    setClients(clientsData ?? []);
    setMaterials(materialsData);
    setProdutosEstoque(produtosData);
    setMovimentos(movimentosData);
    setLoading(false);
  }, [companyId, referenceDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function changeMonth(delta: number) {
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta));
  }

  async function handlePagar(despesaId: string) {
    await updateDespesa(despesaId, { vencimento: '' });
    await loadData();
  }

  const title = {
    recebidas: 'Receitas Recebidas',
    areceber: 'Receitas a Receber',
    despesas: 'Despesas Pagas',
    apagar: 'Despesas a Pagar',
    materiais: 'Valor em Estoque',
    produtos: 'Valor em Produtos',
    perdas: 'Perdas e Desperdícios',
  }[type] || 'Detalhes';

  const items = useMemo(() => {
    switch (type) {
      case 'recebidas': {
        const result: any[] = [];
        for (const s of monthSales) {
          if (isPaid(s)) {
            result.push({
              id: s.id,
              desc: `Venda ${s.number}`,
              sub: 'Pago',
              amount: s.totalAmount,
              color: '#C4956A',
            });
          } else if (s.paymentMethod === 'fiado' && (s.paidAmount ?? 0) > 0) {
            result.push({
              id: s.id + '-partial',
              desc: `Venda ${s.number}`,
              sub: 'Pagamento Parcial',
              amount: s.paidAmount,
              color: '#C4956A',
            });
          }
        }
        return result;
      }
      case 'areceber': {
        const grouped: Record<string, { id: string; desc: string; sub: string; amount: number; count: number; color: string }> = {};
        for (const s of allSales) {
          if (s.status === 'concluída' || s.paymentMethod !== 'fiado') continue;
          const client = clients.find((c: any) => c.id === s.clientId);
          const clientName = client?.name ?? 'Sem cliente';
          if (!grouped[clientName]) {
            grouped[clientName] = { id: s.id, desc: clientName, sub: '', amount: 0, count: 0, color: '#F59E0B' };
          }
          grouped[clientName].amount += s.totalAmount - (s.paidAmount ?? 0);
          grouped[clientName].count++;
        }
        return Object.values(grouped).map((g) => ({ ...g, sub: `${g.count} ${g.count === 1 ? 'venda' : 'vendas'} pendente${g.count === 1 ? '' : 's'}` })).sort((a, b) => b.amount - a.amount);
      }
      case 'despesas': {
        const despesasPeriodo = filterDespesasByPeriod(despesas, referenceDate);
        return despesasPeriodo.filter((d) => !d.vencimento || d.pago).sort((a, b) => b.valor - a.valor).map((d) => ({
          id: d.id,
          desc: d.descricao,
          sub: d.categoria,
          amount: d.valor,
          color: '#DC2626',
        }));
      }
      case 'apagar': {
        const despesasPeriodo = filterDespesasByPeriod(despesas, referenceDate);
        const now = new Date();
        return despesasPeriodo.filter((d) => d.vencimento && !d.pago).sort((a, b) => {
          const aVenc = a.vencimento.split('/').reverse().join('-');
          const bVenc = b.vencimento.split('/').reverse().join('-');
          return aVenc.localeCompare(bVenc);
        }).map((d) => {
          const [dd, mm, yyyy] = d.vencimento.split('/').map(Number);
          const vencDate = new Date(yyyy, mm - 1, dd);
          const vencido = vencDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return {
            id: d.id,
            desc: d.descricao,
            sub: `Vence ${d.vencimento}` + (vencido ? ' (vencida)' : ''),
            amount: d.valor,
            color: vencido ? '#DC2626' : '#6B7280',
            vencido,
          };
        });
      }
      case 'materiais':
        return [...materials]
          .sort((a, b) => (b.precoCompra || 0) - (a.precoCompra || 0))
          .map((m) => ({
            id: m.id,
            desc: m.nome,
            sub: `${formatQuantity(m.quantidadeCompra || 0)} ${m.unidadeCompra} em estoque`,
            amount: m.precoCompra || 0,
            color: '#10B981',
          }));
      case 'produtos':
        return [...produtosEstoque]
          .filter(p => (p.estoqueAtual || 0) > 0)
          .sort((a, b) => ((b.estoqueAtual || 0) * (b.precoVenda || 0)) - ((a.estoqueAtual || 0) * (a.precoVenda || 0)))
          .map((p) => ({
            id: p.id,
            desc: p.nome,
            sub: `${formatQuantity(Math.max(0, p.estoqueAtual || 0))} un — R$ ${(p.precoVenda || 0).toFixed(2)}/un`,
            amount: Math.max(0, p.estoqueAtual || 0) * (p.precoVenda || 0),
            color: '#8B5CF6',
          }));
      case 'perdas': {
        const result: any[] = [];
        for (const mov of movimentos) {
          const d = mov.createdAt?.toDate ? mov.createdAt.toDate() : new Date(mov.createdAt);
          if (d.getMonth() === referenceDate.getMonth() && d.getFullYear() === referenceDate.getFullYear()) {
            if (mov.quantidade < 0 && (mov.tipo === 'perda' || mov.tipo === 'ajuste')) {
              const prod = produtosEstoque.find(p => p.id === mov.productId);
              const cost = mov.custoUnitario || prod?.custoPorUnidade || prod?.custo || 0;
              const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
              result.push({
                id: mov.id,
                desc: prod?.nome || 'Produto desconhecido',
                sub: `${dateStr} - ${Math.abs(mov.quantidade)} un ${mov.observacao ? `(${mov.observacao})` : ''}`,
                amount: Math.abs(mov.quantidade) * cost,
                color: '#DC2626',
              });
            }
          }
        }
        return result;
      }
      default:
        return [];
    }
  }, [type, monthSales, allSales, despesas, referenceDate, materials, produtosEstoque, movimentos]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.backRow}>
            <Pressable onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.navigate('/financeiro' as any);
              }
            }} style={styles.backButton}>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
            />
            <ThemedText type="smallBold">Voltar</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{title}</ThemedText>
          <View style={{ width: 60 }} />
        </ThemedView>

        {/* Month Navigator */}
        <ThemedView style={styles.monthRow}>
          <Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <ThemedText style={{ fontSize: 18, fontWeight: '300', color: theme.textSecondary }}>{'‹'}</ThemedText>
          </Pressable>
          <ThemedText style={{ fontWeight: '600', fontSize: 16 }}>
            {MONTHS[currentMonth]} {currentYear}
          </ThemedText>
          <Pressable onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <ThemedText style={{ fontSize: 18, fontWeight: '300', color: theme.textSecondary }}>{'›'}</ThemedText>
          </Pressable>
        </ThemedView>

        {loading ? <Loading /> : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {items.length > 0 && (
              <ThemedView style={[styles.totalCard, { backgroundColor: items[0].color }]}>
                <View style={styles.totalDecor}>
                  <View style={styles.totalDecorCircle1} />
                  <View style={styles.totalDecorCircle2} />
                </View>
                <ThemedText style={styles.totalLabel}>
                  {type === 'recebidas' ? 'Total Recebido'
                    : type === 'areceber' ? 'Total a Receber'
                    : type === 'apagar' ? 'Total a Pagar'
                    : type === 'materiais' ? 'Total em Estoque'
                    : type === 'produtos' ? 'Total em Produtos'
                    : type === 'perdas' ? 'Total de Perdas'
                    : 'Total de Despesas'}
                </ThemedText>
                <ThemedText style={styles.totalValue}>
                  {formatCurrency(items.reduce((sum, i) => sum + i.amount, 0))}
                </ThemedText>
              </ThemedView>
            )}
            {items.length === 0 ? (
              <ThemedText style={styles.emptyText}>Nenhum registro encontrado neste mês</ThemedText>
            ) : (
              items.map((item: any) => (
                <ThemedView key={item.id} style={styles.itemCard}>
                  <ThemedView style={styles.itemCardTop}>
                    <ThemedView style={styles.itemCardContent}>
                      <ThemedText style={styles.itemDesc}>{item.desc}</ThemedText>
                      <ThemedText style={styles.itemSub}>{item.sub}</ThemedText>
                    </ThemedView>
                    <ThemedText style={[styles.itemAmount, { color: item.color }]}>
                      {formatCurrency(item.amount)}
                    </ThemedText>
                  </ThemedView>
                  {type === 'apagar' && (
                    <Pressable
                      onPress={() => handlePagar(item.id)}
                      style={[styles.pagarButton, { backgroundColor: '#C4956A' }]}
                    >
                      <ThemedText style={styles.pagarText}>Pagar</ThemedText>
                    </Pressable>
                  )}
                </ThemedView>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function getMonthRange(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(ref);
  end.setMonth(end.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getSalesInPeriod(companyId: string, ref: Date) {
  const { start, end } = getMonthRange(ref);
  const days: any[] = [];
  const current = new Date(start);
  while (current <= end) {
    const daySales = await getSalesByDate(companyId, current);
    days.push(...daySales);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function filterDespesasByPeriod(despesas: any[], ref: Date): any[] {
  const refMonth = ref.getMonth();
  const refYear = ref.getFullYear();

  return despesas.filter((d) => {
    if (d.vencimento) {
      const parts = d.vencimento.split('/');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts.map(Number);
        return mm - 1 === refMonth && yyyy === refYear;
      }
    }
    const dataParts = d.data?.slice(0, 10).split('-') || [];
    if (dataParts.length === 3) {
      const [yyyy, mm, dd] = dataParts.map(Number);
      return mm - 1 === refMonth && yyyy === refYear;
    }
    return false;
  });
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
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  monthArrow: { padding: Spacing.one },
  listContent: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  itemCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  itemCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  itemCardContent: { gap: 2, flex: 1 },
  itemDesc: { fontSize: 15, fontWeight: '600' },
  itemSub: { fontSize: 12, opacity: 0.6 },
  itemAmount: { fontSize: 16, fontWeight: '700' },
  itemRight: { alignItems: 'flex-end', gap: Spacing.one },
  pagarButton: { paddingVertical: Spacing.two, borderRadius: Spacing.two, alignItems: 'center' },
  pagarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  emptyText: { fontSize: 14, opacity: 0.5, textAlign: 'center', paddingVertical: Spacing.five },
  totalCard: {
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  totalDecor: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 120,
    height: 120,
  },
  totalDecorCircle1: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  totalDecorCircle2: {
    position: 'absolute',
    right: 30,
    top: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  totalLabel: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  totalValue: { fontSize: 30, fontWeight: '700', lineHeight: 38, color: '#fff', textAlign: 'center' },
});
