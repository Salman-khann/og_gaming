export type AdminReport = {
  since: string; until: string; days: number; registrations: number; approved: number;
  pending: number; rejected: number; checked_in: number; verified_fees: number; unverified_fees: number;
  series: { day: string; entries: number; verified_fees: number }[];
};
