export const SCORECARD_LIMIT = 5;
export function scorecardSlots(selected: number, uploaded: number[]) {
  if (!Number.isInteger(selected) || selected < 1 || selected > SCORECARD_LIMIT) throw new Error('Choose a screenshot from 1 to 5.');
  return [selected,...Array.from({length:SCORECARD_LIMIT},(_,i)=>i+1).filter(slot=>slot!==selected && !uploaded.includes(slot))];
}
