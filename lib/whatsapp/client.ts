
import { Client, LocalAuth, Buttons, List, Poll } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import { registry, BotContext, UserSession } from './registry';
import { leaverCleanupFeature } from './features/leaver-cleanup';
import { systemStatusFeature } from './features/system-status';
import { manageAccessFeature } from './features/manage-access';
import { accessReviewFeature } from './features/access-review';
import { verifyIdentityFeature } from './features/verify-identity';

// Register Features
registry.register(verifyIdentityFeature); // First - for unidentified users
registry.register(leaverCleanupFeature);
registry.register(manageAccessFeature);
registry.register(accessReviewFeature);
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
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-features=site-per-process',
                    '--disable-extensions'
                ]
            },
            // Use official wwebjs.dev cached web version for stable connection
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
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
                // Message from OTHERS (The User)

                // 1. Ignore Groups
                if (msg.from.includes('@g.us')) return;

                // 2. Ignore Status Updates (Broadcasts)
                if (msg.from === 'status@broadcast') return;

                // 3. Allow DMs
                // We proceed to handleMessage
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
            try {
                await this.client.destroy();
            } catch (e) {
                console.error('[WhatsApp] Destroy error:', e);
            }
            this.client = null;
            this.status = 'disconnected';
            this.qrCode = null;
        }
    }

    public async logout() {
        if (this.client && this.status === 'ready') {
            console.log('[WhatsApp] Logging out...');
            try {
                await this.client.logout();
                this.status = 'disconnected';
                this.qrCode = null;
                // Re-initialize to show new QR
                this.initializeClient();
            } catch (e) {
                console.error('[WhatsApp] Logout error:', e);
                // Force destroy if logout fails
                await this.destroy();
                this.initializeClient();
            }
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
    // PHONE-BASED IDENTITY LOOKUP
    // ------------------------------------------
    private async tryIdentifyByPhone(chatId: string, session: UserSession) {
        console.log(`[WhatsApp Debug] tryIdentifyByPhone Called for ${chatId}`);
        if (!this.sailpointConfig) {
            console.log('[WhatsApp Debug] No Config - Skipping lookup');
            return;
        }

        // Extract phone number from chatId (format: 919063248559@c.us)
        const phoneNumber = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
        console.log(`[WhatsApp] Attempting identity lookup for phone: ${phoneNumber}`);

        try {
            console.log('[WhatsApp Debug] Importing workflow lib...');
            const { launchWorkflow } = await import('@/lib/sailpoint/workflow');
            console.log('[WhatsApp Debug] Launching LookupIdentityByPhone...');
            const result = await launchWorkflow('LookupIdentityByPhone', { phoneNumber }, this.sailpointConfig);
            console.log(`[WhatsApp Debug] Lookup Result: success=${result.success}`);

            if (result.success && result.launchResult) {
                const attrs = result.launchResult.attributes;

                // Helper to parse attributes
                const getAttr = (key: string) => {
                    if (!Array.isArray(attrs)) return null;
                    const found = attrs.find((a: any) => a.key === key);
                    return found ? found.value : null;
                };

                const found = getAttr('found') === 'true' || getAttr('found') === true;

                if (found) {
                    session.identifiedUser = getAttr('identityName');
                    session.displayName = getAttr('displayName');

                    const capsStr = getAttr('capabilities');
                    try {
                        session.capabilities = capsStr ? JSON.parse(capsStr) : ['User'];
                    } catch { session.capabilities = ['User']; }

                    console.log(`[WhatsApp] ✅ Identified user: ${session.displayName} (${session.identifiedUser}) - Capabilities: ${session.capabilities}`);
                } else {
                    console.log(`[WhatsApp] ⚠️ Phone ${phoneNumber} not mapped to any Identity`);
                    session.identifiedUser = null;
                }
            }
        } catch (e: any) {
            console.error(`[WhatsApp] Phone lookup error: ${e.message}`);
        }
    }

    // ------------------------------------------
    // MAIN MESSAGE HANDLER
    // ------------------------------------------
    private async handleMessage(msg: any) {
        console.log(`[WhatsApp Debug] handleMessage: ${msg.body} from ${msg.from}`);
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
            console.log('[WhatsApp Debug] Creating New Session');
            // New session - attempt phone-based identification
            session = {
                step: 'MENU',
                data: {},
                lastActive: Date.now(),
                isActive: true,
                identifiedUser: null,      // SailPoint Identity name
                displayName: null,          // User's display name
                capabilities: []            // ["Reviewer", "Admin", "User"]
            };
            this.sessions.set(chatId, session);

            // Attempt auto-identification by phone
            if (this.sailpointConfig) {
                await this.tryIdentifyByPhone(chatId, session);
            } else {
                console.log('[WhatsApp Debug] Session created but No Config for lookup');
            }
        } else {
            // RE-IDENTIFY if session exists but user is not identified (e.g. after Link)
            // But NOT if they are currently in the verify-identity flow
            const isLinking = session.step.includes('verify-identity');
            if (!session.identifiedUser && this.sailpointConfig && !isLinking) {
                console.log('[WhatsApp Debug] Existing session needs identification refresh...');
                await this.tryIdentifyByPhone(chatId, session);
            }
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
            await this.sendMainMenu(msg, session);
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
            await this.sendMainMenu(msg, session, lower === '!textmenu');
            return;
        }

        // Context Wrapper
        const ctx: BotContext = {
            client: this.client,
            channel: 'whatsapp',
            msg,
            session,
            config: this.sailpointConfig,
            reply: async (txt) => {
                // Throttle slightly to ensure delivery order
                await new Promise(r => setTimeout(r, 500));

                try {
                    // Use msg.reply() for better reliability on zombie sessions
                    await msg.reply(txt);
                } catch (e: any) {
                    console.warn('[WhatsApp] Reply failed (Detached Frame?), falling back to sendMessage:', e.message);
                    await this.client?.sendMessage(msg.from, txt);
                }
            },
            sendPoll: async (question, options, allowMultiple = false) => {
                // FORCE TEXT MODE for reliability during debugging
                console.log('[WhatsApp Debug] sendPoll Fallback Triggered (Forced)');
                let text = `${question}\n\n`;
                options.forEach((opt, i) => text += `${i + 1}️⃣ ${opt}\n`);
                await msg.reply(text);
            },
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
                await this.sendMainMenu(msg, session);
            }
        } catch (error: any) {
            console.error("Workflow Error:", error);
            await ctx.reply(`BOT: ❌ Error: ${error.message}`);
            ctx.resetSession();
        }
    }

    private async sendMainMenu(msg: any, session: UserSession, forceText: boolean = false) {
        const allFeatures = registry.getAll();
        const userCaps = session.capabilities || [];

        // Filter features based on capabilities
        console.log(`[WhatsApp Debug] sendMainMenu: Filtering features for user (Caps: ${userCaps.join(', ')})`);

        const features = allFeatures.filter(f => {
            // Master Role gets everything
            if (userCaps.includes('sailsetu-master')) return true;

            if (!f.requiredCapability || f.requiredCapability === '*') return true;
            return userCaps.includes(f.requiredCapability);
        });

        console.log(`[WhatsApp Debug] sendMainMenu: Found ${features.length} features for user (Caps: ${userCaps})`);

        if (features.length === 0) {
            await this.client?.sendMessage(msg.from, "BOT: ⚠️ No matching features found for your role.");
            return;
        }

        // ALWAYS send a text greeting first to ensure connectivity/feedback (Debug Mode)
        await this.client?.sendMessage(msg.from, "BOT: ⏳ Loading Menu...");

        // FORCE TEXT MODE for now to bypass Poll issues
        forceText = true;

        if (!forceText) {
            try {
                const options = features.map(f => f.name); // Poll options
                console.log('[WhatsApp Debug] Poll Options:', JSON.stringify(options));

                // Validate Poll options (must be > 0, preferably > 1 for a poll, but 1 is valid in some versions?)
                // Actually WhatsApp Web JS Polls usually need at least 1 option.

                const pollMsg = new Poll(
                    "🤖 *SailSetu Tools Menu*\nSelect a tool to open:",
                    options,
                    { allowMultipleAnswers: false } as any
                );

                await this.client?.sendMessage(msg.from, pollMsg);
                console.log('[WhatsApp] Main Menu sent (Poll Mode).');
                return;
            } catch (e: any) {
                console.error("Error sending poll, falling back to text:", e.message);
                await this.client?.sendMessage(msg.from, `BOT: ⚠️ Error loading menu: ${e.message}`);
            }
        }

        // Text Fallback
        console.log('[WhatsApp] Sending Main Menu (Text Mode)...');
        let menuParams = "";
        features.forEach((f, i) => {
            menuParams += `${i + 1}️⃣ *${f.name}*\n`;
        });

        const menuText = `BOT: 🤖 *SailSetu Tools Menu* (Text Mode)\nReply with a number:\n\n${menuParams}`;
        try {
            // Delay slightly to ensure order/processing
            await new Promise(r => setTimeout(r, 500));

            // Use reply() instead of sendMessage() to force a reply-context message, which is often more reliable
            await msg.reply(menuText);
            console.log('[WhatsApp] Main Menu sent (Reply Mode):', menuText.replace(/\n/g, ' '));
        } catch (e: any) {
            console.error('[WhatsApp Error] Failed to send text menu:', e);
            // Try sending a simpler message as last resort
            await this.client?.sendMessage(msg.from, "BOT: ⚠️ Error displaying menu. Type !help.");
        }

    }

    private async handleMenuSelection(ctx: BotContext, selection: string) {
        const allFeatures = registry.getAll();
        const userCaps = ctx.session.capabilities || [];

        // Filter features based on capabilities
        const features = allFeatures.filter(f => {
            // Master Role gets everything
            if (userCaps.includes('sailsetu-master')) return true;

            if (!f.requiredCapability || f.requiredCapability === '*') return true;
            return userCaps.includes(f.requiredCapability);
        });

        console.log(`[WhatsApp Debug] Menu Selection: "${selection}" parsed as index ${parseInt(selection) - 1}`);

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
            console.log('[WhatsApp Debug] Invalid Menu Selection');
            await ctx.reply("BOT: ⚠️ Invalid selection. Please use the buttons or reply with a number.");
            return;
        }

        console.log(`[WhatsApp Debug] Selected Feature: ${feature.name} (${feature.id})`);

        // CRITICAL: Check config availability before launching feature
        const safeFeatures = ['system_status', 'leaver_cleanup'];
        // Let's stick to safeFeatures = ['system_status'] to be safe, or just check config.

        console.log(`[WhatsApp Debug] Config status: ${!!ctx.config}`);

        if (!ctx.config && feature.id !== 'system-status') {
            console.log('[WhatsApp Debug] Blocking feature due to missing config');
            await ctx.reply("BOT: ⚠️ *Configuration Missing!* 🚫\nTo secure the connection, I need to be authorized.\n\n👉 Please visit the *SpyGlass Dashboard* to wake me up!");
            return;
        }

        ctx.session.step = `FEATURE:${feature.id}`;
        console.log(`[WhatsApp Debug] Transitioning to step: ${ctx.session.step}`);
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
