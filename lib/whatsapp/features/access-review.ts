import { BotContext, Feature } from '../registry';
import { launchWorkflow } from '@/lib/sailpoint/workflow';

export class AccessReviewFeature implements Feature {
    id = "access-reviews";
    name = "Access Reviews";
    description = "View and act on pending access certifications.";
    requiredCapability = "sailsetu-user";

    async onSelect(ctx: BotContext) {
        ctx.session.data = {}; // Clear data
        await this.listPendingReviews(ctx);
    }

    // --- HELPER to parse SCIM attributes array ---
    private getAttribute(attributes: any[], key: string): string | null {
        if (!Array.isArray(attributes)) return null;
        const found = attributes.find((a: any) => a.key === key);
        return found ? found.value : null;
    }

    async handler(ctx: BotContext, text: string) {
        const step = ctx.session.data.internalStep;

        // --- STEP 1: SELECT REVIEW ---
        if (step === 'SELECT_REVIEW') {
            await this.handleSelectReview(ctx, text);
            return;
        }

        // --- STEP 2: SELECT ITEM ---
        if (step === 'SELECT_ITEM') {
            if (text.toLowerCase() === 'done') {
                await ctx.reply("BOT: ✅ Exiting review mode.");
                ctx.resetSession();
                return;
            }
            await this.handleSelectItem(ctx, text);
            return;
        }

        // --- STEP 3: DECIDE (APPROVE/REVOKE) ---
        if (step === 'DECIDE_ACTION') {
            await this.handleDecision(ctx, text);
            return;
        }
    }

    // --- LOGIC ---

    async listPendingReviews(ctx: BotContext) {
        // This is the WhatsApp user mapped to SP Identity?
        // Wait, assumes 'spadmin' or similar is mapped. 
        // We usually use a hardcoded user or mapped user.
        // Let's assume the session has the identityName or we ask for it?
        // In other features we asked for "Exact Username". 
        // Here, it should probably be the *Reviewer*.
        // Let's assume the mapped user (ctx.session.username) IS the reviewer.
        // But for testing 'spadmin', we might need to rely on the Authenticated User in `client.ts`?
        // Actually `ctx.session.username` is from the sender registry.

        // Let's try to fetch reviews for "spadmin" by default for this demo if not mapped, 
        // OR ask "Enter your Identity Name" first?
        // Let's stick to "spadmin" fallback or use config.

        const reviewer = ctx.session.identifiedUser;

        if (!reviewer) {
            await ctx.reply("BOT: ⚠️ Error: User identity not found. Please re-verify.");
            ctx.resetSession();
            return;
        }

        await ctx.reply(`BOT: ⏳ Fetching reviews for *${reviewer}*...`);

        try {
            const launch = await launchWorkflow('GetPendingReviews', { reviewerName: reviewer }, ctx.config);

            if (launch.success && launch.launchResult) {
                const attrs = launch.launchResult.attributes;
                let reviews: any[] = [];
                const reviewsStr = this.getAttribute(attrs, 'reviews');

                if (reviewsStr) {
                    try {
                        reviews = JSON.parse(reviewsStr);
                    } catch (e) { console.error(e); }
                }

                if (reviews.length === 0) {
                    await ctx.reply("BOT: No pending reviews found.");
                    ctx.resetSession();
                } else {
                    ctx.session.data.reviews = reviews;
                    ctx.session.data.internalStep = 'SELECT_REVIEW';

                    // Standard UI using sendPoll
                    if (reviews.length <= 10) {
                        const options = reviews.map((r: any, i: number) =>
                            `${(r.target || r.name).substring(0, 20)}`
                        );
                        await ctx.sendPoll("📋 *Pending Reviews*\nSelect a review to process:", options);
                        return;
                    }

                    // Fallback to text
                    let msg = "BOT: 📋 *Pending Reviews*\nReply with # to select:\n\n";
                    reviews.forEach((r, i) => {
                        msg += `${i + 1}. *${r.target || r.name}* (${r.created})\n`;
                    });
                    await ctx.reply(msg);
                }
            } else {
                await ctx.reply("BOT: ❌ Failed to fetch reviews.");
            }
        } catch (e: any) {
            await ctx.reply(`BOT: ❌ Error: ${e.message}`);
        }
    }

    async handleSelectReview(ctx: BotContext, text: string) {
        const reviews = ctx.session.data.reviews;
        // Prefer ID from List interaction
        const input = (ctx.msg && ctx.msg.selectedRowId) ? ctx.msg.selectedRowId : text;

        // Match by ID
        let review = reviews.find((r: any) => r.id === input);

        // If not found by ID (maybe text title was sent, or manual number), try other methods
        if (!review) {
            // Match by Name (Title)
            review = reviews.find((r: any) => (r.target || r.name).startsWith(text));
        }

        // Fallback to index
        if (!review) {
            const idx = parseInt(text) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < reviews.length) {
                review = reviews[idx];
            }
        }

        if (!review) {
            await ctx.reply("BOT: ⚠️ Invalid selection.");
            return;
        }

        ctx.session.data.selectedReviewId = review.id;
        ctx.session.data.selectedReviewName = review.target || review.name;

        await ctx.reply(`BOT: ✅ Selected Review: *${ctx.session.data.selectedReviewName}*`);
        await this.listReviewItems(ctx, review.id);
    }

    async listReviewItems(ctx: BotContext, workItemId: string) {
        await ctx.reply(`BOT: ⏳ Loading items...`);

        try {
            const launch = await launchWorkflow('GetReviewItems', { workItemId }, ctx.config);

            if (launch.success && launch.launchResult) {
                const attrs = launch.launchResult.attributes;
                let items: any[] = [];
                const itemsStr = this.getAttribute(attrs, 'items');

                if (itemsStr) {
                    try {
                        items = JSON.parse(itemsStr);
                    } catch (e) { }
                }

                ctx.session.data.items = items;
                ctx.session.data.internalStep = 'SELECT_ITEM';

                // Count open items
                const openItems = items.filter((i: any) => i.decision !== 'Approved' && i.decision !== 'Remediated');

                // Standard UI using sendPoll
                if (items.length <= 9) { // 9 + 1 for sign off
                    const options = items.map((item: any, i: number) => {
                        const status = item.decision === 'Approved' ? '✅' : (item.decision === 'Remediated' ? '❌' : '⏳');
                        return `${status} ${item.attribute}: ${item.value}`.substring(0, 20);
                    });
                    options.push("✍️ Sign Off Certification");

                    await ctx.sendPoll(`📝 *Review: ${ctx.session.data.selectedReviewName}*\nSelect an item:`, options);
                    return;
                }

                // Fallback Text combined
                let msg = `BOT: 📝 *Review: ${ctx.session.data.selectedReviewName}*\n`;
                msg += `Total Items: ${items.length} (Open: ${openItems.length})\n\n`;
                items.forEach((item: any, i: number) => {
                    const statusIcon = item.decision === 'Approved' ? '✅' : (item.decision === 'Remediated' ? '❌' : '⏳');
                    msg += `${i + 1}. ${statusIcon} *${item.attribute}*: ${item.value} (${item.identity})\n`;
                });
                msg += `\n${items.length + 1}. ✍️ Sign Off Certification\n`; // Add Sign Off as a numbered option
                msg += "\nReply with *Item #* to decide.\nReply *'done'* to exit.";
                await ctx.reply(msg);
            } else {
                await ctx.reply("BOT: ❌ Failed to fetch items.");
            }
        } catch (e: any) {
            await ctx.reply(`BOT: ❌ Error: ${e.message}`);
        }
    }

    async handleSelectItem(ctx: BotContext, text: string) {
        const input = (ctx.msg && ctx.msg.selectedRowId) ? ctx.msg.selectedRowId : text;
        const items = ctx.session.data.items || [];
        const idx = parseInt(input) - 1;

        // Check for Sign Off (String match OR last numeric option)
        const isSignOffInput = input === 'SIGNOFF' ||
            input === 'Sign Off Certification' ||
            input === '✍️ Sign Off Certification' ||
            input.toUpperCase() === 'S';

        const isSignOffIdx = !isNaN(idx) && idx === items.length; // Sign Off is the (items.length + 1)th option, so its index is items.length

        if (isSignOffInput || isSignOffIdx) {
            await ctx.reply("BOT: ✍️ Signing Off Certification...");
            try {
                const launch = await launchWorkflow('MakeReviewDecision', {
                    workItemId: ctx.session.data.selectedReviewId,
                    signOff: "true"
                }, ctx.config);

                if (launch.success) {
                    await ctx.reply("BOT: ✅ Certification Signed Off Successfully!");
                    ctx.session.data = {};
                    ctx.session.step = 'MENU';
                } else {
                    await ctx.reply("BOT: ❌ Sign Off Failed (Launch Error).");
                }
            } catch (e: any) {
                await ctx.reply(`BOT: ❌ Error during Sign Off: ${e.message}`);
            }
            return;
        }

        if (isNaN(idx) || idx < 0 || idx >= items.length) {
            await ctx.reply("BOT: ⚠️ Invalid item number. Please reply with a number from the list.");
            return;
        }

        const item = items[idx];
        ctx.session.data.selectedItem = item;
        ctx.session.data.internalStep = 'DECIDE_ACTION';

        await ctx.sendPoll(
            `Decision for: *${item.attribute}: ${item.value}*\nIdentity: ${item.identity}`,
            ['Approve', 'Revoke', 'Cancel']
        );
    }

    async handleDecision(ctx: BotContext, text: string) {
        const input = (ctx.msg && ctx.msg.selectedButtonId) ? ctx.msg.selectedButtonId.toUpperCase() : text.toUpperCase();

        if (input === 'C' || input === 'CANCEL') {
            await ctx.reply("Cancelled.");
            // Go back to list
            await this.listReviewItems(ctx, ctx.session.data.selectedReviewId);
            return;
        }

        let decision = "";
        if (input === 'A' || input === 'APPROVE') decision = "Approved";
        else if (input === 'R' || input === 'REVOKE') decision = "Revoked";
        else {
            await ctx.reply("BOT: ⚠️ Please reply A or R.");
            return;
        }

        const item = ctx.session.data.selectedItem;

        // Call MakeReviewDecision
        const payload = [
            { itemId: item.id, decision: decision }
        ];

        await ctx.reply(`BOT: 💾 Saving decision...`);

        try {
            // Pass as JSON string
            const launch = await launchWorkflow('MakeReviewDecision', {
                workItemId: ctx.session.data.selectedReviewId,
                items: JSON.stringify(payload)
            }, ctx.config);

            if (launch.success) {
                await ctx.reply(`BOT: ✅ Item ${decision}!`);
            } else {
                await ctx.reply("BOT: ❌ Save failed.");
            }
        } catch (e: any) {
            await ctx.reply(`BOT: ❌ Error: ${e.message}`);
        }

        // Return to list
        await this.listReviewItems(ctx, ctx.session.data.selectedReviewId);
    }
}

export const accessReviewFeature = new AccessReviewFeature();
