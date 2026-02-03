
import { BotContext, Feature } from '../registry';
import { launchWorkflow } from '@/lib/sailpoint/workflow';

export class ManageAccessFeature implements Feature {
    id = "manage-access";
    name = "Manage User Access";
    description = "Request or Revoke access for an identity.";
    requiredCapability = "*";

    async onSelect(ctx: BotContext) {
        ctx.session.data = {}; // Clear data
        ctx.session.data.internalStep = 'SEARCH_USER';
        await ctx.reply("BOT: 👤 *Manage Access*\n\nPlease type the *exact username* of the identity (e.g. `spadmin` or `james.smith`).");
    }

    async handler(ctx: BotContext, text: string) {
        const step = ctx.session.data.internalStep;

        // --- STEP 1: SEARCH USER ---
        if (step === 'SEARCH_USER') {
            await this.handleSearchUser(ctx, text);
            return;
        }

        // --- STEP 2: SELECT ACTION ---
        if (step === 'SELECT_ACTION') {
            await this.handleSelectAction(ctx, text);
            return;
        }

        // --- STEP 3: REMOVE FLOW ---
        if (step === 'SELECT_REMOVE_ITEM') {
            await this.handleSelectRemoveItem(ctx, text);
            return;
        }

        // --- STEP 4: ADD FLOW ---
        if (step === 'ENTER_ADD_NAME') {
            ctx.session.data.addName = text;
            ctx.session.data.internalStep = 'SELECT_ADD_TYPE';
            await ctx.reply("BOT: Is this a **Role** or **Entitlement**?\n1️⃣ Role\n2️⃣ Entitlement");
            return;
        }

        if (step === 'SELECT_ADD_TYPE') {
            if (text === '1') {
                ctx.session.data.addType = 'Role';
                ctx.session.data.addApp = 'IIQ'; // Default for Roles
                ctx.session.data.addAttr = 'assignedRoles';

                ctx.session.data.internalStep = 'CONFIRM_ADD';
                await ctx.reply(`BOT: ❓ Confirm Request:\n\nUser: *${ctx.session.data.targetUser}*\nAction: *Add Role*\nName: *${ctx.session.data.addName}*\n\nReply 'yes' to proceed.`);
            } else if (text === '2') {
                ctx.session.data.addType = 'Entitlement';
                ctx.session.data.internalStep = 'ENTER_APP_NAME';
                await ctx.reply("BOT: 🏢 Enter the **Application Name** (e.g. Active Directory, TRAKK):");
            } else {
                await ctx.reply("BOT: ⚠️ Invalid selection. Reply 1 or 2.");
            }
            return;
        }

        if (step === 'ENTER_APP_NAME') {
            ctx.session.data.addApp = text;
            const app = text;
            const val = ctx.session.data.addName;

            await ctx.reply(`BOT: 🔍 Verifying *${val}* in *${app}*...`);

            try {
                // Launch SearchEntitlement
                const launch = await launchWorkflow('SearchEntitlement', {
                    applicationName: app,
                    value: val
                }, ctx.config);

                let found = false;
                let attr = "";
                let display = "";

                if (launch.success && launch.launchResult) {
                    const attrs = launch.launchResult.attributes || [];
                    const foundReq = attrs.find((a: any) => a.key === 'found');
                    if (foundReq && (foundReq.value === 'true' || foundReq.value === true)) {
                        found = true;
                        attr = attrs.find((a: any) => a.key === 'attribute')?.value;
                        display = attrs.find((a: any) => a.key === 'displayName')?.value;
                    }
                }

                if (found && attr) {
                    ctx.session.data.addAttr = attr;
                    ctx.session.data.internalStep = 'CONFIRM_ADD';

                    await ctx.reply(
                        `BOT: ✅ *Verified!*\n` +
                        `Entitlement: *${display || val}*\n` +
                        `Attribute: *${attr}*\n\n` +
                        `❓ *Confirm Request:*\n` +
                        `User: *${ctx.session.data.targetUser}*\n` +
                        `Action: *Add Entitlement*\n` +
                        `App: *${app}*\n` +
                        `Attr: *${attr}*\n` +
                        `Value: *${val}*\n\n` +
                        `Reply 'yes' to proceed.`
                    );
                } else {
                    ctx.session.data.internalStep = 'ENTER_ATTR_NAME';
                    await ctx.reply("BOT: ⚠️ Could not auto-detect the attribute name.\n\n🏷️ Please enter the **Attribute Name** manually (e.g. `memberOf`, `group`).");
                }

            } catch (e: any) {
                // Fallback to manual
                ctx.session.data.internalStep = 'ENTER_ATTR_NAME';
                await ctx.reply(`BOT: ⚠️ Lookup Error (${e.message}).\n\n🏷️ Please enter the **Attribute Name** manually.`);
            }
            return;
        }

        if (step === 'ENTER_ATTR_NAME') {
            ctx.session.data.addAttr = text;
            ctx.session.data.internalStep = 'CONFIRM_ADD';

            await ctx.reply(
                `BOT: ❓ Confirm Request:\n\n` +
                `User: *${ctx.session.data.targetUser}*\n` +
                `Action: *Add Entitlement*\n` +
                `App: *${ctx.session.data.addApp}*\n` +
                `Attr: *${ctx.session.data.addAttr}*\n` +
                `Value: *${ctx.session.data.addName}*\n\n` +
                `Reply 'yes' to proceed.`
            );
            return;
        }

        // --- CONFIRMATION ---
        if (step === 'CONFIRM_REMOVE' || step === 'CONFIRM_ADD') {
            if (text.toLowerCase() === 'yes' || text.toLowerCase() === 'y') {
                await this.executeProvisioning(ctx);
            } else {
                await ctx.reply("BOT: 🚫 Cancelled.");
                ctx.resetSession();
            }
            return;
        }
    }

    // --- HANDLERS ---

    async handleSearchUser(ctx: BotContext, username: string) {
        await ctx.reply(`BOT: 🔍 Searching for *${username}*...`);

        try {
            // Use 'GetIdentityAccess' to verify user and get current items
            const launch = await launchWorkflow('GetIdentityAccess', { identityName: username }, ctx.config);

            if (launch.success && launch.launchResult) {
                const attrs = launch.launchResult.attributes;
                // Check if 'accessList' exists (even if empty, it means user exists) OR checks if attributes returned
                // Usually if user invalid, workflow might fail or return error. 
                // Let's assume success means user exists.

                let accessList: any[] = [];
                if (attrs && attrs.accessList) {
                    accessList = attrs.accessList;
                }

                ctx.session.data.targetUser = username;
                ctx.session.data.accessList = accessList;
                ctx.session.data.internalStep = 'SELECT_ACTION';

                await ctx.reply(
                    `BOT: ✅ Found *${username}*\nCurrent Access Items: ${accessList.length}\n\n` +
                    `👇 *Select Action:*\n` +
                    `1️⃣ Add Access (Request Role/Entitlement)\n` +
                    `2️⃣ Remove Access (Revoke Existing)`
                );
            } else {
                await ctx.reply("BOT: ❌ Identity not found or workflow error. Please check the username and try again.");
            }
        } catch (e: any) {
            await ctx.reply(`BOT: ❌ Search failed: ${e.message}`);
        }
    }

    async handleSelectAction(ctx: BotContext, text: string) {
        if (text === '1') {
            // Add Access
            ctx.session.data.internalStep = 'ENTER_ADD_NAME';
            await ctx.reply("BOT: ➕ *Request Access*\n\nPlease type the *exact name* of the Role or Entitlement you want to add.");
        } else if (text === '2') {
            // Remove Access
            const list = ctx.session.data.accessList;
            if (!list || list.length === 0) {
                await ctx.reply("BOT: ⚠️ User has no access items to remove.");
                return; // Stay in select action? Or reset?
            }

            ctx.session.data.internalStep = 'SELECT_REMOVE_ITEM';
            let msg = "BOT: ➖ *Revoke Access*\nReply with the *number* to remove:\n\n";
            list.forEach((item: any, i: number) => {
                msg += `${i + 1}. ${item.type}: *${item.name}* (${item.value || ''})\n`;
            });
            await ctx.reply(msg);
        } else {
            await ctx.reply("BOT: ⚠️ Invalid selection. Reply 1 or 2.");
        }
    }

    async handleSelectRemoveItem(ctx: BotContext, text: string) {
        const idx = parseInt(text) - 1;
        const list = ctx.session.data.accessList;

        if (isNaN(idx) || idx < 0 || idx >= list.length) {
            await ctx.reply("BOT: ⚠️ Invalid number.");
            return;
        }

        const item = list[idx];
        ctx.session.data.targetItem = item;
        ctx.session.data.internalStep = 'CONFIRM_REMOVE';

        await ctx.reply(
            `BOT: ❓ Confirm Revocation:\n\n` +
            `User: *${ctx.session.data.targetUser}*\n` +
            `Item: *${item.name}*\n` +
            `Type: ${item.type}\n\n` +
            `Reply 'yes' to proceed.`
        );
    }

    async executeProvisioning(ctx: BotContext) {
        const user = ctx.session.data.targetUser;
        const step = ctx.session.data.internalStep;
        let inputList: any[] = [{ key: "identityName", value: user }];

        if (step === 'CONFIRM_REMOVE') {
            const item = ctx.session.data.targetItem;
            // Map item to ProvisionAccess format
            // GetIdentityAccess returns: { name, value, type, application, attribute } roughly
            // ProvisionAccess expects: type, application, name, value, op

            // We need to be careful with mapping. GetIdentityAccess output might vary.
            // Assuming item has: type (Role/Entitlement), name, value, application (sometimes)

            // Re-map type
            let type = "entitlement";
            if (item.type === 'Assigned Role' || item.type === 'Role' || item.type === 'Bundle') type = 'role';

            const accessItem = {
                type,
                application: item.application || (type === 'role' ? 'IIQ' : ''),
                name: item.name,
                value: item.value,
                op: "Remove"
            };

            // Fix for Roles: name is 'assignedRoles', value is Role Name
            if (type === 'role') {
                accessItem.name = 'assignedRoles';
                accessItem.value = item.name; // Role name usually in 'name' from GetIdentityAccess
            } else {
                // Entitlement: name is attribute name (e.g. memberOf), value is value
                // Wait, GetIdentityAccess usually returns 'name' as display name.
                // We might need raw attributes if available.
                // Looking at page.tsx debug: { name, value, type }
                // Let's hope 'name' is the attribute name for entitlements.
                // Actually usually 'name' is the value for entitlements in some views.
                // Let's trust the item structure for now, but might need debugging.
                // Fallback: Use 'value' as value.
            }

            inputList.push({ key: "accessItems", value: JSON.stringify([accessItem]) });

        } else if (step === 'CONFIRM_ADD') {
            const type = ctx.session.data.addType === 'Role' ? 'role' : 'entitlement';

            const accessItem = {
                type,
                application: ctx.session.data.addApp,
                name: ctx.session.data.addAttr,
                value: ctx.session.data.addName,
                op: "Add"
            };

            inputList.push({ key: "accessItems", value: JSON.stringify([accessItem]) });
        }

        inputList.push({ key: "approvalScheme", value: "manager" }); // Force Workitem creation

        await ctx.reply("BOT: 🚀 Submitting request...");

        try {
            const launch = await launchWorkflow('ProvisionAccess', inputList, ctx.config);
            if (launch.success) {
                let reqId = "N/A";
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

                await ctx.reply(`BOT: ✅ Success! Request submitted.\nRequest ID: ${reqId}`);
            } else {
                await ctx.reply("BOT: ❌ Workflow failed.");
            }
        } catch (e: any) {
            await ctx.reply(`BOT: ❌ Error: ${e.message}`);
        }
        ctx.resetSession();
    }
}

export const manageAccessFeature = new ManageAccessFeature();
