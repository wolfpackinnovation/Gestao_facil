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

export function formatQuantity(value: number): string {
  return parseFloat(value.toFixed(3)).toString()
}

export function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
