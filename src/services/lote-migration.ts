import { getAll, where } from './db'
import { Collections } from './collections'
import { createLote, listLotes, gerarCodigoLote } from './lote-service'
import { getMaterials } from './material-service'
import type { Lote } from '@/types/schema'

export interface MigracaoLotesResultado {
  materiais: number
  produtos: number
}

const executadas = new Set<string>()

/**
 * Cria um lote "Estoque inicial (migração)" para materiais e produtos antigos
 * que ainda não possuem nenhum lote. Não cria despesas nem altera totais do item.
 * É idempotente: itens que já têm lote (mesmo esgotado) são ignorados.
 */
export async function migrarItensSemLote(companyId: string): Promise<MigracaoLotesResultado> {
  const resultado: MigracaoLotesResultado = { materiais: 0, produtos: 0 }
  if (!companyId || executadas.has(companyId)) return resultado
  executadas.add(companyId)

  try {
    const lotes: Lote[] = await listLotes(companyId, 5000)
    const comLote = new Set(lotes.map(l => l.productId))
    const codigos = lotes.map(l => l.codigo)
    const dataEntrada = new Date().toLocaleDateString('pt-BR')

    const criar = async (productId: string, nome: string, quantidade: number, custoUnitario: number) => {
      const codigo = gerarCodigoLote(codigos, (nome || 'LT').slice(0, 2).toUpperCase())
      codigos.push(codigo)
      await createLote({
        companyId,
        productId,
        codigo,
        quantidadeInicial: quantidade,
        custoUnitario,
        dataValidade: '',
        dataEntrada,
        fornecedor: '',
        observacao: 'Estoque inicial (migração)',
        origem: 'reposicao',
      })
      comLote.add(productId)
    }

    // Materiais
    const materiais = await getMaterials(companyId)
    for (const m of materiais) {
      if (comLote.has(m.id)) continue
      const qtd = m.quantidadeCompra || 0
      if (qtd <= 0) continue
      const custo = (m.precoCompra || 0) / qtd
      await criar(m.id, m.nome, qtd, custo)
      resultado.materiais++
    }

    // Produtos
    const produtos = await getAll<any>(Collections.inventory, where('companyId', '==', companyId))
    for (const p of produtos) {
      if (!p.id || comLote.has(p.id)) continue
      const qtd = p.quantidade ?? 0
      if (qtd <= 0) continue
      const custo = p.custoPorUnidade ?? p.custo ?? 0
      await criar(p.id, p.nome ?? '', qtd, custo)
      resultado.produtos++
    }
  } catch (e) {
    executadas.delete(companyId)
    console.error('migrarItensSemLote error:', e)
  }

  return resultado
}
