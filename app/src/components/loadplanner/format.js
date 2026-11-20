// Shared display formatters for the volumetric loading module.
export const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
export const kg = (n) => `${Math.round(n || 0).toLocaleString('en-IN')} kg`;
export const pct = (n, dp = 1) => `${(n ?? 0).toFixed(dp)}%`;
