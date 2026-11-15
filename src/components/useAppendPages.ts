'use client';
import { useEffect, useMemo, useState } from 'react';
const MAX_PAGES = 20;
function recentPages<T>(pages: Record<number, T[]>) {
  return Object.fromEntries(
    Object.entries(pages)
      .sort(([a], [b]) => Number(b) - Number(a))
      .slice(0, MAX_PAGES),
  );
}
export function useAppendPages<T extends { id?: string; faceit_id?: string | null }>(
  scope: string,
  page: number,
  items: T[] | undefined,
) {
  const [stored, setStored] = useState<{ scope: string; pages: Record<number, T[]> } | null>(null);
  useEffect(() => {
    if (!items) return;
    const timer = setTimeout(
      () =>
        setStored((previous) => ({
          scope,
          pages: recentPages({
            ...(previous?.scope === scope ? previous.pages : {}),
            [page]: items,
          }),
        })),
      0,
    );
    return () => clearTimeout(timer);
  }, [scope, page, items]);
  return useMemo(() => {
    const pages = recentPages({
      ...(stored?.scope === scope ? stored.pages : {}),
      ...(items ? { [page]: items } : {}),
    });
    return [
      ...new Map(
        Object.values(pages)
          .flat()
          .map((item) => [item.id || item.faceit_id, item]),
      ).values(),
    ];
  }, [stored, scope, page, items]);
}
