# Application Cloner Feature

## Overview

The **Application Cloner** feature allows administrators to create duplicate copies of existing IdentityIQ applications with a new name. This is useful for:
- Creating test/dev versions of production applications
- Duplicating application templates
- Quick application setup based on existing configurations

## Architecture

### Components

1. **Frontend**: `app/app-cloner/page.tsx`
   - Source application dropdown (populated from SCIM API)
   - Target application name input field
   - Clone button with status feedback

2. **API Layer**:
   - **GET** `/api/app/list` - Fetches all applications
   - **POST** `/api/app/clone` - Triggers clone workflow

3. **Backend Workflow**: `xml/CloneApplication.xml`
   - Uses XML serialization for deep copy
   - Nullifies IDs to avoid Hibernate conflicts
   - Returns success/failure status with messages

---

## How It Works

### 1. Fetching Application List

**Endpoint**: `GET /api/app/list`

**Flow**:
```
Frontend → GET /api/app/list → SCIM API → /scim/v2/Applications
                                   ↓
                            Returns application list
```

**Code** (`app/api/app/list/route.ts`):
```typescript
const response = await fetch(`${iiqUrl}/scim/v2/Applications`, {
    method: "GET",
    headers: {
        "Authorization": `Basic ${auth}`,
        "Accept": "application/scim+json"
    }
});

const data = await response.json();
// Returns array from data.Resources
```

**Response**:
```json
[
  {
    "id": "c0a8012f...",
    "name": "TRAKK",
    "authoritative": true
  },
  ...
]
```

---

### 2. Cloning an Application

**Endpoint**: `POST /api/app/clone`

**Input Parameters**:
- `sourceAppName` (string) - Name of the application to clone
- `newAppName` (string) - Name for the new application

**Request Body**:
```json
{
  "sourceAppName": "TRAKK",
  "newAppName": "TRAKK_Test"
}
```

**Flow**:
```
Frontend → POST /api/app/clone → SCIM Workflow Launch
                                        ↓
                                CloneApplication workflow
                                        ↓
                                Returns status & message
```

**Code** (`app/api/app/clone/route.ts`):
```typescript
const payload = {
    schemas: [
        "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
        "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
    ],
    "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow": {
        workflowName: "CloneApplication",
        input: [
            { key: "sourceAppName", value: sourceAppName },
            { key: "newAppName", value: newAppName }
        ]
    }
};

const response = await fetch(`${iiqUrl}/scim/v2/LaunchedWorkflows`, {
    method: "POST",
    headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/scim+json"
    },
    body: JSON.stringify(payload)
});
```

**Response**:
```json
{
  "success": true,
  "workflowCaseId": "c0a8012f9c131624819c155068f3081e",
  "status": "Success",
  "message": "Successfully cloned 'TRAKK' to 'TRAKK_Test' (ID: c0a8012f...)",
  "data": { ... }
}
```

---

## Workflow Details

### CloneApplication Workflow (`xml/CloneApplication.xml`)

**Input Variables**:
- `sourceAppName` - Source application name
- `newAppName` - Target application name

**Output Variables**:
- `status` - "Success" or "Failure"
- `message` - Detailed result message

**Process**:
1. Validate input parameters
2. Fetch source application from database
3. Check if target name already exists
4. Serialize source application to XML
5. Parse XML to create new application object
6. Set new name and null the application ID
7. **Null all Schema IDs** to avoid Hibernate session conflicts
8. Save new application to database
9. Commit transaction and verify creation

**Key Code** (BeanShell):
```java
// XML Serialization for deep copy
String xml = source.toXml();
Application newApp = (Application) XMLObjectFactory.getInstance()
    .parseXml(context, xml, false);

newApp.setName(newAppName);
newApp.setId(null);

// Critical: Null Schema IDs to avoid Hibernate errors
List schemas = newApp.getSchemas();
if (schemas != null) {
    for (Object schemaObj : schemas) {
        Schema schema = (Schema) schemaObj;
        schema.setId(null);
    }
}

context.saveObject(newApp);
context.commitTransaction();
```

**Workflow Result Extraction**:
```typescript
// In API route
if (data.attributes && Array.isArray(data.attributes)) {
    const statusAttr = data.attributes.find((a: any) => a.key === "status");
    const messageAttr = data.attributes.find((a: any) => a.key === "message");
    
    status = statusAttr?.value || "Unknown";
    message = messageAttr?.value || "No message returned";
}
```

```

---

## Direct IIQ SCIM API Usage (Without Next.js Code)

If you want to call the CloneApplication workflow **directly via IIQ's SCIM API** without using our Next.js code, follow these examples:

### 1. Get All Applications (Direct SCIM)

**Endpoint**: `GET http://localhost:8080/identityiq/scim/v2/Applications`

**Postman Setup**:
1. **Method**: GET
2. **URL**: `http://localhost:8080/identityiq/scim/v2/Applications`
3. **Headers**:
   - `Authorization`: `Basic c3BhZG1pbjphZG1pbg==` (Base64 of `spadmin:admin`)
   - `Accept`: `application/scim+json`

**Raw Response**:
```json
{
  "totalResults": 3,
  "itemsPerPage": 3,
  "startIndex": 1,
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
  "Resources": [
    {
      "id": "c0a8012f9c131624819c1545697a07e6",
      "name": "TRAKK",
      "authoritative": true,
      "schemas": ["urn:ietf:params:scim:schemas:sailpoint:1.0:Application"]
    },
    {
      "id": "c0a8012f9c131624819c154569e507e7",
      "name": "Active Directory",
      "authoritative": false,
      "schemas": ["urn:ietf:params:scim:schemas:sailpoint:1.0:Application"]
    }
  ]
}
```

---

### 2. Launch CloneApplication Workflow (Direct SCIM)

**Endpoint**: `POST http://localhost:8080/identityiq/scim/v2/LaunchedWorkflows`

**Postman Setup**:

#### Tab: Authorization
- **Type**: Basic Auth
- **Username**: `spadmin`
- **Password**: `admin`

#### Tab: Headers
- `Content-Type`: `application/scim+json`
- `Accept`: `application/scim+json`

#### Tab: Body (raw - JSON)
```json
{
  "schemas": [
    "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
    "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
  ],
  "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow": {
    "workflowName": "CloneApplication",
    "input": [
      {
        "key": "sourceAppName",
        "value": "TRAKK"
      },
      {
        "key": "newAppName",
        "value": "TRAKK_Clone123"
      }
    ]
  }
}
```

**Success Response** (200 OK):
```json
{
  "id": "c0a8012f9c131624819c1566a0d90842",
  "launched": "2026-01-31T18:29:12.345Z",
  "launcher": "spadmin",
  "workflowName": "CloneApplication",
  "attributes": [
    {
      "key": "status",
      "value": "Success"
    },
    {
      "key": "message",
      "value": "Successfully cloned 'TRAKK' to 'TRAKK_Clone123' (ID: c0a8012f9c131624819c1566a0bc0841)"
    }
  ],
  "schemas": [
    "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
    "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
  ]
}
```

**Error Response - Application Exists**:
```json
{
  "id": "c0a8012f9c131624819c1566a1230845",
  "launched": "2026-01-31T18:30:15.123Z",
  "launcher": "spadmin",
  "workflowName": "CloneApplication",
  "attributes": [
    {
      "key": "status",
      "value": "Failure"
    },
    {
      "key": "message",
      "value": "Application 'TRAKK_Clone123' already exists (ID=c0a8012f9c131624819c1566a0bc0841)"
    }
  ],
  "schemas": [
    "urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow",
    "urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"
  ]
}
```

---

### Important SCIM Payload Notes

1. **schemas** array is **required** and must include both:
   - `urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow`
   - `urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult`

2. **Workflow-specific section** key must match exactly:
   - `urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow`

3. **input** must be an array of objects with `key` and `value` properties:
   ```json
   "input": [
     { "key": "param1", "value": "value1" },
     { "key": "param2", "value": "value2" }
   ]
   ```

4. **Workflow output** is returned in the `attributes` array - extract by matching the `key` field.

---

## Using with Postman (via Next.js API)

### 1. List All Applications

**Request**:
```
GET http://localhost:3000/api/app/list
```

**Headers**: None required

**Response**:
```json
[
  {
    "id": "c0a8012f9c131624819c1545697a07e6",
    "name": "TRAKK",
    "authoritative": true
  },
  {
    "id": "c0a8012f9c131624819c154569e507e7",
    "name": "Active Directory",
    "authoritative": false
  }
]
```

---

### 2. Clone an Application

**Request**:
```
POST http://localhost:3000/api/app/clone
Content-Type: application/json

{
  "sourceAppName": "TRAKK",
  "newAppName": "TRAKK_Dev"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "workflowCaseId": "c0a8012f9c131624819c155068f3081e",
  "status": "Success",
  "message": "Successfully cloned 'TRAKK' to 'TRAKK_Dev' (ID: c0a8012f9c131624819c155068d2081b)",
  "data": {
    "id": "c0a8012f9c131624819c155068f3081e",
    "schemas": [...],
    "attributes": [
      { "key": "status", "value": "Success" },
      { "key": "message", "value": "Successfully cloned..." }
    ]
  }
}
```

**Error Response - Missing Parameters** (400):
```json
{
  "error": "Missing sourceAppName or newAppName"
}
```

**Error Response - Application Exists** (200 with Failure):
```json
{
  "success": false,
  "status": "Failure",
  "message": "Application 'TRAKK_Dev' already exists (ID=c0a8012f...)"
}
```

**Error Response - Source Not Found** (200 with Failure):
```json
{
  "success": false,
  "status": "Failure",
  "message": "Source Application 'InvalidApp' not found."
}
```

---

## Terminal Logging

When the clone operation runs, detailed logs appear in the Next.js terminal:

```
[Clone] ====== Starting Clone Operation ======
[Clone] Source: TRAKK, Target: TRAKK_Dev
[Clone] Launching workflow at http://localhost:8080/identityiq/scim/v2/LaunchedWorkflows
[Clone] Workflow launched successfully - Case ID: c0a8012f9c131624819c155068f3081e
[Clone] Checking workflow output...
[Clone] Workflow Status: Success
[Clone] Workflow Message: Successfully cloned 'TRAKK' to 'TRAKK_Dev' (ID: c0a8012f...)
[Clone] ====== Clone Operation Complete ======
```

---

## Known Limitations

1. **Schemas Only**: Currently only clones the application and schemas. Other configurations like:
   - Provisioning policies
   - Account correlation configs
   - Management workflows
   - Templates
   
   Are not cloned to avoid Hibernate collection sharing errors.

2. **No Schema Content Cloning**: Schema structures are cloned but without detailed attribute definitions to avoid `AttributeDefinition` ID conflicts.

## Troubleshooting

### Issue: Empty Dropdown
- **Cause**: SCIM endpoint not returning applications
- **Fix**: Check IIQ is running at `http://localhost:8080/identityiq`

### Issue: "Shared references to a collection" Error
- **Cause**: Cloned object shares collection references with source
- **Fix**: Already handled by nullifying Schema IDs in workflow

### Issue: "Application already exists"
- **Cause**: Target application name is not unique
- **Fix**: Choose a different name or delete existing application first

---

## Files Modified/Created

- `xml/CloneApplication.xml` - SailPoint workflow
- `app/api/app/clone/route.ts` - Clone API endpoint
- `app/api/app/list/route.ts` - List applications endpoint
- `app/app-cloner/page.tsx` - Frontend UI
- `app/dashboard/page.tsx` - Added navigation card
