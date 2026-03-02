import { ShieldAlert, Phone, ExternalLink, Heart } from 'lucide-react';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

interface CrisisScreenProps {
    severity: string;
    onDismiss: () => void;
}

const crisisResources = [
    {
        name: "National Suicide Prevention Lifeline",
        number: "988",
        url: "tel:988",
        description: "Free, confidential, 24/7 support",
        region: "US",
    },
    {
        name: "Crisis Text Line",
        number: "Text HOME to 741741",
        url: "sms:741741&body=HOME",
        description: "Free crisis counseling via text",
        region: "US",
    },
    {
        name: "Samaritans",
        number: "116 123",
        url: "tel:116123",
        description: "Free emotional support, 24/7",
        region: "UK/IE",
    },
    {
        name: "International Association for Suicide Prevention",
        number: "https://www.iasp.info/resources/Crisis_Centres/",
        url: "https://www.iasp.info/resources/Crisis_Centres/",
        description: "Find a crisis centre in your country",
        region: "Global",
    },
];

export function CrisisScreen({ severity, onDismiss }: CrisisScreenProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="max-w-lg w-full mx-4 flex flex-col items-center gap-8">

                {/* Icon + Header */}
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400/40 flex items-center justify-center shadow-[0_0_40px_rgba(244,63,94,0.3)]">
                        <ShieldAlert size={32} className="text-rose-300" />
                    </div>
                    <h2 className="text-2xl font-serif text-white/95">
                        We care about you
                    </h2>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                        Your writing suggests you may be going through a difficult time.
                        AI coaching has been <span className="text-rose-300 font-medium">paused</span> to
                        protect you. Please consider reaching out to a real person.
                    </p>
                </div>

                {/* Crisis Resources */}
                <div className="w-full flex flex-col gap-3">
                    {crisisResources.map((resource, i) => (
                        <div
                            key={i}
                            onClick={() => BrowserOpenURL(resource.url)}
                            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-rose-400/30 hover:bg-white/[0.07] transition-all group cursor-pointer"
                        >
                            <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0 group-hover:bg-rose-500/25 transition-colors">
                                {resource.number.startsWith("http") ? (
                                    <ExternalLink size={18} className="text-rose-300" />
                                ) : (
                                    <Phone size={18} className="text-rose-300" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-white text-sm truncate">{resource.name}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                                        {resource.region}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{resource.description}</p>
                            </div>
                            <span className="text-accent font-mono text-sm shrink-0">
                                {resource.number.startsWith("http") ? "Visit" : resource.number}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Dismiss */}
                <div className="flex flex-col items-center gap-3 pt-2">
                    <button
                        onClick={onDismiss}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all text-sm"
                    >
                        <Heart size={14} />
                        I'm safe — continue writing
                    </button>
                    <p className="text-[10px] text-gray-600 text-center max-w-xs">
                        This screen is shown as a precaution. Sanctum does not store or transmit crisis detection data.
                    </p>
                </div>
            </div>
        </div>
    );
}
