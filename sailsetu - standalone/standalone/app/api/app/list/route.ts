import { NextResponse } from "next/server";

export async function GET() {
    console.log("API: Fetching application list via SCIM...");
    try {
        const iiqUrl = "http://localhost:8080/identityiq";
        const auth = Buffer.from("spadmin:admin").toString("base64");

        // Use SCIM v2 API to fetch Applications
        const response = await fetch(`${iiqUrl}/scim/v2/Applications`, {
            method: "GET",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Accept": "application/scim+json"
            }
        });

        console.log("API: SCIM Response Status:", response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error("API: SCIM Error:", errText);
            return NextResponse.json({ error: "Failed to fetch apps from IIQ" }, { status: response.status });
        }

        const data = await response.json();
        console.log("API: SCIM response has Resources:", !!data.Resources);

        // SCIM returns results in a 'Resources' array
        if (data.Resources && Array.isArray(data.Resources)) {
            const apps = data.Resources.map((app: any) => ({
                id: app.id,
                name: app.name,
                authoritative: app.authoritative || false
            }));
            console.log(`API: Found ${apps.length} applications.`);
            return NextResponse.json(apps);
        } else {
            console.warn("API: No Resources in SCIM response:", JSON.stringify(data).substring(0, 200));
            return NextResponse.json([]);
        }

    } catch (error: any) {
        console.error("API: Exception:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
