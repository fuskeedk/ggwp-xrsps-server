import {
  DAMAGE_OPTIONS,
  PROPERTY_OPTIONS,
  SEVERITY_OPTIONS,
  TRADE_OPTIONS,
  UPGRADE_OPTIONS,
  URGENCY_OPTIONS,
  type DamageType,
  type PropertyType,
  type Severity,
  type Trade,
  type Upgrade,
  type Urgency,
} from '../data/pricing'

export type QuoteInput = {
  damageType: DamageType | null
  propertyType: PropertyType | null
  areaM2: number
  severity: Severity | null
  trades: Trade[]
  upgrades: Upgrade[]
  urgency: Urgency
}

export type LineItem = {
  label: string
  amount: number
}

export type QuoteResult = {
  lines: LineItem[]
  subtotal: number
  vat: number
  total: number
  low: number
  high: number
  weeksLow: number
  weeksHigh: number
}

const empty: QuoteResult = {
  lines: [],
  subtotal: 0,
  vat: 0,
  total: 0,
  low: 0,
  high: 0,
  weeksLow: 0,
  weeksHigh: 0,
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  if (!input.damageType || !input.propertyType || !input.severity || input.areaM2 <= 0) {
    return empty
  }

  const damage = DAMAGE_OPTIONS.find((d) => d.id === input.damageType)!
  const property = PROPERTY_OPTIONS.find((p) => p.id === input.propertyType)!
  const severity = SEVERITY_OPTIONS.find((s) => s.id === input.severity)!
  const urgency = URGENCY_OPTIONS.find((u) => u.id === input.urgency)!

  const area = Math.min(Math.max(input.areaM2, 1), 250)
  const restoration =
    (damage.baseFee + damage.ratePerM2 * area) *
    severity.multiplier *
    property.multiplier

  const lines: LineItem[] = [
    {
      label: `${damage.label} – udbedring (${area} m², ${severity.label.toLowerCase()})`,
      amount: Math.round(restoration),
    },
  ]

  const selectedTrades = TRADE_OPTIONS.filter((t) => input.trades.includes(t.id))
  let tradeSum = 0
  for (const trade of selectedTrades) {
    if (trade.addOn > 0) {
      tradeSum += trade.addOn
      lines.push({ label: `${trade.label} – ekstra fag`, amount: trade.addOn })
    }
  }

  // Coordinering når flere fag indgår
  if (selectedTrades.length >= 3) {
    const coordination = 4500
    tradeSum += coordination
    lines.push({ label: 'Projektkoordinering på tværs af fag', amount: coordination })
  }

  let upgradeSum = 0
  for (const upgrade of UPGRADE_OPTIONS.filter((u) => input.upgrades.includes(u.id))) {
    upgradeSum += upgrade.cost
    lines.push({ label: upgrade.label, amount: upgrade.cost })
  }

  let subtotal = restoration + tradeSum + upgradeSum

  if (urgency.multiplier !== 1) {
    const urgencyFee = Math.round(subtotal * (urgency.multiplier - 1))
    lines.push({ label: urgency.label, amount: urgencyFee })
    subtotal += urgencyFee
  }

  subtotal = Math.round(subtotal)
  const vat = Math.round(subtotal * 0.25)
  const total = subtotal + vat

  // ±15% spænd – vejledende overslag
  const low = Math.round(total * 0.85)
  const high = Math.round(total * 1.15)

  const baseWeeks = Math.ceil(area / 12) + (selectedTrades.length > 2 ? 1 : 0)
  const severityWeeks =
    input.severity === 'omfattende' ? 2 : input.severity === 'middel' ? 1 : 0
  const weeksLow = Math.max(1, baseWeeks + severityWeeks - 1)
  const weeksHigh = weeksLow + 2 + (input.upgrades.length > 0 ? 1 : 0)

  return {
    lines,
    subtotal,
    vat,
    total,
    low,
    high,
    weeksLow,
    weeksHigh,
  }
}

export function formatDkk(amount: number): string {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    maximumFractionDigits: 0,
  }).format(amount)
}
