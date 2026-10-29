export const TABLE_PAGE_SIZE_KEY = "purchase-sale-table-page-size";
export const TABLE_PAGE_SIZE_EVENT = "purchase-sale-table-page-size-change";
export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function readTablePageSize() {
  const saved = Number(window.localStorage.getItem(TABLE_PAGE_SIZE_KEY));
  return TABLE_PAGE_SIZE_OPTIONS.includes(
    saved as (typeof TABLE_PAGE_SIZE_OPTIONS)[number],
  )
    ? saved
    : 25;
}

export function saveTablePageSize(pageSize: number) {
  if (
    !TABLE_PAGE_SIZE_OPTIONS.includes(
      pageSize as (typeof TABLE_PAGE_SIZE_OPTIONS)[number],
    )
  )
    return;
  window.localStorage.setItem(TABLE_PAGE_SIZE_KEY, String(pageSize));
  window.dispatchEvent(
    new CustomEvent<number>(TABLE_PAGE_SIZE_EVENT, { detail: pageSize }),
  );
}
