export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE"
  | "UNCLASSIFIED";
export type Account = {
  code: string;
  description: string;
  parentCode: string | null;
  openingBalance: number;
  openingBalanceSide: "DEBIT" | "CREDIT";
  accountType: AccountType;
};
export type Item = {
  code: string;
  description: string;
  unit: string;
  saleRate: number;
  purchaseRate: number;
  stockType: string;
  brand: string;
  category: string;
  stockQuantity: number;
};
export type Bank = {
  code: string;
  name: string;
  accountNumber: string;
  openingBalance: number;
  address: string;
  phone: string;
  ledgerAccountCode: string;
};
export type StockType = { code: string; description: string };
export type StockMovement = {
  id: number;
  date: string;
  document: string;
  type: string;
  itemCode: string;
  location: string;
  quantity: number;
  rate: number;
  amount: number;
};
export type OpeningBalance = {
  id: number;
  date: string;
  document: string;
  itemCode: string;
  itemDescription: string | null;
  location: string;
  quantity: number;
  rate: number;
  amount: number;
};
export type ChallanLine = {
  lineNumber?: number;
  itemCode: string;
  itemLabel?: string;
  quantity: number;
  rate: number;
  amount: number;
};
export type ChallanInputLine = {
  itemCode?: string;
  itemLabel?: string;
  quantity: number;
  rate?: number;
};
export type Challan = {
  number: string;
  type: string;
  date: string;
  party: string;
  location: string;
  total: number;
  lines: ChallanLine[];
};
export type Cheque = {
  number: string;
  bankCode: string;
  date: string;
  party: string;
  amount: number;
  status: string;
  checkNumber: string;
  direction: "" | "PAYMENT" | "RECEIPT";
  bankAccountCode: string;
  clearedDate: string;
};
export type VoucherLine = {
  lineNumber?: number;
  accountCode: string;
  debit: number;
  credit: number;
};
export type Voucher = {
  number: string;
  date: string;
  narration: string;
  reference: string;
  type: "VOUCHER" | "JOURNAL VOUCHER" | "PAYMENT" | "RECEIPT";
  lines: VoucherLine[];
};
export type Dashboard = {
  today: string;
  counts: {
    accounts: number | null;
    items: number | null;
    banks: number | null;
    purchasesToday: number | null;
    salesToday: number | null;
  };
  brandTotals: Array<{ brand: string; purchases: number | null; sales: number | null }>;
  recent: Array<{
    number: string;
    type: string;
    date: string;
    party: string;
    total: number;
  }>;
  canSeeRecent: boolean;
  stockQuantity: number | null;
};
export type OfficeUser = {
  username: string;
  permissions: string[];
  macAddress: string;
  isAdministrator: boolean;
};
export type AuthorizedDevice = {
  deviceId: string;
  username: string;
  name: string;
  fingerprint: string;
  createdAt: string;
  revokedAt: string;
};
export type IssuedDeviceCredential = {
  device: AuthorizedDevice;
  bundle: {
    version: 1;
    deviceId: string;
    username: string;
    name: string;
    certificate: string;
    encryptedPrivateKey: string;
  };
  passphrase: string;
};
export type AuditEvent = {
  eventTime: string;
  username: string;
  action: string;
  details: string;
};
export type OfficeSession = {
  username: string;
  permissions: string[];
  isAdministrator: boolean;
};
export type UserPermissionPreset = {
  name: string;
  originalName?: string;
  description: string;
  permissions: string[];
};
export type OfficeConnection = {
  mode: "local" | "remote";
  url?: string;
  fingerprint?: string;
};
export type InstallationApprovalStatus = {
  authorized: boolean;
  request: {
    version: 1;
    requestId: string;
    installationPublicKey: string;
  } | null;
  authorizedFirstAdminUsername: string | null;
  error: string | null;
};
export type OfficeServerInfo = {
  urls: string[];
  fingerprint: string;
  port: number;
};
export type DatabaseVerification = {
  ok: boolean;
  integrity: string[];
  foreignKeyViolations: Array<Record<string, unknown>>;
  tableCounts: Record<string, number>;
  checkedAt: string;
};
export type CompanyProfile = {
  name: string;
  address: string;
  phone: string;
  fiscalYear: string;
  logoPath: string;
};

export type OfficeBridge = {
  auth: {
    status: () => Promise<{
      hasUsers: boolean;
      hasCompanyProfile: boolean;
      hasAdminToolsPassword: boolean;
      adminToolsUnlockedUntil: number | null;
      companyProfile?: CompanyProfile | null;
      session: OfficeSession | null;
      localInstallation?: InstallationApprovalStatus;
    }>;
    downloadBootstrapRequest: (value: {
      firstAdminUsername: string | null;
    }) => Promise<{ canceled: boolean; path: string | null }>;
    authorizeBootstrap: (value: {
      request: {
        version: 1;
        requestId: string;
        installationPublicKey: string;
        firstAdminUsername: string | null;
      };
      grant: string;
    }) => Promise<{ authorized: boolean }>;
    setup: (value: {
      username: string;
      password: string;
    }) => Promise<OfficeSession>;
    login: (value: {
      username: string;
      password: string;
    }) => Promise<OfficeSession>;
    logout: () => Promise<void>;
    onSessionExpired?: (callback: () => void) => () => void;
  };
  sync: { onDataChanged: (callback: () => void) => () => void };
  app: {
    quit: () => Promise<void>;
    canOpenDevTools: () => Promise<boolean>;
    menuAction: (
      action:
        | "reload"
        | "forceReload"
        | "devTools"
        | "zoomIn"
        | "zoomOut"
        | "resetZoom"
        | "minimize"
        | "close"
        | "fullscreen"
        | "undo"
        | "redo"
        | "cut"
        | "copy"
        | "paste"
        | "selectAll",
    ) => Promise<void>;
    onScreenshotDownloadComplete: (
      callback: (result: { state: string; path: string }) => void,
    ) => () => void;
  };
  connection: {
    get: () => Promise<OfficeConnection>;
    configureRemote: (value: {
      url: string;
      fingerprint: string;
    }) => Promise<OfficeConnection>;
    useLocal: () => Promise<OfficeConnection>;
  };
  device: {
    importCredential: (value: {
      bundle: string;
      passphrase: string;
    }) => Promise<{ deviceId: string; username: string; name: string }>;
  };
  security: {
    unlockAdminTools: (password: string) => Promise<{ expiresAt: number }>;
    configureAdminToolsPassword: (value: {
      currentPassword: string;
      newPassword: string;
    }) => Promise<void>;
  };
  server: {
    start: () => Promise<OfficeServerInfo>;
    stop: () => Promise<void>;
    status: () => Promise<OfficeServerInfo | null>;
    getAutostart: () => Promise<boolean>;
    setAutostart: (enabled: boolean) => Promise<boolean>;
  };
  users: {
    list: () => Promise<OfficeUser[]>;
    save: (value: {
      username: string;
      password: string;
      permissions: string[];
      macAddress: string;
    }) => Promise<OfficeUser>;
    remove: (username: string) => Promise<void>;
  };
  presets: {
    list: () => Promise<UserPermissionPreset[]>;
    save: (value: UserPermissionPreset) => Promise<UserPermissionPreset[]>;
    remove: (name: string) => Promise<UserPermissionPreset[]>;
  };
  devices: {
    list: () => Promise<AuthorizedDevice[]>;
    create: (value: {
      username: string;
      name: string;
    }) => Promise<IssuedDeviceCredential>;
    revoke: (deviceId: string) => Promise<void>;
  };
  audit: { list: () => Promise<AuditEvent[]> };
  database: {
    backup: () => Promise<{ fileName: string; bytes: number; path: string }>;
    backupDirectory: () => Promise<{ directory: string }>;
    chooseBackupDirectory: () => Promise<{
      canceled: boolean;
      directory: string;
    }>;
    exportData: () => Promise<{
      canceled: boolean;
      path?: string;
      bytes?: number;
    }>;
    verify: () => Promise<DatabaseVerification>;
    openBackups: () => Promise<void>;
  };
  reports: {
    exportPdf: (
      fileName: string,
      landscape: boolean,
    ) => Promise<{ canceled: boolean; path?: string }>;
  };
  ids: {
    next: (
      entity:
        | "account"
        | "item"
        | "bank"
        | "purchaseChallan"
        | "saleChallan"
        | "cheque"
        | "transfer"
        | "voucher",
    ) => Promise<string>;
  };
  dashboard: () => Promise<Dashboard>;
  company: {
    get: () => Promise<CompanyProfile>;
    save: (value: CompanyProfile) => Promise<CompanyProfile>;
    logo: () => Promise<string | null>;
    pathForFile: (file: File) => string;
  };
  accounts: {
    list: () => Promise<Account[]>;
    save: (
      value: Account & { __baseline?: Partial<Account> },
    ) => Promise<Account>;
    remove: (code: string) => Promise<void>;
  };
  items: {
    list: () => Promise<Item[]>;
    save: (value: Item & { __baseline?: Partial<Item> }) => Promise<Item>;
    createForChallan: (value: {
      type: "PURCHASE" | "SALE";
      item: Omit<Item, "code" | "stockQuantity">;
    }) => Promise<Item>;
    remove: (code: string) => Promise<void>;
  };
  banks: {
    list: () => Promise<Bank[]>;
    save: (value: Bank & { __baseline?: Partial<Bank> }) => Promise<Bank>;
    remove: (code: string) => Promise<void>;
  };
  challans: {
    list: (type?: string) => Promise<Challan[]>;
    post: (
      value: Omit<Challan, "total" | "lines"> & { lines: ChallanInputLine[] },
    ) => Promise<Challan>;
    update: (
      value: Omit<Challan, "total" | "lines"> & {
        lines: ChallanInputLine[];
        __baseline?: Partial<Challan>;
      },
    ) => Promise<Challan>;
    remove: (number: string) => Promise<void>;
  };
  cheques: {
    list: () => Promise<Cheque[]>;
    save: (value: Cheque & { __baseline?: Partial<Cheque> }) => Promise<Cheque>;
    remove: (number: string) => Promise<void>;
  };
  vouchers: {
    list: () => Promise<Voucher[]>;
    save: (
      value: Voucher & { update?: boolean; __baseline?: Partial<Voucher> },
    ) => Promise<Voucher>;
    remove: (number: string) => Promise<void>;
  };
  stock: {
    locations: () => Promise<string[]>;
    quantity: (itemCode: string, location: string) => Promise<number>;
    types: () => Promise<StockType[]>;
    saveType: (value: StockType) => Promise<StockType>;
    removeType: (code: string) => Promise<void>;
    movements: () => Promise<StockMovement[]>;
    openings: () => Promise<OpeningBalance[]>;
    addOpening: (value: {
      itemCode: string;
      location: string;
      quantity: number;
    }) => Promise<{
      itemCode: string;
      location: string;
      quantity: number;
      rate: number;
      amount: number;
    }>;
    transfer: (value: {
      itemCode: string;
      fromLocation: string;
      toLocation: string;
      quantity: number;
    }) => Promise<{
      transferId: string;
      date: string;
      itemCode: string;
      fromLocation: string;
      toLocation: string;
      quantity: number;
    }>;
  };
  locations: {
    save: (name: string) => Promise<string>;
    remove: (name: string) => Promise<void>;
  };
};

declare global {
  interface Window {
    office: OfficeBridge;
  }
}
