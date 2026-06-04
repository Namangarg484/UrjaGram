/**
 * PM Surya Ghar KYC pre-check helpers (client-side only — not UIDAI/DISCOM verification).
 */

export const PM_SURYA_PROCESS_STEPS = [
  'Register consumer mobile number on PM Surya Ghar portal (pmsuryaghar.gov.in).',
  'Complete profile — name, address, state, district, PIN must match DISCOM records.',
  'Select DISCOM and fetch consumer account (use consumer number, not meter number).',
  'Submit rooftop application and wait for DISCOM feasibility approval.',
  'Select MNRE-empanelled vendor and finalise technical proposal.',
  'Collect KYC documents and upload clear mobile scans (Aadhaar, bill, bank, ownership).',
  'Install plant as per sanctioned capacity and ALMM-listed modules.',
  'Request DISCOM inspection and net-metering approval.',
  'Upload commissioning certificate and vendor completion report.',
  'Track CFA subsidy disbursal to Aadhaar-linked bank account (DBT).',
];

export const PM_SURYA_MOBILE_DOCS = [
  { id: 'aadhaar', label: 'Aadhaar (front + back)' },
  { id: 'bill', label: 'Latest electricity bill' },
  { id: 'bank', label: 'Bank passbook / cancelled cheque' },
  { id: 'ownership', label: 'Roof ownership / NOC proof' },
  { id: 'photo', label: 'Applicant passport photo' },
  { id: 'site', label: 'Site photos (roof + meter board)' },
];

/** Research-backed friction points — portal/DISCOM behaviour, not legal advice. */
export const PM_SURYA_GOVT_CHALLENGES = [
  {
    title: 'Three-way name match (bill · Aadhaar · bank)',
    detail:
      'Portal and DBT checks compare consumer name on the electricity bill, Aadhaar, and NPCI-linked bank records. Minor initials may pass manual review; different spellings or a family member’s bank account often fail.',
    fix: 'Align all three at DISCOM (name correction) and bank branch before applying. Confirm Aadhaar–bank seeding.',
  },
  {
    title: 'DISCOM record is source of truth',
    detail:
      'Consumer number, DISCOM circle, and registered name are validated against DISCOM databases. Wrong DISCOM or meter number instead of consumer number causes instant rejection.',
    fix: 'Use the latest bill; correct consumer master data at the DISCOM section office (15–30 days typical).',
  },
  {
    title: 'Document quality gates',
    detail:
      'Blurry uploads, bills older than ~6 months, or missing ownership/NOC for non-owner applicants pause feasibility and subsidy steps.',
    fix: 'Daylight photos, full page in frame, PDF/JPEG under portal size limits; obtain NOC if connection is not in applicant’s name.',
  },
  {
    title: 'Subsidy after commissioning (DBT)',
    detail:
      'CFA is released post net-metering/commissioning. Failures often trace to non-empanelled vendor, non-ALMM panels, or DBT name mismatch even after plant install.',
    fix: 'Verify vendor on portal list before contract; link bank to Aadhaar early; use national helpline 1800-180-3333 or portal grievance if rejected.',
  },
  {
    title: 'Same Aadhaar, different names on bill',
    detail:
      'When Aadhaar number is the same person but bill shows old spelling, initials, or husband/father name format, automated match may still flag the file.',
    fix: 'Self-declaration affidavit + ID proof + DISCOM name update; keep photo consistent with Aadhaar for field verification.',
  },
];

export const NAME_MISMATCH_PLAYBOOK = [
  {
    when: 'Bill missing middle/last name vs full Aadhaar name',
    action: 'Request consumer name update at DISCOM with Aadhaar copy; do not alter Aadhaar spelling for portal convenience.',
  },
  {
    when: 'Initials on bill (e.g. R. Kumar) vs full name on Aadhaar',
    action: 'Update bill to expanded name where DISCOM allows; attach affidavit only if DISCOM/portal requests it.',
  },
  {
    when: 'Bank account in shortened or old spelling',
    action: 'Update account holder name at bank with Aadhaar; wait 3–5 working days for NPCI mapping before DBT step.',
  },
  {
    when: 'Photo does not resemble Aadhaar (aged photo, veil, etc.)',
    action: 'Use fresh passport photo matching current appearance; field staff may reject before portal upload.',
  },
  {
    when: 'Rejected on portal after install',
    action: 'Read rejection reason on pmsuryaghar.gov.in → grievance with bill, Aadhaar, bank proof showing same person.',
  },
];

const HONORIFICS = new Set(['shri', 'smt', 'kumari', 'mr', 'mrs', 'ms', 'dr', 'late']);

export const normalizeName = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenSet = (name = '') =>
  new Set(
    normalizeName(name)
      .split(' ')
      .filter((t) => t && !HONORIFICS.has(t)),
  );

/** Token overlap — handles missing middle names and reordering. */
export const nameSimilarity = (left = '', right = '') => {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((t) => b.has(t)).length;
  return common / Math.max(a.size, b.size);
};

/** True if all tokens of the shorter name appear in the longer name. */
export const nameIsSubset = (left = '', right = '') => {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return false;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  return [...smaller].every((t) => larger.has(t));
};

const aadhaarValid = (num = '') => /^\d{12}$/.test(String(num).replace(/\s+/g, ''));

/**
 * @returns {{ risk: 'pending'|'low'|'partial'|'high', label: string, note: string, actions: string[], metrics: object }}
 */
export function evaluatePmSuryaKyc({
  aadhaarName = '',
  billName = '',
  bankName = '',
  aadhaarNumber = '',
  photoMatchConfirmed = 'yes',
}) {
  const aadhaar = normalizeName(aadhaarName);
  const bill = normalizeName(billName);
  const bank = normalizeName(bankName);
  const hasCore = Boolean(aadhaar && bill);
  const validAadhaar = aadhaarValid(aadhaarNumber);
  const photoOk = photoMatchConfirmed === 'yes';
  const billSim = nameSimilarity(aadhaarName, billName);
  const bankSim = bank ? nameSimilarity(aadhaarName, bankName) : null;
  const billExact = hasCore && aadhaar === bill;
  const billSubset = hasCore && nameIsSubset(aadhaarName, billName);
  const bankExact = bank ? aadhaar === bank : null;
  const bankSubset = bank ? nameIsSubset(aadhaarName, bankName) : null;

  const metrics = {
    billSimilarityPct: Math.round(billSim * 100),
    bankSimilarityPct: bankSim == null ? null : Math.round(bankSim * 100),
    validAadhaar,
    photoOk,
  };

  if (!hasCore) {
    return {
      risk: 'pending',
      label: 'Pending KYC pre-check',
      note: 'Enter Aadhaar name and electricity-bill name. Add bank name for DBT risk check.',
      actions: [],
      metrics,
      tone: 'border-border bg-parchment/40 text-muted',
    };
  }

  const bankMismatch =
    bank && !bankExact && !(bankSubset || (bankSim != null && bankSim >= 0.5));
  const billMismatch = !billExact && !(billSubset || billSim >= 0.5);

  if (billExact && (!bank || bankExact || bankSubset)) {
    return {
      risk: 'low',
      label: 'Name match: low rejection risk',
      note: bank
        ? 'Aadhaar, bill, and bank names align. Proceed with empanelled vendor and DISCOM feasibility.'
        : 'Aadhaar and bill names match. Add bank name to check DBT eligibility.',
      actions: bank ? [] : ['Enter name as per bank passbook / NPCI records'],
      metrics,
      tone: 'border-meadow/25 bg-meadow/10 text-meadow',
    };
  }

  if (!billMismatch && validAadhaar && photoOk && !bankMismatch) {
    return {
      risk: 'partial',
      label: 'Partial mismatch: likely resolvable',
      note: `Bill similarity ${metrics.billSimilarityPct}%${
        metrics.bankSimilarityPct != null ? `, bank ${metrics.bankSimilarityPct}%` : ''
      }. Same Aadhaar with supporting papers often accepted after DISCOM/bank correction.`,
      actions: [
        'Update electricity consumer name at DISCOM to match Aadhaar',
        'Confirm bank account is Aadhaar-seeded for DBT',
        'Prepare self-declaration affidavit if names differ only by initials/spelling',
      ],
      metrics,
      tone: 'border-amber/30 bg-amber/10 text-amber',
    };
  }

  const actions = [
    'Visit DISCOM with Aadhaar for consumer name correction on the bill',
    'Update bank account name or use an account already matching Aadhaar',
  ];
  if (!validAadhaar) actions.unshift('Enter valid 12-digit Aadhaar number for field records');
  if (!photoOk) actions.push('Use a current photo matching Aadhaar before site verification');

  return {
    risk: 'high',
    label: 'High mismatch risk',
    note: 'Significant name differences across bill/bank/Aadhaar. Fix master data before portal submission to avoid automated rejection.',
    actions,
    metrics,
    tone: 'border-red-200 bg-red-50 text-red-600',
  };
}
