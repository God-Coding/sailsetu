import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password, term } = body;

        if (!url || !username || !password || !term) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const baseUrl = url.replace(/\/$/, '');
        // SCIM Search: userName startsWith OR displayName startsWith
        // We limit to 10 results for autocomplete performance
        const filter = `userName sw "${term}" or displayName sw "${term}"`;
        const targetUrl = `${baseUrl}/scim/v2/Users?filter=${encodeURIComponent(filter)}&count=10`;

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
            users: data.Resources || []
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
