import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  CompanyProfile,
  InstallationApprovalStatus,
  OfficeConnection,
  OfficeSession,
} from "@/types";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import appLogo from "../../../image.png";
import { Field } from "@/components/forms/Fields";

const bootstrapAdminUsernameKey = "tradeledger-bootstrap-admin-username";

function readBootstrapAdminUsername() {
  try {
    return window.sessionStorage.getItem(bootstrapAdminUsernameKey) || "";
  } catch {
    return "";
  }
}

export function SignInPage({
  setup,
  connection,
  onSuccess,
  onInstallationAuthorized,
}: {
  setup: boolean;
  connection: OfficeConnection;
  onSuccess: (session: OfficeSession) => void;
  onInstallationAuthorized: (status: {
    hasUsers: boolean;
    hasCompanyProfile: boolean;
    hasAdminToolsPassword: boolean;
    companyProfile?: CompanyProfile | null;
  }) => void;
}) {
  const [username, setUsername] = useState(readBootstrapAdminUsername);
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(connection.url || "");
  const [fingerprint, setFingerprint] = useState(connection.fingerprint || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [devicePassphrase, setDevicePassphrase] = useState("");
  const [deviceImporting, setDeviceImporting] = useState(false);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [installation, setInstallation] =
    useState<InstallationApprovalStatus | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalDownloadBusy, setApprovalDownloadBusy] = useState(false);
  const [approvalRequestPath, setApprovalRequestPath] = useState("");

  useEffect(() => {
    let active = true;
    void window.office.auth
      .status()
      .then((status) => {
        if (!active) return;
        if (status.hasCompanyProfile) setCompany(status.companyProfile || null);
        if (status.localInstallation) {
          setInstallation(status.localInstallation);
          if (setup && status.localInstallation.authorizedFirstAdminUsername)
            setUsername(status.localInstallation.authorizedFirstAdminUsername);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [connection.mode, connection.url, setup]);

  useEffect(() => {
    if (setup) {
      try {
        window.sessionStorage.setItem(bootstrapAdminUsernameKey, username);
      } catch {
        /* The approval grant still carries the signed administrator name. */
      }
    }
  }, [setup, username]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const accountUsername = setup
        ? installation?.authorizedFirstAdminUsername || username.trim()
        : username.trim();
      onSuccess(
        setup
          ? await window.office.auth.setup({
              username: accountUsername,
              password,
            })
          : await window.office.auth.login({
              username: accountUsername,
              password,
            }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadApprovalRequest() {
    if (!installation?.request) return;
    if (setup && !username.trim()) {
      setError(
        "Enter the administrator name as it should appear on the account",
      );
      return;
    }
    setApprovalDownloadBusy(true);
    setError("");
    setApprovalRequestPath("");
    try {
      const result = await window.office.auth.downloadBootstrapRequest({
        firstAdminUsername: setup ? username.trim() : null,
      });
      if (!result.canceled && result.path) setApprovalRequestPath(result.path);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the approval request",
      );
    } finally {
      setApprovalDownloadBusy(false);
    }
  }

  async function importApproval(file: File) {
    setApprovalBusy(true);
    setError("");
    try {
      if (!installation?.request)
        throw new Error(
          "The installation request is not available yet. Reload the sign-in page and try again.",
        );
      const grantText = await file.text();
      let grant: { firstAdminUsername?: string | null };
      try {
        grant = JSON.parse(grantText) as { firstAdminUsername?: string | null };
      } catch {
        throw new Error("The selected approval file is not valid JSON");
      }
      const approvedUsername =
        typeof grant.firstAdminUsername === "string"
          ? grant.firstAdminUsername.trim()
          : "";
      const firstAdminUsername = setup
        ? username.trim() || approvedUsername
        : null;
      if (setup && !firstAdminUsername)
        throw new Error(
          "Enter the administrator name or choose the approval file from your company owner",
        );
      const request = { ...installation.request, firstAdminUsername };
      await window.office.auth.authorizeBootstrap({
        request,
        grant: grantText,
      });
      const status = await window.office.auth.status();
      setInstallation(status.localInstallation || null);
      if (status.hasCompanyProfile) setCompany(status.companyProfile || null);
      if (setup && status.localInstallation?.authorizedFirstAdminUsername)
        setUsername(status.localInstallation.authorizedFirstAdminUsername);
      onInstallationAuthorized(status);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not import the approval file",
      );
    } finally {
      setApprovalBusy(false);
    }
  }

  const needsLocalApproval =
    connection.mode === "local" && !installation?.authorized;
  const ownerApprovalPanel = (
    <div className="grid min-w-0 gap-3 rounded-md border p-3 sm:p-4">
      <p className="text-sm font-medium">Company owner approval</p>
      <p className="text-sm text-muted-foreground">
        This computer needs one-time approval before anyone can sign in or
        create the first administrator account.
      </p>
      {installation?.error && (
        <p role="alert" className="text-sm text-destructive">
          {installation.error}
        </p>
      )}
      {installation?.request && (
        <>
          {setup && (
            <Field label="Administrator name" id="bootstrap-admin-username">
              <Input
                id="bootstrap-admin-username"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setApprovalRequestPath("");
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the name that should appear on the first account.
              </p>
            </Field>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={approvalDownloadBusy || (setup && !username.trim())}
            onClick={() => void downloadApprovalRequest()}
          >
            {approvalDownloadBusy ? "Saving…" : "Save approval request"}
          </Button>
          {approvalRequestPath && (
            <p
              role="status"
              className="break-all text-xs text-muted-foreground"
            >
              Request saved to {approvalRequestPath}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Send this file to your company owner, then import the approval file
            they return.
          </p>
          <Field label="Approval file" id="owner-approval-file">
            <Input
              id="owner-approval-file"
              type="file"
              accept=".json,application/json"
              disabled={approvalBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importApproval(file);
                event.target.value = "";
              }}
            />
          </Field>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <main className="grid min-h-svh w-full place-items-center overflow-y-auto bg-muted/30 px-3 py-4 sm:px-6 sm:py-8">
      <div className="grid w-full max-w-5xl min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
        <Card className="order-1 min-w-0 lg:col-start-2 lg:row-start-1">
          <CardHeader className="p-4 sm:p-6">
            <div className="mb-2 grid size-11 place-items-center overflow-hidden rounded-xl border bg-white p-0.5 shadow-sm">
              <img
                src={appLogo}
                alt="TradeLedger Office logo"
                className="size-11 object-contain"
              />
            </div>
            <CardTitle>
              {needsLocalApproval
                ? "Approve this computer"
                : setup
                  ? "Create administrator account"
                  : "Sign in"}
            </CardTitle>
            <CardDescription>
              {needsLocalApproval
                ? "Request approval from your company owner before using this computer."
                : setup
                  ? "The first account will have administrator access."
                  : `Use your office account · ${connection.mode === "remote" ? "Shared office" : "This computer"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4 p-4 pt-0 sm:gap-4 sm:p-6 sm:pt-0">
            {needsLocalApproval ? (
              ownerApprovalPanel
            ) : setup && connection.mode === "remote" ? (
              <p className="text-sm text-muted-foreground">
                Create the first administrator account on the office computer,
                then sign in here with your office account.
              </p>
            ) : (
              <form
                className="min-w-0"
                onSubmit={(event) => void submit(event)}
              >
                <FieldGroup className="grid min-w-0 gap-4">
                  <FormSectionHeading
                    title={setup ? "Administrator account" : "Sign-in details"}
                    className="w-full"
                  />
                  <Field label="User name" id="auth-username">
                    <Input
                      id="auth-username"
                      autoComplete="username"
                      required
                      value={
                        setup
                          ? installation?.authorizedFirstAdminUsername ||
                            username
                          : username
                      }
                      readOnly={Boolean(
                        setup && installation?.authorizedFirstAdminUsername,
                      )}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </Field>
                  <Field label="Password" id="auth-password">
                    <Input
                      id="auth-password"
                      type="password"
                      autoComplete={setup ? "new-password" : "current-password"}
                      minLength={setup ? 8 : undefined}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Please wait…"
                      : setup
                        ? "Create administrator"
                        : "Sign in"}
                  </Button>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="order-2 grid min-w-0 content-start gap-3 lg:col-start-1 lg:row-start-1">
          {company && (
            <Card className="min-w-0">
              <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                <CardTitle className="truncate text-base">
                  {company.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 p-4 pt-0 text-sm text-muted-foreground sm:p-5 sm:pt-0">
                {company.address && (
                  <p className="wrap-break-word whitespace-pre-line">
                    {company.address}
                  </p>
                )}
                {company.phone && <p>{company.phone}</p>}
                {company.fiscalYear && (
                  <p className="text-xs">Fiscal year · {company.fiscalYear}</p>
                )}
              </CardContent>
            </Card>
          )}
          <Card className="min-w-0">
            <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
              <CardTitle className="text-base">Shared office</CardTitle>
              <CardDescription>
                Connect this computer to your company office.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
              <details
                open={
                  connection.mode === "remote" && (needsLocalApproval || setup)
                }
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {connection.mode === "remote"
                    ? "Change connection settings"
                    : "Connect to a shared office"}
                </summary>
                <div className="mt-3 grid min-w-0 gap-3">
                  <p className="text-xs text-muted-foreground">
                    Enter the server address and security fingerprint provided
                    by your administrator. Confirm both with them before
                    connecting.
                  </p>
                  <div className="grid min-w-0 gap-2 rounded-md border p-3">
                    <p className="text-sm font-medium">Device access</p>
                    <p className="text-xs text-muted-foreground">
                      Your administrator provides a device file and a one-time
                      passphrase. Import them here before connecting. The
                      credential is stored securely on this computer.
                    </p>
                    <Field
                      label="One-time passphrase"
                      id="device-credential-passphrase"
                    >
                      <Input
                        id="device-credential-passphrase"
                        type="password"
                        autoComplete="off"
                        required
                        value={devicePassphrase}
                        onChange={(event) =>
                          setDevicePassphrase(event.target.value)
                        }
                      />
                    </Field>
                    <Input
                      className="min-w-0"
                      type="file"
                      accept=".json,application/json"
                      aria-label="Device credential file"
                      disabled={deviceImporting}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setDeviceImporting(true);
                        try {
                          await window.office.device.importCredential({
                            bundle: await file.text(),
                            passphrase: devicePassphrase,
                          });
                          window.location.reload();
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Could not import device credential",
                          );
                        } finally {
                          setDeviceImporting(false);
                          event.target.value = "";
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {deviceImporting
                        ? "Importing device access…"
                        : "Import the device file before connecting."}
                    </p>
                  </div>
                  <FormSectionHeading
                    title="Connection details"
                    className="w-full"
                  />
                  <Field label="Office server address" id="office-server-url">
                    <Input
                      id="office-server-url"
                      placeholder="https://192.168.1.20:48391"
                      value={serverUrl}
                      onChange={(event) => setServerUrl(event.target.value)}
                    />
                  </Field>
                  <Field
                    label="Certificate fingerprint"
                    id="office-server-fingerprint"
                  >
                    <Input
                      id="office-server-fingerprint"
                      placeholder="SHA-256 fingerprint"
                      value={fingerprint}
                      onChange={(event) => setFingerprint(event.target.value)}
                    />
                  </Field>
                  <Button
                    className="w-full"
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await window.office.connection.configureRemote({
                          url: serverUrl,
                          fingerprint,
                        });
                        window.location.reload();
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Could not save office server connection",
                        );
                      }
                    }}
                  >
                    Connect to shared office
                  </Button>
                  {connection.mode === "remote" && (
                    <Button
                      className="w-full"
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        await window.office.connection.useLocal();
                        window.location.reload();
                      }}
                    >
                      Use this computer’s local database
                    </Button>
                  )}
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
