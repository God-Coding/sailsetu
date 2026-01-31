# Default Rule Template

**AI INSTRUCTION:** Use this template when NO specific example matches the user's requirements.  
**Purpose:** Provide basic rule structure with minimal pattern.

---

## Use This When:
- No specific example matches user's request
- User needs custom/unique logic
- Building a completely new pattern
- Fallback for unrecognized use cases

---

## Basic Rule Template:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule name="Custom Rule" language="beanshell">
  <Description>
    Custom rule description - explain what this rule does
  </Description>
  <Source>
    <![CDATA[
    import sailpoint.object.*;
    import sailpoint.api.SailPointContext;
    import java.util.*;
    
    // Custom logic here
    // Access common objects: context, log
    
    return null; // Return appropriate value
    ]]>
  </Source>
</Rule>

</sailpoint>
```

---

## Key Points:
- **NO type attribute** 
- **Minimal imports**: Add as needed
- **Return value**: Depends on use case
- **Add Signature**: If rule needs specific inputs/outputs

---

## If Rule Needs Type:

Refer to MANDATORY_rules_reference.md for valid types:
- Correlation
- BuildMap  
- IdentityAttribute
- FieldValue
- Refresh
- (etc.)

---

**Note:** Always check MANDATORY_rules_reference.md for valid types and structure!
