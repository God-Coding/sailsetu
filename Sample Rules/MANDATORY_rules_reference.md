# MANDATORY: SailPoint Rule Types and Structure Reference

**AI INSTRUCTION:** This file contains ONLY valid SailPoint rule types and XML structure patterns.  
**YOU MUST use ONLY what is defined here. DO NOT invent custom types or attributes.**

---

## Valid Rule Types

Rules MUST have a `type` attribute set to ONE of these official SailPoint types:

### Identity Processing
- `IdentityAttribute` - Calculate identity attributes dynamically (email, display name, username)
- `FieldValue` - Populate form field values dynamically
- `ManagerCorrelation` - Determine an identity's manager

### Aggregation & Account Processing
- `Correlation` - Match aggregated accounts to existing identities
- `BuildMap` - Transform attributes during aggregation before Link storage
- `MergeMaps` - Merge data from multiple sources

### Provisioning
- `BeforeProvisioning` - Execute logic BEFORE provisioning starts
- `AfterProvisioning` - Execute logic AFTER provisioning completes

### Access Management
- `Owner` - Determine ownership of roles, entitlements, or objects
- `Approval` - Determine approvers for workflow steps
- `Validation` - Validate form input or policy compliance

### Special Cases
- **RuleExecutor Tasks**: Rules executed by `sailpoint.task.RuleExecutor` have **NO type attribute**
