# Leaver Access Cleanup - Feature Documentation

## 1. Feature Overview
The **Leaver Access Cleanup** feature identifies users who are marked as "Inactive" (or meet other criteria like `lastLogin > 90 days`) but still hold access (Entitlements or Roles) in target applications. It allows administrators to:
1.  **Scan**: Automatically detect these users and their residual access.
2.  **Report**: View a risk-prioritized list of access to be removed.
3.  **Revoke**: Execute a "Batch Revocation" process to remove access directly or via workitems.

## 2. Architecture & Data Flow

### A. Frontend (UI)
The UI (`app/leaver-cleanup/page.tsx`) aggregates access data and groups it by Identity. When "Execute Revocation" is clicked, it iterates through each user and calls the backend API.

### B. Backend API
**Endpoint**: `POST /api/workflow/launch`
**Function**: Acts as a bridge to IdentityIQ, launching the `ProvisionAccess` workflow.

### C. Workflow Input (The Contract)
The UI sends a payload to the workflow. Here is the exact structure:

**Workflow Name**: `ProvisionAccess`
**Input variables**:
1.  `identityName` (String): The IIQ Identity Name (e.g., "James.Smith").
2.  `approvalScheme` (String):
    *   `"none"`: Auto-approve (Direct Revocation).
    *   `"manager"` (or null): Create Workitems for manager approval.
3.  `accessItems` (String - JSON Array): A generic list of items to process.

#### `accessItems` JSON Structure
```json
[
  {
    "type": "entitlement",       // or "role"
    "application": "TRAKK",      // Target Application Name
    "name": "capability",        // Attribute Name (e.g., "capability" or "assignedRoles")
    "value": "accounting_read",  // Value to remove
    "op": "Remove"               // Operation
  }
]
```

## 3. Workflow Logic: `ProvisionAccess.xml`

1.  **Parsing**: The workflow parses the `accessItems` JSON string.
2.  **Identity Resolution**:
    *   It looks up the Identity object for `identityName`.
    *   It loops through the Identity's **Links** to find the account executing on `application` (e.g., "TRAKK").
    *   **Crucial Step**: It retrieves the `NativeIdentity` (Database ID, e.g., "1a") from that Link.
3.  **Request Creation**:
    *   It creates a `ProvisioningPlan` with an `AccountRequest`.
    *   Sets `NativeIdentity` to the ID found above (ensuring the target system knows *which* account to modify).
    *   Sets Operation to `Modify` / `Remove`.
4.  **Provisioning**:
    *   Calls `LCM Provisioning` to execute the plan.
    *   Assuming `approvalScheme="none"` and `optimisticProvisioning="false"`, it triggers the Connector immediately.
5.  **Rule Execution**:
    *   The JDBC Provisioning Rule (`TRAKK_Provisioning_Rule`) receives the request.
    *   It executes `DELETE FROM capabilities WHERE id=? AND capability=?`.

## 4. Workflow Return

The workflow returns the following variables to the API/UI:
*   `identityRequestId`: The ID of the request object created in IIQ (e.g., "10234").
*   `project`: The compilation of the provisioning plan (technical detail).

## 5. Postman Usage Guide

You can test this feature manually using Postman.

**Method**: `POST`
**URL**: `http://localhost:3000/api/workflow/launch` (or your server URL)
**Headers**:
*   `Content-Type`: `application/json`

**Body (Raw JSON)**:
```json
{
    "url": "http://localhost:8080/identityiq",
    "username": "spadmin",
    "password": "admin",
    "workflowName": "ProvisionAccess",
    "input": [
        {
            "key": "identityName",
            "value": "James.Smith"
        },
        {
            "key": "approvalScheme",
            "value": "none"
        },
        {
            "key": "accessItems",
            "value": "[{\"type\":\"entitlement\",\"application\":\"TRAKK\",\"name\":\"capability\",\"value\":\"accounting_read\",\"op\":\"Remove\"}]"
        }
    ]
}
```

### Explanation of Postman payload
*   We use the **Bridge API** (`/api/workflow/launch`) which expects `url/username/password` to authenticate with IIQ.
*   The `input` array maps directly to the workflow inputs defined in `ProvisionAccess.xml`.
*   Note that `accessItems` is passed as an **escaped JSON string** inside the value field, because workflows handle complex objects best as strings when passed via simple maps.
