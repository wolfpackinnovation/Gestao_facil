export interface PixParams {
  pixKey: string
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
  amount?: number
  merchantName?: string
  merchantCity?: string
  txid?: string
}

function pad(len: number): string {
  return len.toString().padStart(2, '0')
}

function emv(id: string, value: string): string {
  return `${id}${pad(value.length)}${value}`
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function projectName(name: string): string {
  return removeAccents(name)
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .substring(0, 25)
    .toUpperCase()
}

function projectCity(city: string): string {
  return removeAccents(city)
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .substring(0, 15)
    .toUpperCase()
}

function projectTxid(txid: string): string {
  return txid.replace(/[^A-Za-z0-9]/g, '').substring(0, 25).toUpperCase() || '***'
}

function normalizePixKey(key: string, type?: PixParams['pixKeyType']): string {
  const trimmed = key.trim()
  if (!trimmed) return trimmed
  if (type === 'email' || trimmed.includes('@')) {
    return trimmed.toLowerCase()
  }
  if (type === 'aleatoria') {
    return trimmed.toLowerCase()
  }
  return trimmed
}

function crc16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc <<= 1
      }
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buildPixBrCode(params: PixParams): string {
  const pixKey = normalizePixKey(params.pixKey, params.pixKeyType)
  const receiverName = projectName(params.merchantName && params.merchantName.trim() ? params.merchantName : 'PIX')
  const receiverCity = projectCity(params.merchantCity && params.merchantCity.trim() ? params.merchantCity : 'BRASIL')
  const txid = projectTxid(params.txid ?? '***')

  const merchantAccount = emv('26', emv('00', 'BR.GOV.BCB.PIX') + emv('01', pixKey))

  const additionalData = emv('62', emv('05', txid))

  const parts: string[] = [
    emv('00', '01'),
    emv('01', '11'),
    merchantAccount,
    emv('52', '0000'),
    emv('53', '986'),
  ]

  if (typeof params.amount === 'number' && params.amount > 0) {
    parts.push(emv('54', params.amount.toFixed(2)))
  }

  parts.push(
    emv('58', 'BR'),
    emv('59', receiverName),
    emv('60', receiverCity),
    additionalData,
    '6304',
  )

  const payload = parts.join('')
  const checksum = crc16(payload)
  return payload + checksum
}
