export type UnitType = 'mass' | 'volume' | 'quantity';

export interface UnitDef {
  code: string;
  label: string;
  type: UnitType;
  toBase: number;
}

export const UNITS: UnitDef[] = [
  { code: 'mg', label: 'mg (miligrama)', type: 'mass', toBase: 0.001 },
  { code: 'g', label: 'g (grama)', type: 'mass', toBase: 1 },
  { code: 'kg', label: 'kg (quilograma)', type: 'mass', toBase: 1000 },
  { code: 'ml', label: 'ml (mililitro)', type: 'volume', toBase: 1 },
  { code: 'litro', label: 'litro', type: 'volume', toBase: 1000 },
  { code: 'un', label: 'un (unidade)', type: 'quantity', toBase: 1 },
  { code: 'dz', label: 'dz (dúzia)', type: 'quantity', toBase: 12 },
];

export const UNIT_LABELS: Record<string, string> = UNITS.reduce(
  (acc, u) => ({ ...acc, [u.code]: u.label }),
  {} as Record<string, string>,
);

export function getUnit(code: string): UnitDef | undefined {
  return UNITS.find((u) => u.code === code);
}

export function unitsByType(type: UnitType): UnitDef[] {
  return UNITS.filter((u) => u.type === type);
}

export function convertToBase(quantity: number, unitCode: string): number {
  const unit = getUnit(unitCode);
  if (!unit) return quantity;
  return quantity * unit.toBase;
}

export function convertUnits(quantity: number, fromCode: string, toCode: string): number {
  const base = convertToBase(quantity, fromCode);
  const target = getUnit(toCode);
  if (!target) return base;
  return base / target.toBase;
}

export function sameType(unitA: string, unitB: string): boolean {
  const a = getUnit(unitA);
  const b = getUnit(unitB);
  if (!a || !b) return false;
  return a.type === b.type;
}

export function formatQuantity(value: number, unitCode: string): string {
  const formatted = parseFloat(value.toFixed(3)).toString();
  return `${formatted} ${unitCode}`;
}
