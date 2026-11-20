import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { overloadPenaltyInr } from '../src/engine/loadPlan.js';
import { resolveVehicle, frictionFor, STATUTORY_AXLE_LIMITS_KG } from '../src/engine/specs.js';
import { computeWeightDistribution } from '../src/engine/physics.js';
import { buildSecuringPlan } from '../src/engine/securing.js';
import { vehicleTypes } from '../src/data/seedData.js';

describe('JBM LoadIQ Physics & Compliance Engine', () => {
  describe('Statutory Overload Penalties (MV Amendment Act 2019)', () => {
    it('returns zero penalty for compliant non-overloaded cargo', () => {
      assert.equal(overloadPenaltyInr(0), 0);
      assert.equal(overloadPenaltyInr(-250), 0);
    });

    it('calculates correct statutory penalties for overweight cargo', () => {
      // 500 kg overload -> ₹20,000 base + 1st tonne (₹2,000) = ₹22,000
      assert.equal(overloadPenaltyInr(500), 22000);
      // 1500 kg overload -> ₹20,000 base + 2 tonnes (₹4,000) = ₹24,000
      assert.equal(overloadPenaltyInr(1500), 24000);
    });
  });

  describe('Vehicle Specifications & Regulatory Limits', () => {
    it('resolves standard vehicle geometry and axle bounds', () => {
      const vType = vehicleTypes[0]; // e.g. 32ft MX Multi-Axle
      assert.ok(vType, 'Catalogue vehicle type must exist');
      const resolved = resolveVehicle(vType);

      assert.ok(resolved.payloadKg > 0, 'Payload must be positive');
      assert.ok(resolved.gvwKg > resolved.payloadKg, 'GVW must exceed payload');
      assert.ok(resolved.deck.lengthMm > 0, 'Deck length must be positive');
      assert.ok(resolved.deck.widthMm > 0, 'Deck width must be positive');
      assert.ok(resolved.geometry.wheelbaseMm > 0, 'Wheelbase must be positive');
    });

    it('enforces statutory axle group limits', () => {
      assert.equal(STATUTORY_AXLE_LIMITS_KG.SINGLE_2_TYRE, 7500);
      assert.equal(STATUTORY_AXLE_LIMITS_KG.SINGLE_4_TYRE, 11500);
      assert.equal(STATUTORY_AXLE_LIMITS_KG.TANDEM_8_TYRE, 19000);
      assert.equal(STATUTORY_AXLE_LIMITS_KG.TRIDEM_12_TYRE, 24000);
    });

    it('computes friction coefficients according to contact materials', () => {
      const muWoodSteel = frictionFor('steel', 'plywood');
      assert.ok(muWoodSteel > 0 && muWoodSteel <= 1.0);

      const muWheeled = frictionFor('wheeled');
      assert.equal(muWheeled, 0.0);
    });
  });

  describe('Weight Distribution and Axle Reactions', () => {
    it('accurately calculates static axle loads from cargo placements', () => {
      const vType = vehicleTypes[0];
      const resolved = resolveVehicle(vType);

      // Place a 2,000 kg pallet centrally in the cargo deck
      const testPlacements = [
        {
          huId: 'TEST-HU-01',
          x: 2000,
          y: 0,
          z: 200,
          l: 1200,
          w: 1000,
          h: 1000,
          grossKg: 2000,
          mu: 0.45,
          baseMaterial: 'wood',
        },
      ];

      const dist = computeWeightDistribution(resolved, testPlacements);
      assert.equal(dist.cargoMassKg, 2000);
      assert.ok(dist.axles.length > 0, 'Axle groups must be evaluated');
      
      const totalAxleLoad = dist.axles.reduce((sum, a) => sum + a.loadKg, 0);
      assert.equal(Math.round(totalAxleLoad), Math.round(resolved.tareKg + 2000));
    });
  });

  describe('Cargo Securing Schedule (EN 12195-1)', () => {
    it('generates lashing and blocking schedule for placed cargo', () => {
      const vType = vehicleTypes[0];
      const resolved = resolveVehicle(vType);
      const testPlacements = [
        {
          huId: 'TEST-HU-01',
          x: 1000,
          y: 0,
          z: 200,
          l: 1200,
          w: 1000,
          h: 1000,
          grossKg: 1500,
          tier: 1,
          mu: 0.45,
          baseMaterial: 'wood',
        },
      ];

      const securing = buildSecuringPlan(resolved, testPlacements);
      assert.ok(securing, 'Securing plan should be created');
      assert.ok(Array.isArray(securing.items), 'Securing plan should list items');
      assert.equal(securing.items.length, 1);
    });
  });
});
