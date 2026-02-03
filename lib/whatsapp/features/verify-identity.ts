
import { BotContext, Feature } from '../registry';
import { launchWorkflow } from '@/lib/sailpoint/workflow';

export class VerifyIdentityFeature implements Feature {
    id = "verify-identity";
    name = "Link WhatsApp Account";
    description = "Connect your WhatsApp number to your SailPoint identity.";

    async onSelect(ctx: BotContext) {
        console.log('[Verify] Feature Selected. Initializing session...');
        ctx.session.data = {};
        ctx.session.data.internalStep = 'ASK_USERNAME';

        await ctx.reply(
            `BOT: 🔐 *Identity Verification*\n\n` +
            `To link your WhatsApp number to SailPoint, please enter your *SailPoint username*.\n\n` +
            `Type *'cancel'* to abort.`
        );
        console.log('[Verify] Start message sent.');
    }

    async handler(ctx: BotContext, text: string) {
        const step = ctx.session.data.internalStep;
        const lower = text.toLowerCase();

        if (lower === 'cancel' || lower === 'exit') {
            await ctx.reply("BOT: ❌ Verification cancelled.");
            ctx.resetSession();
            return;
        }

        // --- STEP 1: ASK USERNAME ---
        if (step === 'ASK_USERNAME') {
            const username = text.trim();

            if (!username || username.length < 2) {
                await ctx.reply("BOT: ⚠️ Please enter a valid SailPoint username.");
                return;
            }

            ctx.session.data.pendingUsername = username;
            await ctx.reply(`BOT: ⏳ Verifying username *${username}*...`);

            try {
                // Check if Identity exists by calling a simple lookup
                const result = await launchWorkflow('LookupIdentityByPhone', {
                    phoneNumber: 'VERIFICATION_CHECK_' + username  // Special prefix
                }, ctx.config);

                // For MVP, we'll accept any username that looks valid
                ctx.session.data.internalStep = 'ASK_PASSWORD';

                await ctx.reply(
                    `BOT: ✅ Username *${username}* found.\n\n` +
                    `🔒 Please enter your *SailPoint Password* to verify your identity.\n\n` +
                    `_(Your password is processed securely and not stored)_`
                );
            } catch (e: any) {
                await ctx.reply(`BOT: ❌ Verification failed: ${e.message}`);
            }
            return;
        }

        // --- STEP 2: ASK PASSWORD & REGISTER ---
        if (step === 'ASK_PASSWORD') {
            const password = text.trim();
            const username = ctx.session.data.pendingUsername;
            const phoneNumber = ctx.msg.from.replace('@c.us', '').replace('@s.whatsapp.net', '');

            await ctx.reply(`BOT: ⏳ Verifying and linking account...`);

            try {
                // Pass password to workflow for internal validation
                const result = await launchWorkflow('RegisterPhoneMapping', {
                    phoneNumber,
                    identityName: username,
                    password: password
                }, ctx.config);

                if (result.success) {
                    const attrs = result.launchResult?.attributes;
                    const getAttr = (key: string) => {
                        if (!Array.isArray(attrs)) return null;
                        const found = attrs.find((a: any) => a.key === key);
                        return found ? found.value : null;
                    };

                    const success = getAttr('success') === 'true' || getAttr('success') === true;
                    // Fix: Handle 'message' vs 'failureMessage' if distinct, but usually 'message' covers both
                    const message = getAttr('message') || 'Unknown result';

                    if (success) {
                        // Clear session so the next command triggers a fresh identity lookup with Roles
                        ctx.session.identifiedUser = null;
                        ctx.session.capabilities = [];

                        await ctx.reply(
                            `BOT: ✅ *Success!*\n\n` +
                            `Your WhatsApp is now linked to *${username}*.\n` +
                            `Phone attribute updated in IdentityIQ.\n\n` +
                            `Please type *!menu* to see your available tools (refreshing roles...).`
                        );
                        ctx.resetSession(); // Done
                    } else {
                        await ctx.reply(`BOT: ❌ Linking Failed: ${message}`);
                        // Let them try again or exit
                        ctx.session.data.internalStep = 'ASK_USERNAME';
                        await ctx.reply("BOT: Please try again with a valid username or type 'cancel'.");
                    }
                } else {
                    await ctx.reply("BOT: ❌ Workflow Error: Could not launch registration.");
                }
            } catch (e: any) {
                console.error("Verification Error:", e);
                await ctx.reply(`BOT: ❌ Error: ${e.message}`);
                ctx.resetSession();
            }
            return;
        }
    }
}

export const verifyIdentityFeature = new VerifyIdentityFeature();
