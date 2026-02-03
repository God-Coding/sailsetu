
export interface UserSession {
    step: string;
    data: any;
    lastActive: number;
    isActive?: boolean;          // Sleep Mode flag
    identifiedUser?: string | null;  // SailPoint Identity name
    displayName?: string | null;     // User's display name
    capabilities?: string[];         // ["Reviewer", "Admin", "User"]
}

export interface BotContext {
    client: any; // WhatsApp or Telegram Client
    channel: 'whatsapp' | 'telegram';
    msg: any;    // Incoming Message
    session: UserSession;
    config: any; // SailPoint Config
    reply: (content: string) => Promise<void>;
    sendPoll: (question: string, options: string[], allowMultiple?: boolean) => Promise<void>;
    resetSession: () => void;
}

export interface Feature {
    id: string;
    name: string;
    description: string;
    requiredCapability?: string; // "Reviewer", "Admin", "User", or "*" for all
    // Called when the user first selects this feature from the menu
    onSelect(context: BotContext): Promise<void>;
    // Main handler for messages while this feature is active
    handler(context: BotContext, text: string): Promise<void>;
}

export class FeatureRegistry {
    private features: Map<string, Feature> = new Map();

    register(feature: Feature) {
        this.features.set(feature.id, feature);
        console.log(`[WhatsApp Registry] Registered feature: ${feature.name}`);
    }

    get(id: string): Feature | undefined {
        return this.features.get(id);
    }

    getAll(): Feature[] {
        return Array.from(this.features.values());
    }
}

export const registry = new FeatureRegistry();
