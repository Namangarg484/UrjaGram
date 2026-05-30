import os
import json
import ee
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="UrjaGram GEE Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://urja-gram.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── GEE Initialisation ────────────────────────────────────────────────────────
_ee_ready = False

def init_ee():
    global _ee_ready
    key_json = os.environ.get("GEE_SERVICE_ACCOUNT_KEY")
    if not key_json:
        print("[GEE] GEE_SERVICE_ACCOUNT_KEY not set — Earth Engine disabled.")
        return
    try:
        key_data = json.loads(key_json)
        credentials = ee.ServiceAccountCredentials(
            email=key_data["client_email"],
            key_data=key_json,
        )
        ee.Initialize(credentials)
        _ee_ready = True
        print("[GEE] Earth Engine initialised ✓")
    except Exception as exc:
        print(f"[GEE] Init failed: {exc}")

init_ee()

# ── Helpers ───────────────────────────────────────────────────────────────────
def fetch_peak_sun_hours(lat: float, lng: float) -> float:
    """Return 5-year (2019–2023) average daily GHI in kWh/m²/day for a point."""
    point = ee.Geometry.Point([lng, lat])
    era5 = (
        ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY")
        .filterDate("2019-01-01", "2023-12-31")
        .select("surface_solar_radiation_downwards")
    )
    total = era5.sum()
    val = (
        total.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point,
            scale=11132,
            maxPixels=1,
        )
        .get("surface_solar_radiation_downwards")
        .getInfo()
    )
    if val is None:
        raise ValueError("No ERA5 data for this location")
    n_days = 5 * 365  # 2019-2023
    return round(val / 3_600 / 1_000 / n_days, 2)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "geeReady": _ee_ready}


@app.get("/solar/peak-hours")
def peak_hours(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    """
    Returns real satellite-derived peak sun hours for any lat/lng.
    Uses ECMWF ERA5-Land 5-year average (2019–2023).
    """
    if not _ee_ready:
        raise HTTPException(
            status_code=503,
            detail="Earth Engine not initialised — set GEE_SERVICE_ACCOUNT_KEY env var.",
        )
    try:
        psh = fetch_peak_sun_hours(lat, lng)
        return {"lat": lat, "lng": lng, "peakSunHours": psh, "source": "ERA5-Land 2019-2023"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
