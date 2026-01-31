import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password } = body;

        const baseUrl = url.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/scim/v2/LaunchedWorkflows`;
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');

        const payload = {
            schemas: [
                "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
                "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
            ],
            "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow": {
                workflowName: "GetIdentityAttributes",
                input: []
            }
        };

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
            throw new Error(`Workflow Launch Failed: ${response.status} ${txt}`);
        }

        const data = await response.json();

        let attributes: string[] = [];
        if (data.attributes) {
            const attr = data.attributes.find((a: any) => a.key === "attributes");
            if (attr && attr.value) {
                if (typeof attr.value === 'string') {
                    try {
                        attributes = JSON.parse(attr.value);
                    } catch (e) { console.error("Parse error", e); }
                } else if (Array.isArray(attr.value)) {
                    attributes = attr.value;
                }
            }
        }

        return NextResponse.json({ success: true, attributes });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
