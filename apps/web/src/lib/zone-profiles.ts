// Soil & plant profile data for irrigation calculations
// Sources: USDA NRCS, FAO-56, EPA WaterSense, university extension programs
// All values stored in inches (converted to cm for display when length_unit = 'cm')

export type SoilType = 'sand' | 'sandy_loam' | 'loam' | 'clay_loam' | 'silt_loam' | 'silty_clay' | 'clay';
export type PlantType =
  | 'cool_turf' | 'warm_turf'
  | 'annuals' | 'perennials'
  | 'shade_trees' | 'evergreen_trees' | 'fruit_trees'
  | 'xeriscape' | 'vegetable' | 'native_plants';

export interface SoilProfile {
  key: SoilType;
  label: string;
  intakeRate: number;   // in/hr — basic steady-state infiltration rate
  awc: number;          // in/ft — available water capacity per foot of soil depth
  color: string;        // tailwind bg class for visual swatch
}

export interface PlantProfile {
  key: PlantType;
  label: string;
  rootDepth: number;    // inches — effective root zone depth
  kc: number;           // crop coefficient (multiply by ET₀)
  mad: number;          // management allowed depletion (fraction 0-1)
  icon: string;         // material symbol icon name
  minZone?: number;     // minimum USDA hardiness zone (inclusive)
  maxZone?: number;     // maximum USDA hardiness zone (inclusive)
}

export const SOIL_PROFILES: SoilProfile[] = [
  { key: 'sand',       label: 'Sand',       intakeRate: 2.0,  awc: 0.70, color: 'bg-amber-200' },
  { key: 'sandy_loam', label: 'Sandy Loam', intakeRate: 1.0,  awc: 1.10, color: 'bg-amber-300' },
  { key: 'loam',       label: 'Loam',       intakeRate: 0.5,  awc: 1.70, color: 'bg-amber-600' },
  { key: 'clay_loam',  label: 'Clay Loam',  intakeRate: 0.3,  awc: 1.80, color: 'bg-amber-700' },
  { key: 'silt_loam',  label: 'Silt Loam',  intakeRate: 0.4,  awc: 2.00, color: 'bg-amber-500' },
  { key: 'silty_clay', label: 'Silty Clay',  intakeRate: 0.2,  awc: 1.60, color: 'bg-orange-700' },
  { key: 'clay',       label: 'Clay',       intakeRate: 0.1,  awc: 1.50, color: 'bg-orange-800' },
];

export const PLANT_PROFILES: PlantProfile[] = [
  // Turf — zone-dependent recommendation
  { key: 'cool_turf',       label: 'Cool-Season Lawn',    rootDepth: 6,  kc: 0.80, mad: 0.50, icon: 'grass',         minZone: 2, maxZone: 7 },
  { key: 'warm_turf',       label: 'Warm-Season Lawn',    rootDepth: 8,  kc: 0.60, mad: 0.50, icon: 'grass',         minZone: 7, maxZone: 11 },
  // Trees
  { key: 'evergreen_trees', label: 'Evergreen / Cedar',   rootDepth: 18, kc: 0.45, mad: 0.50, icon: 'park',          minZone: 2, maxZone: 8 },
  { key: 'shade_trees',     label: 'Shade Trees',         rootDepth: 36, kc: 0.50, mad: 0.50, icon: 'forest',        minZone: 3, maxZone: 10 },
  { key: 'fruit_trees',     label: 'Fruit Trees',         rootDepth: 24, kc: 0.65, mad: 0.45, icon: 'nutrition',     minZone: 4, maxZone: 10 },
  // Garden & landscape
  { key: 'annuals',         label: 'Annual Flowers',      rootDepth: 6,  kc: 0.80, mad: 0.50, icon: 'local_florist' },
  { key: 'perennials',      label: 'Shrubs / Perennials', rootDepth: 18, kc: 0.50, mad: 0.50, icon: 'eco' },
  { key: 'vegetable',       label: 'Vegetable Garden',    rootDepth: 12, kc: 0.75, mad: 0.40, icon: 'compost' },
  { key: 'native_plants',   label: 'Native Plants',       rootDepth: 18, kc: 0.35, mad: 0.55, icon: 'psychiatry' },
  { key: 'xeriscape',       label: 'Desert / Xeriscape',  rootDepth: 12, kc: 0.30, mad: 0.60, icon: 'spa',           minZone: 7, maxZone: 13 },
];

export function getSoilProfile(key: string | null): SoilProfile | null {
  return SOIL_PROFILES.find(s => s.key === key) ?? null;
}

export function getPlantProfile(key: string | null): PlantProfile | null {
  return PLANT_PROFILES.find(p => p.key === key) ?? null;
}

/** Filter plant profiles by hardiness zone compatibility */
export function getPlantProfilesForZone(zoneNumber: number | null): {
  recommended: PlantProfile[];
  other: PlantProfile[];
} {
  if (zoneNumber === null) return { recommended: PLANT_PROFILES, other: [] };

  const recommended: PlantProfile[] = [];
  const other: PlantProfile[] = [];

  for (const p of PLANT_PROFILES) {
    const inRange = (!p.minZone || zoneNumber >= p.minZone) && (!p.maxZone || zoneNumber <= p.maxZone);
    if (inRange) {
      recommended.push(p);
    } else {
      other.push(p);
    }
  }

  return { recommended, other };
}

// Unit conversion helpers
export function inToUnit(inches: number, unit: 'in' | 'cm'): number {
  return unit === 'cm' ? inches * 2.54 : inches;
}

export function formatLength(inches: number, unit: 'in' | 'cm'): string {
  const val = inToUnit(inches, unit);
  return unit === 'cm' ? `${val.toFixed(1)} cm` : `${val.toFixed(2)} in`;
}

export function formatRate(inPerHr: number, unit: 'in' | 'cm'): string {
  const val = inToUnit(inPerHr, unit);
  return unit === 'cm' ? `${val.toFixed(2)} cm/hr` : `${val.toFixed(2)} in/hr`;
}
