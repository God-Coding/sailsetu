
import { Feature, BotContext } from '../registry';

export const systemStatusFeature: Feature = {
    id: 'system_status',
    name: 'System Status',
    description: 'Check connectivity status',
    requiredCapability: 'sailsetu-master',

    async onSelect(ctx: BotContext) {
        if (ctx.config && ctx.config.url) {
            await ctx.reply(`BOT: ✅ *SailSetu Online*\nConnected to: ${ctx.config.url}`);
        } else {
            await ctx.reply(`BOT: ⚠️ *Disconnected*\nNo SailPoint configuration found.`);
        }
        ctx.resetSession();
    },

    async handler(ctx: BotContext, text: string) {
        // This feature is single-shot, but if we end up here, just show status again
        await this.onSelect(ctx);
    }
};
