const fetch = require('node-fetch'); // OR use global fetch if Node 18+

async function run() {
    const url = "http://localhost:3000/api/workflow/launch";
    const payload = {
        url: "http://localhost:8080/identityiq",
        username: "spadmin",
        password: "admin",
        workflowName: "InspectClass",
        input: {
            className: "sailpoint.object.CertificationEntity"
        }
    };

    try {
        console.log("Launching InspectClass for CertificationItem...");
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.success && data.launchResult) {
            const attrs = data.launchResult.attributes;
            let methods = "";
            if (Array.isArray(attrs)) {
                const mAttr = attrs.find(a => a.key === 'methods');
                if (mAttr) methods = mAttr.value;
            } else if (attrs && attrs.methods) {
                methods = attrs.methods;
            }
            
            const fs = require('fs');
            fs.writeFileSync('methods_list.txt', methods, 'utf8');
            console.log("Methods saved to methods_list.txt");
        } else {
            console.error("Workflow Failed:", JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error("Error running script:", e);
    }
}

run();
