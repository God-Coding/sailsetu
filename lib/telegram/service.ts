import { registry, BotContext, UserSession } from '../whatsapp/registry';
import { launchWorkflow } from '@/lib/sailpoint/workflow';
import { EventEmitter } from 'events';

declare global {
    var telegramTokenCache: string | undefined;
}

export class TelegramService extends EventEmitter {
    private token: string | null = null;
    private sailpointConfig: any = null;
    private sessions: Map<string, UserSession> = new Map();
    private isRunning: boolean = false;
    private lastUpdateId: number = 0;

    constructor() {
        super();
        // Restore from global cache similar to WhatsApp
        if (global.telegramTokenCache) {
            this.token = global.telegramTokenCache;
        }
        if (global.sailpointConfigCache) {
            this.sailpointConfig = global.sailpointConfigCache;
        }

        if (this.token) {
            this.startPolling();
        }
    }

    public setConfig(spConfig: any, tgToken?: string) {
        this.sailpointConfig = spConfig;
        if (tgToken) {
            this.token = tgToken;
            global.telegramTokenCache = tgToken;
            this.startPolling();
        }
        console.log('[Telegram] Config updated');
    }

    private async startPolling() {
        if (this.isRunning || !this.token) return;
        this.isRunning = true;
        console.log('[Telegram] Starting Long Polling...');

        while (this.isRunning) {
            try {
                const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        this.lastUpdateId = update.update_id;
                        if (update.message) {
                            await this.handleMessage(update.message);
                        }
                    }
                }
            } catch (error) {
                console.error('[Telegram] Polling error:', error);
                await new Promise(r => setTimeout(r, 5000)); // Wait before retry
            }
        }
    }

    private async handleMessage(msg: any) {
        const chatId = msg.chat.id.toString();
        const text = msg.text || '';

        console.log(`[Telegram] Msg from ${chatId}: ${text}`);

        // Get or Create Session
        let session = this.sessions.get(chatId);
        if (!session) {
            session = {
                step: 'start',
                data: {},
                lastActive: Date.now(),
                capabilities: []
            };
            this.sessions.set(chatId, session);

            // Auto-identify by Telegram ID
            if (this.sailpointConfig) {
                await this.tryIdentifyById(chatId, session);
            }
        } else {
            // RE-IDENTIFY if session exists but user is not identified (e.g. after Link)
            // But NOT if they are currently in the verify-identity flow
            const isLinking = session.step === 'FEATURE:verify-identity';
            if (!session.identifiedUser && this.sailpointConfig && !isLinking) {
                console.log('[Telegram Debug] Session needs identification refresh...');
                await this.tryIdentifyById(chatId, session);
            }
        }
        const ctx: BotContext = {
            client: this, // Using the service as client for simplicity
            channel: 'telegram',
            msg: msg,
            session,
            config: this.sailpointConfig,
            reply: async (txt) => {
                await this.sendMessage(chatId, txt);
            },
            sendPoll: async (question, options, allowMultiple = false) => {
                let text = `${question}\n\n`;
                options.forEach((opt, i) => text += `${i + 1}️⃣ ${opt}\n`);
                await this.sendMessage(chatId, text);
            },
            resetSession: () => {
                session.step = 'start';
                session.data = {};
            }
        };

        // --- GLOBAL COMMANDS ---
        if (text === '!menu' || text === '!tools' || text === 'hi' || text === 'Hi' || text === '/start') {
            console.log(`[Telegram Debug] Triggering Main Menu for ${chatId}`);
            await ctx.reply("BOT: ⏳ *Loading SailSetu Tools...*");
            await this.sendMainMenu(ctx);
            return;
        }

        // --- FEATURE HANDLERS ---
        if (session.step !== 'start' && session.step.startsWith('FEATURE:')) {
            const featureId = session.step.replace('FEATURE:', '');
            const feature = registry.get(featureId);
            if (feature) {
                console.log(`[Telegram Debug] Routing to feature: ${featureId}`);
                await feature.handler(ctx, text);
                return;
            }
        }

        // --- MENU SELECTION ---
        if (session.step === 'menu') {
            console.log(`[Telegram Debug] Processing menu selection: ${text}`);
            await this.handleMenuSelection(ctx, text);
            return;
        }

        console.log(`[Telegram Debug] No handler found for text at step: ${session.step}`);
    }

    private async tryIdentifyById(chatId: string, session: UserSession) {
        if (!this.sailpointConfig) return;

        try {
            console.log(`[Telegram] 🎯 IDENTITY_REFRESH_CHECK for Chat ID: ${chatId}`);

            const result = await launchWorkflow('LookupIdentityByPhone', {
                phoneNumber: chatId
            }, this.sailpointConfig);

            if (!result.success) {
                console.error(`[Telegram Debug] Workflow launch failed.`);
                return;
            }

            const attrs = result.launchResult?.attributes || [];
            console.log(`[Telegram Debug] Raw Attributes:`, JSON.stringify(attrs));
            const getAttr = (key: string) => attrs.find((a: any) => a.key === key)?.value;

            console.log(`[Telegram Debug] Found: ${getAttr('found')}, Identity: ${getAttr('identityName')}`);

            if (getAttr('found') === 'true') {
                session.identifiedUser = getAttr('identityName');
                session.displayName = getAttr('displayName');
                const capsRaw = getAttr('capabilities');
                try {
                    session.capabilities = JSON.parse(capsRaw || '[]');
                } catch (e) {
                    session.capabilities = [];
                    console.error('[Telegram Debug] Caps parse error:', e);
                }
                console.log(`[Telegram] Identified User: ${session.identifiedUser} with Caps: ${session.capabilities?.length || 0}`);

                // --- PROACTIVE FEEDBACK ---
                await this.sendMessage(chatId, `BOT: ✅ *Identity Recognized!*\n\nWelcome back, *${session.displayName}*.\nYour roles have been synchronized from SailPoint.`);
            } else {
                console.log(`[Telegram Debug] User with ID ${chatId} not found in SailPoint.`);
            }
        } catch (e) {
            console.error('[Telegram] Identification failed:', e);
        }
    }

    private async sendMainMenu(ctx: BotContext) {
        try {
            const allFeatures = registry.getAll();
            const userCaps = ctx.session.capabilities || [];

            const features = allFeatures.filter(f => {
                if (userCaps.includes('sailsetu-master')) return true;
                if (!f.requiredCapability || f.requiredCapability === '*') return true;
                return userCaps.includes(f.requiredCapability);
            });

            console.log(`[Telegram Debug] Features for ${ctx.session.identifiedUser}: ${features.length}`);

            if (features.length === 0) {
                await ctx.reply("BOT: ⚠️ No matching features found for your roles. Please ensure you have the correct `sailsetu-*` roles in SailPoint.");
                return;
            }

            let menuText = "BOT: 🤖 *SailSetu Tools Menu*\nReply with a number:\n\n";
            features.forEach((f, i) => {
                menuText += `${i + 1}️⃣ *${f.name}*\n`;
            });

            ctx.session.step = 'menu';
            ctx.session.data.menuFeatures = features.map(f => f.id);
            await ctx.reply(menuText);
        } catch (e: any) {
            console.error('[Telegram Debug] Error in sendMainMenu:', e);
            await ctx.reply("BOT: ❌ Error loading menu. Please try again.");
        }
    }

    private async handleMenuSelection(ctx: BotContext, text: string) {
        const index = parseInt(text) - 1;
        const menuFeatures = ctx.session.data.menuFeatures || [];

        if (isNaN(index) || index < 0 || index >= menuFeatures.length) {
            await ctx.reply("❌ Invalid selection. Please reply with a number from the menu (e.g. '1').");
            return;
        }

        const featureId = menuFeatures[index];
        const feature = registry.get(featureId);

        if (feature) {
            ctx.session.step = `FEATURE:${feature.id}`;
            await feature.onSelect(ctx);
        }
    }

    public async sendMessage(chatId: string | number, text: string) {
        if (!this.token) return;
        try {
            const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                console.warn('[Telegram] API Send Error (Markdown?):', JSON.stringify(errData));

                // Fallback to plain text if Markdown fails
                if (errData.description?.toLowerCase().includes('parse')) {
                    console.log('[Telegram] Retrying message as plain text...');
                    await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: text.replace(/[*_`\[]/g, '') // Strip markdown chars
                        })
                    });
                }
            }
        } catch (e) {
            console.error('[Telegram] Send failed:', e);
        }
    }

    public stop() {
        this.isRunning = false;
    }
}

// Singleton pattern
const tgInstance = new TelegramService();
export default tgInstance;
