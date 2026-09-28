import "server-only";

import { z } from "zod";

// Explicit versions of what row-level security shows an MSP, so an admin's
// "View as MSP" preview matches the MSP's own pages. For MSP users these
// filters are redundant with RLS; for admins (who can read everything) they
// are what keeps the preview to that MSP's view.

const uuid = z.uuid();

export function isUuid(value: string) {
  return uuid.safeParse(value).success;
}

/** PostgREST `or` filter: program assets, this cohort's, and this MSP's own. */
export function visibleAssetsFilter(cohortId: string, mspId: string) {
  if (!isUuid(cohortId) || !isUuid(mspId)) throw new Error("Invalid cohort or MSP id");
  return `scope.eq.program,and(scope.eq.cohort,cohort_id.eq.${cohortId}),and(scope.eq.msp,msp_id.eq.${mspId})`;
}

/** PostgREST `or` filter: shared program tasks plus this MSP's extra tasks. */
export function mspTasksFilter(mspId: string) {
  if (!isUuid(mspId)) throw new Error("Invalid MSP id");
  return `msp_id.is.null,msp_id.eq.${mspId}`;
}
