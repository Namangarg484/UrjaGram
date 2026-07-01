import os
import json
import ee
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="UrjaGram GEE Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://urja-gram.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
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


class UrjaSakhiData(BaseModel):
    householdHead: str
    contactNumber: str
    email: Optional[str] = None
    aadhaarNumber: Optional[str] = None
    state: str
    district: str
    address: str
    familySize: Optional[int] = None
    discom: str
    consumerAccountNumber: str
    electricitySource: str
    monthlyBill: Optional[float] = None
    sanctionedLoadKw: Optional[float] = None
    category: str = 'Residential'
    roofType: str
    roofAreaSqft: Optional[float] = None
    bankName: Optional[str] = None
    bankAccountNumber: Optional[str] = None
    bankIfsc: Optional[str] = None
    # Assuming documents are handled as URLs or file paths for now
    aadhaarFrontUrl: Optional[str] = None
    aadhaarBackUrl: Optional[str] = None
    electricityBillFrontUrl: Optional[str] = None
    electricityBillBackUrl: Optional[str] = None
    rooftopPhotoFrontUrl: Optional[str] = None
    rooftopPhotoBackUrl: Optional[str] = None


@app.post("/api/urjasakhi/submit")
def submit_urjasakhi_data(data: UrjaSakhiData):
    """
    Plug-and-play wrapper endpoint for Urjasakhi data.
    Receives comprehensive data and splits it across multiple government/vendor silos (mocked here).
    """
    try:
        # 1. Save all data to our internal DB (Simulated or via Supabase client if configured here)
        # In a real scenario we'd insert this into Supabase urjasakhi_data here.
        print(f"[WRAPPER] Received complete PM Surya Ghar data for {data.householdHead}")

        # 2. Distribute data to Vendors (Technical & Location Info)
        vendor_payload = {
            "name": data.householdHead,
            "contact": data.contactNumber,
            "address": f"{data.address}, {data.district}, {data.state}",
            "roofAreaSqft": data.roofAreaSqft,
            "roofType": data.roofType,
            "sanctionedLoadKw": data.sanctionedLoadKw,
            "monthlyBill": data.monthlyBill,
            "rooftopPhotos": [data.rooftopPhotoFrontUrl, data.rooftopPhotoBackUrl]
        }
        print(f"[VENDOR_API] Pushed technical requirements to partner vendors: {vendor_payload['name']}")

        # 3. Distribute data to MNRE/Central Portal (Scheme Registration)
        mnre_payload = {
            "state": data.state,
            "district": data.district,
            "discom": data.discom,
            "consumerAccountNumber": data.consumerAccountNumber,
            "mobile": data.contactNumber,
            "email": data.email,
            "category": data.category
        }
        print(f"[MNRE_API] Registered case on National Portal for {mnre_payload['consumerAccountNumber']}")

        # 4. Distribute data to DISCOM (Load Sanction / Feasibility)
        discom_payload = {
            "consumerAccountNumber": data.consumerAccountNumber,
            "requestedLoadKw": data.sanctionedLoadKw,
            "electricityBillUrls": [data.electricityBillFrontUrl, data.electricityBillBackUrl]
        }
        print(f"[DISCOM_API] Initiated load feasibility with {data.discom}")

        # 5. Distribute data to Banks (Loan / Subsidy routing)
        bank_payload = {
            "applicantName": data.householdHead,
            "bankName": data.bankName,
            "accountNumber": data.bankAccountNumber,
            "ifsc": data.bankIfsc,
            "aadhaar": data.aadhaarNumber,
            "kycUrls": [data.aadhaarFrontUrl, data.aadhaarBackUrl]
        }
        if data.bankAccountNumber:
            print(f"[BANK_API] Pushed KYC and account details for subsidy routing.")

        return {
            "status": "success",
            "message": "Data orchestrated successfully across Vendor, MNRE, DISCOM, and Bank systems.",
            "dispatched": ["vendor", "mnre", "discom", "bank"]
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
