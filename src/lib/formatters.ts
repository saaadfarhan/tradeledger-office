export const formatMoney = (value: number) => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
export const todayIsoDate = () => new Date().toISOString().slice(0, 10)
