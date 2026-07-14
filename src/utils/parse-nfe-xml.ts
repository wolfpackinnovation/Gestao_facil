export interface NFeData {
  number: string
  party: string
  value: number
  date: string
  type: string
  entrada: boolean
  status: string
}

export function parseNFeXML(xmlContent: string): NFeData | null {
  try {
    const number = extractTag(xmlContent, 'nNF') || extractTag(xmlContent, 'cNF') || ''
    const emitName = extractTag(xmlContent, 'xNome', 'emit')
    const destName = extractTag(xmlContent, 'xNome', 'dest')
    const valueStr = extractTag(xmlContent, 'vNF') || extractTag(xmlContent, 'vProd') || '0'
    const value = parseFloat(valueStr.replace(',', '.')) || 0
    const date = extractTag(xmlContent, 'dhEmi') || extractTag(xmlContent, 'dhRecbto') || new Date().toISOString()
    const tpNF = extractTag(xmlContent, 'tpNF')
    const entrada = tpNF === '0'

    const nProt = extractTag(xmlContent, 'nProt')
    const status = nProt ? 'XML disponível' : 'Pendente'

    return {
      number,
      party: entrada ? emitName : destName,
      value,
      date: formatISOToDate(date),
      type: entrada ? 'Nota Fiscal de Entrada' : 'Nota Fiscal de Saída',
      entrada,
      status,
    }
  } catch {
    return null
  }
}

function extractTag(xml: string, tag: string, parentTag?: string): string {
  if (parentTag) {
    const parentMatch = xml.match(new RegExp(`<${parentTag}>[\\s\\S]*?<\\/${parentTag}>`))
    if (parentMatch) {
      const match = parentMatch[0].match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`))
      return match ? match[1].trim() : ''
    }
    return ''
  }
  const match = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`))
  return match ? match[1].trim() : ''
}

function formatISOToDate(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr.split('T')[0]
    return d.toISOString().split('T')[0]
  } catch {
    return isoStr.split('T')[0]
  }
}
