export type Page =
  | "home"
  | "company"
  | "accounts"
  | "items"
  | "banks"
  | "stockTypes"
  | "locations"
  | "opening"
  | "transfer"
  | "purchase"
  | "sale"
  | "cheques"
  | "voucher"
  | "journal"
  | "payment"
  | "paymentSearch"
  | "reports"
  | "users"
  | "audit"
  | "database"
  | "settings"
  | "manual"
  | "keybindings";

export const pageNames: Record<Page, string> = {
  home: "Overview",
  company: "Company Profile",
  accounts: "Chart of Accounts",
  items: "Items",
  banks: "Banks",
  stockTypes: "Stock Types",
  locations: "Locations",
  opening: "Item Opening Balances",
  transfer: "Transfer",
  purchase: "Purchase Challans",
  sale: "Sale Challans",
  cheques: "Cheque Detail",
  voucher: "Voucher",
  journal: "Journal Voucher",
  payment: "Payment / Receipt",
  paymentSearch: "Search Payment",
  reports: "Reports",
  users: "User Rights",
  audit: "Audit Log",
  database: "Database Tools",
  settings: "Settings",
  manual: "Manual",
  keybindings: "Keybindings",
};

export const reportGroups = [
  {
    label: "Inventory",
    reports: [
      "Transit",
      "Stock Ledger",
      "Stock Summary",
      "Stock Report Date Wise",
      "Stock Report Item Wise",
      "Item Ledger",
      "Type Wise Item Report",
    ],
  },
  {
    label: "Sales & Purchases",
    reports: [
      "Company Profitability Report",
      "Item Profitability Report",
      "Purchase Register",
      "Sales Register",
      "Purchase Report Date Wise",
      "PC Profit Report",
      "Party Item Detail",
      "Party Activity Report",
    ],
  },
  {
    label: "Financial & Ledgers",
    reports: [
      "Trial Balance",
      "Trial Balance Date Wise",
      "General Ledger",
      "Ledger",
      "Balance Sheet",
      "Profit & Loss",
      "Party Ledger",
      "Cash Book",
      "Bank Book",
    ],
  },
  { label: "Receivables", reports: ["Receivables", "Payables"] },
  {
    label: "Cheques",
    reports: ["Post Dated Cheques", "Returned Cheques", "OS Cheques"],
  },
] as const;

export const permissionPages: Page[] = [
  "home",
  "accounts",
  "items",
  "banks",
  "stockTypes",
  "locations",
  "opening",
  "transfer",
  "cheques",
  "purchase",
  "sale",
  "voucher",
  "journal",
  "paymentSearch",
  "payment",
  "reports",
  "users",
  "audit",
  "database",
  "manual",
];
