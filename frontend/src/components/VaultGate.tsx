import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { GetVaultStatus, ResetVault, SetupVaultPassword, UnlockVault } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";

interface VaultGateProps {
    initialStatus: main.VaultStatus | null;
    onUnlocked: (status: main.VaultStatus) => void;
}

type VaultMode = "setup" | "unlock" | "reset";

const passwordHint = "Use at least 10 characters. Sanctum cannot recover this password.";

export function VaultGate({ initialStatus, onUnlocked }: VaultGateProps) {
    const [status, setStatus] = useState<main.VaultStatus | null>(initialStatus);
    const [mode, setMode] = useState<VaultMode>(initialStatus?.configured ? "unlock" : "setup");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetConsent, setResetConsent] = useState("");
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(!initialStatus);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (initialStatus) {
            setStatus(initialStatus);
            setMode(initialStatus.configured ? "unlock" : "setup");
            setLoading(false);
            return;
        }

        let active = true;
        setLoading(true);
        GetVaultStatus()
            .then((nextStatus) => {
                if (!active) return;
                setStatus(nextStatus);
                setMode(nextStatus.configured ? "unlock" : "setup");
            })
            .catch(() => {
                if (active) setFeedback("Could not read vault status.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [initialStatus]);

    const clearSecrets = () => {
        setPassword("");
        setConfirmPassword("");
        setResetConsent("");
    };

    const handleResult = (result: main.AuthResult) => {
        setFeedback(result.message || "");
        setStatus(result.status);
        if (result.success && result.status?.unlocked) {
            clearSecrets();
            onUnlocked(result.status);
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFeedback("");

        if ((mode === "setup" || mode === "reset") && password !== confirmPassword) {
            setFeedback("Passwords do not match.");
            return;
        }

        if (mode === "reset" && resetConsent.trim().toUpperCase() !== "RESET") {
            setFeedback("Type RESET to confirm that the encrypted journal will be archived and cleared.");
            return;
        }

        setSubmitting(true);
        try {
            if (mode === "setup") {
                handleResult(await SetupVaultPassword(password, confirmPassword));
            } else if (mode === "reset") {
                handleResult(await ResetVault(password, confirmPassword));
            } else {
                handleResult(await UnlockVault(password));
            }
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : String(error));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !status) {
        return (
            <div className="relative min-h-screen overflow-hidden text-[var(--text)]">
                <div className="page-shell flex min-h-screen items-center justify-center">
                    <section className="app-panel-strong flex min-h-[220px] w-full max-w-xl items-center justify-center rounded-[32px]">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                    </section>
                </div>
            </div>
        );
    }

    const isSetup = mode === "setup";
    const isReset = mode === "reset";
    const title = isSetup ? "Create your Sanctum password" : isReset ? "Reset your journal password" : "Unlock Sanctum";
    const eyebrow = isSetup ? "Private Vault" : isReset ? "No Recovery" : "Welcome Back";
    const buttonText = submitting
        ? isSetup
            ? "Creating vault..."
            : isReset
                ? "Resetting journal..."
                : "Unlocking..."
        : isSetup
            ? "Create password"
            : isReset
                ? "Archive and reset"
                : "Unlock";

    return (
        <div className="relative min-h-screen overflow-hidden text-[var(--text)]">
            <div className="page-shell flex min-h-screen items-center justify-center">
                <section className="app-panel-strong w-full max-w-xl rounded-[32px] p-6 sm:p-8">
                    <div className="flex flex-col items-center text-center">
                        <span className="icon-badge h-16 w-16 rounded-[1.4rem]">
                            {isReset ? <AlertTriangle size={28} /> : <ShieldCheck size={28} />}
                        </span>
                        <p className="eyebrow mt-6">{eyebrow}</p>
                        <h1 className="page-title mt-3">{title}</h1>
                        <p className="mt-4 max-w-md text-sm leading-7 text-[var(--muted-strong)]">
                            {isReset
                                ? "Without the password, existing entries cannot be decrypted. Reset archives the encrypted database and starts a new empty journal."
                                : passwordHint}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
                        <div>
                            <label className="eyebrow">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="soft-input mt-2"
                                autoFocus
                                autoComplete={isSetup || isReset ? "new-password" : "current-password"}
                            />
                        </div>

                        {(isSetup || isReset) && (
                            <div>
                                <label className="eyebrow">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    className="soft-input mt-2"
                                    autoComplete="new-password"
                                />
                            </div>
                        )}

                        {isReset && (
                            <div className="rounded-[24px] border border-[rgba(177,95,78,0.22)] bg-[rgba(245,225,221,0.86)] p-4 text-left">
                                <p className="text-sm leading-7 text-[#7b4e42]">
                                    Type RESET to confirm the active journal will be cleared after a backup is created.
                                </p>
                                <input
                                    type="text"
                                    value={resetConsent}
                                    onChange={(event) => setResetConsent(event.target.value)}
                                    className="soft-input mt-3"
                                />
                            </div>
                        )}

                        {feedback && (
                            <div className="rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-4 text-sm leading-7 text-[var(--muted-strong)]">
                                {feedback}
                            </div>
                        )}

                        <button type="submit" disabled={submitting || !password} className="action-primary mt-2 justify-center">
                            {submitting ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f8f7f2] border-t-transparent" />
                            ) : isSetup || isReset ? (
                                <ArrowRight size={18} />
                            ) : (
                                <Lock size={18} />
                            )}
                            {buttonText}
                        </button>
                    </form>

                    {status.configured && !isReset && (
                        <button
                            type="button"
                            onClick={() => {
                                clearSecrets();
                                setFeedback("");
                                setMode("reset");
                            }}
                            className="action-secondary mt-4 w-full justify-center"
                        >
                            Forgot password
                        </button>
                    )}

                    {isReset && status.configured && (
                        <button
                            type="button"
                            onClick={() => {
                                clearSecrets();
                                setFeedback("");
                                setMode("unlock");
                            }}
                            className="action-secondary mt-4 w-full justify-center"
                        >
                            Back to unlock
                        </button>
                    )}
                </section>
            </div>
        </div>
    );
}
