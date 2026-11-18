// Everything here comes from Purchase_Order.xlsx (the "Purchase Order" and "Lists" tabs).
// Change the lists and wording in this file, then rebuild.

export const ORG_NAME = 'Regenerating Sonora';
export const PROGRAM = 'TISUPP';

/** Prefix for automatic PO numbers: RS-20261117-1432-PR (date, time, requester's initials). */
export const PO_PREFIX = 'RS';

/** Dates on the form may not be earlier than this (same check as the workbook). */
export const MIN_DATE = '2025-01-01';

export const MAX_ITEMS = 10;

/** Suggested budget lines. Any other text can be typed in on the form. */
export const BUDGET_LINES = [
  'Partner MOUs and project start-up',
  'Data collection procedures',
  'Trainings (HOPE, SAPST, SBIRT, Triple P)',
  'Training: Prevention Core Competencies',
  'Developing materials',
  'Listening sessions',
  'Planning meetings',
  'Community Atlas',
  'Family Tree',
  'Quarterly partnership meetings',
  'Family Resilience Workshops',
  'New CHWs: training, stipends, field hours',
  'CHW referrals, outreach, marketing',
  'Youth Leadership Academy',
  'Green Thumb Warriors',
  'Full Moon Garden Parties',
  'Youth and family field trips',
  'Data collection and GOYFF reporting',
  'Train 5 community leaders',
  'Strengths-based prevention messaging',
  'Environmental prevention strategies',
  'Indirect',
  'ERE',
];

/** Suggested funding sources. Any other text can be typed in on the form. */
export const FUNDING_SOURCES = ['TISUPP - SAMHSA SUBG via GOYFF / Arizona State University'];

export const PROCUREMENT_METHODS = [
  'Micro-purchase',
  'Simplified acquisition',
  'Formal procurement',
  'Noncompetitive (sole source)',
  'Not a procurement (payroll/stipend)',
];

/**
 * Threshold notes, checked from the top down. `over` means "more than"; `atLeast` means
 * "this much or more". Amounts are in cents.
 */
export const THRESHOLDS: { atLeast?: number; over?: number; label: string }[] = [
  { atLeast: 2_500_000, label: '$25,000+: quotes or bids, SAM.gov check, termination terms' },
  { over: 1_500_000, label: 'Over $15,000: quotes required, termination terms' },
  { over: 1_000_000, label: 'Over $10,000: termination terms required' },
];
export const THRESHOLD_DEFAULT_LABEL = 'Micro-purchase';

/** Above this total, a text-message approval is not allowed (FIN-05). Cents. */
export const TEXT_APPROVAL_LIMIT = 100_000;

export const PDF_BANNER = `PURCHASE ORDER · ${ORG_NAME.toUpperCase()} · ${PROGRAM}`;
export const PDF_TITLE = 'Purchase Order';
export const PDF_RULES = 'Rules: 2 CFR 200.303, 200.318, 200.327';

export const TERMS = [
  '1. This purchase is paid with federal funds (see funding source above; for TISUPP, SAMHSA SUBG through GOYFF and Arizona State University). The vendor must keep related records for at least 3 years after the final grant report and give the funder and its representatives access on request.',
  '2. Invoices must reference this PO number and may not exceed the PO total without a written change.',
  '3. Payment terms: paid within 14 days after receipt of goods or services and a correct invoice, unless the contract states otherwise.',
  '4. Regenerating Sonora may cancel this order for cause or for convenience by written notice.',
];

export const REQUESTED_BY_ROLE =
  'Requested by (board vice president or other authorized requester)';
export const APPROVED_BY_ROLE =
  'Approved by (board president; treasurer if the president has a conflict)';
export const APPROVAL_FOOTNOTE =
  'Approval by email or signature only (text approvals are limited to $1,000 under FIN-05).';
