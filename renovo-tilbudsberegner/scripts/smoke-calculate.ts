import assert from 'node:assert/strict'
import { calculateQuote, formatDkk } from '../src/lib/calculate'

const quote = calculateQuote({
  damageType: 'vand',
  propertyType: 'hus',
  areaM2: 20,
  severity: 'middel',
  trades: ['tomrer', 'maler', 'vvs'],
  upgrades: [],
  urgency: 'normal',
})

assert.ok(quote.total > 0, 'total skal være positiv')
assert.ok(quote.high > quote.low, 'interval skal have spænd')
assert.ok(quote.vat === Math.round(quote.subtotal * 0.25), 'moms skal være 25%')
assert.match(formatDkk(quote.total), /kr/)

const empty = calculateQuote({
  damageType: null,
  propertyType: null,
  areaM2: 0,
  severity: null,
  trades: [],
  upgrades: [],
  urgency: 'normal',
})
assert.equal(empty.total, 0)

console.log('calculate tests OK', formatDkk(quote.low), '-', formatDkk(quote.high))
