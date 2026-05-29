import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[UrjaGram] Missing Supabase env vars — check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── AUTH ──────────────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── VILLAGES ─────────────────────────────────────────────────────────────────

export async function fetchVillages() {
  const { data, error } = await supabase
    .from('villages')
    .select('*')
    .order('name');
  return { data: data ?? [], error };
}

export async function upsertVillage(village) {
  const row = {
    name: village.name,
    gp_name: village.gpName,
    district: village.district ?? null,
    state: village.state ?? null,
    lat: village.lat ?? null,
    lng: village.lng ?? null,
    population: village.population ?? null,
    households: village.households ?? null,
    status: village.status ?? 'not_started',
  };
  const { data, error } = await supabase.from('villages').upsert([row], { onConflict: 'name' }).select();
  return { data, error };
}

// ─── SOLAR ASSESSMENTS ────────────────────────────────────────────────────────

export async function fetchAssessments() {
  const { data, error } = await supabase
    .from('solar_assessments')
    .select('*')
    .order('assessed_at', { ascending: false });
  if (error) return { data: [], error };
  // Normalise snake_case → camelCase for the UI
  const normalised = data.map((row) => ({
    id: row.id,
    villageId: row.village_id,
    villageName: row.village_name,
    roofAreaSqm: row.roof_area_sqm,
    usableAreaSqm: row.usable_area_sqm,
    panelCount: row.panel_count,
    systemKWp: row.system_kwp,
    annualKWh: row.annual_kwh,
    co2OffsetT: row.co2_offset_t,
    coveragePct: row.coverage_pct,
    subsidyInr: row.subsidy_inr,
    confidence: row.confidence,
    orientation: row.orientation,
    shadingPct: row.shading_pct,
    roofTypeDetected: row.roof_type_detected,
    observations: row.observations,
    imageUrl: row.image_url,
    assessedBy: row.assessed_by,
    assessedAt: row.assessed_at,
  }));
  return { data: normalised, error: null };
}

export async function insertSolarAssessment(record) {
  const { data, error } = await supabase.from('solar_assessments').insert([
    {
      village_id: record.villageId ?? null,
      village_name: record.villageName,
      roof_area_sqm: record.roofAreaSqm,
      usable_area_sqm: record.usableAreaSqm,
      panel_count: record.panelCount,
      system_kwp: record.systemKWp,
      annual_kwh: record.annualKWh,
      co2_offset_t: record.co2OffsetT,
      coverage_pct: record.coveragePct,
      subsidy_inr: record.subsidyInr,
      confidence: record.confidence,
      orientation: record.orientation,
      shading_pct: record.shadingPct,
      roof_type_detected: record.roofTypeDetected ?? null,
      observations: record.observations ?? null,
      image_url: record.imageUrl ?? null,
      assessed_by: record.assessedBy ?? null,
      assessed_at: record.assessedAt,
    },
  ]).select();
  return { data, error };
}

// ─── VIIP DOCUMENTS ───────────────────────────────────────────────────────────

export async function fetchViipDocuments() {
  const { data, error } = await supabase
    .from('viip_documents')
    .select('*')
    .order('generated_at', { ascending: false });
  if (error) return { data: [], error };
  const normalised = data.map((row) => ({
    id: row.id,
    villageName: row.village_name,
    gpName: row.gp_name,
    state: row.state,
    district: row.district,
    content: row.content,
    priorities: row.priorities ?? [],
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    status: row.status,
  }));
  return { data: normalised, error: null };
}

export async function insertViipDocument(doc) {
  const { data, error } = await supabase.from('viip_documents').insert([
    {
      village_name: doc.villageName,
      gp_name: doc.gpName ?? null,
      state: doc.state ?? null,
      district: doc.district ?? null,
      content: doc.content,
      priorities: doc.priorities ?? [],
      generated_by: doc.generatedBy ?? null,
      status: doc.status ?? 'draft',
    },
  ]).select();
  return { data, error };
}

// ─── MRV RECORDS ──────────────────────────────────────────────────────────────

export async function fetchMrvRecords() {
  const { data, error } = await supabase
    .from('mrv_records')
    .select('*')
    .order('year', { ascending: true });
  if (error) return { data: [], error };
  const normalised = data.map((row) => ({
    id: row.id,
    villageId: row.village_id,
    villageName: row.village_name,
    month: row.month,
    year: row.year,
    actualKWh: row.actual_kwh,
    forecastKWh: row.forecast_kwh,
    co2OffsetT: row.co2_offset_t,
    recordedAt: row.recorded_at,
  }));
  return { data: normalised, error: null };
}

export async function insertMrvRecord(record) {
  const { data, error } = await supabase.from('mrv_records').insert([
    {
      village_id: record.villageId ?? null,
      village_name: record.villageName,
      month: record.month,
      year: record.year,
      actual_kwh: record.actualKWh,
      forecast_kwh: record.forecastKWh,
      co2_offset_t: record.co2OffsetT,
    },
  ]).select();
  return { data, error };
}

// ─── REALTIME ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to new solar_assessments rows.
 * Returns the Supabase RealtimeChannel so caller can call .unsubscribe().
 */
export function subscribeToAssessments(onInsert) {
  return supabase
    .channel('solar_assessments_changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'solar_assessments' },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
}