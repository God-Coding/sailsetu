import { NextResponse } from 'next/server';
import { launchWorkflow } from '../../../lib/sailpoint/workflow'; // Fixed import path
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Path matching what we configured in Java (System.getProperty("java.io.tmpdir"))
// On Windows Tomcat, this usually resolves to %Temp% or a specific temp folder.
// Since Java and Node run on same localized environment here (c:\Program Files...), we check standard locations.
const REGISTRY_FILENAME = 'report_registry.json';
// Hardcoded path to ensure alignment with Backend (Tomcat)
const WIN_TEMP_PATH = 'c:/Program Files/Apache Software Foundation/Tomcat 9.0/temp/' + REGISTRY_FILENAME;
// Note: We bypass os.tmpdir to match the specific location Java is writing to.

async function getRegistry(config: any): Promise<any[]> {
    try {
        // Try OS temp first (where Java System.io.tmpdir usually points)
        // Also check Tomcat temp if predictable?
        // Let's assume standard behavior first.

        // We might need to find where exactly Java wrote it. 
        // For this environment, we'll try to read from the path we suspect.
        // If file doesn't exist, we trigger the workflow to create it.

        // Strategy: Check if file exists.
        // In local dev, we can just rely on the file potentially being there or triggering generation.

        // If file missing:
        try {
            await fs.access(WIN_TEMP_PATH);
        } catch {
            // File missing. Trigger generation.
            console.log("Registry missing. Triggering generation...");
            const launch = await launchWorkflow('GetAllReportDefinitions', {}, config);
            // We'd ideally wait here, but for now we'll fail fast or return empty to user saying "Initializing..."
            // Or we simple block for a few seconds.
            await new Promise(r => setTimeout(r, 4000));
        }

        const data = await fs.readFile(WIN_TEMP_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading registry:", e);
        return [];
    }
}

async function callAzureOpenAI(registry: any[], query: string) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

    if (!apiKey || !endpoint || !deployment) {
        throw new Error("Missing Azure OpenAI configuration");
    }

    const systemPrompt = `You are an AI assistant for SailPoint IdentityIQ.
Your job is to map a user's natural language query to the correct OOTB Report (TaskDefinition).

Here is the Registry of available reports (Name, Description, Arguments):
${JSON.stringify(registry).substring(0, 30000)}

Instructions:
1. Select the most appropriate Report Name from the registry.
2. Extract relevant arguments for that report based on the query.
3. **CRITICAL VALIDATION STEP**: 
   a. Look at the "arguments" array for your chosen report in the registry
   b. Check if the report HAS the parameter you want to use (e.g., "roles", "identity", "applications")
   c. If the parameter does NOT exist in that report's arguments, REJECT that report and find a different one
   d. Match BOTH the description AND the available arguments
   
   **Example Problem**: User asks "members of role Admins"
   - BAD: "Role Members Report" with {"roles": "Admins"} - this report has NO "roles" parameter!
   - GOOD: Find a report that actually accepts "roles" in its arguments array
   
4. Return ONLY a valid JSON object in this format:
   { "reportName": "Exact Task Name", "reportArgs": { "argName": "argValue" } }
5. If no report accepts the exact parameters, choose the closest match and leave reportArgs empty.

IMPORTANT PATTERNS:
- "who has access to **ROLE** X" → X is a BUSINESS ROLE/BUNDLE name, NOT an entitlement
  - Use "Identity Roles Report" with "identityRoles" parameter (NOT "roles"!)
  - Do NOT use "Identity Entitlements Detail Report" for role queries
- "who has access to X" or "members with X" (without "role" keyword) → X is an ENTITLEMENT name
  - Use "entitlementValue" or "entitlement" parameter
- "access for user Y" → Y is an IDENTITY name, use "identity" parameter  
- "members of group Z" → Z is a GROUP/WORKGROUP name, use "workgroup" or related parameter
- "on application A" → A is an APPLICATION name, use "application" parameter
- "who requested/raised/submitted access" → Use ACCESS REQUEST reports, not entitlement reports

ENTITLEMENT FORMAT (CRITICAL):
When you see entitlement names like "APP-attribute-value" (e.g., "TRAKK-capability-super"):
- This represents Application-Attribute-Value
- For "entitlements" parameter in Access Request reports, pass the FULL string as-is: "TRAKK-capability-super"
- Backend will parse and resolve it automatically

KEYWORD DETECTION (CRITICAL - CHECK THIS FIRST):
- Keywords "request", "requested", "raised", "submitted", "pending" → **ALWAYS** use "Access Request Status Report"
- Keywords "has access", "current", "members", "assigned", "entitlements for" → Use "Identity Entitlements Detail Report"
- Keywords "certification", "review", "certified" → Use "Access Review" reports

**PRIORITY RULE**: If query contains BOTH "request" AND "access", choose Access Request report, NOT entitlement report.
Example: "access requests for X" → Access Request Status Report (NOT Identity Entitlements Detail Report)

Examples:
1. Query: "who has access to Admin entitlement" 
   → { "reportName": "Identity Entitlements Detail Report", "reportArgs": { "entitlementValue": "Admin" } }

2. Query: "who has access to role Finance Approver"
   → { "reportName": "Identity Roles Report", "reportArgs": { "identityRoles": "Finance Approver" } }
   **IMPORTANT**: Use parameter "identityRoles" (NOT "roles") for role filtering!

3. Query: "who raised access request for Admin entitlement"
   → { "reportName": "Access Request Status Report", "reportArgs": {} }
   NOTE: Entitlement filtering in Access Request reports requires complex JSON format. 
   For now, return the full report without entitlement filter.

3. Query: "access for user John.Smith" 
   → { "reportName": "Identity Entitlements Detail Report", "reportArgs": { "identity": "John.Smith" } }

4. Query: "access requests by John.Smith"
   → { "reportName": "Access Request Status Report", "reportArgs": { "requestors": "John.Smith" } }

5. Query: "members of Finance group" 
   → { "reportName": "Identity Report", "reportArgs": { "workgroup": "Finance" } }

6. Query: "pending requests for application AD"
   → { "reportName": "Access Request Status Report", "reportArgs": { "applications": "AD", "status": "Pending" } }

7. Query: "give all entitlements for users John.Smith, Jane.Doe, Bob.Wilson"
   → { "reportName": "Identity Entitlements Detail Report", "reportArgs": { "identity": ["John.Smith", "Jane.Doe", "Bob.Wilson"] } }
   NOTE: Parse comma-separated or space-separated lists into arrays when report argument supports multi=true

8. Query: "access requests by users A, B, and C"
   → { "reportName": "Access Request Status Report", "reportArgs": { "requestors": ["A", "B", "C"] } }

MULTI-VALUE PARSING:
- When query contains "users X, Y, Z" or "identities A and B" or "applications P Q R", extract into an array
- Check registry to see if argument is multi=true before passing as array
- Common delimiters: commas, "and", "or", newlines, semicolons

If the argument expects an ID but you only have a name, just send the Name. The backend will resolve it.
If the report requires "identity" (singular) but the registry argument is "identities" (plural), preserve the registry name.

Return ONLY valid JSON, no markdown code blocks.`;

    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey
        },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ],
            max_tokens: 500,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI Error ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content;

    if (!text) {
        throw new Error("No response from Azure OpenAI");
    }


    // Clean up any markdown or extra text
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Try to extract JSON object if there's extra text
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleanText = jsonMatch[0];
    }

    try {
        return JSON.parse(cleanText);
    } catch (parseError: any) {
        console.error("Failed to parse AI response:", text);
        throw new Error(`Failed to parse AI response: ${parseError.message}. Response was: ${text.substring(0, 200)}`);
    }
}

// Validate that selected report accepts the parameters AI wants to pass
function validateReportParameters(report: any, proposedArgs: Record<string, any>): { valid: boolean, missingParams: string[] } {
    const validArgNames = new Set(report.arguments?.map((arg: any) => arg.name) || []);
    const proposedParamNames = Object.keys(proposedArgs);

    const missingParams = proposedParamNames.filter(param => !validArgNames.has(param));

    return {
        valid: missingParams.length === 0,
        missingParams
    };
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query, url, username, password } = body;

        const config = { url, username, password };

        // 1. Get Registry
        let registry = await getRegistry(config);
        if (!registry || registry.length === 0) {
            // Fallback or retry
            return NextResponse.json({ message: "Initializing Report Registry... Please try again in 5 seconds." });
        }

        // 2. Mock Logic vs Real Logic switch
        // If no key, fallback to mock? No, we have the key now.

        let decision: any;
        let validationAttempt = 1;
        let validationResult: any = null;

        try {
            // FIRST PASS: Let AI pick best report
            decision = await callAzureOpenAI(registry, query);

            // Validate that chosen report accepts the proposed parameters
            const selectedReport = registry.find(r => r.name === decision.reportName);
            if (selectedReport && decision.reportArgs && Object.keys(decision.reportArgs).length > 0) {
                const validation = validateReportParameters(selectedReport, decision.reportArgs);
                validationResult = validation;

                if (!validation.valid) {
                    console.log(`VALIDATION FAILED: Report "${decision.reportName}" doesn't accept parameters: ${validation.missingParams.join(', ')}`);
                    console.log('Attempting SECOND PASS with filtered registry...');

                    // SECOND PASS: Filter registry to only reports that accept the required parameters
                    const requiredParams = Object.keys(decision.reportArgs);
                    const filteredRegistry = registry.filter(report => {
                        const reportParams = new Set(report.arguments?.map((arg: any) => arg.name) || []);
                        // Check if report has ALL the required parameters
                        return requiredParams.every(param => reportParams.has(param));
                    });

                    console.log(`Filtered registry from ${registry.length} to ${filteredRegistry.length} reports that accept: ${requiredParams.join(', ')}`);

                    if (filteredRegistry.length > 0) {
                        validationAttempt = 2;
                        // Call AI again with filtered registry
                        decision = await callAzureOpenAI(filteredRegistry, query);
                        console.log('SECOND PASS Decision:', decision);
                    } else {
                        console.log('No reports found that accept the required parameters. Using original decision with empty args.');
                        decision.reportArgs = {}; // Clear invalid args
                    }
                }
            }

        } catch (err: any) {
            console.error("Azure OpenAI failed", err);
            return NextResponse.json({ error: "AI Processing Failed: " + err.message }, { status: 500 });
        }

        console.log("Final AI Decision:", decision);

        if (!decision || !decision.reportName) {
            return NextResponse.json({ error: "AI could not find a matching report." }, { status: 400 });
        }

        // 3. Launch Report
        const result = await launchWorkflow('LaunchOOTBReport', {
            reportName: decision.reportName,
            reportArgs: JSON.stringify(decision.reportArgs || {})
        }, config);

        // Add debug information
        return NextResponse.json({
            ...result,
            debug: {
                query: query,
                registryCount: registry.length,
                registrySample: registry.slice(0, 3).map(r => ({ name: r.name, args: r.arguments })),
                aiDecision: decision,
                validationAttempts: validationAttempt,
                validationResult: validationResult
            }
        });

    } catch (error: any) {
        console.error("AI Route Error:", error);
        return NextResponse.json({ error: "Internal Server Error: " + error.message }, { status: 500 });
    }
}
