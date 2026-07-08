import type { BaseEntity } from '@/services/db'
import type { Timestamp } from 'firebase/firestore'

export interface Company extends BaseEntity {
  name: string
  cnpj: string
  email?: string
  phone?: string
  logoUrl?: string
  active: boolean
  settings?: string
  subscriptionStatus?: string
}

export interface User extends BaseEntity {
  companyId: string
  name: string
  email: string
  role: string
  phone?: string
}

export interface Client extends BaseEntity {
  companyId: string
  name: string
  email?: string
  phone?: string
  cpfCnpj?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
}

export interface Supplier extends BaseEntity {
  companyId: string
  name: string
  cnpj?: string
  contact?: string
}

export interface Category extends BaseEntity {
  companyId: string
  name: string
}

export interface Product extends BaseEntity {
  companyId: string
  categoryId?: string
  name: string
  unit: string
  sku?: string
  price: number
  costPrice?: number
  stockQuantity: number
  minStock?: number
  metadata?: string
}

export interface LossControl extends BaseEntity {
  companyId: string
  productId: string
  quantity: number
  reason?: string
}

export interface Sale extends BaseEntity {
  companyId: string
  number: string
  userId?: string
  clientId?: string
  totalAmount: number
  paymentMethod?: string
  status?: string
}

export interface SaleItem extends BaseEntity {
  saleId: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
  discount?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Purchase extends BaseEntity {
  companyId: string
  supplierId: string
  totalAmount: number
  status?: string
}

export interface PurchaseItem extends BaseEntity {
  purchaseId: string
  productId: string
  quantity: number
  unitCost: number
  subtotal: number
}

export interface CashRegister extends BaseEntity {
  companyId: string
  name: string
  currentBalance: number
  isOpen: boolean
}

export interface CashMovement extends BaseEntity {
  cashRegisterId: string
  userId: string
  type: string
  amount: number
  balanceAfter?: number
  description?: string
}

export interface Receivable extends BaseEntity {
  companyId: string
  saleId?: string
  amount: number
  dueDate: Timestamp
  status?: string
}

export interface Payable extends BaseEntity {
  companyId: string
  purchaseId?: string
  amount: number
  dueDate: Timestamp
  status?: string
}

export interface TableModule extends BaseEntity {
  companyId: string
  number: number
  status?: string
}

export interface Order extends BaseEntity {
  companyId: string
  number: string
  tableId?: string
  userId?: string
  status?: string
}

export interface OrderItem extends BaseEntity {
  orderId: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface Production extends BaseEntity {
  companyId: string
  productId: string
  quantity: number
}

export interface ProductionConsumption extends BaseEntity {
  productionId: string
  productId: string
  quantity: number
}
