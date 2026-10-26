# TradeLedger Office

TradeLedger Office is a desktop application for keeping company accounts, inventory, challans, vouchers, cheques, and reports together. It is an active development project being prepared for a controlled office pilot.

The current app uses Electron, React, TypeScript, Vite, Tailwind CSS, and SQLite. A legacy Java Swing implementation is kept under [`java-app/`](java-app/).

## What it includes

- Company profile and printable company branding
- Accounts, items, banks, stock locations, and opening balances
- Purchase and sales challans, stock transfers, vouchers, payments, and cheque tracking
- Ledgers, trial balance, inventory, and other reports with CSV export where available
- User accounts, page permissions, and an audit log
- Local SQLite backups, data export, and database integrity checks
- Optional shared-office access with one computer hosting the database

## Development

Requirements: Node.js 24 and pnpm.

```sh
pnpm install
pnpm dev
```

Run the automated checks and production build with:

```sh
pnpm test
pnpm build
```

To create a fictional showcase database and launch the app against it:

```sh
pnpm seed
pnpm dev:seed
```

The seed database contains sample company, account, inventory, challan, voucher, transfer, and cheque records. It does not include a login account; use the normal first-administrator approval and setup process. `pnpm seed -- --reset` recreates the showcase database and deletes the app’s backup folder for the current operating system. Use it only when you intend to remove those local backups. The seed script can also target a separate test database; see `scripts/seed-demo.cjs` for the command syntax.

## First administrator approval

Before a local installation can create its first administrator or sign in, the company owner must approve that installation:

1. On the company computer, enter the administrator name and save the approval request from the sign-in page.
2. Give the request file to the owner through a trusted channel.
3. The owner signs it using the private key kept outside the app and repository:

   ```sh
   node scripts/approve-installation.cjs tradeledger-installation-request.json /path/to/bootstrap-owner-private.pem tradeledger-approval.json
   ```

4. Return the approval file to the company computer and import it. The signature is valid for that installation and administrator name, and expires after 72 hours.

The app package contains the matching public key at `electron/bootstrap-owner-public.pem`. Do not commit, package, or share the private key. Losing that private key means existing builds cannot accept grants signed by a replacement key.

## Shared office

Shared-office mode keeps one SQLite database on the host computer. Client computers connect over HTTPS using an administrator-issued device credential, the server address, and a verified certificate fingerprint. Each operator uses an individual account.

The host must remain powered on, signed in, running the app, and connected to the office network. Clients do not maintain separate editable databases or merge offline changes. Use a trusted private network or approved VPN; do not expose the server directly to the public internet. Protect the host account and make regular backups. The live SQLite file is not encrypted by the app, and a person with administrator access to the host computer can access its local files.

## Build packages

Build Windows packages on a supported Windows computer:

```sh
pnpm package:win
```

Build an AppImage on Linux:

```sh
pnpm package:linux
```

Packages are written to `build-electron/`, which is intentionally excluded from Git. Test the installer and data persistence on the target operating system before using it with office records.

## Project status and limits

This is a pilot application, not an accounting-validated replacement for an existing system. Report calculations and business rules need office review before official use. Invoice-level payment allocation, due-date aging, in-app backup restore, verified legacy data migration, and offline change merging are not implemented. Keep the current office system authoritative until the workflows and results have been checked against approved records.

The Java Swing application is retained for reference. Its source, tests, and scripts are under `java-app/`; it is not used by the Electron package. Run its tests with `./java-app/scripts/test.sh` or launch it with `./java-app/scripts/run.sh`.
