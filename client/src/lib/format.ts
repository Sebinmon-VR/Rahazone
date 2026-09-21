/** Workspace currency (ISO 4217 code). Set from /api/settings after login; INR by default. */
let CURRENCY = 'INR';
export const setCurrency = (code: string) => { CURRENCY = code || 'INR'; };
export const currencyCode = () => CURRENCY;

/** Common currencies offered in the admin settings; any other ISO code can be typed in. */
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'INR', name: 'Indian rupee' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'QAR', name: 'Qatari riyal' },
  { code: 'KWD', name: 'Kuwaiti dinar' },
  { code: 'OMR', name: 'Omani rial' },
  { code: 'BHD', name: 'Bahraini dinar' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
];

function fmt(v: number, opts: Intl.NumberFormatOptions) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: CURRENCY, currencyDisplay: 'code', ...opts }).format(v);
  } catch {
    return `${CURRENCY} ${new Intl.NumberFormat('en', opts).format(v)}`;
  }
}

/** "INR 1,91,800" style amounts, always with the currency code so nothing is ambiguous. */
export const money = (n: number | null | undefined, opts: { compact?: boolean } = {}) => {
  const v = Number(n) || 0;
  const s = opts.compact && Math.abs(v) >= 1000
    ? fmt(v, { notation: 'compact', maximumFractionDigits: 1 })
    : fmt(v, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return s.replace(/ /g, ' ');
};

export const num = (n: number | null | undefined, digits = 0) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(Number(n) || 0);

/** Compact plain number for chart axes: 1.5K, 2M */
export const compact = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const pct = (n: number | null | undefined) => `${num(n, 2)}%`;

export const date = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
};

export const daysUntil = (s: string) => Math.ceil((new Date(`${s}T00:00:00`).getTime() - Date.now()) / 86400000);

export const fileSize = (b?: number) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export const today = () => new Date().toISOString().slice(0, 10);
