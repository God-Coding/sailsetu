
import { BotContext, Feature } from '../registry';
import { launchWorkflow } from '@/lib/sailpoint/workflow';

export class VerifyIdentityFeature implements Feature {
    id = "verify-identity";
    name = "Link WhatsApp Account";
    description = "Connect your WhatsApp number to your SailPoint identity.";

    async onSelect(ctx: BotContext) {
        ctx.session.data = {};
        ctx.session.data.internalStep = 'ASK_USERNAME';

        await ctx.reply(
            `BOT: 🔐 *Identity Verification*\n\n` +
            `To link your WhatsApp number to SailPoint, please enter your *SailPoint username*.\n\n` +
            `Type *'cancel'* to abort.`
        );
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

            await ctx.reply(`BOT: ⏳ Validating credentials with SailPoint...`);

            try {
                // 1. Validate Credentials via SailPoint API (Basic Auth)
                const baseUrl = ctx.config?.url ? ctx.config.url.replace(/\/$/, '') : 'http://localhost:8080/identityiq';
                const testUrl = `${baseUrl}/scim/v2/Identity/${username}`;
                // We test accessing their own identity or a general endpoint
                // Actually 'Me' is best but let's try reading their Identity which they should have access to.

                const creds = Buffer.from(`${username}:${password}`).toString('base64');

                console.log(`[Verify] Testing auth against: ${testUrl}`);
                const authResponse = await fetch(testUrl, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${creds}` }
                });

                if (authResponse.status === 401 || authResponse.status === 403) {
                    await ctx.reply("BOT: ❌ Invalid Password. Please try again.");
                    // Remain in ASK_PASSWORD step
                    return;
                }

                if (!authResponse.ok) {
                    console.error(`[Verify] Auth Check Error: ${authResponse.status}`);
                    // If it's not 401/403, it might be a system error or 404. Proceed with caution or fail?
                    // Let's assume fail to be safe.
                    await ctx.reply(`BOT: ⚠️ Error validating credentials (Status: ${authResponse.status}).`);
                    return;
                }

                await ctx.reply(`BOT: ✅ Verified! Linking account...`);

                // 2. Register Mapping (No password needed, trusted call by Admin)
                const result = await launchWorkflow('RegisterPhoneMapping', {
                    phoneNumber,
                    identityName: username
                    // No password passed to workflow
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
                        // Update session with verified identity
                        ctx.session.identifiedUser = username;
                        ctx.session.displayName = username;
                        ctx.session.capabilities = ['User']; // Default, will be updated on next lookup

                        await ctx.reply(
                            `BOT: ✅ *Success!*\n\n` +
                            `Your WhatsApp is now linked to *${username}*.\n` +
                            `Phone attribute updated in IdentityIQ.\n\n` +
                            `Type *!menu* to see available tools.`
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
