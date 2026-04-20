import { ExternalLink, Heart, Phone, ShieldAlert, X } from "lucide-react";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";

interface CrisisScreenProps {
    severity: string;
    region: string;
    onDismiss: () => void;
}

const crisisResources = [
    {
        regionKey: "us",
        name: "National Suicide Prevention Lifeline",
        number: "988",
        url: "tel:988",
        description: "Free, confidential, 24/7 support",
        region: "US",
    },
    {
        regionKey: "us",
        name: "Crisis Text Line",
        number: "Text HOME to 741741",
        url: "sms:741741&body=HOME",
        description: "Free crisis counseling via text",
        region: "US",
    },
    {
        regionKey: "uk_ie",
        name: "Samaritans",
        number: "116 123",
        url: "tel:116123",
        description: "Free emotional support, 24/7",
        region: "UK/IE",
    },
    {
        regionKey: "global",
        name: "International Association for Suicide Prevention",
        number: "https://www.iasp.info/resources/Crisis_Centres/",
        url: "https://www.iasp.info/resources/Crisis_Centres/",
        description: "Find a crisis centre in your country",
        region: "Global",
    },
];

const regionLabels: Record<string, string> = {
    global: "global",
    us: "US and global",
    uk_ie: "UK/IE and global",
};

export function CrisisScreen({ severity, region, onDismiss }: CrisisScreenProps) {
    const selectedRegion = region || "global";
    const visibleResources = crisisResources.filter((resource) => {
        if (selectedRegion === "global") return resource.regionKey === "global";
        return resource.regionKey === selectedRegion || resource.regionKey === "global";
    });

    return (
        <div className="fixed inset-0 z-50 bg-[rgba(35,49,39,0.5)] backdrop-blur-xl">
            <div className="app-panel-strong h-full w-full overflow-y-auto rounded-none px-4 py-5 sm:px-6 sm:py-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                    <div className="flex justify-end">
                        <button
                            onClick={onDismiss}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(79,96,82,0.12)] bg-[rgba(255,255,255,0.78)] text-[var(--muted-strong)] transition-all hover:bg-white hover:text-[var(--text)]"
                            title="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(177,95,78,0.25)] bg-[rgba(245,225,221,0.88)] shadow-[0_18px_35px_rgba(144,86,72,0.14)]">
                            <ShieldAlert size={30} className="text-[#9a5d4d]" />
                        </div>
                        <div className="space-y-3">
                            <p className="eyebrow">Pause for care</p>
                            <h2 className="section-title text-[2rem]">We care about your safety</h2>
                            <p className="mx-auto max-w-xl text-sm leading-7 text-[var(--muted-strong)]">
                                Your writing suggests you may be going through a difficult moment. AI coaching has been
                                paused as a precaution. Please consider reaching out to a real person right now.
                            </p>
                            {severity && (
                                <div className="pill-chip mx-auto bg-[rgba(245,225,221,0.9)] text-[#8a5f42]">
                                    Alert level: {severity}
                                </div>
                            )}
                            <p className="text-xs leading-5 text-[var(--muted)]">
                                Showing {regionLabels[selectedRegion] || regionLabels.global} crisis resources.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        {visibleResources.map((resource, i) => (
                            <div
                                key={i}
                                onClick={() => BrowserOpenURL(resource.url)}
                                className="flex cursor-pointer items-center gap-4 rounded-[24px] border border-[rgba(177,95,78,0.14)] bg-[rgba(255,255,255,0.76)] p-4 transition-all hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.92)]"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(245,225,221,0.92)] text-[#9a5d4d]">
                                    {resource.number.startsWith("http") ? (
                                        <ExternalLink size={18} />
                                    ) : (
                                        <Phone size={18} />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-[var(--text)]">{resource.name}</span>
                                        <span className="shrink-0 rounded-full bg-[rgba(245,225,221,0.82)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#8a5f42]">
                                            {resource.region}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs leading-6 text-[var(--muted)]">{resource.description}</p>
                                </div>
                                <span className="shrink-0 text-sm font-medium text-[#8a5f42]">
                                    {resource.number.startsWith("http") ? "Visit" : resource.number}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-3 pt-2">
                        <button onClick={onDismiss} className="action-secondary">
                            <Heart size={14} />
                            I&apos;m safe, continue writing
                        </button>
                        <p className="max-w-md text-center text-[11px] leading-5 text-[var(--muted)]">
                            This screen is shown as a precaution. Sanctum does not store or transmit crisis detection
                            data.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
