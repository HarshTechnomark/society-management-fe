import type { GeneratorBuilding, GeneratorInput, GeneratorPosition, UnitType } from '@/types/societySetup';

export interface GenRow {
  mode: 'existing' | 'new';
  buildingId: string;
  code: string;
  name: string;
  kind: 'TOWER' | 'WING' | 'COMMERCIAL';
}
export interface GenPos {
  unitType: UnitType;
  bhk: string;
  carpet: string;
  builtUp: string;
  superArea: string;
}
export interface GenForm {
  rows: GenRow[];
  floorFrom: string;
  floorTo: string;
  positions: GenPos[];
  pattern: string;
  skipFloors: string;
  skipCells: string;
}

export const PATTERN_TOKENS = [
  '{building}',
  '{floor}',
  '{floor:2}',
  '{pos}',
  '{pos:2}',
  '{posAlpha}',
  '{seq}',
  '{seq:3}',
];

/** The pattern the onboarding wizard uses: `{floor}0{pos}` below ten positions, else `{floor}{pos:2}`. */
export const defaultPattern = (positions: number) => (positions < 10 ? '{floor}0{pos}' : '{floor}{pos:2}');

export const blankPos = (): GenPos => ({ unitType: 'FLAT', bhk: '', carpet: '', builtUp: '', superArea: '' });
export const blankRow = (): GenRow => ({ mode: 'new', buildingId: '', code: '', name: '', kind: 'TOWER' });

export const blankForm = (): GenForm => ({
  rows: [blankRow()],
  floorFrom: '1',
  floorTo: '10',
  positions: [blankPos(), blankPos(), blankPos(), blankPos()],
  pattern: defaultPattern(4),
  skipFloors: '',
  skipCells: '',
});

const AREA = /^\d{1,6}(\.\d{1,3})?$/;

/** Turns the form into the API body, or returns `errors` per field name. */
export function buildGeneratorInput(
  f: GenForm,
): { input: GeneratorInput; errors?: undefined } | { input?: undefined; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const buildings: GeneratorBuilding[] = [];
  f.rows.forEach((r, i) => {
    if (r.mode === 'existing') {
      if (!r.buildingId) errors[`building${i}`] = 'Choose a building.';
      else buildings.push({ buildingId: Number(r.buildingId) });
    } else {
      const code = r.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{1,6}$/.test(code)) errors[`building${i}`] = 'Code: 1 to 6 letters or digits.';
      else buildings.push({ newBuilding: { code, name: r.name.trim() || `Tower ${code}`, kind: r.kind } });
    }
  });
  const codes = f.rows.filter(r => r.mode === 'new').map(r => r.code.trim().toUpperCase());
  if (new Set(codes).size !== codes.length) errors.buildings = 'Each building code can be used once.';
  const floorFrom = Number(f.floorFrom);
  const floorTo = Number(f.floorTo);
  if (!Number.isInteger(floorFrom) || floorFrom < -5 || floorFrom > 200)
    errors.floorFrom = 'From floor: -5 to 200.';
  if (!Number.isInteger(floorTo) || floorTo < floorFrom || floorTo > 200)
    errors.floorTo = 'To floor: not below the first floor, at most 200.';
  if (f.pattern.trim().length < 1 || f.pattern.trim().length > 40)
    errors.pattern = 'Pattern: 1 to 40 characters.';
  const positions: GeneratorPosition[] = f.positions.map((p, i) => {
    for (const [k, v] of [
      ['carpet', p.carpet],
      ['builtUp', p.builtUp],
      ['superArea', p.superArea],
    ] as const)
      if (v && !AREA.test(v)) errors[`pos${i}.${k}`] = 'Number with up to 3 decimals.';
    const one: GeneratorPosition = { position: i + 1, unitType: p.unitType };
    if (p.bhk && p.unitType === 'FLAT') one.bhk = p.bhk;
    if (p.carpet) one.carpetAreaSqft = p.carpet;
    if (p.builtUp) one.builtUpAreaSqft = p.builtUp;
    if (p.superArea) one.superBuiltUpAreaSqft = p.superArea;
    return one;
  });
  const skipFloors: number[] = [];
  for (const t of f.skipFloors
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)) {
    const n = Number(t);
    if (!Number.isInteger(n)) errors.skipFloors = `"${t}" is not a floor number.`;
    else skipFloors.push(n);
  }
  const skipCells: { floor: number; position: number }[] = [];
  for (const t of f.skipCells
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)) {
    const m = /^(-?\d+)\s*[:/-]\s*(\d+)$/.exec(t);
    if (!m) errors.skipCells = `"${t}" should look like 5:2 (floor:position).`;
    else skipCells.push({ floor: Number(m[1]), position: Number(m[2]) });
  }
  if (Object.keys(errors).length) return { errors };
  const input: GeneratorInput = { buildings, floorFrom, floorTo, positions, pattern: f.pattern.trim() };
  if (skipFloors.length) input.skipFloors = skipFloors;
  if (skipCells.length) input.skipCells = skipCells;
  return { input };
}
