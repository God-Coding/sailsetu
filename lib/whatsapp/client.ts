
import { Client, LocalAuth, Buttons, List, Poll } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import { registry, BotContext, UserSession } from './registry';
import { leaverCleanupFeature } from './features/leaver-cleanup';
import { systemStatusFeature } from './features/system-status';
import { manageAccessFeature } from './features/manage-access';
import { accessReviewFeature } from './features/access-review'; // Access Review Feature

// Register Features
registry.register(leaverCleanupFeature);
registry.register(manageAccessFeature);
registry.register(accessReviewFeature); // Register
registry.register(systemStatusFeature);

export class WhatsAppService extends EventEmitter {
    private client: Client | null = null;
    private qrCode: string | null = null;
    private ownerId: string | null = null; // Store Bot's own ID
    public status: 'disconnected' | 'initializing' | 'ready' = 'disconnected';
    private sailpointConfig: any = null;

    // Memory store for user sessions (phone -> session)
    private sessions: Map<string, UserSession> = new Map();

    constructor() {
        super();
        // Restore config from cache if available (preserves login across HMR)
        if (global.sailpointConfigCache) {
            this.sailpointConfig = global.sailpointConfigCache;
            console.log('[WhatsApp] Restored SailPoint config from cache');
        }
        this.initializeClient();
    }

    private initializeClient() {
        console.log('[WhatsApp] Initializing Client...');
        this.status = 'initializing';

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'sailsetu-client',
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        // Detect Poll Votes (for Menu/Decisions)
        this.client.on('vote_update', async (vote: any) => {
            console.log('[WhatsApp] Vote Update:', JSON.stringify(vote.selectedOptions));

            if (vote.selectedOptions && vote.selectedOptions.length > 0) {
                const selected = vote.selectedOptions[0].name;
                const voter = vote.voter;

                // Only process if vote is from the bot owner (Note to Self check)
                // In "Note to Self", voter should match the bot's own ID/OwnerID
                if (voter === this.ownerId || voter === vote.parentMessage.to) {
                    console.log(`[WhatsApp] Processing Poll Vote as Command: ${selected}`);

                    // Helper to handle message
                    await this.handleMessage({
                        from: voter,
                        body: selected,
                        fromMe: true, // Treat as "My" message
                        to: voter, // Note to self
                        isStatus: false
                    });
                }
            }
        });

        this.client.on('qr', async (qr) => {
            console.log('[WhatsApp] QR Code Received');
            try {
                this.qrCode = await QRCode.toDataURL(qr);
                this.status = 'initializing';
                this.emit('qr', this.qrCode);
            } catch (err) {
                console.error('Error generating QR code:', err);
            }
        });

        this.client.on('ready', async () => {
            console.log('[WhatsApp] Client is ready!');
            this.status = 'ready';
            this.qrCode = null;
            this.emit('ready');

            // Send Welcome Message to SELF
            try {
                if (!this.client) return;
                const info = (this.client as any).info;
                if (info && info.wid && info.wid._serialized) {
                    const myId = info.wid._serialized;
                    this.ownerId = myId; // Save Owner ID
                    console.log(`[WhatsApp] Sending welcome to self (${myId})`);
                    await this.client?.sendMessage(myId,
                        "BOT: 🚀 *SailSetu Connected!*\n\n" +
                        "You are now the bot admin!\n" +
                        "You can control the system by messaging *yourself* (Note to Self).\n\n" +
                        "👇 *Try these commands:*\n" +
                        "Type *!tools* to open the menu."
                    );
                }
            } catch (e) {
                console.error("Error sending welcome message:", e);
            }
        });

        this.client.on('disconnected', (reason) => {
            console.log('[WhatsApp] Client was disconnected', reason);
            this.status = 'disconnected';
            this.emit('disconnected', reason);
        });

        this.client.on('message_create', async (msg) => {
            // IGNORE status updates
            if (msg.isStatus) return;

            const body = msg.body.trim();
            console.log(`[WhatsApp] Msg: '${body}' | From: ${msg.from} | Me: ${msg.fromMe}`);

            // Logic: Allow if Command OR Session exists
            const isCommand = body.startsWith('!');
            const hasSession = this.sessions.has(msg.from);

            if (msg.fromMe) {
                // CRITICAL: Only allow "Note to Self"
                // Stateless check: If I send a message (fromMe), it is a Note-to-Self ONLY if 'to' equals 'from'.
                if (msg.to !== msg.from) {
                    return; // Ignore messages sent to friends/groups
                }

                // Lazy-load ownerId if missed during startup
                if (!this.ownerId) this.ownerId = msg.from;

                // Ignore ALL messages sent BY the bot itself
                // (commands start with BOT: or use specific emojis)
                const botPrefixes = ['BOT:', '🤖', '📋', '📝', '✍️'];
                if (botPrefixes.some(p => body.startsWith(p))) return;

                // Ignore if NOT a command AND NO active session AND NOT a wake word
                const lowerBody = body.toLowerCase();
                const isWakeWord = lowerBody.includes('hi sailsetu') || lowerBody === 'hello sailsetu';

                if (!isCommand && !hasSession && !isWakeWord) return;
            } else {
                // EXPLICITLY IGNORE messages from others
                return;
            }

            await this.handleMessage(msg);
        });

        console.log('[WhatsApp] Service Initialized');
        this.client.initialize().catch(err => {
            if (err.message && err.message.includes('browser is already running')) {
                console.error("❌ CRITICAL: The WhatsApp browser process is locked. Please RESTART the server to fix this.");
            } else {
                console.error("WhatsApp Init Error:", err);
            }
        });
    }

    public async destroy() {
        if (this.client) {
            console.log('[WhatsApp] Destroying client...');
            await this.client.destroy();
            this.client = null;
        }
    }

    public setSailPointConfig(config: any) {
        this.sailpointConfig = config;
        global.sailpointConfigCache = config; // Cache it
        console.log('[WhatsApp] SailPoint Configuration updated & cached');
    }

    public getStatus() {
        return {
            status: this.status,
            qrCode: this.qrCode,
            hasConfig: !!this.sailpointConfig
        };
    }

    // ------------------------------------------
    // MAIN MESSAGE HANDLER
    // ------------------------------------------
    private async handleMessage(msg: any) {
        // Check Config (Soft check)
        if (!this.sailpointConfig) {
            // Try to restore again just in case
            if (global.sailpointConfigCache) {
                this.sailpointConfig = global.sailpointConfigCache;
            } else {
                console.log('[WhatsApp] Warning: No SailPoint Config available (yet).');
                // We allow proceeding so at least Menu works.
            }
        }

        const chatId = msg.from;
        const text = msg.body.trim();
        const lower = text.toLowerCase();

        // Get or Create Session
        let session = this.sessions.get(chatId);
        if (!session) {
            // New session defaults to Active? Or Wait for Hello?
            // User requested "If I exit... connection close. If I say Hi... open".
            // Let's default to ACTIVE for convenience, but respect the toggle.
            session = { step: 'MENU', data: {}, lastActive: Date.now(), isActive: true };
            this.sessions.set(chatId, session);
        }

        // --- GLOBAL SESSION COMMANDS ---

        // 1. EXIT / CLOSE
        if (lower === 'exit' || lower === 'bye' || lower === 'close') {
            session.isActive = false;
            session.step = 'MENU'; // Reset on close
            session.data = {};
            await this.client?.sendMessage(chatId, "BOT: 🛌 *Session Paused*\nI will stay quiet now.\n\nType *'Hi SailSetu'* to wake me up!");
            return;
        }

        // 2. WAKE UP
        if (lower.includes('hi sailsetu') || lower === 'hello sailsetu') {
            session.isActive = true;
            session.step = 'MENU';
            await this.client?.sendMessage(chatId, "BOT: 👋 *Hello! SailSetu is Online.*");
            await this.sendMainMenu(msg);
            return;
        }

        // --- CHECK ACTIVE STATE ---
        if (!session.isActive) {
            // IGNORE all other messages when sleeping
            return;
        }

        // RESET commands
        if (lower === '!reset' || lower === '!menu' || lower === '!tools' || lower === '!textmenu' || lower === '!ping') {
            if (lower === '!ping') {
                await this.client?.sendMessage(msg.from, "BOT: 🏓 Pong!");
                return;
            }
            session.step = 'MENU';
            session.data = {};
            await this.sendMainMenu(msg, lower === '!textmenu');
            return;
        }

        // Context Wrapper
        const ctx: BotContext = {
            client: this.client,
            msg,
            session,
            config: this.sailpointConfig,
            reply: async (txt) => { await this.client?.sendMessage(msg.from, txt); },
            resetSession: () => {
                // Instead of deleting, we just reset to MENU and keep active? 
                // Or maybe purely reset state.
                session!.step = 'MENU';
                session!.data = {};
            }
        };

        try {
            // 1. Menu Selection
            if (session.step === 'MENU') {
                await this.handleMenuSelection(ctx, text);
            }
            // 2. Feature Handlers
            else if (session.step.startsWith('FEATURE:')) {
                const featureId = session.step.split(':')[1];
                const feature = registry.get(featureId);

                if (feature) {
                    // CRITICAL: Check config availability before running functionality (except for safe features)
                    // System Status is usually safe or handles its own errors.
                    // Access Reviews NEEDS config.
                    const safeFeatures = ['system-status'];

                    if (!ctx.config && !safeFeatures.includes(feature.id)) {
                        await ctx.reply("BOT: ⚠️ *Configuration Missing!* 🚫\nTo secure the connection, I need to be authorized.\n\n👉 Please visit the *SpyGlass Dashboard* to wake me up!");
                        ctx.resetSession();
                        return;
                    }

                    await feature.handler(ctx, text);
                } else {
                    await ctx.reply("BOT: ⚠️ Error: Active feature not found. Resetting.");
                    ctx.resetSession();
                }
            }
            // 3. Fallback
            else {
                await this.sendMainMenu(msg);
            }
        } catch (error: any) {
            console.error("Workflow Error:", error);
            await ctx.reply(`BOT: ❌ Error: ${error.message}`);
            ctx.resetSession();
        }
    }

    private async sendMainMenu(msg: any, forceText: boolean = false) {
        const features = registry.getAll();

        if (!forceText) {
            try {
                console.log('[WhatsApp] Sending Main Menu (Poll Mode)...');
                const options = features.map(f => f.name); // Poll options

                const pollMsg = new Poll(
                    "🤖 *SailSetu Tools Menu*\nSelect a tool to open:",
                    options,
                    { allowMultipleAnswers: false } as any // Cast to ANY to bypass strict type check for messageSecret
                );

                await this.client?.sendMessage(msg.from, pollMsg);
                console.log('[WhatsApp] Main Menu sent (Poll Mode).');
                return;
            } catch (e) {
                console.error("Error sending poll, falling back to text:", e);
            }
        }

        // Text Fallback
        console.log('[WhatsApp] Sending Main Menu (Text Mode)...');
        let menuParams = "";
        features.forEach((f, i) => {
            menuParams += `${i + 1}️⃣ *${f.name}*\n`;
        });
        await this.client?.sendMessage(msg.from,
            `BOT: 🤖 *SailSetu Tools Menu* (Text Mode)\n` +
            `Reply with a number:\n\n` +
            menuParams
        );
    }

    private async handleMenuSelection(ctx: BotContext, selection: string) {
        const features = registry.getAll();

        // 1. Try to find by Name (Button Click sends Name)
        let feature = features.find(f => f.name === selection || f.id === selection);

        // 2. Fallback to Index (Text Reply)
        if (!feature) {
            const idx = parseInt(selection) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < features.length) {
                feature = features[idx];
            }
        }

        if (!feature) {
            await ctx.reply("BOT: ⚠️ Invalid selection. Please use the buttons or reply with a number.");
            return;
        }

        // CRITICAL: Check config availability before launching feature
        const safeFeatures = ['system-status', 'leaver-cleanup']; // Leaver cleanup usually just schedules, might be safe or not.
        // Let's stick to safeFeatures = ['system-status'] to be safe, or just check config.

        if (!ctx.config && feature.id !== 'system-status') {
            await ctx.reply("BOT: ⚠️ *Configuration Missing!* 🚫\nTo secure the connection, I need to be authorized.\n\n👉 Please visit the *SpyGlass Dashboard* to wake me up!");
            return;
        }

        ctx.session.step = `FEATURE:${feature.id}`;
        await feature.onSelect(ctx);
    }
}

// ------------------------------------------
// SINGLETON & HMR HANDLING
// ------------------------------------------

// If HMR is reloading this module, destroy the old client to free port/memory
if (process.env.NODE_ENV === 'development' && global.whatsappClient) {
    console.log('[WhatsApp] HMR: Destroying old client instance...');
    try {
        global.whatsappClient.removeAllListeners();
        // Use public method
        global.whatsappClient.destroy();
    } catch (e) {
        console.error('Error destroying old client:', e);
    }
    global.whatsappClient = undefined;
}

declare global {
    var whatsappClient: WhatsAppService | undefined;
    var sailpointConfigCache: any | undefined;
}

let waInstance: WhatsAppService;
if (!global.whatsappClient) {
    global.whatsappClient = new WhatsAppService();
}
waInstance = global.whatsappClient;

export default waInstance;
