import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
} from './data/pricing'
import { calculateQuote, formatDkk, type QuoteInput } from './lib/calculate'
import './index.css'

const STEPS = ['Skade', 'Omfang', 'Fag', 'Tillæg', 'Resultat'] as const

const fadeSlide = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
}

function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export default function App() {
  const [step, setStep] = useState(0)
  const [damageType, setDamageType] = useState<DamageType | null>(null)
  const [propertyType, setPropertyType] = useState<PropertyType | null>('hus')
  const [areaM2, setAreaM2] = useState(25)
  const [severity, setSeverity] = useState<Severity | null>('middel')
  const [trades, setTrades] = useState<Trade[]>(['tomrer', 'maler'])
  const [upgrades, setUpgrades] = useState<Upgrade[]>([])
  const [urgency, setUrgency] = useState<Urgency>('normal')
  const [submitted, setSubmitted] = useState(false)
  const [contact, setContact] = useState({
    name: '',
    phone: '',
    email: '',
    note: '',
  })

  const input: QuoteInput = useMemo(
    () => ({
      damageType,
      propertyType,
      areaM2,
      severity,
      trades,
      upgrades,
      urgency,
    }),
    [damageType, propertyType, areaM2, severity, trades, upgrades, urgency],
  )

  const quote = useMemo(() => calculateQuote(input), [input])
  const canAdvance =
    (step === 0 && damageType !== null) ||
    (step === 1 && propertyType !== null && severity !== null && areaM2 > 0) ||
    (step === 2 && trades.length > 0) ||
    step === 3 ||
    step === 4

  function goNext() {
    if (!canAdvance) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleContact(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="app">
      <header className="site-header">
        <a className="logo" href="#top">
          Renovo <span>ApS</span>
        </a>
        <div className="header-meta">
          <span>70 77 78 78</span>
          <span>kundeservice@renovo.dk</span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-media" aria-hidden="true" />
        <div className="hero-grain" aria-hidden="true" />
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="hero-brand">
            Reno<em>vo</em>
          </p>
          <h1>Vejledende tilbud på udbedring af din skade</h1>
          <p>
            Beregn et prisoverslag på forsikringsskade eller genopbygning — og
            send det videre til os for en konkret gennemgang.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#beregner">
              Start beregner
            </a>
            <a className="btn btn-ghost" href="tel:+4570777878">
              Ring 70 77 78 78
            </a>
          </div>
        </motion.div>
      </section>

      <section className="section" id="beregner">
        <motion.div
          className="section-intro"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.45 }}
        >
          <h2>Tilbudsberegner</h2>
          <p>
            Vælg skadetype, omfang og fag. Du får et vejledende interval inkl.
            moms — ikke et bindende tilbud. Endelig pris aftales efter
            besigtigelse.
          </p>
        </motion.div>

        <div className="calculator-shell">
          <div className="panel">
            <div className="steps" aria-label="Trin">
              {STEPS.map((label, index) => {
                const state =
                  index === step ? 'active' : index < step ? 'done' : ''
                return (
                  <span key={label} className={`step-pill ${state}`.trim()}>
                    {index + 1}. {label}
                  </span>
                )
              })}
            </div>

            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step-0" {...fadeSlide}>
                  <h3 className="step-title">Hvilken type skade?</h3>
                  <p className="step-copy">
                    Vi håndterer vand, storm, brand, indbrud, fugt og mere.
                  </p>
                  <div className="option-grid two">
                    {DAMAGE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`option ${damageType === option.id ? 'selected' : ''}`}
                        onClick={() => setDamageType(option.id)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="step-1" {...fadeSlide}>
                  <h3 className="step-title">Hvor og hvor stort?</h3>
                  <p className="step-copy">
                    Angiv boligtype, skadet areal og hvor omfattende skaden er.
                  </p>

                  <div className="option-grid two" style={{ marginBottom: '1.25rem' }}>
                    {PROPERTY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`option ${propertyType === option.id ? 'selected' : ''}`}
                        onClick={() => setPropertyType(option.id)}
                      >
                        <strong>{option.label}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="field">
                    <div className="range-row">
                      <label htmlFor="area">Skadet areal</label>
                      <div className="range-value">{areaM2} m²</div>
                    </div>
                    <input
                      id="area"
                      type="range"
                      min={5}
                      max={150}
                      step={1}
                      value={areaM2}
                      onChange={(e) => setAreaM2(Number(e.target.value))}
                    />
                  </div>

                  <div className="option-grid three">
                    {SEVERITY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`option ${severity === option.id ? 'selected' : ''}`}
                        onClick={() => setSeverity(option.id)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step-2" {...fadeSlide}>
                  <h3 className="step-title">Hvilke fag skal ind?</h3>
                  <p className="step-copy">
                    Vælg de håndværksfag, der typisk indgår i udbedringen.
                  </p>
                  <div className="option-grid two">
                    {TRADE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`option ${trades.includes(option.id) ? 'selected' : ''}`}
                        onClick={() => setTrades((prev) => toggleItem(prev, option.id))}
                      >
                        <strong>{option.label}</strong>
                        <span>
                          {option.id === 'tomrer'
                            ? 'Indgår i grundberegningen'
                            : `+ ${formatDkk(option.addOn)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step-3" {...fadeSlide}>
                  <h3 className="step-title">Tempo og opgraderinger</h3>
                  <p className="step-copy">
                    Mange opgraderer køkken, bad eller gulve i forbindelse med
                    genopbygningen.
                  </p>

                  <div className="option-grid" style={{ marginBottom: '1.25rem' }}>
                    {URGENCY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`option ${urgency === option.id ? 'selected' : ''}`}
                        onClick={() => setUrgency(option.id)}
                      >
                        <strong>{option.label}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="option-grid two">
                    {UPGRADE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`option ${upgrades.includes(option.id) ? 'selected' : ''}`}
                        onClick={() =>
                          setUpgrades((prev) => toggleItem(prev, option.id))
                        }
                      >
                        <strong>{option.label}</strong>
                        <span>
                          {option.description} · ca. {formatDkk(option.cost)}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step-4" {...fadeSlide}>
                  <h3 className="step-title">Dit vejledende overslag</h3>
                  <p className="step-copy">
                    Send dine oplysninger, så følger vi op med besigtigelse og et
                    konkret tilbud.
                  </p>

                  {submitted ? (
                    <p className="form-success">
                      Tak. Vi har registreret din forespørgsel lokalt i denne
                      demo. Ring 70 77 78 78 eller skriv til
                      kundeservice@renovo.dk for en rigtig sag.
                    </p>
                  ) : (
                    <form className="contact-form" onSubmit={handleContact}>
                      <div className="field">
                        <label htmlFor="name">Navn</label>
                        <input
                          id="name"
                          required
                          value={contact.name}
                          onChange={(e) =>
                            setContact((c) => ({ ...c, name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="phone">Telefon</label>
                        <input
                          id="phone"
                          type="tel"
                          required
                          value={contact.phone}
                          onChange={(e) =>
                            setContact((c) => ({ ...c, phone: e.target.value }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="email">E-mail</label>
                        <input
                          id="email"
                          type="email"
                          required
                          value={contact.email}
                          onChange={(e) =>
                            setContact((c) => ({ ...c, email: e.target.value }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="note">Kort beskrivelse (valgfri)</label>
                        <input
                          id="note"
                          value={contact.note}
                          onChange={(e) =>
                            setContact((c) => ({ ...c, note: e.target.value }))
                          }
                          placeholder="Fx vandskade i køkken efter rørbrud"
                        />
                      </div>
                      <button className="btn btn-dark" type="submit">
                        Send forespørgsel
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="nav-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={goBack}
                disabled={step === 0}
              >
                Tilbage
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={goNext}
                  disabled={!canAdvance}
                >
                  Fortsæt
                </button>
              ) : (
                <a className="btn btn-primary" href="tel:+4570777878">
                  Ring nu
                </a>
              )}
            </div>
          </div>

          <aside className="panel summary">
            <h3>Prisoverslag</h3>
            <p className="summary-lead">
              Opdateres løbende ud fra dine valg. Alle beløb er vejledende.
            </p>

            {quote.total > 0 ? (
              <>
                <div className="price-block">
                  <p className="price-label">Estimeret interval inkl. moms</p>
                  <p className="price-range">
                    {formatDkk(quote.low)} – {formatDkk(quote.high)}
                  </p>
                  <p className="price-note">
                    Forventet varighed ca. {quote.weeksLow}–{quote.weeksHigh}{' '}
                    uger efter opstart
                  </p>
                </div>

                <ul className="line-list">
                  {quote.lines.map((line) => (
                    <li key={line.label}>
                      <span>{line.label}</span>
                      <span>{formatDkk(line.amount)}</span>
                    </li>
                  ))}
                </ul>

                <div className="totals">
                  <div>
                    <span>Subtotal ekskl. moms</span>
                    <span>{formatDkk(quote.subtotal)}</span>
                  </div>
                  <div>
                    <span>Moms (25%)</span>
                    <span>{formatDkk(quote.vat)}</span>
                  </div>
                  <div className="grand">
                    <span>I alt inkl. moms</span>
                    <span>{formatDkk(quote.total)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="empty-state">
                Vælg skadetype og omfang for at se et overslag her.
              </p>
            )}

            <p className="disclaimer">
              Beregneren erstatter ikke besigtigelse. Forsikringsdækning aftales
              med dit selskab. Renovo ApS · CVR 39660067 · Stamholmen 173, 2650
              Hvidovre.
            </p>
          </aside>
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>Renovo</strong>
          <div>Forsikringsskader og erhvervsservice</div>
        </div>
        <div>70 77 78 78 · kundeservice@renovo.dk</div>
      </footer>
    </div>
  )
}
