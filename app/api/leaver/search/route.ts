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
                workflowName: "GetAuthoritativeApps",
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

        // Extract "apps" from attributes
        let apps: any[] = [];
        if (data.attributes) {
            const appsAttr = data.attributes.find((a: any) => a.key === "apps");
            if (appsAttr && appsAttr.value) {
                if (typeof appsAttr.value === 'string') {
                    try {
                        apps = JSON.parse(appsAttr.value);
                    } catch (e) { }
                } else if (Array.isArray(appsAttr.value)) {
                    apps = appsAttr.value;
                }
            }
        }

        if (apps.length > 0) {
            apps = apps.filter((a: any) => a.authoritative === true);
        }

        return NextResponse.json({ success: true, apps });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
