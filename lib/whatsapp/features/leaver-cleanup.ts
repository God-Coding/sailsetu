
import { Feature, BotContext } from '../registry';
import { launchWorkflow } from '@/lib/sailpoint/workflow';

// Define internal states for this feature
type LeaverState = 'SELECT_MODE' | 'UPLOAD_CSV' | 'SELECT_SOURCE' | 'SELECT_ATTRIBUTE' | 'SELECT_USER' | 'SELECT_ACTION' | 'SELECT_ACTION_ALL';

class LeaverCleanupFeature implements Feature {
    id = 'leaver_cleanup';
    name = 'Leaver Cleanup';
    description = 'Auto Scan & Revoke access for leavers';
    requiredCapability = "Admin";

    async onSelect(ctx: BotContext) {
        ctx.session.data.internalStep = 'SELECT_MODE';
        await ctx.reply(
            "BOT: 🛠️ *Leaver Cleanup Mode*\n" +
            "Reply with number:\n\n" +
            "1️⃣ Auto Scan (Source + Attribute)\n" +
            "2️⃣ CSV Upload (Manual List)"
        );
    }

    async handler(ctx: BotContext, text: string) {
        const step = ctx.session.data.internalStep as LeaverState;

        switch (step) {
            case 'SELECT_MODE':
                await this.handleSelectMode(ctx, text);
                break;
            case 'UPLOAD_CSV':
                await this.handleUploadCsv(ctx, text);
                break;
            case 'SELECT_SOURCE':
                await this.handleSelectSource(ctx, text);
                break;
            case 'SELECT_ATTRIBUTE':
                await this.handleSelectAttribute(ctx, text);
                break;
            case 'SELECT_USER':
                await this.handleSelectUser(ctx, text);
                break;
            case 'SELECT_ACTION':
                await this.handleSelectAction(ctx, text);
                break;
            case 'SELECT_ACTION_ALL':
                await this.handleSelectActionAll(ctx, text);
                break;
            default:
                await ctx.reply("BOT: ⚠️ Unknown state. resetting.");
                ctx.resetSession();
        }
    }

    // --- Sub-Handlers ---

    async handleSelectMode(ctx: BotContext, text: string) {
        if (text === '1') {
            ctx.session.data.mode = 'auto'; // Store mode just in case
            ctx.session.data.internalStep = 'SELECT_SOURCE';
            await ctx.reply("BOT: ⏳ Fetching Authoritative Sources...");

            try {
                const launch = await launchWorkflow('GetAuthoritativeApps', {}, ctx.config);
                if (launch.success) {
                    const appsAttr = launch.launchResult?.attributes?.find((a: any) => a.key === 'apps');
                    let apps: any[] = [];
                    if (appsAttr && appsAttr.value) {
                        if (typeof appsAttr.value === 'string') {
                            try { apps = JSON.parse(appsAttr.value); } catch (e) { }
                        } else if (Array.isArray(appsAttr.value)) {
                            apps = appsAttr.value;
                        }
                    }
                    const authApps = apps.filter((a: any) => a.authoritative === true).map((a: any) => a.name);
                    if (authApps.length === 0) {
                        await ctx.reply("BOT: ⚠️ No Authoritative Applications found.");
                        ctx.resetSession();
                        return;
                    }
                    ctx.session.data.authApps = authApps;
                    let msgTxt = "BOT: 🏢 *Select Source Application*\nReply with the number:\n\n";
                    authApps.forEach((app: string, idx: number) => msgTxt += `${idx + 1}. ${app}\n`);
                    await ctx.reply(msgTxt);
                } else {
                    throw new Error("Failed to fetch apps");
                }
            } catch (e: any) {
                await ctx.reply(`BOT: ❌ Error: ${e.message}`);
                ctx.resetSession();
            }

        } else if (text === '2') {
            ctx.session.data.mode = 'csv';
            ctx.session.data.internalStep = 'UPLOAD_CSV';
            await ctx.reply("BOT: 📂 *Upload CSV*\nPlease upload a CSV file containing identity names (1st column).");
        } else {
            await ctx.reply("BOT: ⚠️ Invalid selection.");
        }
    }

    async handleUploadCsv(ctx: BotContext, text: string) {
        if (!ctx.msg.hasMedia) {
            await ctx.reply("BOT: ⚠️ No file detected. Please upload a CSV file.");
            return;
        }

        try {
            const media = await ctx.msg.downloadMedia();
            if (!media) throw new Error("Failed to download media.");

            const content = Buffer.from(media.data, 'base64').toString('utf-8');
            const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

            if (lines.length === 0) {
                await ctx.reply("BOT: ⚠️ Empty CSV file.");
                return;
            }

            const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

            // Check for Detailed Columns (Instruction Mode)
            const hasApp = header.includes('application');
            const hasAttr = header.includes('attributename');
            const hasVal = header.includes('attributevalue');
            const hasId = header.includes('identityname');

            if (hasApp && hasAttr && hasId) {
                // --- DETAILED CSV MODE ---
                await ctx.reply("BOT: 📂 Detected Detailed Instruction File. Verifying against live access...");

                const colMap = {
                    id: header.indexOf('identityname'),
                    app: header.indexOf('application'),
                    attr: header.indexOf('attributename'),
                    val: header.indexOf('attributevalue'),
                    op: header.indexOf('operation')
                };

                // 1. Parse CSV into "Proposed" Map
                const proposedMap = new Map<string, any[]>();
                const allIdentities = new Set<string>();

                lines.slice(1).forEach(l => {
                    const cols = l.split(',').map(c => c.trim().replace(/"/g, ''));
                    if (cols.length <= colMap.id) return;

                    const identity = cols[colMap.id];
                    if (!identity) return;

                    if (!proposedMap.has(identity)) proposedMap.set(identity, []);
                    allIdentities.add(identity);

                    proposedMap.get(identity)?.push({
                        type: "Entitlement",
                        application: cols[colMap.app] || "",
                        attribute: cols[colMap.attr] || "",
                        value: cols[colMap.val] || "",
                        op: "Remove"
                    });
                });

                if (allIdentities.size === 0) {
                    await ctx.reply("BOT: ⚠️ No identities found in CSV.");
                    return;
                }

                // 2. Validate against Live Access (AnalyzeLeaver)
                // We launch a scan for these users to see what they ACTUALLY have.
                const launch = await launchWorkflow('AnalyzeLeaver', {
                    mode: 'csv',
                    identityList: Array.from(allIdentities).join(',')
                }, ctx.config);

                let actualAccessMap = new Map<string, any[]>(); // Identity -> List of actual items

                if (launch.success) {
                    const reportStr = launch.launchResult?.attributes?.find((a: any) => a.key === 'report')?.value;
                    if (reportStr) {
                        const report = JSON.parse(reportStr);
                        report.forEach((r: any) => {
                            actualAccessMap.set(r.identityName, r.accessItems || []);
                        });
                    }
                } else {
                    await ctx.reply("BOT: ⚠️ Validation scan failed. Proceeding with raw CSV data (Risk of errors).");
                }

                // 3. Filter "Proposed" against "Actual"
                const verifiedLeavers: any[] = [];
                let removedCount = 0;

                proposedMap.forEach((items, identity) => {
                    const actualItems = actualAccessMap.get(identity) || [];

                    // Filter: Keep item ONLY if it exists in actualItems
                    const validItems = items.filter(propItem => {
                        const exists = actualItems.some((actItem: any) =>
                            actItem.application === propItem.application &&
                            (actItem.name === propItem.attribute || actItem.value === propItem.value)
                            // Note: 'name' in report maps to 'attribute' in CSV usually. Value check is safer.
                        );
                        if (!exists) removedCount++;
                        return exists;
                    });

                    if (validItems.length > 0) {
                        verifiedLeavers.push({
                            identityName: identity,
                            accessItems: validItems
                        });
                    }
                });

                ctx.session.data.leavers = verifiedLeavers;
                ctx.session.data.internalStep = 'SELECT_USER';

                let msgTxt = `BOT: ✅ *Verification Complete*\n`;
                if (removedCount > 0) msgTxt += `🗑️ Filtered out ${removedCount} items that were already revoked.\n`;
                msgTxt += `⚠️ *Loaded ${verifiedLeavers.length} Identities with Active Access*\n\n`;
                msgTxt += `👉 Reply with *number* to View Details\n`;
                msgTxt += `👉 Reply *'all'* to revoke ALL immediately\n\n`;

                verifiedLeavers.slice(0, 10).forEach((l: any, i: number) => {
                    const uniqueApps = Array.from(new Set(l.accessItems?.map((item: any) => item.application) || [])).length;
                    const items = l.accessItems?.length || 0;
                    msgTxt += `${i + 1}. *${l.identityName}* (Apps: ${uniqueApps}, Items: ${items})\n`;
                });
                await ctx.reply(msgTxt);
                return;
            }

            // --- SIMPLE LIST MODE ---
            let idIdx = header.indexOf('identityname');
            if (idIdx === -1) idIdx = 0;

            const identities = lines.slice(1).map(l => {
                const cols = l.split(',');
                if (cols.length <= idIdx) return null;
                return cols[idIdx].trim().replace(/"/g, '');
            }).filter(n => n && n.toLowerCase() !== 'identityname');

            const uniqueIdentities = Array.from(new Set(identities));

            if (uniqueIdentities.length === 0) {
                await ctx.reply("BOT: ⚠️ No valid identities found in CSV.");
                return;
            }

            await ctx.reply(`BOT: 🔍 Analyzing ${uniqueIdentities.length} identities from CSV (Scan Mode)...`);

            const launch = await launchWorkflow('AnalyzeLeaver', {
                mode: 'csv',
                identityList: uniqueIdentities.join(',')
            }, ctx.config);

            if (launch.success) {
                const reportStr = launch.launchResult?.attributes?.find((a: any) => a.key === 'report')?.value;
                if (!reportStr) throw new Error("No report returned.");

                const leavers = JSON.parse(reportStr);
                if (!leavers || leavers.length === 0) {
                    await ctx.reply(`BOT: ✅ No access items found for these users.`);
                    ctx.resetSession();
                    return;
                }

                ctx.session.data.leavers = leavers;
                ctx.session.data.internalStep = 'SELECT_USER';

                let msgTxt = `BOT: ⚠️ *Found ${leavers.length} Identities with Access*\n\n`;
                msgTxt += `👉 Reply with *number* to View Details\n`;
                msgTxt += `👉 Reply *'all'* to revoke ALL immediately\n\n`;

                leavers.slice(0, 10).forEach((l: any, i: number) => {
                    const uniqueApps = Array.from(new Set(l.accessItems?.map((item: any) => item.application) || [])).length;
                    const items = l.accessItems?.length || 0;
                    msgTxt += `${i + 1}. *${l.identityName}* (Apps: ${uniqueApps}, Items: ${items})\n`;
                });
                await ctx.reply(msgTxt);

            } else {
                throw new Error("Analysis failed");
            }

        } catch (e: any) {
            await ctx.reply(`BOT: ❌ CSV Process Error: ${e.message}`);
        }
    }

    async handleSelectSource(ctx: BotContext, text: string) {
        const { authApps } = ctx.session.data;
        const idx = parseInt(text) - 1;

        if (isNaN(idx) || idx < 0 || idx >= authApps.length) {
            await ctx.reply("BOT: ⚠️ Invalid number. Please try again.");
            return;
        }

        const sourceName = authApps[idx];
        ctx.session.data.selectedSource = sourceName;

        ctx.session.data.internalStep = 'SELECT_ATTRIBUTE';
        await ctx.reply(
            `BOT: 🏢 *Source Selected: ${sourceName}*\n\n` +
            `Now, please enter the **Identity Attribute** to check for inactivity (e.g., 'inactive', 'status', 'cloudLifecycleState').\n` +
            `Reply with the attribute name:`
        );
    }

    async handleSelectAttribute(ctx: BotContext, text: string) {
        const attribute = text.trim();
        if (!attribute) {
            await ctx.reply("BOT: ⚠️ Attribute cannot be empty.");
            return;
        }

        ctx.session.data.inactiveAttr = attribute;
        const { selectedSource } = ctx.session.data;

        await ctx.reply(`BOT: 🔍 Scanning *${selectedSource}* for users where *${attribute}* is inactive...`);

        try {
            const launch = await launchWorkflow('AnalyzeLeaver', {
                mode: 'scan',
                source: selectedSource,
                inactiveAttr: attribute
            }, ctx.config);

            if (launch.success) {
                const reportStr = launch.launchResult?.attributes?.find((a: any) => a.key === 'report')?.value;
                if (!reportStr) throw new Error("No report returned.");

                const leavers = JSON.parse(reportStr);
                if (!leavers || leavers.length === 0) {
                    await ctx.reply(`BOT: ✅ No pending leavers found in ${selectedSource}.`);
                    ctx.resetSession();
                    return;
                }

                ctx.session.data.leavers = leavers;
                ctx.session.data.internalStep = 'SELECT_USER'; // Advance state

                let msgTxt = `BOT: ⚠️ *Found ${leavers.length} Potential Leavers*\n\n`;
                msgTxt += `👉 Reply with *number* to View Details\n`;
                msgTxt += `👉 Reply *'all'* to revoke ALL immediately\n\n`;

                leavers.slice(0, 10).forEach((l: any, i: number) => {
                    const uniqueApps = Array.from(new Set(l.accessItems?.map((item: any) => item.application) || [])).length;
                    const items = l.accessItems?.length || 0;
                    msgTxt += `${i + 1}. *${l.identityName}* (Apps: ${uniqueApps}, Items: ${items})\n`;
                });
                await ctx.reply(msgTxt);
            } else {
                throw new Error("Workflow launch failed");
            }
        } catch (e: any) {
            await ctx.reply(`BOT: ❌ Scan failed: ${e.message}`);
            ctx.resetSession();
        }
    }

    async handleSelectUser(ctx: BotContext, text: string) {
        // CHECK FOR 'ALL'
        if (text.toLowerCase() === 'all') {
            const { leavers } = ctx.session.data;
            ctx.session.data.internalStep = 'SELECT_ACTION_ALL';
            await ctx.reply(
                `BOT: 🚨 *Bulk Revocation Mode*\n` +
                `You are about to process **${leavers.length} identities**.\n\n` +
                `👇 *Select Action for ALL:*\n` +
                `1️⃣ Revoke All Now (Direct)\n` +
                `2️⃣ Revoke All Now (Create Workitems)`
            );
            return;
        }

        const { leavers } = ctx.session.data;
        const idx = parseInt(text) - 1;

        if (isNaN(idx) || idx < 0 || idx >= leavers.length) {
            await ctx.reply("BOT: ⚠️ Invalid selection. Reply a number or 'all'.");
            return;
        }

        const victim = leavers[idx];
        ctx.session.data.targetVictim = victim;
        ctx.session.data.internalStep = 'SELECT_ACTION'; // Advance state

        const items = victim.accessItems || [];

        // Format access items like UI
        let itemsList = "";
        items.slice(0, 15).forEach((item: any) => {
            itemsList += `- ${item.name || item.value} (${item.application})\n`;
        });
        if (items.length > 15) itemsList += `...and ${items.length - 15} more.\n`;

        await ctx.reply(
            `BOT: 👤 *Identity Details*\n` +
            `User: ${victim.identityName}\n` +
            `Inactive: true\n\n` +
            `*Access to Revoke:*\n${itemsList}\n` +
            `👇 *Select Action:*\n` +
            `1️⃣ Revoke Now (Direct)\n` +
            `2️⃣ Revoke Now (Create Workitem)`
        );
    }

    // Helper to map items like UI
    private mapAccessItems(items: any[]): any[] {
        const mapped: any[] = [];
        items.forEach(item => {
            if (item.type === "Entitlement") {
                mapped.push({
                    type: "entitlement",
                    application: item.application,
                    name: item.attribute || "unknown",
                    value: item.value,
                    op: "Remove"
                });
            } else if (item.type === "Role" || item.type === "Bundle") {
                mapped.push({
                    type: "role",
                    name: "assignedRoles",
                    value: item.value,
                    op: "Remove"
                });
            }
        });
        return mapped;
    }

    async handleSelectAction(ctx: BotContext, text: string) {
        const { targetVictim } = ctx.session.data;
        const rawItems = targetVictim.accessItems || [];
        const mappedItems = this.mapAccessItems(rawItems);

        let inputList: any[] = [
            { key: "identityName", value: targetVictim.identityName },
            { key: "accessItems", value: JSON.stringify(mappedItems) }
        ];

        let action = "";

        if (text === '1') {
            action = "Direct Revocation";
            inputList.push({ key: "approvalScheme", value: "none" });
        } else if (text === '2') {
            action = "Create Workitem";
        } else {
            await ctx.reply("BOT: 🚫 Cancelled / Invalid Selection.");
            ctx.resetSession();
            return;
        }

        if (mappedItems.length === 0) {
            await ctx.reply("BOT: ⚠️ No revocable items (Entitlements/Roles) found.");
            return;
        }

        await ctx.reply(`BOT: 🚀 Executing *${action}* for ${mappedItems.length} items...`);

        try {
            const launch = await launchWorkflow('ProvisionAccess', inputList, ctx.config);

            if (launch.success) {
                let reqId = "N/A";
                const result = launch.launchResult;
                if (result) {
                    if (result.id && !reqId.match(/^[a-z0-9]{32}$/i)) reqId = result.id;

                    const idAttr = result.attributes?.find((a: any) => a.key === "identityRequestId");
                    if (idAttr) {
                        reqId = idAttr.value;
                    } else {
                        const planAttr = result.attributes?.find((a: any) => a.key === "plan");
                        if (planAttr && planAttr.value) {
                            const match = planAttr.value.match(/key="identityRequestId"\s+value="([^"]+)"/);
                            if (match && match[1]) reqId = match[1];
                        }
                    }
                }

                await ctx.reply(`BOT: ✅ *Success!*\nRequest ID: ${reqId}\nItems: ${mappedItems.length}`);
            } else {
                throw new Error("Workflow reported failure");
            }
        } catch (e: any) {
            await ctx.reply(`BOT: ❌ Failed: ${e.message}`);
        }

        ctx.resetSession();
    }

    async handleSelectActionAll(ctx: BotContext, text: string) {
        const { leavers } = ctx.session.data;
        let approvalScheme = "";
        let actionName = "";

        if (text === '1') {
            approvalScheme = "none";
            actionName = "Direct Revocation";
        } else if (text === '2') {
            approvalScheme = "";
            actionName = "Create Workitems";
        } else {
            await ctx.reply("BOT: 🚫 Cancelled.");
            ctx.resetSession();
            return;
        }

        await ctx.reply(`BOT: 🚀 Starting Batch ${actionName} for ${leavers.length} identities...`);

        let success = 0;
        let fail = 0;
        let processed = 0;
        const results: string[] = [];

        for (const victim of leavers) {
            const rawItems = victim.accessItems || [];
            const mappedItems = this.mapAccessItems(rawItems);

            if (mappedItems.length === 0) {
                processed++;
                continue;
            }

            const inputList: any[] = [
                { key: "identityName", value: victim.identityName },
                { key: "accessItems", value: JSON.stringify(mappedItems) }
            ];
            if (approvalScheme === "none") {
                inputList.push({ key: "approvalScheme", value: "none" });
            }

            try {
                const launch = await launchWorkflow('ProvisionAccess', inputList, ctx.config);
                // Extract Request ID
                let reqId = "N/A";

                if (launch.success) {
                    success++;
                    const result = launch.launchResult;
                    if (result) {
                        // Priority 1: Direct Attribute
                        const idAttr = result.attributes?.find((a: any) => a.key === "identityRequestId");
                        if (idAttr) {
                            reqId = idAttr.value;
                        }

                        // Priority 2: Plan/Project XML
                        if (reqId === "N/A") {
                            const planAttr = result.attributes?.find((a: any) => a.key === "plan" || a.key === "project");
                            if (planAttr && planAttr.value) {
                                const match = planAttr.value.match(/key="identityRequestId"\s+value="([^"]+)"/);
                                if (match && match[1]) reqId = match[1];
                            }
                        }

                        // Priority 3: Task Result ID (Fallback)
                        if (reqId === "N/A" && result.id) {
                            reqId = result.id;
                        }
                    }
                    results.push(`✅ ${victim.identityName}: ${reqId}`);
                } else {
                    fail++;
                    results.push(`❌ ${victim.identityName}: Workflow Fail`);
                }
            } catch (e: any) {
                fail++;
                console.error(`Batch Error for ${victim.identityName}:`, e);
                results.push(`❌ ${victim.identityName}: err`);
            }
            processed++;

            if (processed % 5 === 0) {
                await ctx.reply(`BOT: ⏳ Progress: ${processed}/${leavers.length}...`);
            }
        }

        let summary = `BOT: ✅ *Batch Complete*\nProcessed: ${processed}\nSuccess: ${success}\nFailed: ${fail}\n\n*Details:*\n`;
        const details = results.join('\n');
        // Truncate if too long (WhatsApp limit approx 4096 chars, safe limit 1000)
        if (details.length > 3000) {
            summary += results.slice(0, 50).join('\n') + `\n...and ${results.length - 50} more.`;
        } else {
            summary += details;
        }

        await ctx.reply(summary);
        ctx.resetSession();
    }
}

export const leaverCleanupFeature = new LeaverCleanupFeature();
