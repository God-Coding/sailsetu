import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password } = body;

        if (!url || !username || !password) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Ensure URL doesn't end with slash to avoid double slashes
        const baseUrl = url.replace(/\/$/, '');

        // Switch to SCIM discovery endpoint which is standard and requires no params.
        // This is safer than predicting native REST endpoints.
        const targetUrl = `${baseUrl}/scim/v2/ServiceProviderConfig`;

        const credentials = Buffer.from(`${username}:${password}`).toString('base64');

        console.log(`Testing connection to: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`,
                // SCIM standard content type
                'Content-Type': 'application/scim+json',
                'Accept': 'application/scim+json, application/json'
            },
        });

        const status = response.status;
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            // Check if it's HTML
            if (rawText.trim().startsWith('<') || rawText.includes("<!DOCTYPE")) {
                console.error("Received HTML response:", rawText.slice(0, 200));
                return NextResponse.json({
                    success: false,
                    status: 404, // Usually URL is wrong or redirected
                    error: "Received HTML login page instead of API response. Check your URL (e.g. /identityiq) or SCIM configuration.",
                    details: { rawHtmlPreview: rawText.slice(0, 100) }
                }, { status: 400 });
            }
            data = { rawText: rawText };
        }

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                status,
                error: data.message || response.statusText,
                details: data
            }, { status: response.status });
        }

        return NextResponse.json({
            success: true,
            status,
            data
        });

    } catch (error: any) {
        console.error('Connection error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
