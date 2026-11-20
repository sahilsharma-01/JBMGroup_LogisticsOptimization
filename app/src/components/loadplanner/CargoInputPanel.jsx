import { useMemo, useState } from 'react'
import { packagingSpecs } from '../../engine/specs'
import { tierCeiling } from '../../engine/bounds'

// ============================================================================
// CARGO INPUT
// ----------------------------------------------------------------------------
// Real measured figures go in here: packaging outside dimensions, tare mass,
// piece mass, piece count, stack rating and superimposed load rating. Every
// derived quantity is shown live next to the input, because a transposed digit
// in a packaging height is the single most common cause of a load plan that
// cannot be executed on the dock.
//
// Gross per unit = pieces x piece mass + packaging tare
// Volume per unit = L x W x H of the *packaging*, not of the part
// ============================================================================

const PACKAGING_OPTIONS = Object.entries(packagingSpecs).map(([name, spec]) => ({
  name, ...spec,
}))

const BLANK = {
  partNo: '',
  description: '',
  customerId: '',
  priority: 'high',
  dueTime: '14:00',
  containers: 4,
  piecesPerContainer: 8,
  pieceMassKg: 20,
  packaging: 'Steel Stillage (ST-1200)',
  lengthMm: 1200,
  widthMm: 1000,
  heightMm: 950,
  tareKg: 68,
  maxStackTiers: 2,
  topLoadCapacityKg: 1500,
  rotatableYaw: true,
  category: 'Chassis & Subframe',
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export function deriveLine(form, index) {
  const containers = Math.max(1, Math.round(num(form.containers)))
  const pieces = Math.max(0, Math.round(num(form.piecesPerContainer)))
  const grossPerUnit = pieces * num(form.pieceMassKg) + num(form.tareKg)
  const volPerUnit = (num(form.lengthMm) * num(form.widthMm) * num(form.heightMm)) / 1e9
  const id = form.id || `CUSTOM-${String(index + 1).padStart(3, '0')}`
  const partId = `${id}-PART`

  return {
    id,
    form,
    grossPerUnit,
    volPerUnit,
    totalGrossKg: grossPerUnit * containers,
    totalVolumeM3: volPerUnit * containers,
    footprintM2: (num(form.lengthMm) * num(form.widthMm)) / 1e6,
    part: {
      id: partId,
      name: form.description || 'Planner-entered line',
      partNo: form.partNo || id,
      category: form.category,
      oemModel: '',
      weight: num(form.pieceMassKg),
      volume: volPerUnit,
      containerType: form.packaging,
      unitsPerContainer: pieces,
      containerTareKg: num(form.tareKg),
      containerDimensions: {
        lengthMm: num(form.lengthMm),
        widthMm: num(form.widthMm),
        heightMm: num(form.heightMm),
      },
      maxStackTiers: Math.max(1, Math.round(num(form.maxStackTiers))),
      colorCode: '#7c3aed',
      fragility: 'Planner-entered',
    },
    order: {
      id,
      customerId: form.customerId,
      partId,
      quantity: pieces * containers,
      weight: grossPerUnit * containers,
      volume: volPerUnit * containers,
      bins: containers,
      containerType: form.packaging,
      priority: form.priority,
      status: 'qa-passed',
      dueTime: form.dueTime,
      poNumber: `PLANNER/${id}`,
      sapRef: '—',
      lineInfo: 'Entered in the load planner',
      notes: '',
      __custom: true,
      __overrideSpec: {
        topLoadCapacityKg: num(form.topLoadCapacityKg),
        rotatableYaw: Boolean(form.rotatableYaw),
      },
    },
  }
}

export default function CargoInputPanel({
  customLines, onChange, customers, vehicle,
}) {
  const [form, setForm] = useState({ ...BLANK, customerId: customers[0]?.id || '' })
  const [editingId, setEditingId] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Selecting a packaging family pulls in its real engineering properties, so
  // the planner only has to type the figures that are genuinely line-specific.
  const applyPackaging = (name) => {
    const spec = packagingSpecs[name]
    setForm(f => ({
      ...f,
      packaging: name,
      tareKg: name.includes('Stillage') ? 68 : name.includes('Trolley') ? 85 : name.includes('FLC') ? 42 : name.includes('EV') ? 55 : 3.5,
      topLoadCapacityKg: spec?.topLoadCapacityKg ?? 0,
      rotatableYaw: spec?.rotatableYaw ?? true,
    }))
  }

  const preview = useMemo(() => deriveLine(form, customLines.length), [form, customLines.length])

  const tiers = useMemo(() => {
    if (!vehicle) return null
    return tierCeiling({
      h: num(form.heightMm),
      maxTiers: Math.max(1, Math.round(num(form.maxStackTiers))),
      topLoadCapacityKg: num(form.topLoadCapacityKg),
      grossKg: preview.grossPerUnit,
      floorOnly: num(form.maxStackTiers) <= 1 || num(form.topLoadCapacityKg) <= 0,
    }, vehicle.deck.heightMm)
  }, [form, vehicle, preview.grossPerUnit])

  const deckShare = vehicle
    ? (preview.footprintM2 * preview.form.containers / Math.max(tiers || 1, 1)) / vehicle.deckAreaM2 * 100
    : 0

  const commit = () => {
    if (!form.customerId) return
    const line = deriveLine(
      { ...form, id: editingId || undefined },
      editingId ? customLines.findIndex(l => l.id === editingId) : customLines.length,
    )
    const next = editingId
      ? customLines.map(l => (l.id === editingId ? line : l))
      : [...customLines, line]
    onChange(next)
    setEditingId(null)
    setForm({ ...BLANK, customerId: form.customerId })
  }

  const edit = (line) => { setForm(line.form); setEditingId(line.id) }
  const remove = (id) => onChange(customLines.filter(l => l.id !== id))

  const F = ({ label, k, step = 1, unit, width }) => (
    <label className="ci-field" style={width ? { width } : undefined}>
      <span>{label}{unit && <em> {unit}</em>}</span>
      <input
        type="number"
        step={step}
        value={form[k]}
        onChange={e => set(k, e.target.value)}
      />
    </label>
  )

  return (
    <div className="ci">
      <div className="ci-intro">
        Enter measured packaging dimensions and masses. Gross mass per unit is computed as
        pieces × piece mass + packaging tare, and volume from the packaging envelope — never
        from the part itself.
      </div>

      <div className="ci-grid">
        <label className="ci-field ci-wide">
          <span>Part number</span>
          <input value={form.partNo} onChange={e => set('partNo', e.target.value)} placeholder="JBM-BIW-0000-X" />
        </label>
        <label className="ci-field ci-wide">
          <span>Description</span>
          <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Welded assembly" />
        </label>

        <label className="ci-field ci-wide">
          <span>Consignee</span>
          <select value={form.customerId} onChange={e => set('customerId', e.target.value)}>
            {customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.plant}</option>)}
          </select>
        </label>
        <label className="ci-field">
          <span>Due</span>
          <input type="time" value={form.dueTime} onChange={e => set('dueTime', e.target.value)} />
        </label>
        <label className="ci-field">
          <span>Priority</span>
          <select value={form.priority} onChange={e => set('priority', e.target.value)}>
            {['critical', 'high', 'medium', 'internal'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label className="ci-field ci-full">
          <span>Packaging family</span>
          <select value={form.packaging} onChange={e => applyPackaging(e.target.value)}>
            {PACKAGING_OPTIONS.map(o => (
              <option key={o.name} value={o.name}>
                {o.name} — {o.contactPoints} contact points, {o.topLoadCapacityKg === 0 ? 'no stacking' : `${o.topLoadCapacityKg} kg top load`}
              </option>
            ))}
          </select>
        </label>

        <F label="Containers" k="containers" />
        <F label="Pieces each" k="piecesPerContainer" />
        <F label="Piece mass" k="pieceMassKg" step={0.1} unit="kg" />
        <F label="Tare" k="tareKg" step={0.5} unit="kg" />

        <F label="Length" k="lengthMm" step={10} unit="mm" />
        <F label="Width" k="widthMm" step={10} unit="mm" />
        <F label="Height" k="heightMm" step={10} unit="mm" />

        <F label="Max tiers" k="maxStackTiers" />
        <F label="Top load" k="topLoadCapacityKg" step={50} unit="kg" />
        <label className="ci-field ci-check">
          <span>May turn 90°</span>
          <input type="checkbox" checked={form.rotatableYaw} onChange={e => set('rotatableYaw', e.target.checked)} />
        </label>
      </div>

      {/* live derived figures — this is the error-catching surface */}
      <div className="ci-derived">
        <div><span>Gross / unit</span><strong>{preview.grossPerUnit.toFixed(1)} kg</strong></div>
        <div><span>Volume / unit</span><strong>{preview.volPerUnit.toFixed(3)} m³</strong></div>
        <div><span>Footprint</span><strong>{preview.footprintM2.toFixed(2)} m²</strong></div>
        <div><span>Line total</span><strong>{(preview.totalGrossKg / 1000).toFixed(2)} t</strong></div>
        <div><span>Line volume</span><strong>{preview.totalVolumeM3.toFixed(2)} m³</strong></div>
        <div>
          <span>Tiers possible</span>
          <strong className={tiers === 1 ? 'text-warning' : ''}>{tiers ?? '—'}</strong>
        </div>
        <div>
          <span>Deck floor needed</span>
          <strong className={deckShare > 100 ? 'text-danger' : ''}>{deckShare.toFixed(0)}%</strong>
        </div>
      </div>

      {num(form.heightMm) > (vehicle?.deck.heightMm ?? 1e9) && (
        <div className="lp-alert critical">
          <strong>HEIGHT</strong>
          <span>
            {form.heightMm} mm exceeds the {vehicle.deck.heightMm} mm clear internal height of the
            selected vehicle. This line cannot be loaded.
          </span>
        </div>
      )}
      {(num(form.widthMm) > (vehicle?.deck.widthMm ?? 1e9)
        && num(form.lengthMm) > (vehicle?.deck.widthMm ?? 1e9)) && (
        <div className="lp-alert critical">
          <strong>WIDTH</strong>
          <span>
            Neither dimension fits the {vehicle.deck.widthMm} mm clear width in any orientation.
          </span>
        </div>
      )}

      <div className="ci-actions">
        <button className="btn btn-primary btn-sm" onClick={commit} disabled={!form.customerId}>
          {editingId ? 'Save line' : 'Add consignment line'}
        </button>
        {editingId && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setEditingId(null); setForm({ ...BLANK, customerId: form.customerId }) }}
          >
            Cancel
          </button>
        )}
      </div>

      {customLines.length > 0 && (
        <div className="ci-list">
          <span className="ci-list-title">Planner-entered lines ({customLines.length})</span>
          {customLines.map(l => (
            <div key={l.id} className="ci-list-row">
              <div>
                <strong>{l.form.partNo || l.id}</strong>
                <span>
                  {l.form.containers} × {l.form.lengthMm}×{l.form.widthMm}×{l.form.heightMm} mm ·
                  {' '}{l.grossPerUnit.toFixed(0)} kg each · {(l.totalGrossKg / 1000).toFixed(2)} t
                </span>
              </div>
              <div className="ci-list-btns">
                <button className="btn btn-secondary btn-sm" onClick={() => edit(l)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => remove(l.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
