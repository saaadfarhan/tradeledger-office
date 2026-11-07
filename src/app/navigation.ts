export type Page =
  | "home"
  | "company"
  | "accounts"
  | "items"
  | "categories"
  | "banks"
  | "locations"
  | "opening"
  | "transfer"
  | "purchase"
  | "sale"
  | "cheques"
  | "journal"
  | "payment"
  | "paymentView"
  | "reports"
  | "users"
  | "audit"
  | "database"
  | "settings"
  | "manual"
  | "keybindings"
  | "search";

export const pageNames: Record<Page, string> = {
  home: "Home",
  company: "Company Profile",
  accounts: "Chart of Accounts",
  items: "Items",
  categories: "Categories",
  banks: "Banks",
  locations: "Locations",
  opening: "Item Opening Balances",
  transfer: "Transfer",
  purchase: "Purchase Challans",
  sale: "Sale Challans",
  cheques: "Cheque Detail",
  journal: "Journal Voucher",
  payment: "Payment / Receipt",
  paymentView: "Payment / Receipt (view only)",
  reports: "Reports",
  users: "User Rights",
  audit: "Audit Log",
  database: "Database Tools",
  settings: "Settings",
  manual: "Manual",
  keybindings: "Keybindings",
  search: "Search Results",
};

export const permissionPages: Page[] = [
  "home",
  "accounts",
  "items",
  "categories",
  "banks",
  "locations",
  "opening",
  "transfer",
  "cheques",
  "purchase",
  "sale",
  "journal",
  "payment",
  "paymentView",
  "reports",
  "users",
  "audit",
  "database",
  "manual",
];
