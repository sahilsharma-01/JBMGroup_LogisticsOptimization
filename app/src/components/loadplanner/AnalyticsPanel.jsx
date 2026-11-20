import { useMemo, useState } from 'react'
import { Histogram, InfluenceChart, TightnessBars, ParetoScatter, StatTile, ShareBar } from './Charts'
import { paretoSet } from '../../engine/analytics'
import { inr, kg } from './format'

const CONSIGNEE_PALETTE = ['#1d4ed8', '#0891b2', '#7c3aed', '#c2410c', '#15803d', '#be123c']

export default function AnalyticsPanel({ plan, onConfigChange }) {
  const [scenarios, setScenarios] = useState(plan?.uncertainty?.config?.scenarios ?? 6000)
  const pareto = useMemo(() => paretoSet(plan.trials), [plan.trials])

  const b = plan.bounds
  const u = plan.uncertainty
  const d = plan.distribution
  const m = plan.marginal

  const massByConsignee = useMemo(() => {
    const map = new Map()
    plan.placements.forEach(p => {
      map.set(p.customerCode, (map.get(p.customerCode) || 0) + p.grossKg)
    })
    return [...map.entries()].map(([label, value], i) => ({
      label, value, colour: CONSIGNEE_PALETTE[i % CONSIGNEE_PALETTE.length],
    }))
  }, [plan.placements])

  return (
    <div className="an">
      {/* ---------- bounds / optimality ---------- */}
      <section className="an-block">
        <header>
          <h5>Optimality against provable bounds</h5>
          <p>
            Three relaxations of the loading problem, each keeping one resource and dropping the
            geometry. No feasible plan can beat them, so the gap is a real measure of pattern
            quality rather than a utilisation figure with nothing to compare against.
          </p>
        </header>

        <div className="an-tiles">
          <StatTile
            label="Cube bound"
            value={b.cubeBound.toFixed(2)}
            unit="loads"
            sub={`${b.totalVolumeM3.toFixed(1)} m³ goods ÷ ${b.deckVolumeM3.toFixed(1)} m³ deck`}
          />
          <StatTile
            label="Payload bound"
            value={b.massBound.toFixed(2)}
            unit="loads"
            sub={`${kg(b.totalMassKg)} ÷ ${kg(plan.vehicle.payloadKg)}`}
          />
          <StatTile
            label="Floor-area bound"
            value={b.floorAreaBound.toFixed(2)}
            unit="loads"
            sub={`A_min ${b.minFloorAreaM2.toFixed(1)} m² = ${b.floorOnlyAreaM2.toFixed(1)} non-stackable + ${b.stackableAreaM2.toFixed(1)} volume÷height`}
            tone={b.bindingResource === 'floor area' ? 'accent' : ''}
          />
          <StatTile
            label="Provable minimum"
            value={b.minVehicles}
            unit={b.minVehicles === 1 ? 'vehicle' : 'vehicles'}
            sub={`${b.bindingResource} binds at ${(b.continuousBound * 100).toFixed(0)}% of one load`}
            tone={b.minVehicles > 1 ? 'bad' : 'ok'}
          />
          <StatTile
            label="Area efficiency"
            value={b.areaEfficiencyPct !== null ? b.areaEfficiencyPct.toFixed(1) : '—'}
            unit={b.areaEfficiencyPct !== null ? '%' : ''}
            sub={b.areaGapPct !== null
              ? `${b.placedFootprintM2.toFixed(1)} m² used vs ${b.minFloorAreaM2.toFixed(1)} m² bound (${b.areaGapPct.toFixed(1)}% gap)`
              : 'Not all units seated — gap undefined'}
            tone={b.areaGapPct === null ? '' : b.areaGapPct <= 10 ? 'ok' : b.areaGapPct <= 25 ? 'warn' : 'bad'}
          />
          <StatTile
            label="Envelope length"
            value={(b.envelopeLengthMm / 1000).toFixed(2)}
            unit="m"
            sub={`Bound ${(b.minEnvelopeLengthMm / 1000).toFixed(2)} m of ${(plan.vehicle.deck.lengthMm / 1000).toFixed(2)} m deck`}
          />
        </div>

        <p className="an-verdict">{plan.boundsVerdict}</p>

        {b.tierDetail.length > 0 && (
          <table className="compact-enterprise-table an-table">
            <thead>
              <tr><th>Packaging</th><th>Units</th><th>Footprint</th><th>Height</th><th>Tier ceiling</th><th>Limited by</th></tr>
            </thead>
            <tbody>
              {b.tierDetail.map(t => (
                <tr key={t.key}>
                  <td className="font-mono">{t.packagingCode}</td>
                  <td>{t.units}</td>
                  <td>{t.footprintM2.toFixed(2)} m²</td>
                  <td>{t.heightMm} mm</td>
                  <td className="text-bold">{t.tierCeiling}</td>
                  <td className="lp-sub">{t.limitedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------- constraint tightness ---------- */}
      <section className="an-block">
        <header>
          <h5>What is actually binding</h5>
          <p>
            Every limit normalised to its own ceiling. The marker is 100%. Anything at or above
            90% is effectively binding once declared-mass error is allowed for.
          </p>
        </header>
        <TightnessBars rows={plan.tightness.rows} />
      </section>

      {/* ---------- influence lines ---------- */}
      <section className="an-block">
        <header>
          <h5>Axle influence lines</h5>
          <p>
            The marginal axle cost of every bay. Lines are the fraction of one kilogram placed at
            that position which lands on each axle group; bars are where the mass actually is.
            {plan.influence.steerZeroXMm !== null && (
              <>
                {' '}Past {(plan.influence.steerZeroXMm / 1000).toFixed(2)} m the steer coefficient
                turns negative: mass loaded there <strong>lifts</strong> the steer axle through the
                rear overhang, which is what light steering and poor braking feel like from the cab.
              </>
            )}
          </p>
        </header>
        <InfluenceChart
          influence={plan.influence}
          profile={plan.massProfile}
          axles={d.axles}
        />
        <div className="an-tiles">
          <StatTile
            label="Peak bay"
            value={`B${String(plan.massProfile.peakBay?.bay ?? 0).padStart(2, '0')}`}
            sub={`${kg(plan.massProfile.peakBay?.massKg ?? 0)} · ${(plan.massProfile.peakBay?.sharePct ?? 0).toFixed(0)}% of cargo`}
          />
          {d.axles.map(a => {
            const contribution = plan.massProfile.bays.reduce(
              (s, bay) => s + (bay.contribution[a.id] || 0), 0,
            )
            return (
              <StatTile
                key={a.id}
                label={`${a.label} from cargo`}
                value={Math.round(contribution).toLocaleString('en-IN')}
                unit="kg"
                sub={`plus tare — total ${a.loadKg.toLocaleString('en-IN')} of ${a.limitKg.toLocaleString('en-IN')} kg`}
                tone={a.compliant ? '' : 'bad'}
              />
            )
          })}
        </div>
      </section>

      {/* ---------- uncertainty ---------- */}
      {u && (
        <section className="an-block">
          <header>
            <h5>Declared-mass uncertainty</h5>
            <p>
              {u.scenarios.toLocaleString('en-IN')} Monte Carlo scenarios over the mass vector.
              Each scenario applies a correlated batch offset per part number (a coil lot running
              heavy makes every unit heavy at once), an idiosyncratic per-unit error, positive
              drift on returnable packaging, pick error, and the gate weighbridge's own accuracy.
              Reactions are evaluated exactly from the influence coefficients, not re-solved.
            </p>
          </header>

          <div className={`an-banner ${u.verdict.level}`}>
            <strong>{u.verdict.level === 'ok' ? 'ROBUST' : u.verdict.level.toUpperCase()}</strong>
            <span>{u.verdict.text}</span>
          </div>

          <div className="an-charts">
            {u.axles.map(a => (
              <div className="an-chart" key={a.id}>
                <div className="an-chart-head">
                  <strong>{a.label}</strong>
                  <span>
                    μ {Math.round(a.mean).toLocaleString('en-IN')} · σ {a.sd.toFixed(0)} kg
                    {' '}({((a.sd / a.mean) * 100).toFixed(2)}%) · p99 {Math.round(a.p99).toLocaleString('en-IN')}
                  </span>
                </div>
                <Histogram
                  bins={a.histogram}
                  limit={a.limitKg}
                  nominal={a.mean}
                  p99={a.p99}
                  unit=" kg"
                  colour={a.breachProb > 0 ? '#dc2626' : '#0284c7'}
                />
                <div className="an-chart-foot">
                  <span className={a.breachProb > 0 ? 'text-danger' : 'text-success'}>
                    P(breach) {(a.breachProb * 100).toFixed(2)}%
                  </span>
                  <span>Plan-to headroom {kg(Math.max(0, a.headroomP99Kg))} at p99</span>
                </div>
              </div>
            ))}

            <div className="an-chart">
              <div className="an-chart-head">
                <strong>Gross vehicle weight as weighed</strong>
                <span>
                  μ {Math.round(u.gross.mean).toLocaleString('en-IN')} · p99{' '}
                  {Math.round(u.gross.p99).toLocaleString('en-IN')} kg
                </span>
              </div>
              <Histogram
                bins={u.gross.histogram}
                limit={u.gross.limitKg}
                nominal={u.gross.mean}
                p99={u.gross.p99}
                unit=" kg"
                colour={u.gross.breachProb > 0 ? '#dc2626' : '#16a34a'}
              />
              <div className="an-chart-foot">
                <span>P(over GVW) {(u.gross.breachProb * 100).toFixed(2)}%</span>
                <span>Longitudinal CoG σ {u.cogPct.sd.toFixed(2)} pp</span>
              </div>
            </div>
          </div>

          <div className="an-controls">
            <label>
              Scenarios
              <select
                value={scenarios}
                onChange={e => {
                  const v = Number(e.target.value)
                  setScenarios(v)
                  onConfigChange && onConfigChange({ scenarios: v })
                }}
              >
                {[2000, 6000, 20000, 50000].map(n => (
                  <option key={n} value={n}>{n.toLocaleString('en-IN')}</option>
                ))}
              </select>
            </label>
            <span className="lp-sub">
              {u.partIds} distinct part numbers contribute independent batch offsets. A single-part
              full load carries far more mass risk than a diversified one, because nothing averages out.
            </span>
          </div>
        </section>
      )}

      {/* ---------- deck structure ---------- */}
      <section className="an-block">
        <header>
          <h5>Deck structural check</h5>
          <p>
            A steel stillage bears on four welded feet, so the pressure at the foot governs, not
            the nominal footprint pressure — which is roughly an order of magnitude lower and would
            never flag a floor failure.
          </p>
        </header>
        <div className="an-tiles">
          <StatTile
            label="Worst distributed"
            value={plan.deckCheck.worstDistributedPct.toFixed(0)}
            unit="%"
            sub={`${Math.round(plan.deckCheck.distributedStats?.max ?? 0)} of ${plan.deckCheck.ratings.distributedKgPerM2} kg/m²`}
            tone={plan.deckCheck.worstDistributedPct > 100 ? 'bad' : plan.deckCheck.worstDistributedPct > 80 ? 'warn' : 'ok'}
          />
          <StatTile
            label="Worst point load"
            value={plan.deckCheck.worstContactPct.toFixed(0)}
            unit="%"
            sub={`${Math.round(plan.deckCheck.contactStats?.max ?? 0)} kg per foot of ${plan.deckCheck.ratings.pointLoadKgPerContact} kg`}
            tone={plan.deckCheck.worstContactPct > 100 ? 'bad' : plan.deckCheck.worstContactPct > 80 ? 'warn' : 'ok'}
          />
          <StatTile
            label="Deck pressure"
            value={Math.round(plan.pressure.stats?.mean ?? 0)}
            unit="kg/m²"
            sub={`p95 ${Math.round(plan.pressure.stats?.p95 ?? 0)} · max ${Math.round(plan.pressure.stats?.max ?? 0)}`}
          />
          <StatTile
            label="Stacks on deck"
            value={plan.deckCheck.stacks.length}
            sub={`heaviest ${kg(plan.deckCheck.stacks[0]?.stackKg ?? 0)} over ${plan.deckCheck.stacks[0]?.contactPoints ?? 0} feet`}
          />
        </div>
        <table className="compact-enterprise-table an-table">
          <thead>
            <tr><th>Base unit</th><th>Pkg</th><th>Tiers</th><th>Stack mass</th><th>kg/m²</th><th>kg per foot</th><th>Position</th></tr>
          </thead>
          <tbody>
            {plan.deckCheck.stacks.slice(0, 6).map(s => (
              <tr key={s.key}>
                <td className="font-mono">{s.baseHuId}</td>
                <td>{s.packagingCode}</td>
                <td>{s.tiers}</td>
                <td>{kg(s.stackKg)}</td>
                <td>{Math.round(s.distributedKgPerM2)}</td>
                <td className={s.perContactKg > plan.deckCheck.ratings.pointLoadKgPerContact ? 'text-danger text-bold' : ''}>
                  {Math.round(s.perContactKg)}
                </td>
                <td className="lp-sub">x{s.x} z{s.z}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------- solver search ---------- */}
      <section className="an-block">
        <header>
          <h5>Solver search space</h5>
          <p>
            {plan.trials.length} strategy parameterisations, plotted as packing compactness against
            axle margin. Statutory compliance is a hard constraint, so infeasible candidates can
            never win no matter how tightly they pack.
          </p>
        </header>
        <ParetoScatter points={pareto} chosenLabel={plan.trials[0]?.label} />
      </section>

      {/* ---------- economics ---------- */}
      <section className="an-block">
        <header>
          <h5>Trip economics</h5>
          <p>
            Fuel from the laden consumption figure over the routed distance, plus tolls and driver
            cost. The air-freight figure is the share of this trip's cost attributable to hauling
            empty deck.
          </p>
        </header>
        <div className="an-tiles">
          <StatTile label="Trip cost" value={inr(plan.economics.tripCostInr)} sub={`${plan.economics.roundTripKm} km round trip · ${plan.economics.litres} L`} />
          <StatTile label="Per m³ delivered" value={inr(m.costPerM3Inr)} sub={`${plan.capacity.goodsVolumeM3.toFixed(1)} m³ of goods`} />
          <StatTile label="Per tonne" value={inr(m.costPerTonneInr)} sub={`${(d.cargoMassKg / 1000).toFixed(2)} t carried`} />
          <StatTile label="Per handling unit" value={inr(m.costPerUnitInr)} sub={`${plan.kpi.unitsPlaced} units`} />
          <StatTile label="Cost of hauling air" value={inr(m.residualValueInr)} sub={`${plan.capacity.floorFreeM2.toFixed(1)} m² of deck left empty`} tone={m.residualValueInr > plan.economics.tripCostInr * 0.2 ? 'warn' : ''} />
          <StatTile label="CO₂" value={plan.economics.co2Kg} unit="kg" sub={`${(plan.economics.co2Kg / Math.max(plan.capacity.goodsVolumeM3, 0.01)).toFixed(1)} kg per m³`} />
        </div>

        <div className="an-share">
          <span className="an-share-title">Mass by consignee</span>
          <ShareBar segments={massByConsignee} />
          <div className="ch-legend">
            {massByConsignee.map(s => (
              <span key={s.label}>
                <i style={{ background: s.colour }} />
                {s.label} — {kg(s.value)}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
