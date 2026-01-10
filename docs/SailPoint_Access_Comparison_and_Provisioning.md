# SailPoint Access Comparison & Provisioning Feature

## 1. Use Case Overview
The **Access Comparator** tool allows administrators/managers to:
1.  **Compare Access**: Visually compare the entitlements and roles of a "Source" identity (template) against a "Target" identity.
2.  **Identify Gaps**: Automatically highlight access that the Target user is missing (but Source has).
3.  **Clone/Mirror Access**: One-click provisioning to add the missing access to the Target user.

This replaces the manual effort of opening two identity cubes in IIQ and cross-referencing their entitlements line-by-line.

---

## 2. Technical Architecture

### Components Used
*   **Frontend**: Next.js 14+ (React) with Tailwind CSS for the UI.
*   **Intermediate API**: Next.js API Routes (`/api/workflow/launch`) acting as a proxy to handle CORS and auth.
*   **SailPoint Interface**: SCIM 2.0 API (`/scim/v2/LaunchedWorkflows`).
*   **Workflows**:
    1.  `GetIdentityAccess`: A custom workflow to fetch and serialize user access.
    2.  `LCM Provisioning`: The Out-of-the-Box (OOTB) workflow to handle access requests.

### Data Flow
1.  **User Search**: Frontend calls `/scim/v2/Users` to search and select identities.
2.  **Fetch Access**:
    *   Frontend calls `GetIdentityAccess` workflow via SCIM.
    *   Workflow executes BeanShell script to gather Roles, Entitlements, and Accounts.
    *   Workflow returns a **JSON String** representation of the access list.
3.  **Comparison**: Frontend JavaScript compares the two arrays and renders "Missing in Target" badges.
4.  **Provisioning**:
    *   User clicks "Copy Access".
    *   Frontend constructs a native **ProvisioningPlan XML string**.
    *   Frontend calls `LCM Provisioning` workflow via SCIM, passing the XML plan.
    *   SailPoint creates an Identity Request and starts the approval process.

---

## 3. Implementation Details

### A. Fetching Access (`GetIdentityAccess.xml`)
We created a custom workflow because the standard APIs return raw data that is hard to correlate (e.g., Link IDs vs Entitlement names). This workflow flattens everything into a simple structure.

**Key Syntax (BeanShell):**
```java
// 1. Get Identity
Identity id = context.getObjectByName(Identity.class, identityName);

// 2. Iterate Links (Accounts)
List links = id.getLinks();
if (links != null) {
    for (Link l : links) {
        // 3. Get Application & Entitlements
        String appName = l.getApplicationName();
        List entitlements = l.getEntitlements(null, null); // Native call to get granular entitlements
        
        // 4. Add to List
        Map item = new HashMap();
        item.put("type", "Entitlement");
        item.put("name", appName + " : " + entName);
        item.put("value", entValue);
        accessList.add(item);
    }
}

// 5. Serialize to JSON (Important for API delivery)
String json = sailpoint.tools.Util.toJson(accessList);
return json;
```

### B. Provisioning Access (Frontend Logic)
Instead of building a complex custom provisioning workflow, we leveraged the robust **LCM Provisioning** workflow. The trick is passing the `ProvisioningPlan` correctly.

**Problem**: The SCIM API difficultly handles complex nested JSON objects for Java classes like `ProvisioningPlan`.
**Solution**: We construct the **XML representation** of the plan on the client side and pass it as a raw string. SailPoint parses this automatically when the input variable is type `application/xml`.

**Syntax (TypeScript Helper):**
```typescript
const buildProvisioningPlanXML = (targetIdentity, requester, items) => {
    let accountRequests = "";
    
    items.forEach(item => {
        // Dynamically build AccountRequest for each missing item
        accountRequests += `
        <AccountRequest application="${item.appName}" op="Modify" nativeIdentity="${targetIdentity}">
            <AttributeRequest name="${item.attrName}" op="Add" value="${item.value}"/>
        </AccountRequest>`;
    });

    // Wrap in ProvisioningPlan envelope
    return `<ProvisioningPlan>
        ${accountRequests}
        <Attributes>
            <Map>
                <entry key="source" value="LCM"/>
                <entry key="requester" value="${requester}"/>
            </Map>
        </Attributes>
        <Requesters>
             <Reference class="sailpoint.object.Identity" name="${requester}"/>
        </Requesters>
    </ProvisioningPlan>`;
};
```

### C. The SCIM Payload
To launch the workflow, we hit `POST /scim/v2/LaunchedWorkflows`.
Crucially, we format the input as a **list of key-value pairs** with types.

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow"],
  "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow": {
    "workflowName": "LCM Provisioning",
    "input": [
      {
        "key": "plan",
        "value": "<ProvisioningPlan>...</ProvisioningPlan>",
        "type": "application/xml" 
      },
      {
        "key": "identityName",
        "value": "Amanda.Ross"
      },
      {
        "key": "flow",
        "value": "AccessRequest"
      }
    ]
  }
}
```
*Note: The `type: "application/xml"` tells SailPoint to interpret the string value as an object.*

---

## 4. SailPoint Interview Questions
Questions derived from this implementation experience:

### Q1: How do you bypass the limitations of passing complex Java Objects (like ProvisioningPlan) via the SCIM API?
**Answer**: You can serialize the object to its **XML representation** string. In the SCIM payload, pass this string as an input variable and explicitly set the `type` attribute to `application/xml`. The workflow engine deserializes it back into the native Java object (e.g., `ProvisioningPlan`).

### Q2: What is the difference between `Identity.getEntitlements()` and `Link.getEntitlements()`?
**Answer**: 
- `Identity.getEntitlements()` returns `IdentityItem` objects which are high-level groupings (detected roles). 
- `Link.getEntitlements()` returns the actual native permissions (granular entitlements) on the target application account. For accurate cloning, we usually need the granular `Link` entitlements.

### Q3: How do you handle "Lazy Loading" of Hibernate objects in BeanShell?
**Answer**: When traversing collections (like links or bundles) in a workflow rule, you must ensure the session is open. Sometimes accessing `identity.getLinks()` directly works, but deep properties might require re-attaching the object or using `context.getObjectByName` to ensure a fresh session. In our script, we simply ensured we iterated carefully and checked for nulls.

### Q4: Why use the `LCM Provisioning` workflow instead of a custom one with `Provisioner` API?
**Answer**: `LCM Provisioning` (Lifecycle Manager) handles much more than just provisioning. It handles:
- **Approvals**: Generates work items for managers/owners.
- **Notifications**: Emails relevant parties.
- **Auditing**: Creates an `IdentityRequest` object for tracking.
- **policy Checking**: Verifies SoD constraints.
Using the `Provisioner` API directly skips these critical governance steps.

### Q5: If a workflow variable is missing in the SCIM response, where should you look?
**Answer**: The SCIM response for a launched workflow has two main places for output:
1. The top-level `attributes` map (standard SCIM extension).
2. The `output` list inside the specific URN schema (`urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow`).
Always check both, as different versions of IdentityIQ or different workflow configurations may populate one or the other.

---

## 5. Troubleshooting & common Errors

| Error | Cause | Fix |
| :--- | :--- | :--- |
| **405 Method Not Allowed** | Using REST API (`/rest/workflows`) instead of SCIM. | Switch to SCIM (`/scim/v2/LaunchedWorkflows`). |
| **Resource Workflow null not found** | Workflow name typo or input structure invalid. | Ensure inputs are nested in the URN object, not at root. |
| **Missing required variable: plan** | Plan not passed or failed to parse. | Use `type: "application/xml"` in input map. |
| **Identity Request ID not found** | Workflow finished but didn't return ID. | Check `output` array in response for `identityRequestId`. |
