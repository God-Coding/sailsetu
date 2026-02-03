import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, username, password } = body;

        if (!url || !username || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 401 });
        }

        const baseUrl = url.replace(/\/$/, '');
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        const headers: HeadersInit = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/scim+json',
            'Accept': 'application/scim+json, application/json'
        };

        // Helper to fetch /Me
        const fetchMe = async () => {
            const targetUrl = `${baseUrl}/scim/v2/Me`;
            // Add a timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(targetUrl, { method: 'GET', headers, signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(JSON.stringify({ status: response.status, msg: text }));
                }
                return await response.json();
            } catch (e: any) {
                clearTimeout(timeoutId);
                throw e;
            }
        };

        // Helper to fetch Search
        const fetchSearch = async () => {
            const targetUrl = `${baseUrl}/scim/v2/Users?filter=userName eq "${username}"`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const response = await fetch(targetUrl, { method: 'GET', headers, signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(JSON.stringify({ status: response.status, msg: text }));
                }
                const data = await response.json();
                if (data.Resources && Array.isArray(data.Resources) && data.Resources.length > 0) {
                    return data.Resources[0];
                }
                throw new Error(JSON.stringify({ status: 404, msg: "User not found in search results" }));
            } catch (e: any) {
                clearTimeout(timeoutId);
                throw e;
            }
        };

        console.log(`[FastAuth] Racing /Me and /Users search for ${username}...`);

        try {
            // Promise.any waits for the first FULFILLED promise
            const userProfile = await Promise.any([fetchMe(), fetchSearch()]);

            return NextResponse.json({
                success: true,
                user: userProfile
            });

        } catch (error: any) {
            // If we get here, BOTH failed.
            console.error('[FastAuth] All auth strategies failed.');

            let finalStatus = 500;
            let finalMsg = "Authentication failed. Unable to retrieve user profile.";

            if (error instanceof AggregateError) {
                // Check inner errors
                for (const e of error.errors) {
                    try {
                        const parsed = JSON.parse(e.message);
                        if (parsed.status === 403) {
                            finalStatus = 403;
                            finalMsg = "Permission Denied. User may not have 'SP_SCIM_User' capability.";
                            break;
                        }
                        if (parsed.status === 401) {
                            finalStatus = 401;
                            finalMsg = "Invalid Credentials.";
                            break;
                        }
                    } catch (jsonErr) {
                        // ignore parse error, use default
                    }
                }
            }

            return NextResponse.json({
                success: false,
                error: finalMsg
            }, { status: finalStatus });
        }

    } catch (error: any) {
        console.error('Profile fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
