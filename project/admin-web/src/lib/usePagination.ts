import { useEffect, useMemo, useState } from 'react';

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return { page, setPage, pageCount, pageItems, pageSize, total: items.length };
}
