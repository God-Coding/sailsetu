import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password, workflowName, input } = body;

        console.log(`[Launch Debug] Workflow: ${workflowName}`);
        console.log(`[Launch Debug] Input received:`, JSON.stringify(input));

        if (!url || !username || !password || !workflowName) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const baseUrl = url.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/scim/v2/LaunchedWorkflows`;
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');

        // Transform input object to SCIM format [{ key: k, value: v }]
        // If input is already an array (pre-formatted client side), use it directly
        let inputList;
        if (Array.isArray(input)) {
            inputList = input;
        } else {
            inputList = Object.keys(input || {}).map(key => {
                let val = input[key];
                if (typeof val === 'object') {
                    val = JSON.stringify(val);
                }
                return { key: key, value: val };
            });
        }

        // CORRECT payload structure (matching your Python example)
        const payload = {
            schemas: [
                "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
                "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
            ],
            "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow": {
                workflowName: workflowName,
                input: inputList
            }
        };

        console.log(`[Launch Debug] Sending to ${targetUrl}:`, JSON.stringify(payload, null, 2));

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/scim+json',
                'Accept': 'application/scim+json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Launch Debug] Failed response (${response.status}):`, errorText);
            return NextResponse.json({ success: false, error: response.statusText, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        console.log(`[Launch Debug] Success Response:`, JSON.stringify(data, null, 2));
        return NextResponse.json({
            success: true,
            launchResult: data
        });

    } catch (error: any) {
        console.error("[Launch Debug] Exception:", error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
