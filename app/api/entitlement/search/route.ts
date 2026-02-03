
import { NextRequest, NextResponse } from 'next/server';
import { launchWorkflow } from '@/lib/sailpoint/workflow';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { application, value, url, username, password } = body;

        // We might get auth from body (if called from UI) or need to handle it. 
        // Bot passes config in launchWorkflow.
        // But here we are making a dedicated endpoint.
        // Actually, the Bot logic runs on server, it can call launchWorkflow directly!
        // It doesn't need to call this API endpoint via HTTP if it imports `launchWorkflow`.
        // BUT, `manage-access.ts` uses `ctx.config`.

        // Wait, I am creating this API for the UI? 
        // The Bot runs in `lib/whatsapp`. It can import `launchWorkflow`.
        // I don't strictly need a Next.js Route for the Bot.
        // However, standardizing on API routes is good practice in this project (everything else does it).
        // Plus, the UI might need it later.

        // Let's implement it.
        const config = { url, username, password };

        const launch = await launchWorkflow('SearchEntitlement', {
            applicationName: application,
            value: value
        }, config);

        if (launch.success && launch.launchResult) {
            const attrs = launch.launchResult.attributes || [];
            const foundReq = attrs.find((a: any) => a.key === 'found');
            const attrReq = attrs.find((a: any) => a.key === 'attribute');
            const dnReq = attrs.find((a: any) => a.key === 'displayName');

            // Workflow returns "true"/"false" strings usually for booleans in attributes map?
            // Or actual booleans if workflow.put(boolean).
            // SCIM response attributes are Key/Value strings mostly.

            const isFound = foundReq?.value === 'true' || foundReq?.value === true;

            return NextResponse.json({
                success: true,
                found: isFound,
                attribute: attrReq?.value,
                displayName: dnReq?.value
            });
        }

        return NextResponse.json({ success: false, found: false });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
