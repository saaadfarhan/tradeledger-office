#!/usr/bin/env node

// Create a disposable, realistic local SQLite dataset for UI/manual testing.
// Usage: pnpm seed [--reset] [path/to/database.sqlite]
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const Database = require("better-sqlite3");
const { openOfficeDatabase } = require("../electron/database.cjs");

const businessTables = [
  "company_profile",
  "users",
  "accounts",
  "items",
  "stock_types",
  "locations",
  "banks",
  "cheques",
  "cheque_status_history",
  "challans",
  "challan_lines",
  "vouchers",
  "voucher_lines",
  "stock_movements",
  "stock_transfers",
  "audit_events",
];

function parseArgs(args) {
  const reset = args.includes("--reset");
  const files = args.filter((arg) => arg !== "--reset");
  if (files.length > 1)
    throw new Error("Usage: pnpm seed [--reset] [path/to/database.sqlite]");
  return {
    reset,
    file: path.resolve(files[0] || path.join("build", "showcase-data.sqlite")),
  };
}

function getSystemBackupDirectory() {
  if (process.platform === "win32") {
    const root =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(root, "PurchaseSaleOffice", "data", "backups");
  }
  if (process.platform === "darwin")
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "TradeLedgerOffice",
      "data",
      "backups",
    );
  const configRoot =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configRoot, "TradeLedgerOffice", "data", "backups");
}

function assertEmptyDatabase(file) {
  if (!fs.existsSync(file)) return;
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const tables = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
    const occupied = businessTables
      .filter((table) => tables.has(table))
      .filter((table) => db.prepare(`SELECT 1 FROM "${table}" LIMIT 1`).get());
    if (occupied.length) {
      throw new Error(
        `Refusing to seed a database with existing data (${occupied.join(", ")}). Choose a new file.`,
      );
    }
  } finally {
    db.close();
  }
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function seed(store) {
  store.saveCompanyProfile({
    name: "Crescent Trading Company",
    address: "Shop 12, Jodia Bazaar, Karachi",
    phone: "+92 21 3241 7788",
    fiscalYear: `${new Date().getUTCFullYear()}-${new Date().getUTCFullYear() + 1}`,
    logoPath: "",
  });

  const accounts = [
    { code: "1000", description: "Assets", accountType: "ASSET" },
    {
      code: "1100",
      description: "Cash in Hand",
      parentCode: "1000",
      accountType: "ASSET",
      openingBalance: 300000,
    },
    {
      code: "1200",
      description: "Bank Accounts",
      parentCode: "1000",
      accountType: "ASSET",
      openingBalance: 1570000,
    },
    {
      code: "1300",
      description: "Accounts Receivable",
      parentCode: "1000",
      accountType: "ASSET",
    },
    { code: "2000", description: "Liabilities", accountType: "LIABILITY" },
    {
      code: "2100",
      description: "Accounts Payable",
      parentCode: "2000",
      accountType: "LIABILITY",
    },
    { code: "PARTY", description: "Party", accountType: "UNCLASSIFIED" },
    { code: "3000", description: "Equity", accountType: "EQUITY" },
    {
      code: "3100",
      description: "Owner Capital",
      parentCode: "3000",
      accountType: "EQUITY",
      openingBalance: 2100000,
      openingBalanceSide: "CREDIT",
    },
    { code: "4000", description: "Sales Revenue", accountType: "INCOME" },
    { code: "5000", description: "Purchases", accountType: "EXPENSE" },
    { code: "6000", description: "Operating Expenses", accountType: "EXPENSE" },
    {
      code: "6100",
      description: "Rent Expense",
      parentCode: "6000",
      accountType: "EXPENSE",
    },
    {
      code: "6200",
      description: "Utilities Expense",
      parentCode: "6000",
      accountType: "EXPENSE",
    },
    {
      code: "6300",
      description: "Staff Salaries",
      parentCode: "6000",
      accountType: "EXPENSE",
    },
    {
      code: "6400",
      description: "Freight and Delivery",
      parentCode: "6000",
      accountType: "EXPENSE",
    },
    {
      code: "6500",
      description: "Bank Charges",
      parentCode: "6000",
      accountType: "EXPENSE",
    },
  ];
  accounts.forEach((account) =>
    store.saveAccount({
      openingBalance: 0,
      openingBalanceSide: "DEBIT",
      ...account,
    }),
  );

  store.saveStockType({ code: "REG", description: "Regular merchandise" });
  store.saveStockType({ code: "SER", description: "Services" });
  store.saveStockType({ code: "BULK", description: "Bulk goods" });
  store.saveStockType({ code: "PACK", description: "Packaged goods" });

  const items = [
    {
      code: "ITM-00001",
      description: "Premium Basmati Rice 25kg",
      unit: "Bag",
      purchaseRate: 6400,
      saleRate: 7100,
      stockType: "BULK",
    },
    {
      code: "ITM-00002",
      description: "Cooking Oil 5L Tin",
      unit: "Tin",
      purchaseRate: 2250,
      saleRate: 2520,
      stockType: "PACK",
    },
    {
      code: "ITM-00003",
      description: "White Sugar 50kg",
      unit: "Bag",
      purchaseRate: 7200,
      saleRate: 7800,
      stockType: "BULK",
    },
    {
      code: "ITM-00004",
      description: "Red Lentils 1kg",
      unit: "Pack",
      purchaseRate: 310,
      saleRate: 365,
      stockType: "PACK",
    },
    {
      code: "ITM-00005",
      description: "Green Tea 500g",
      unit: "Pack",
      purchaseRate: 780,
      saleRate: 930,
      stockType: "PACK",
    },
    {
      code: "ITM-00006",
      description: "Mineral Water 1.5L",
      unit: "Bottle",
      purchaseRate: 82,
      saleRate: 110,
      stockType: "PACK",
    },
    {
      code: "ITM-00007",
      description: "Wheat Flour 10kg",
      unit: "Bag",
      purchaseRate: 1450,
      saleRate: 1690,
      stockType: "BULK",
    },
    {
      code: "ITM-00008",
      description: "Chickpeas 1kg",
      unit: "Pack",
      purchaseRate: 420,
      saleRate: 495,
      stockType: "PACK",
    },
    {
      code: "ITM-00009",
      description: "Laundry Detergent 2kg",
      unit: "Pack",
      purchaseRate: 890,
      saleRate: 1050,
      stockType: "PACK",
    },
    {
      code: "ITM-00010",
      description: "Tea Cups (set of 6)",
      unit: "Set",
      purchaseRate: 1100,
      saleRate: 1390,
      stockType: "REG",
    },
    {
      code: "ITM-00011",
      description: "Delivery Service",
      unit: "Service",
      purchaseRate: 0,
      saleRate: 1200,
      stockType: "SER",
    },
    {
      code: "ITM-00012",
      description: "Packaging and Handling",
      unit: "Service",
      purchaseRate: 0,
      saleRate: 450,
      stockType: "SER",
    },
  ];
  items.forEach((item) => store.saveItem(item));

  store.saveBank({
    code: "BNK-00001",
    name: "Habib Bank Limited",
    accountNumber: "PK12HABB00001234567890",
    openingBalance: 875000,
    address: "I.I. Chundrigar Road, Karachi",
    phone: "+92 21 111 111 425",
    ledgerAccountCode: "1200",
  });
  store.saveBank({
    code: "BNK-00002",
    name: "Meezan Bank",
    accountNumber: "PK44MEZN00009876543210",
    openingBalance: 420000,
    address: "Tariq Road, Karachi",
    phone: "+92 21 111 331 331",
    ledgerAccountCode: "1200",
  });
  store.saveBank({
    code: "BNK-00003",
    name: "Bank Alfalah",
    accountNumber: "PK78ALFH00001122334455",
    openingBalance: 275000,
    address: "Gulshan-e-Iqbal, Karachi",
    phone: "+92 21 111 225 111",
    ledgerAccountCode: "1200",
  });

  const suppliers = [
    "Al Madina Wholesale",
    "Karachi Grain Traders",
    "Noorani Foods",
    "Pak Agro Distributors",
    "Metro General Suppliers",
  ];
  const customers = [
    "City Mart",
    "Al Rehman General Store",
    "Bismillah Supermarket",
    "Usman & Sons",
    "Green Basket Grocers",
    "Saddar Family Store",
  ];
  const supplierCodes = suppliers.map(
    (_, index) => `SUP-${String(index + 1).padStart(3, "0")}`,
  );
  const customerCodes = customers.map(
    (_, index) => `CUS-${String(index + 1).padStart(3, "0")}`,
  );
  const supplierCredits = [75000, 65000, 50000, 35000, 25000];
  const customerDebits = [125000, 95000, 120000, 70000, 70000, 0];
  suppliers.forEach((description, index) =>
    store.saveAccount({
      code: supplierCodes[index],
      description,
      parentCode: "PARTY",
      accountType: "LIABILITY",
      openingBalance: supplierCredits[index],
      openingBalanceSide: "CREDIT",
    }),
  );
  customers.forEach((description, index) =>
    store.saveAccount({
      code: customerCodes[index],
      description,
      parentCode: "PARTY",
      accountType: "ASSET",
      openingBalance: customerDebits[index],
      openingBalanceSide: "DEBIT",
    }),
  );

  const locations = ["Main Warehouse", "Saddar Branch", "Gulshan Outlet"];
  locations.forEach((location) => store.saveLocation(location));
  const products = items.filter((item) => item.stockType !== "SER");
  for (const item of products)
    for (const location of locations)
      store.addOpeningBalance({ itemCode: item.code, location, quantity: 18 });

  for (let i = 0; i < 36; i += 1) {
    const item = products[i % products.length];
    const secondItem = products[(i + 3) % products.length];
    store.postChallan({
      number: `PUR-${String(i + 1).padStart(5, "0")}`,
      type: "PURCHASE",
      date: dateDaysAgo(190 - i * 3),
      party: supplierCodes[i % suppliers.length],
      location: locations[i % locations.length],
      lines: [
        {
          itemCode: item.code,
          quantity: 75 + (i % 6) * 12,
          rate: item.purchaseRate,
        },
        ...(i % 2 === 0
          ? [
              {
                itemCode: secondItem.code,
                quantity: 20 + (i % 5) * 4,
                rate: secondItem.purchaseRate,
              },
            ]
          : []),
      ],
    });
  }

  for (let i = 0; i < 60; i += 1) {
    const item = products[(i * 7) % products.length];
    const secondItem = products[(i * 7 + 4) % products.length];
    const daysAgo = i < 57 ? 80 - i : 2 - (i - 57);
    const lines = [
      { itemCode: item.code, quantity: 3 + (i % 6), rate: item.saleRate },
      ...(i % 3 === 0
        ? [
            {
              itemCode: secondItem.code,
              quantity: 2 + (i % 3),
              rate: secondItem.saleRate,
            },
          ]
        : []),
      ...(i % 11 === 0
        ? [
            {
              itemLabel: "Local delivery and handling",
              quantity: 1,
              rate: 1500,
            },
          ]
        : []),
    ];
    store.postChallan({
      number: `SAL-${String(i + 1).padStart(5, "0")}`,
      type: "SALE",
      date: dateDaysAgo(daysAgo),
      party: customerCodes[i % customers.length],
      location: locations[(i * 5) % locations.length],
      lines,
    });
  }

  store.transferStock({
    itemCode: products[0].code,
    fromLocation: locations[0],
    toLocation: locations[1],
    quantity: 6,
  });
  store.transferStock({
    itemCode: products[3].code,
    fromLocation: locations[1],
    toLocation: locations[2],
    quantity: 9,
  });

  const expenseAccounts = ["6100", "6200", "6300", "6400", "6500"];
  for (let i = 0; i < 24; i += 1) {
    const amount = 8500 + (i % 7) * 3750;
    const cashAccount = i % 2 === 0 ? "1100" : "1200";
    const type = ["PAYMENT", "RECEIPT", "JOURNAL VOUCHER", "VOUCHER"][i % 4];
    let narration;
    let lines;
    if (type === "PAYMENT") {
      narration = [
        "Shop rent",
        "Electricity bill",
        "Staff salary",
        "Freight settlement",
        "Bank service charge",
      ][i % 5];
      lines = [
        {
          accountCode: expenseAccounts[i % expenseAccounts.length],
          debit: amount,
          credit: 0,
        },
        { accountCode: cashAccount, debit: 0, credit: amount },
      ];
    } else if (type === "RECEIPT") {
      narration = `Customer account settlement · ${customers[i % customers.length]}`;
      lines = [
        { accountCode: cashAccount, debit: amount, credit: 0 },
        {
          accountCode: customerCodes[i % customers.length],
          debit: 0,
          credit: amount,
        },
      ];
    } else if (type === "JOURNAL VOUCHER") {
      narration = "Monthly inventory and operating adjustment";
      lines = [
        { accountCode: "5000", debit: amount, credit: 0 },
        { accountCode: "2100", debit: 0, credit: amount },
      ];
    } else {
      narration = "Supplier settlement from bank";
      lines = [
        {
          accountCode: supplierCodes[i % suppliers.length],
          debit: amount,
          credit: 0,
        },
        { accountCode: cashAccount, debit: 0, credit: amount },
      ];
    }
    store.saveVoucher({
      number: `VCH-${String(i + 1).padStart(5, "0")}`,
      date: dateDaysAgo(150 - i * 6),
      type,
      narration,
      reference: `DEMO-${String(i + 1).padStart(3, "0")}`,
      lines,
    });
  }

  const chequeSamples = [
    {
      status: "PENDING",
      bankCode: "BNK-00001",
      party: supplierCodes[1],
      daysAgo: -8,
    },
    {
      status: "CLEARED",
      bankCode: "BNK-00002",
      party: supplierCodes[0],
      daysAgo: 9,
      direction: "PAYMENT",
    },
    {
      status: "RETURNED",
      bankCode: "BNK-00003",
      party: customerCodes[0],
      daysAgo: 18,
    },
    {
      status: "CANCELLED",
      bankCode: "BNK-00001",
      party: supplierCodes[3],
      daysAgo: 24,
    },
    {
      status: "PENDING",
      bankCode: "BNK-00003",
      party: supplierCodes[2],
      daysAgo: 2,
    },
    {
      status: "CLEARED",
      bankCode: "BNK-00001",
      party: customerCodes[1],
      daysAgo: 13,
      direction: "RECEIPT",
    },
  ];
  chequeSamples.forEach((cheque, index) =>
    store.saveCheque({
      number: `CHQ-${String(index + 1).padStart(5, "0")}`,
      bankCode: cheque.bankCode,
      date: dateDaysAgo(cheque.daysAgo),
      party: cheque.party,
      amount: 18500 + index * 12750,
      status: cheque.status,
      checkNumber: `00${4821 + index * 173}`,
      direction: cheque.direction || "",
      bankAccountCode: cheque.direction ? "1200" : "",
      clearedDate:
        cheque.status === "CLEARED" ? dateDaysAgo(cheque.daysAgo) : "",
    }),
  );
}

const { reset, file } = parseArgs(process.argv.slice(2));
if (reset) {
  for (const suffix of ["", "-wal", "-shm"])
    fs.rmSync(`${file}${suffix}`, { force: true });
  const backupDirectory = getSystemBackupDirectory();
  fs.rmSync(backupDirectory, { recursive: true, force: true });
  console.log(
    `Reset database at ${file} and removed system application backups at ${backupDirectory}`,
  );
}
assertEmptyDatabase(file);
const store = openOfficeDatabase(file);
try {
  seed(store);
  console.log(`Seeded sample office data in ${file}`);
  console.log(
    "This dataset contains fictional parties, balanced opening balances, 96 challans, 24 vouchers, stock transfers, and all cheque statuses.",
  );
  console.log(
    "No user account is seeded; complete the normal first-administrator setup to sign in.",
  );
} finally {
  store.close();
}
