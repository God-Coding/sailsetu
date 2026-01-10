import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password } = body;

        if (!url || !username || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 401 });
        }

        const baseUrl = url.replace(/\/$/, '');

        // Strategy 1: Try the standard /Me endpoint (best for self-service)
        let targetUrl = `${baseUrl}/scim/v2/Me`;
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/scim+json',
            'Accept': 'application/scim+json, application/json'
        };

        console.log(`fetching identity profile from: ${targetUrl}`);

        let response = await fetch(targetUrl, { method: 'GET', headers });

        // Strategy 2: Fallback to searching by username if /Me is not supported (404) or fails
        if (response.status === 404 || response.status === 400 || response.status === 405) {
            console.log("SCIM /Me failed or not supported. Falling back to userName search.");
            targetUrl = `${baseUrl}/scim/v2/Users?filter=userName eq "${username}"`;
            response = await fetch(targetUrl, { method: 'GET', headers });
        }

        const status = response.status;
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            data = { rawText };
        }

        if (!response.ok) {
            // Special handling for permissions error
            if (status === 403) {
                return NextResponse.json({
                    success: false,
                    error: "Permission Denied. User may not have SCIM capabilities.",
                    hint: "Ensure the user has the 'SP_SCIM_User' capability or equivalent."
                }, { status: 403 });
            }
            return NextResponse.json({ success: false, error: data.detail || response.statusText, details: data }, { status });
        }

        // If we used /Me, the profile IS the response.
        // If we used /Users search, the profile is inside "Resources" list.
        let userProfile = data;
        if (data.Resources && Array.isArray(data.Resources)) {
            userProfile = data.Resources.length > 0 ? data.Resources[0] : null;
        }

        if (!userProfile) {
            return NextResponse.json({ success: false, error: "User not found via SCIM" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            user: userProfile
        });

    } catch (error: any) {
        console.error('Profile fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
