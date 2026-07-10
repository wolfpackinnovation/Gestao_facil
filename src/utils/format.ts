export function formatCurrencyInput(text: string): string {
  const digits = text.replace(/\D/g, '')
  const cents = parseInt(digits, 10) || 0
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function parseCurrencyInput(formatted: string): number {
  const digits = formatted.replace(/\D/g, '')
  return (parseInt(digits, 10) || 0) / 100
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
