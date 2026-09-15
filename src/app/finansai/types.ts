/**
 * `/finansai` vaizdo modeliai.
 *
 * Skiriasi nuo DB eilučių tuo, kad etiketės jau išverstos, o aukotojų vardai
 * jau perleisti per kaukę (`formatDonorName`) SERVERYJE – pilnas `donor_name`
 * į naršyklę nepatenka net per props.
 */

export interface BalancesView {
  totalCents: number;
  bankCents: number;
  cashCents: number;
  asOfDate: string | null;
}

export interface BucketLineView {
  key: string;
  label: string;
  amountCents: number;
  count: number;
}

export interface BucketView {
  key: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  goalCents: number;
  isPublic: boolean;
  /** Bendra, nepaskirstyta kišenė (nario mokesčiai + parama be projekto). */
  isGeneralPot: boolean;
  receivedCents: number;
  spentCents: number;
  remainingCents: number;
  stillNeededCents: number;
  incomeLines: BucketLineView[];
  expenseLines: BucketLineView[];
}

export interface ReconciliationView {
  hasStatement: boolean;
  systemBankCents: number;
  statementClosingCents: number;
  cashCents: number;
  differenceCents: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface DonationRow {
  id: string;
  date: string;
  /** Jau užmaskuotas vardas. */
  donor: string;
  amountCents: number;
  projectId: string | null;
  projectTitle: string;
  method: string;
  methodLabel: string;
  message: string | null;
}

export interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  supplier: string | null;
  amountCents: number;
  category: string | null;
  categoryLabel: string | null;
  fundingSource: string;
  fundingSourceLabel: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  projectId: string | null;
  projectTitle: string;
  receiptRef: string | null;
}

export interface TransferRow {
  id: string;
  date: string;
  direction: string;
  directionLabel: string;
  amountCents: number;
  note: string | null;
}

export interface FeeRow {
  year: number;
  feeType: string;
  feeTypeLabel: string;
  payerCount: number;
  totalCents: number;
  cashCents: number;
  transferCents: number;
}

export interface FeeSpendingRow {
  label: string;
  amountCents: number;
  count: number;
}

export interface ProjectOption {
  id: string;
  title: string;
}
