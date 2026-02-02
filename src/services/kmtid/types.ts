/**
 * Types for kmtid.atgx.se payload.
 * Structure may need updating once races.js is inspected (see docs/KMTID_INVESTIGATION.md).
 */

export interface KmtidGraphPoint {
  x?: number;
  y?: number;
  distance?: number;
  value?: number;
}

export interface KmtidStartAnalytics {
  first200mPace?: string | number;
  last200mPace?: string | number;
  metersRun?: number;
  calculatedKmTime?: string | number;
  slipstreamMeters?: number;
  slipstream?: number;
  performanceGraphData?: KmtidGraphPoint[];
  /** Alternative keys from real payload */
  first200m?: string | number;
  last200m?: string | number;
  sprungnaMeter?: number;
  omraknadKmTid?: string | number;
}

export interface KmtidStart {
  number?: number;
  postPosition?: number;
  horseId?: number;
  horse?: { id?: number; name?: string };
  /** Analytics from kmtid (paths TBD after inspection) */
  [key: string]: unknown;
}

export interface KmtidRace {
  id?: string;
  raceId?: string;
  number?: number;
  starts?: KmtidStart[];
  [key: string]: unknown;
}

export interface KmtidPayload {
  races?: KmtidRace[];
  [key: string]: unknown;
}
