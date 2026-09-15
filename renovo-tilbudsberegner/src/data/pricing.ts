export type DamageType =
  | 'vand'
  | 'storm'
  | 'brand'
  | 'indbrud'
  | 'fugt'
  | 'andet'

export type PropertyType = 'hus' | 'sommerhus' | 'lejlighed' | 'erhverv'

export type Severity = 'let' | 'middel' | 'omfattende'

export type Trade = 'tomrer' | 'murer' | 'maler' | 'vvs' | 'elektriker'

export type Upgrade = 'kokken' | 'badevaerelse' | 'gulve' | 'fliser'

export const DAMAGE_OPTIONS: {
  id: DamageType
  label: string
  description: string
  baseFee: number
  ratePerM2: number
}[] = [
  {
    id: 'vand',
    label: 'Vandskade',
    description: 'Rørbrud, overløb eller indtrængende vand',
    baseFee: 8500,
    ratePerM2: 2400,
  },
  {
    id: 'storm',
    label: 'Stormskade',
    description: 'Tag, facade, vinduer eller udhæng',
    baseFee: 7200,
    ratePerM2: 2100,
  },
  {
    id: 'brand',
    label: 'Brand- / røgskade',
    description: 'Brand, sod eller røgskader i boligen',
    baseFee: 12000,
    ratePerM2: 3200,
  },
  {
    id: 'indbrud',
    label: 'Indbrudsskade',
    description: 'Døre, vinduer og indvendige skader',
    baseFee: 4500,
    ratePerM2: 1600,
  },
  {
    id: 'fugt',
    label: 'Fugt / råd',
    description: 'Fugtskader, skimmel eller råd i konstruktion',
    baseFee: 7800,
    ratePerM2: 2600,
  },
  {
    id: 'andet',
    label: 'Anden skade',
    description: 'Øvrige skader – vi vurderer individuelt',
    baseFee: 6000,
    ratePerM2: 1900,
  },
]

export const PROPERTY_OPTIONS: {
  id: PropertyType
  label: string
  multiplier: number
}[] = [
  { id: 'hus', label: 'Hus', multiplier: 1 },
  { id: 'sommerhus', label: 'Sommerhus', multiplier: 1.08 },
  { id: 'lejlighed', label: 'Lejlighed', multiplier: 0.95 },
  { id: 'erhverv', label: 'Erhverv / ejendom', multiplier: 1.15 },
]

export const SEVERITY_OPTIONS: {
  id: Severity
  label: string
  description: string
  multiplier: number
}[] = [
  {
    id: 'let',
    label: 'Let',
    description: 'Afgrænset skade, få flader',
    multiplier: 0.75,
  },
  {
    id: 'middel',
    label: 'Middel',
    description: 'Flere rum eller større flader',
    multiplier: 1,
  },
  {
    id: 'omfattende',
    label: 'Omfattende',
    description: 'Større genopbygning på tværs af fag',
    multiplier: 1.45,
  },
]

export const TRADE_OPTIONS: {
  id: Trade
  label: string
  addOn: number
}[] = [
  { id: 'tomrer', label: 'Tømrer', addOn: 0 },
  { id: 'murer', label: 'Murer', addOn: 3500 },
  { id: 'maler', label: 'Maler', addOn: 2800 },
  { id: 'vvs', label: 'VVS', addOn: 4200 },
  { id: 'elektriker', label: 'Elektriker', addOn: 3800 },
]

export const UPGRADE_OPTIONS: {
  id: Upgrade
  label: string
  description: string
  cost: number
}[] = [
  {
    id: 'kokken',
    label: 'Køkkenopgradering',
    description: 'Opdatering i forbindelse med genopbygning',
    cost: 45000,
  },
  {
    id: 'badevaerelse',
    label: 'Badeværelse',
    description: 'Fornyelse af bad ved udbedring',
    cost: 65000,
  },
  {
    id: 'gulve',
    label: 'Nye gulve',
    description: 'Gulvbelægning i skadede områder',
    cost: 18000,
  },
  {
    id: 'fliser',
    label: 'Fliser',
    description: 'Nye fliser i vådrum eller kælder',
    cost: 22000,
  },
]

export const URGENCY_OPTIONS = [
  { id: 'normal' as const, label: 'Normal planlægning', multiplier: 1 },
  { id: 'hurtig' as const, label: 'Hurtig opstart', multiplier: 1.12 },
  { id: 'akut' as const, label: 'Akut / nødhjælp', multiplier: 1.25 },
]

export type Urgency = (typeof URGENCY_OPTIONS)[number]['id']
