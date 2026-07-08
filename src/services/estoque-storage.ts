import AsyncStorage from '@react-native-async-storage/async-storage';

export type UnidadeMedida = 'un' | 'kg' | 'g' | 'L' | 'mL';

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  unidade: UnidadeMedida;
  quantidade: number;
  custo: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  dataValidade: string;
  fornecedor: string;
  createdAt: string;
}

const STORAGE_KEY = '@gestaofacil:produtos';

export async function getProdutos(): Promise<Produto[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveProduto(produto: Produto): Promise<void> {
  const produtos = await getProdutos();
  const index = produtos.findIndex((p) => p.id === produto.id);
  if (index >= 0) {
    produtos[index] = produto;
  } else {
    produtos.push(produto);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
}

export async function deleteProduto(id: string): Promise<void> {
  const produtos = await getProdutos();
  const filtered = produtos.filter((p) => p.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export const CATEGORIAS = [
  'Carnes',
  'Aves',
  'Peixes',
  'Vegetais',
  'Laticínios',
  'Bebidas',
  'Secos',
  'Limpeza',
  'Embalagens',
  'Outros',
];

export const UNIDADES: UnidadeMedida[] = ['un', 'kg', 'g', 'L', 'mL'];

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
