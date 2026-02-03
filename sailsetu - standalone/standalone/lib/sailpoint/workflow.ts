export async function launchWorkflow(workflowName: string, input: any, config: { url: string, username: string, password: string }) {
    if (!config.url || !config.username || !config.password || !workflowName) {
        throw new Error('Missing parameters for workflow launch');
    }

    const baseUrl = config.url.replace(/\/$/, '');
    const targetUrl = `${baseUrl}/scim/v2/LaunchedWorkflows`;
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    // Transform input object to SCIM format [{ key: k, value: v }]
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

    console.log(`[Launch Worklow] ${workflowName} -> ${targetUrl}`);

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
        throw new Error(`SailPoint Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
        success: true,
        launchResult: data
    };
}
