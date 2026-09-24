import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Coins,
  Copy,
  Download,
  FileImage,
  FileText,
  History,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Share2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  BilletageCurrency,
  BilletageLine,
} from '../../../types/billetage';
import {
  calculateBilletage,
  createBilletage,
} from '../../../services/BilletageService';

interface BilletageModuleProps {
  onClose?: () => void;
}

interface DenominationRow {
  id: string;
  value: number;
  quantity: number | null;
}

type AdjustmentMode = 'add' | 'remove';

interface AdjustmentState {
  mode: AdjustmentMode;
  rowId: string;
  denomination: number;
  quantity: string;
}

type GapStatusCode =
  | 'EQUILIBRE'
  | 'MANQUANT'
  | 'EXCEDENT';

interface GapStatus {
  status: GapStatusCode;
  label: string;
  amount: number;
}

interface GapHistoryEntry {
  id: string;
  montantAttendu: number;
  montantCompte: number;
  ecart: number;
  statut: GapStatusCode;
  devise: BilletageCurrency;
  auteur: string;
  date: string;
}

const USD_DENOMINATIONS: readonly number[] = [
  100,
  50,
  20,
  10,
  5,
  1,
];

const CDF_STORAGE_KEY = 'ets-amani-billetage-cdf-denominations';
const DEFAULT_CDF_DENOMINATIONS: number[] = [
  20000,
  10000,
  5000,
  1000,
  500,
  200,
  100,
  50,
];

const ADJUSTMENT_STORAGE_KEY = 'ets-amani-billetage-quick-adjustment';
const GAP_HISTORY_STORAGE_KEY = 'ets-amani-billetage-gap-history';
const ETS_AMANI_LOGO_SRC = '/logo.png';

function generateLocalId(value: number): string {
  return `denomination_${value}`;
}

function readCdfDenominations(): number[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_CDF_DENOMINATIONS];
  }
  try {
    const raw = window.localStorage.getItem(CDF_STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_CDF_DENOMINATIONS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_CDF_DENOMINATIONS];
    }
    const values = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0 && value !== 2000);
    const uniqueValues = Array.from(new Set(values)).sort((a, b) => b - a);
    return uniqueValues.length > 0 ? uniqueValues : [...DEFAULT_CDF_DENOMINATIONS];
  } catch {
    return [...DEFAULT_CDF_DENOMINATIONS];
  }
}

function readAdjustmentSetting(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    const value = window.localStorage.getItem(ADJUSTMENT_STORAGE_KEY);
    if (value === null) {
      return true;
    }
    return value === 'true';
  } catch {
    return true;
  }
}

function readGapHistory(): GapHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(GAP_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function formatMoney(amount: number, currency: BilletageCurrency): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(amount);
}

function createRows(values: readonly number[]): DenominationRow[] {
  return values.map((value) => ({
    id: generateLocalId(value),
    value,
    quantity: null,
  }));
}

function copyText(text: string): Promise<void> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        resolve();
      } else {
        reject(new Error('Copie impossible.'));
      }
    } catch (copyError) {
      reject(copyError);
    }
  });
}

function getAuthorLabel(user: unknown): string {
  const candidate = user as {
    displayName?: unknown;
    name?: unknown;
    email?: unknown;
    uid?: unknown;
  };
  if (typeof candidate.displayName === 'string' && candidate.displayName.trim()) {
    return candidate.displayName.trim();
  }
  if (typeof candidate.email === 'string' && candidate.email.trim()) {
    return candidate.email.trim();
  }
  return 'Utilisateur';
}

function formatDateTime(date: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export default function BilletageModule({ onClose }: BilletageModuleProps) {
  const { user, hasPermission } = useAuth();
  const [currency, setCurrency] = useState<BilletageCurrency>('USD');
  const [cdfDenominations, setCdfDenominations] = useState<number[]>(readCdfDenominations);
  const [usdRows, setUsdRows] = useState<DenominationRow[]>(() =>
    createRows(USD_DENOMINATIONS)
  );
  const [cdfRows, setCdfRows] = useState<DenominationRow[]>(() =>
    createRows(readCdfDenominations())
  );
  const [expectedAmount, setExpectedAmount] = useState<string>('');
  const [showCdfSettings, setShowCdfSettings] = useState(false);
  const [cdfInput, setCdfInput] = useState<string>('');
  const [showBusiness, setShowBusiness] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [adjustmentEnabled, setAdjustmentEnabled] = useState<boolean>(readAdjustmentSetting);
  const [adjustment, setAdjustment] = useState<AdjustmentState | null>(null);
  const [showAdjustmentSettings, setShowAdjustmentSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [gapHistory, setGapHistory] = useState<GapHistoryEntry[]>(readGapHistory);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const activeRows = currency === 'USD' ? usdRows : cdfRows;

  const lines: BilletageLine[] = useMemo(() => {
    return activeRows.map((row) => ({
      denominationId: row.id,
      currency,
      denomination: row.value,
      quantity: row.quantity ?? 0,
      subtotal: row.value * (row.quantity ?? 0),
    }));
  }, [activeRows, currency]);

  const parsedExpectedAmount = useMemo(() => {
    if (!expectedAmount.trim()) {
      return null;
    }
    const normalized = expectedAmount.replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }, [expectedAmount]);

  const calculation = useMemo(() => {
    try {
      return calculateBilletage(currency, lines, null);
    } catch {
      const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
      return {
        currency,
        total,
        declaredAmount: null,
        isCoherent: true,
      };
    }
  }, [currency, lines]);

  const totalCounted =
    Number(calculation.total) ||
    lines.reduce((sum, line) => sum + line.subtotal, 0);

  const gapStatus = useMemo(() => {
    if (parsedExpectedAmount === null) {
      return null;
    }
    const rawGap = totalCounted - parsedExpectedAmount;
    const gap =
      Math.abs(rawGap) < 0.005 ? 0 : Number(rawGap.toFixed(2));
    if (gap === 0) {
      return {
        status: 'EQUILIBRE' as GapStatusCode,
        label: 'ÉQUILIBRÉ',
        amount: 0,
      };
    }
    if (gap < 0) {
      return {
        status: 'MANQUANT' as GapStatusCode,
        label: `MANQUANT : ${formatMoney(Math.abs(gap), currency)}`,
        amount: Math.abs(gap),
      };
    }
    return {
      status: 'EXCEDENT' as GapStatusCode,
      label: `EXCÉDENT : ${formatMoney(gap, currency)}`,
      amount: gap,
    };
  }, [currency, parsedExpectedAmount, totalCounted]);

  const canAccessBilletage = Boolean(user);
  const canCreateBusinessBilletage =
    hasPermission('billetage.create') ||
    user?.role === 'administrateur_systeme' ||
    user?.role === 'directeur_general' ||
    user?.role === 'administrateur_agence' ||
    user?.role === 'agent';

  const updateRows = (
    updater: (rows: DenominationRow[]) => DenominationRow[]
  ) => {
    if (currency === 'USD') {
      setUsdRows(updater);
    } else {
      setCdfRows(updater);
    }
  };

  const updateQuantity = (rowId: string, rawValue: string) => {
    const cleaned = rawValue.replace(/[^\d]/g, '');
    const quantity =
      cleaned === '' ? null : Math.max(0, Number(cleaned));
    updateRows((rows) =>
      rows.map((row) =>
        row.id === rowId ? { ...row, quantity } : row
      )
    );
  };

  const openAdjustment = (mode: AdjustmentMode, row: DenominationRow) => {
    if (!adjustmentEnabled) return;
    setError(null);
    setMessage(null);
    setAdjustment({
      mode,
      rowId: row.id,
      denomination: row.value,
      quantity: '',
    });
  };

  const applyAdjustment = () => {
    if (!adjustment) return;
    const amount = Number(adjustment.quantity);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      setError('Veuillez saisir un nombre entier de billets supérieur à 0.');
      return;
    }
    const row = activeRows.find((item) => item.id === adjustment.rowId);
    if (!row) {
      setAdjustment(null);
      return;
    }
    const currentQuantity = row.quantity ?? 0;
    if (adjustment.mode === 'remove' && amount > currentQuantity) {
      setError(
        `Impossible : vous ne pouvez pas retirer ${amount} billets. Quantité disponible : ${currentQuantity}.`
      );
      return;
    }
    const newQuantity =
      adjustment.mode === 'add'
        ? currentQuantity + amount
        : currentQuantity - amount;

    updateQuantity(adjustment.rowId, String(newQuantity));
    setAdjustment(null);
    setError(null);
    setMessage(
      adjustment.mode === 'add'
        ? `${amount} billet(s) de ${formatMoney(adjustment.denomination, currency)} ajouté(s).`
        : `${amount} billet(s) de ${formatMoney(adjustment.denomination, currency)} retiré(s).`
    );
  };

  const resetBilletage = () => {
    if (currency === 'USD') {
      setUsdRows(createRows(USD_DENOMINATIONS));
    } else {
      setCdfRows(createRows(cdfDenominations));
    }
    setExpectedAmount('');
    setMessage(null);
    setError(null);
    setAdjustment(null);
  };

  const saveCdfConfiguration = () => {
    const values = cdfInput
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value) && value > 0 && value !== 2000);
    const uniqueValues = Array.from(new Set(values)).sort((a, b) => b - a);
    if (uniqueValues.length === 0) {
      setError('Veuillez saisir au moins une coupure CDF valide.');
      return;
    }
    try {
      window.localStorage.setItem(CDF_STORAGE_KEY, JSON.stringify(uniqueValues));
    } catch {
      // ignore
    }
    setCdfDenominations(uniqueValues);
    setCdfRows(createRows(uniqueValues));
    setCdfInput('');
    setShowCdfSettings(false);
    setError(null);
    setMessage('Configuration des coupures CDF mise à jour.');
  };

  const toggleAdjustment = () => {
    const nextValue = !adjustmentEnabled;
    setAdjustmentEnabled(nextValue);
    try {
      window.localStorage.setItem(ADJUSTMENT_STORAGE_KEY, String(nextValue));
    } catch {
      // ignore
    }
    if (!nextValue) {
      setAdjustment(null);
    }
    setMessage(
      nextValue
        ? 'Les boutons d ajustement rapide sont activés.'
        : 'Les boutons d ajustement rapide sont désactivés.'
    );
  };

  const saveGapHistory = () => {
    if (parsedExpectedAmount === null || !gapStatus || !user) {
      return;
    }
    const rawGap = totalCounted - parsedExpectedAmount;
    const entry: GapHistoryEntry = {
      id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      montantAttendu: parsedExpectedAmount,
      montantCompte: totalCounted,
      ecart: Number(rawGap.toFixed(2)),
      statut: gapStatus.status,
      devise: currency,
      auteur: getAuthorLabel(user),
      date: new Date().toISOString(),
    };
    const nextHistory = [entry, ...gapHistory].slice(0, 100);
    setGapHistory(nextHistory);
    try {
      window.localStorage.setItem(GAP_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    } catch {
      // ignore
    }
  };

  const saveBusinessBilletage = async () => {
    if (!user) {
      setError('Vous devez être connecté pour enregistrer un billetage professionnel.');
      return;
    }
    if (!canCreateBusinessBilletage) {
      setError('Vous ne disposez pas de la permission nécessaire pour enregistrer un billetage professionnel.');
      return;
    }
    if (parsedExpectedAmount === null) {
      setError('Veuillez saisir le montant attendu avant d enregistrer le billetage professionnel.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createBilletage({
        type: 'business',
        userId: user.uid,
        agencyId: user.agencyId || 'agence-centrale',
        currency,
        lines,
        declaredAmount: parsedExpectedAmount,
      });
      saveGapHistory();
      setMessage(
        gapStatus
          ? `Billetage professionnel enregistré avec succès. Contrôle : ${gapStatus.label}.`
          : 'Billetage professionnel enregistré.'
      );
    } catch (saveError) {
      console.error('Erreur enregistrement billetage :', saveError);
      setError('Impossible d enregistrer le billetage professionnel.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildBilletageText = () => {
    const linesText = lines
      .filter((line) => line.quantity > 0)
      .map(
        (line) =>
          `${formatMoney(line.denomination, currency)} × ${line.quantity} = ${formatMoney(line.subtotal, currency)}`
      )
      .join('\n');
    const parts = [
      'Ets AMANI — Billetage',
      `Type : ${showBusiness ? 'Professionnel' : 'Personnel'}`,
      `Devise : ${currency}`,
      '',
      linesText || 'Aucune coupure saisie.',
      '',
      `Total compté : ${formatMoney(totalCounted, currency)}`,
    ];
    if (showBusiness && parsedExpectedAmount !== null) {
      parts.push(`Montant attendu : ${formatMoney(parsedExpectedAmount, currency)}`);
      if (gapStatus) {
        parts.push(`Contrôle : ${gapStatus.label}`);
      }
    }
    return parts.join('\n');
  };

  const shareBilletage = async () => {
    const text = buildBilletageText();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'Billetage Ets AMANI', text });
        setMessage('Billetage partagé avec succès.');
        return;
      }
      await copyText(text);
      setMessage('Résumé du billetage copié dans le presse-papiers.');
    } catch {
      setError('Le partage n a pas pu être effectué.');
    }
  };

  const copyTotal = async () => {
    try {
      let text = `Total compté : ${formatMoney(totalCounted, currency)}`;
      if (showBusiness && parsedExpectedAmount !== null && gapStatus) {
        text += `\nMontant attendu : ${formatMoney(parsedExpectedAmount, currency)}`;
        text += `\n${gapStatus.label}`;
      }
      await copyText(text);
      setMessage('Résumé du total copié.');
    } catch {
      setError('Impossible de copier le total.');
    }
  };

  const exportAsPdf = () => {
    setShowExportOptions(false);
    window.print();
  };

  if (!canAccessBilletage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Calculator className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Billetage</h2>
            <p className="text-sm text-slate-500">Connectez-vous pour utiliser le billetage.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <Coins className="h-5 w-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900">
                Billetage & Caisse
              </h2>
              <p className="text-xs text-slate-500">
                Ets AMANI — Comptage et contrôle des liquidités USD / CDF
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Fermer le billetage"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setShowBusiness(false);
              setExpectedAmount('');
              setError(null);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              !showBusiness
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Billetage personnel
          </button>
          <button
            type="button"
            onClick={() => {
              setShowBusiness(true);
              setError(null);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              showBusiness
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Billetage professionnel
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => {
                setCurrency('USD');
                setExpectedAmount('');
                setError(null);
                setMessage(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                currency === 'USD'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrency('CDF');
                setExpectedAmount('');
                setError(null);
                setMessage(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                currency === 'CDF'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              CDF
            </button>
          </div>
          <button
            type="button"
            onClick={resetBilletage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={copyTotal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Copy className="h-4 w-4" />
            Copier
          </button>
          <button
            type="button"
            onClick={shareBilletage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Share2 className="h-4 w-4" />
            Partager
          </button>
          <button
            type="button"
            onClick={exportAsPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Imprimer / PDF
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowAdjustmentSettings((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Settings2 className="h-4 w-4" />
              Ajustement
            </button>
            {showBusiness && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <History className="h-4 w-4" />
                Historique
              </button>
            )}
          </div>
        </div>

        {showAdjustmentSettings && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Boutons d ajustement rapide
                </p>
                <p className="text-xs text-slate-500">
                  + ou - ouvre une saisie numérique pour ajouter ou retirer des billets.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleAdjustment}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  adjustmentEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    adjustmentEnabled ? 'bg-white' : 'bg-slate-500'
                  }`}
                />
                {adjustmentEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Business Setup */}
      {showBusiness && (
        <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label
                htmlFor="expected-amount"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Montant attendu en caisse
              </label>
              <input
                id="expected-amount"
                type="number"
                min="0"
                step={currency === 'USD' ? '0.01' : '1'}
                inputMode="decimal"
                value={expectedAmount}
                onChange={(event) => {
                  setExpectedAmount(event.target.value);
                  setError(null);
                }}
                placeholder={currency === 'USD' ? 'Ex. 1250.00' : 'Ex. 250000'}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setCdfInput(cdfDenominations.join(', '));
                  setShowCdfSettings((v) => !v);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4" />
                Coupures CDF
              </button>
            </div>
          </div>

          {showCdfSettings && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label
                htmlFor="cdf-denominations"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Coupures CDF disponibles (séparées par des virgules)
              </label>
              <input
                id="cdf-denominations"
                type="text"
                value={cdfInput}
                onChange={(e) => setCdfInput(e.target.value)}
                placeholder="20000, 10000, 5000, 1000, 500, 200, 100, 50"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                La coupure 2 000 CDF est automatiquement exclue.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveCdfConfiguration}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Appliquer
                </button>
                <button
                  type="button"
                  onClick={() => setShowCdfSettings(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {(message || error) && (
        <div className="px-4 pt-4 sm:px-6">
          {message && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}
          {error && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Gap status */}
      {showBusiness && gapStatus && (
        <div className="px-4 pt-4 sm:px-6">
          <div
            className={`rounded-xl border px-4 py-3 ${
              gapStatus.status === 'EQUILIBRE'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : gapStatus.status === 'MANQUANT'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{gapStatus.label}</p>
                <p className="text-xs mt-0.5 opacity-90">
                  Compté : {formatMoney(totalCounted, currency)} | Attendu : {formatMoney(parsedExpectedAmount ?? 0, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={saveGapHistory}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Historiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Denominations table */}
      <div className="px-3 py-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 bg-slate-50 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:px-4">
            <span>Coupure</span>
            <span className="text-center">Quantité</span>
            <span className="text-right">Sous-total</span>
          </div>
          <div className="divide-y divide-slate-100">
            {activeRows.map((row) => {
              const subtotal = row.value * (row.quantity ?? 0);
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:px-4"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900 sm:text-base">
                      {formatMoney(row.value, currency)}
                    </p>
                    <p className="text-[11px] text-slate-400">coupure</p>
                  </div>
                  <div className="flex items-center justify-center">
                    {adjustmentEnabled && (
                      <button
                        type="button"
                        onClick={() => openAdjustment('remove', row)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={row.quantity ?? ''}
                      onChange={(event) => updateQuantity(row.id, event.target.value)}
                      className={`h-8 ${adjustmentEnabled ? 'w-12' : 'w-16'} border-y border-slate-200 bg-white px-1 text-center text-sm font-bold text-slate-900 outline-none`}
                    />
                    {adjustmentEnabled && (
                      <button
                        type="button"
                        onClick={() => openAdjustment('add', row)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-slate-900 sm:text-base">
                      {formatMoney(subtotal, currency)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary footer */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {showBusiness ? 'Total compté en caisse' : 'Total calculé'}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 sm:text-3xl">
              {formatMoney(totalCounted, currency)}
            </p>
          </div>
          {showBusiness && (
            <button
              type="button"
              onClick={saveBusinessBilletage}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Enregistrement...' : 'Enregistrer le billetage'}
            </button>
          )}
        </div>
      </div>

      {/* Adjustment modal */}
      {adjustment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  {adjustment.mode === 'add' ? 'Ajouter des billets' : 'Retirer des billets'}
                </h3>
                <p className="text-xs text-slate-500">
                  Coupure : <strong>{formatMoney(adjustment.denomination, currency)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantité de billets
              </label>
              <input
                type="number"
                min="1"
                step="1"
                autoFocus
                value={adjustment.quantity}
                onChange={(e) =>
                  setAdjustment({
                    ...adjustment,
                    quantity: e.target.value.replace(/[^\d]/g, ''),
                  })
                }
                placeholder="Ex. 5"
                className="w-full rounded-xl border border-slate-300 p-3 text-center text-xl font-bold"
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustment(null)}
                className="rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={applyAdjustment}
                className={`rounded-xl p-3 text-sm font-bold text-white ${
                  adjustment.mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {adjustment.mode === 'add' ? 'Ajouter' : 'Retirer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
