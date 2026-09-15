import { createWithId, getAll, get, update, remove, where, limit, Timestamp } from './db'
import { Collections } from './collections'
import type { Lote, LoteMovimento, LoteMovimentoTipo } from '@/types/schema'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function fromFirestoreDoc(doc: any): Lote {
  return {
    id: doc.id,
    companyId: doc.companyId,
    productId: doc.productId,
    codigo: doc.codigo ?? '',
    quantidadeInicial: doc.quantidadeInicial ?? 0,
    quantidadeAtual: doc.quantidadeAtual ?? 0,
    custoUnitario: doc.custoUnitario ?? 0,
    dataValidade: doc.dataValidade ?? '',
    dataEntrada: doc.dataEntrada ?? '',
    fornecedor: doc.fornecedor ?? '',
    observacao: doc.observacao,
    origem: doc.origem,
    ativo: doc.ativo ?? true,
    createdAt: doc.createdAt?.toDate?.()?.toISOString() ?? doc.createdAt ?? new Date().toISOString(),
    updatedAt: doc.updatedAt?.toDate?.()?.toISOString() ?? doc.updatedAt,
  }
}

export function parseDateBR(dateStr: string): Date | null {
  if (!dateStr) return null
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  if (isNaN(date.getTime())) return null
  return date
}

export function compareValidade(a: Lote, b: Lote): number {
  const da = parseDateBR(a.dataValidade)?.getTime() ?? Number.MAX_SAFE_INTEGER
  const db = parseDateBR(b.dataValidade)?.getTime() ?? Number.MAX_SAFE_INTEGER
  if (da !== db) return da - db
  const ca = parseDateBR(a.dataEntrada)?.getTime() ?? 0
  const cb = parseDateBR(b.dataEntrada)?.getTime() ?? 0
  return ca - cb
}

export async function createLote(
  data: Omit<Lote, 'id' | 'createdAt' | 'updatedAt' | 'ativo' | 'quantidadeAtual'> & { quantidadeAtual?: number }
): Promise<string> {
  const id = generateId()
  const lote: Record<string, any> = {
    companyId: data.companyId,
    productId: data.productId,
    codigo: data.codigo,
    quantidadeInicial: data.quantidadeInicial,
    quantidadeAtual: data.quantidadeAtual ?? data.quantidadeInicial,
    custoUnitario: data.custoUnitario,
    dataValidade: data.dataValidade,
    dataEntrada: data.dataEntrada,
    fornecedor: data.fornecedor,
    ativo: true,
  }
  if (data.observacao) lote.observacao = data.observacao
  if (data.origem) lote.origem = data.origem
  await createWithId<Lote>(Collections.lotes, id, lote as any)

  await createLoteMovimento({
    companyId: data.companyId,
    productId: data.productId,
    loteId: id,
    tipo: 'entrada',
    quantidade: lote.quantidadeInicial,
    custoUnitario: lote.custoUnitario,
    dataValidadeSnapshot: lote.dataValidade,
    motivo: 'Entrada de lote',
  })

  return id
}

export async function getLote(id: string): Promise<Lote | null> {
  try {
    const doc = await get<Lote>(Collections.lotes, id)
    return doc ? fromFirestoreDoc(doc) : null
  } catch {
    return null
  }
}

export async function listLotes(companyId: string, max = 500): Promise<Lote[]> {
  try {
    const docs = await getAll<Lote>(
      Collections.lotes,
      where('companyId', '==', companyId),
      limit(max)
    )
    return docs.map(fromFirestoreDoc).sort(compareValidade)
  } catch {
    return []
  }
}

export async function listLotesByProduct(productId: string): Promise<Lote[]> {
  try {
    const docs = await getAll<Lote>(
      Collections.lotes,
      where('productId', '==', productId),
      where('ativo', '==', true)
    )
    return docs.map(fromFirestoreDoc).sort(compareValidade)
  } catch {
    return []
  }
}

export async function listAllLotesByProduct(productId: string): Promise<Lote[]> {
  try {
    const docs = await getAll<Lote>(
      Collections.lotes,
      where('productId', '==', productId)
    )
    return docs.map(fromFirestoreDoc).sort(compareValidade)
  } catch {
    return []
  }
}

export async function updateLote(id: string, data: Partial<Omit<Lote, 'id' | 'createdAt'>>): Promise<void> {
  return update<Lote>(Collections.lotes, id, data)
}

export async function deleteLote(id: string): Promise<void> {
  try {
    await remove(Collections.lotes, id)
  } catch {}
}

export async function getEstoqueAtual(productId: string): Promise<number> {
  const lotes = await listLotesByProduct(productId)
  return lotes.reduce((sum, l) => sum + (l.quantidadeAtual || 0), 0)
}

export async function getCustoMedio(productId: string): Promise<number> {
  const lotes = await listAllLotesByProduct(productId)
  const ativos = lotes.filter(l => l.ativo && l.quantidadeAtual > 0)
  if (ativos.length === 0) return 0
  const total = ativos.reduce((sum, l) => sum + l.quantidadeAtual * l.custoUnitario, 0)
  const qty = ativos.reduce((sum, l) => sum + l.quantidadeAtual, 0)
  return qty > 0 ? total / qty : 0
}

export async function getProximaValidade(productId: string): Promise<string | null> {
  const lotes = await listLotesByProduct(productId)
  if (lotes.length === 0) return null
  return lotes[0].dataValidade || null
}

export interface ConsumoFEFO {
  loteId: string
  quantidade: number
  codigo?: string
}

export interface ResultadoConsumo {
  sucesso: boolean
  consumido: ConsumoFEFO[]
  faltante: number
  mensagem?: string
}

export async function consumirEstoqueFEFO(
  productId: string,
  quantidade: number,
  options?: { referenciaTipo?: string; referenciaId?: string; tipo?: LoteMovimentoTipo; motivo?: string; userId?: string }
): Promise<ResultadoConsumo> {
  if (quantidade <= 0) {
    return { sucesso: false, consumido: [], faltante: 0, mensagem: 'Quantidade inválida' }
  }

  const lotes = await listLotesByProduct(productId)
  const estoqueDisponivel = lotes.reduce((sum, l) => sum + l.quantidadeAtual, 0)

  if (estoqueDisponivel < quantidade) {
    return {
      sucesso: false,
      consumido: [],
      faltante: quantidade - estoqueDisponivel,
      mensagem: `Estoque insuficiente. Disponível: ${estoqueDisponivel.toFixed(3)}`,
    }
  }

  const consumido: ConsumoFEFO[] = []
  let restante = quantidade
  const tipo: LoteMovimentoTipo = options?.tipo ?? 'venda'
  const companyId = lotes[0]?.companyId

  for (const lote of lotes) {
    if (restante <= 0) break
    if (lote.quantidadeAtual <= 0) continue
    if (!lote.id) continue

    const loteId = lote.id
    const tomar = Math.min(lote.quantidadeAtual, restante)
    const novaQtd = lote.quantidadeAtual - tomar
    const ativo = novaQtd > 0.0001

    await updateLote(loteId, {
      quantidadeAtual: Math.max(0, novaQtd),
      ativo,
    })

    if (companyId) {
      await createLoteMovimento({
        companyId,
        productId,
        loteId,
        tipo,
        quantidade: -tomar,
        custoUnitario: lote.custoUnitario,
        dataValidadeSnapshot: lote.dataValidade,
        motivo: options?.motivo,
        userId: options?.userId,
        referenciaTipo: options?.referenciaTipo,
        referenciaId: options?.referenciaId,
      })
    }

    consumido.push({
      loteId,
      quantidade: tomar,
      codigo: lote.codigo,
    })
    restante -= tomar
  }

  return {
    sucesso: restante <= 0.0001,
    consumido,
    faltante: Math.max(0, restante),
  }
}

export async function reverterConsumo(
  productId: string,
  consumos: ConsumoFEFO[],
  options?: { referenciaTipo?: string; referenciaId?: string; tipo?: LoteMovimentoTipo; motivo?: string; userId?: string }
): Promise<void> {
  for (const c of consumos) {
    const lote = await getLote(c.loteId)
    if (!lote || !lote.id) continue
    const loteId = lote.id
    const novaQtd = lote.quantidadeAtual + c.quantidade
    await updateLote(loteId, {
      quantidadeAtual: novaQtd,
      ativo: true,
    })
    await createLoteMovimento({
      companyId: lote.companyId,
      productId,
      loteId: lote.id,
      tipo: options?.tipo ?? 'entrada',
      quantidade: c.quantidade,
      custoUnitario: lote.custoUnitario,
      dataValidadeSnapshot: lote.dataValidade,
      motivo: options?.motivo ?? 'Estorno',
      userId: options?.userId,
      referenciaTipo: options?.referenciaTipo,
      referenciaId: options?.referenciaId,
    })
  }
}

export async function estornarConsumoDaReferencia(referenciaId: string, options?: { motivo?: string; userId?: string }): Promise<void> {
  const movimentos = await getAll<LoteMovimento>(
    Collections.loteMovimentos,
    where('referenciaId', '==', referenciaId)
  )
  const saidas = movimentos.filter(m => m.quantidade < 0)
  for (const m of saidas) {
    const lote = await getLote(m.loteId)
    if (!lote || !lote.id) continue
    const quantidadeEstornada = Math.abs(m.quantidade)
    const novaQtd = lote.quantidadeAtual + quantidadeEstornada
    await updateLote(lote.id, {
      quantidadeAtual: novaQtd,
      ativo: true,
    })
    await createLoteMovimento({
      companyId: lote.companyId,
      productId: lote.productId,
      loteId: lote.id,
      tipo: 'entrada',
      quantidade: quantidadeEstornada,
      custoUnitario: lote.custoUnitario,
      dataValidadeSnapshot: lote.dataValidade,
      motivo: options?.motivo ?? `Estorno ref ${referenciaId}`,
      userId: options?.userId,
      referenciaTipo: m.referenciaTipo,
      referenciaId,
    })
  }
}

export async function ajustarLote(
  loteId: string,
  novaQuantidade: number,
  motivo?: string,
  userId?: string
): Promise<void> {
  const lote = await getLote(loteId)
  if (!lote) return
  const diff = novaQuantidade - lote.quantidadeAtual
  await updateLote(loteId, {
    quantidadeAtual: novaQuantidade,
    ativo: novaQuantidade > 0,
  })
  await createLoteMovimento({
    companyId: lote.companyId,
    productId: lote.productId,
    loteId,
    tipo: 'ajuste',
    quantidade: diff,
    custoUnitario: lote.custoUnitario,
    dataValidadeSnapshot: lote.dataValidade,
    motivo: motivo ?? 'Ajuste manual',
    userId,
  })
}

export async function createLoteMovimento(
  data: Omit<LoteMovimento, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId()
  await createWithId<LoteMovimento>(Collections.loteMovimentos, id, data as any)
  return id
}

export async function listLoteMovimentos(productId: string, max = 100): Promise<LoteMovimento[]> {
  try {
    const docs = await getAll<LoteMovimento>(
      Collections.loteMovimentos,
      where('productId', '==', productId),
      limit(max)
    )
    return docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0
      const tb = b.createdAt?.toMillis?.() ?? 0
      return tb - ta
    })
  } catch {
    return []
  }
}

export async function listAllLoteMovimentos(companyId: string, max = 200): Promise<LoteMovimento[]> {
  try {
    const docs = await getAll<LoteMovimento>(
      Collections.loteMovimentos,
      where('companyId', '==', companyId),
      limit(max)
    )
    return docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0
      const tb = b.createdAt?.toMillis?.() ?? 0
      return tb - ta
    })
  } catch {
    return []
  }
}

export function isLoteVencido(lote: Lote, refDate = new Date()): boolean {
  const d = parseDateBR(lote.dataValidade)
  if (!d) return false
  return d.getTime() < refDate.getTime()
}

export function isLoteProximoVencimento(lote: Lote, dias = 30, refDate = new Date()): boolean {
  const d = parseDateBR(lote.dataValidade)
  if (!d) return false
  const diff = d.getTime() - refDate.getTime()
  return diff > 0 && diff < dias * 24 * 60 * 60 * 1000
}

export function diasAteVencimento(lote: Lote, refDate = new Date()): number | null {
  const d = parseDateBR(lote.dataValidade)
  if (!d) return null
  return Math.floor((d.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000))
}

export function gerarCodigoLote(existingCodes: string[], prefix = 'LT'): string {
  let n = 1
  const used = new Set(existingCodes.map(c => c.toUpperCase()))
  while (used.has(`${prefix}${String(n).padStart(3, '0')}`)) n++
  return `${prefix}${String(n).padStart(3, '0')}`
}
