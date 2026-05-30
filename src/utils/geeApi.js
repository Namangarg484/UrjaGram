const GEE_BACKEND = import.meta.env.VITE_GEE_BACKEND_URL;

/**
 * Fetch real satellite-derived peak sun hours from the GEE backend.
 * Falls back to null if the backend is not configured or unreachable.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<number|null>}
 */
export async function fetchLivePeakSunHours(lat, lng) {
  if (!GEE_BACKEND) return null;
  try {
    const res = await fetch(
      `${GEE_BACKEND}/solar/peak-hours?lat=${lat}&lng=${lng}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.peakSunHours === 'number' ? data.peakSunHours : null;
  } catch {
    return null;
  }
}
