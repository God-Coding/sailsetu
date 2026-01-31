import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password, mode, source, identityList, inactiveAttr } = body;

        if (!url || !username || !password) {
            return NextResponse.json({ error: 'Missing auth parameters' }, { status: 400 });
        }

        const inputList = [
            { key: "mode", value: mode },
            { key: "source", value: source || "" },
            { key: "inactiveAttr", value: inactiveAttr || "inactive" }
        ];

        if (identityList && Array.isArray(identityList)) {
            // Need to pass list. In workflow launch payload, if value is array, it might be treated as multi-value attr?
            // Safer to pass as comma-separated string if simple names, or ensure Launch payload handles list.
            // My route.ts handles array inputs by keeping them as-is? 
            // Looking at launch/route.ts: "if (Array.isArray(input))" refers to the input MAP entries.
            // Here I want to pass a single input variable "identityList" which IS a list.
            // SCIM launch usually expects strings. Let's pass as JSON string to be safe.
            // xml/AnalyzeLeaver.xml handles parsing.
            // Pass as comma-separated string to avoid JSON array ambiguity in BeanShell
            inputList.push({ key: "identityList", value: identityList.join(",") });
            // Actually, AnalyzeLeaver.xml checks for List or String. 
            // Let's rely on standard binding. 
        }

        // We use the existing /api/workflow/launch logic, but we can't call it via fetch(localhost) from server.
        // We replicate the fetch logic to the external IIQ URL.

        const baseUrl = url.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/scim/v2/LaunchedWorkflows`;
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');

        const payload = {
            schemas: [
                "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
                "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
            ],
            "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow": {
                workflowName: "AnalyzeLeaver",
                input: inputList
            }
        };

        console.log("DEBUG: Launching AnalyzeLeaver with payload:", JSON.stringify(payload, null, 2));

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/scim+json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const txt = await response.text();
            console.error("DEBUG: Workflow Launch Failed:", response.status, txt);
            return NextResponse.json({ success: false, error: response.statusText, details: txt }, { status: response.status });
        }

        const data = await response.json();
        console.log("DEBUG: Workflow Response:", JSON.stringify(data, null, 2));

        // The workflow returns "report". 
        // We need to extract it from the TaskResult output.
        // Usually in `attributes`: { key: "report", value: ... }

        let report = [];
        if (data.attributes) {
            const repAttr = data.attributes.find((a: any) => a.key === "report");
            if (repAttr && repAttr.value) {
                // If it's a JSON string, parse it. If it's a Map/List (SCIM obj), use it.
                // It might come back as a List of Maps.
                console.log("DEBUG: Found report attribute value:", repAttr.value);
                if (typeof repAttr.value === 'string') {
                    try {
                        report = JSON.parse(repAttr.value);
                    } catch (e) { console.error("Failed to parse report JSON", e); }
                } else if (Array.isArray(repAttr.value)) {
                    report = repAttr.value;
                }
            } else {
                console.log("DEBUG: Report attribute not found or empty.");
            }
        }

        return NextResponse.json({ success: true, report });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
