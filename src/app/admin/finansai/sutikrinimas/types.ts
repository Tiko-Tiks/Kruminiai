export interface StatementRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  openingCents: number;
  closingCents: number;
  incomeCents: number;
  expenseCents: number;
  note: string | null;
}

export interface TransferAdminRow {
  id: string;
  date: string;
  direction: string;
  amountCents: number;
  note: string | null;
}

export interface DailyItem {
  label: string;
  amountCents: number;
  kind: "income" | "expense";
}

export interface DailyRow {
  date: string;
  incomeCents: number;
  expenseCents: number;
  runningCents: number;
  items: DailyItem[];
}

export interface ReconSummary {
  hasStatement: boolean;
  systemIncomeCents: number;
  systemExpenseCents: number;
  systemBankCents: number;
  statementIncomeCents: number;
  statementExpenseCents: number;
  statementClosingCents: number;
  incomeDifferenceCents: number;
  expenseDifferenceCents: number;
  differenceCents: number;
}

export interface Totals {
  totalCents: number;
  bankCents: number;
  cashCents: number;
}

export interface OpeningBalanceView {
  asOfDate: string;
  amountCents: number;
  note: string | null;
}
