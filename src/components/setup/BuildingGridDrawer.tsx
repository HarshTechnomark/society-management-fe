'use client';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';
import type { Building } from '@/types/societySetup';
import { bhkLabel, sqft } from './format';

/** Floors as rows (top floor first), flats as cells; "Area missing" in amber with an icon (spec 11.6). */
export function BuildingGridDrawer({
  building,
  onClose,
  onOpenUnit,
}: {
  building: Building | null;
  onClose: () => void;
  onOpenUnit: (id: number) => void;
}) {
  const id = building?.id ?? 0;
  const { data, error, loading } = useLoad(
    () => (id ? societySetupService.grid(id) : Promise.resolve(null)),
    id,
  );
  return (
    <Drawer
      open={!!building}
      onClose={onClose}
      size={640}
      title={building ? `${building.name} flats` : 'Flats'}
    >
      {error ? (
        <ErrorState error={error} />
      ) : loading || !data ? (
        <div className="skeleton h-40 w-full" aria-busy="true" />
      ) : data.floors.length === 0 ? (
        <p className="text-[14px] text-muted">No flats in this building yet.</p>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <Chip>{data.totals.units} flats</Chip>
            <Chip tone={data.totals.missingArea ? 'warn' : 'ok'}>{data.totals.missingArea} without area</Chip>
          </div>
          <div className="overflow-x-auto" data-testid="grid-scroll">
            <table className="min-w-full border-separate border-spacing-1 text-[12.5px]">
              <caption className="sr-only">Flats by floor</caption>
              <tbody>
                {data.floors.map(f => (
                  <tr key={f.floor}>
                    <th scope="row" className="w-10 whitespace-nowrap pr-2 text-left font-semibold">
                      {f.floorLabel}
                    </th>
                    <td>
                      <div className="flex gap-1.5">
                        {f.units.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => onOpenUnit(u.id)}
                            className="min-w-[96px] rounded-xl border border-[var(--line)] bg-white/70 p-2 text-left hover:bg-white"
                          >
                            <span className="block font-bold">{u.label}</span>
                            <span className="block text-muted">{bhkLabel(u.bhk)}</span>
                            {u.areaSqft ? (
                              <span className="block">{sqft(u.areaSqft)} sq ft</span>
                            ) : (
                              <span className="flex items-center gap-1 font-semibold text-[#6f4200]">
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  aria-hidden="true"
                                >
                                  <path d="M12 3l10 18H2z" />
                                  <path d="M12 10v5M12 18v.5" strokeLinecap="round" />
                                </svg>
                                Area missing
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Drawer>
  );
}
