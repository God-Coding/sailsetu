import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password, userId } = body;

        if (!url || !username || !password || !userId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const baseUrl = url.replace(/\/$/, '');
        // SCIM Filter to find entitlements where the user is a member
        const filter = `members.value eq "${userId}"`;
        const targetUrl = `${baseUrl}/scim/v2/Entitlements?filter=${encodeURIComponent(filter)}`;

        const credentials = Buffer.from(`${username}:${password}`).toString('base64');

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/scim+json',
                'Accept': 'application/scim+json, application/json'
            },
        });

        if (!response.ok) {
            return NextResponse.json({ success: false, error: response.statusText }, { status: response.status });
        }

        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            data = { rawText };
        }

        return NextResponse.json({
            success: true,
            entitlements: data.Resources || []
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
