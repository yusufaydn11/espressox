import { useEffect, useMemo, useState } from 'react';

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize],
  );

  useEffect(() => {
    setPage(0);
  }, [items, pageSize]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  return {
    page,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    total: items.length,
    hasPrev: page > 0,
    hasNext: page < totalPages - 1,
  };
}
