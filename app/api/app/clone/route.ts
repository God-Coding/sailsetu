import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sourceAppName, newAppName } = body;

        console.log(`\n[Clone] ====== Starting Clone Operation ======`);
        console.log(`[Clone] Source: ${sourceAppName}, Target: ${newAppName}`);

        if (!sourceAppName || !newAppName) {
            console.error("[Clone] ERROR: Missing parameters");
            return NextResponse.json({ error: "Missing sourceAppName or newAppName" }, { status: 400 });
        }

        const iiqUrl = "http://localhost:8080/identityiq";
        const auth = Buffer.from("spadmin:admin").toString("base64");
        const targetUrl = `${iiqUrl}/scim/v2/LaunchedWorkflows`;

        const payload = {
            schemas: [
                "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
                "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
            ],
            "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow": {
                workflowName: "CloneApplication",
                input: [
                    { key: "sourceAppName", value: sourceAppName },
                    { key: "newAppName", value: newAppName }
                ]
            }
        };

        console.log(`[Clone] Launching workflow at ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/scim+json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("[Clone] ERROR: Workflow launch failed -", response.status, errText);
            return NextResponse.json({ error: `IIQ Error: ${errText}` }, { status: response.status });
        }

        const data = await response.json();
        const workflowCaseId = data.id;
        console.log(`[Clone] Workflow launched successfully - Case ID: ${workflowCaseId}`);

        // Extract output variables from the response
        console.log(`[Clone] Checking workflow output...`);

        let status = "Unknown";
        let message = "No message returned";

        if (data.attributes && Array.isArray(data.attributes)) {
            const statusAttr = data.attributes.find((a: any) => a.key === "status");
            const messageAttr = data.attributes.find((a: any) => a.key === "message");

            if (statusAttr) status = statusAttr.value;
            if (messageAttr) message = messageAttr.value;

            console.log(`[Clone] Workflow Status: ${status}`);
            console.log(`[Clone] Workflow Message: ${message}`);
        } else {
            console.log(`[Clone] WARNING: No attributes found in workflow response`);
            console.log(`[Clone] Full response:`, JSON.stringify(data, null, 2));
        }

        console.log(`[Clone] ====== Clone Operation Complete ======\n`);

        return NextResponse.json({
            success: status === "Success",
            workflowCaseId,
            status,
            message,
            data
        });

    } catch (error: any) {
        console.error("[Clone] EXCEPTION:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
