import { get, createWithId, update } from './db'
import { Collections } from './collections'
import type { Company } from '@/types/schema'

export const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartão', label: 'Cartão' },
  { value: 'fiado', label: 'Fiado' },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

export interface AppSettings {
  theme: 'light' | 'dark'
  paymentMethodsOrder: PaymentMethod[]
  enabledPaymentMethods: PaymentMethod[]
  defaultUnit: string
  saleNumberFormat: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  paymentMethodsOrder: ['dinheiro', 'pix', 'cartão', 'fiado'],
  enabledPaymentMethods: ['dinheiro', 'pix', 'cartão', 'fiado'],
  defaultUnit: 'un',
  saleNumberFormat: 'VND-{000}',
}

export interface CompanyInfo {
  name: string
  cnpj: string
  email: string
  phone: string
  pixKey: string
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
  pixCity: string
}

export async function getSettings(companyId: string): Promise<AppSettings> {
  const company = await get<Company>(Collections.companies, companyId)
  if (!company?.settings) return DEFAULT_SETTINGS
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(company.settings) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(
  companyId: string,
  settings: AppSettings
): Promise<void> {
  const company = await get<Company>(Collections.companies, companyId)
  if (company) {
    await update<Company>(Collections.companies, companyId, {
      settings: JSON.stringify(settings),
    })
  } else {
    await createWithId<Company>(
      Collections.companies as any,
      companyId,
      {
        name: '',
        cnpj: '',
        active: true,
        settings: JSON.stringify(settings),
      } as any
    )
  }
}

export async function getCompanyInfo(companyId: string): Promise<CompanyInfo> {
  const company = await get<Company>(Collections.companies, companyId)
  if (!company) {
    return { name: '', cnpj: '', email: '', phone: '', pixKey: '', pixKeyType: 'cpf', pixCity: '' }
  }
  return {
    name: company.name ?? '',
    cnpj: company.cnpj ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    pixKey: (company as any).pixKey ?? '',
    pixKeyType: (company as any).pixKeyType ?? 'cpf',
    pixCity: (company as any).pixCity ?? '',
  }
}

export async function saveCompanyInfo(
  companyId: string,
  info: CompanyInfo
): Promise<void> {
  const company = await get<Company>(Collections.companies, companyId)
  const data: any = {
    name: info.name || null,
    cnpj: info.cnpj || null,
    email: info.email || null,
    phone: info.phone || null,
    pixKey: info.pixKey || null,
    pixKeyType: info.pixKeyType || null,
    pixCity: info.pixCity || null,
  }
  if (company) {
    await update<Company>(Collections.companies, companyId, data as any)
  } else {
    await createWithId<Company>(
      Collections.companies as any,
      companyId,
      {
        name: info.name,
        cnpj: info.cnpj,
        active: true,
        ...data,
      } as any
    )
  }
}
