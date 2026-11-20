// ============================================================================
// VEHICLE INPUT
// ----------------------------------------------------------------------------
// Catalogue specifications and real vehicles differ. A body builder adds 40 mm
// of floor, a tail lift takes 300 kg off the payload, and the weighbridge tare
// is never the brochure tare. Anything typed here overrides the catalogue, and
// the axle model, bounds and uncertainty analysis all re-solve against it.
// ============================================================================

const FIELDS = [
  { group: 'Clear internal body', items: [
    ['lengthMm', 'Length', 'mm', 10],
    ['widthMm', 'Width', 'mm', 10],
    ['heightMm', 'Height', 'mm', 10],
  ] },
  { group: 'Mass ratings', items: [
    ['payloadKg', 'Payload', 'kg', 50],
    ['gvwKg', 'GVW on the RC', 'kg', 50],
  ] },
  { group: 'Chassis geometry', items: [
    ['wheelbaseMm', 'Wheelbase', 'mm', 50],
    ['deckFrontFromSteerMm', 'Steer axle to deck front', 'mm', 10],
    ['deckHeightMm', 'Deck height above ground', 'mm', 10],
    ['trackWidthMm', 'Track width', 'mm', 10],
    ['tareSteerShare', 'Tare share on steer axle', '0–1', 0.01],
  ] },
]

export default function VehicleInputPanel({
  vehicleType, vehicle, overrides, onChange, onReset,
}) {
  if (!vehicleType || !vehicle) return <div className="lp-empty">Select a vehicle.</div>

  const o = overrides[vehicleType.id] || {}
  const set = (k, v) => onChange({
    ...overrides,
    [vehicleType.id]: { ...o, [k]: v === '' ? '' : v },
  })

  const catalogue = {
    lengthMm: vehicleType.dimensions.lengthMm,
    widthMm: vehicleType.dimensions.widthMm,
    heightMm: vehicleType.dimensions.heightMm,
    payloadKg: vehicleType.payloadKg,
    gvwKg: vehicleType.gvwKg,
    wheelbaseMm: vehicle.geometry.wheelbaseMm,
    deckFrontFromSteerMm: vehicle.geometry.deckFrontFromSteerMm,
    deckHeightMm: vehicle.geometry.deckHeightMm,
    trackWidthMm: vehicle.geometry.trackWidthMm,
    tareSteerShare: vehicle.geometry.tareSteerShare,
  }

  const isArtic = vehicle.geometry.vehicleClass === 'articulated'
  const dirty = Object.values(o).some(v => v !== '' && v !== undefined)

  return (
    <div className="ci">
      <div className="ci-intro">
        Blank means “use the catalogue figure”. Overrides apply to
        {' '}<strong>{vehicleType.name}</strong> only and drive every downstream calculation.
      </div>

      {FIELDS.map(section => {
        if (isArtic && section.group === 'Chassis geometry') return null
        return (
          <div key={section.group} className="vi-section">
            <span className="vi-section-title">{section.group}</span>
            <div className="ci-grid">
              {section.items.map(([k, label, unit, step]) => (
                <label className="ci-field" key={k}>
                  <span>{label}{unit && <em> {unit}</em>}</span>
                  <input
                    type="number"
                    step={step}
                    value={o[k] ?? ''}
                    placeholder={String(catalogue[k])}
                    onChange={e => set(k, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )
      })}

      <div className="vi-section">
        <span className="vi-section-title">Axle plate ratings</span>
        <div className="ci-grid">
          {vehicle.axleGroups.map(a => (
            <label className="ci-field" key={a.id}>
              <span>{a.label}<em> kg</em></span>
              <input
                type="number"
                step={100}
                value={o[`axle_${a.id}_Kg`] ?? ''}
                placeholder={String(a.plateKg)}
                onChange={e => set(`axle_${a.id}_Kg`, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="vi-note">
          The engine uses min(statutory limit, plate rating) for each group. Currently:
          {vehicle.axleGroups.map(a => (
            <span key={a.id} className="vi-chip">
              {a.label}: {a.limitKg.toLocaleString('en-IN')} kg ({a.governedBy})
            </span>
          ))}
        </div>
      </div>

      <div className="ci-derived">
        <div><span>Deck area</span><strong>{vehicle.deckAreaM2.toFixed(2)} m²</strong></div>
        <div><span>Deck volume</span><strong>{vehicle.deckVolumeM3.toFixed(1)} m³</strong></div>
        <div><span>Tare (derived)</span><strong>{vehicle.tareKg.toLocaleString('en-IN')} kg</strong></div>
        <div><span>Deck distributed rating</span><strong>{vehicle.deckRatings.distributedKgPerM2} kg/m²</strong></div>
        <div><span>Deck point rating</span><strong>{vehicle.deckRatings.pointLoadKgPerContact} kg</strong></div>
        <div><span>Body</span><strong>EN 12642 {vehicle.geometry.bodyCode}</strong></div>
      </div>

      {dirty && (
        <div className="ci-actions">
          <span className="badge badge-warning">Customised — results reflect your figures</span>
          <button className="btn btn-secondary btn-sm" onClick={onReset}>Reset to catalogue</button>
        </div>
      )}
    </div>
  )
}
