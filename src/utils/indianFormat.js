export function formatIndianNumber(value, options = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }

  return new Intl.NumberFormat('en-IN', options).format(Number(value));
}

export function useIndianNumberFormat() {
  return (value, options) => formatIndianNumber(value, options);
}