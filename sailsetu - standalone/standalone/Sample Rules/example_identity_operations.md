# Identity Operations Rule Examples

**Purpose:** Common patterns for working with the `Identity` object in SailPoint rules using standard API methods.

## Rule Structure

All these examples follow standard rule patterns with proper imports and context usage.

---

## Example 1: Count All Identities

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Count All Identities" language="beanshell">
  <Description>
    Counts the total number of Identity objects in the system.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.QueryOptions;
import sailpoint.object.Identity;
import sailpoint.tools.Util;
import java.util.Iterator;

// Search for all Identity objects
QueryOptions options = new QueryOptions();
Iterator iterator = context.search(Identity.class, options);

int count = 0;
while (iterator.hasNext()) {
    iterator.next();
    count++;
    // Memory optimization: clear object if needed, though simple counting implies we might just want count(class, qo)
    // context.decache(); 
}
Util.flushIterator(iterator);

return count;
    ]]>
  </Source>
</Rule>
</sailpoint>
```

---

## Example 2: Get Identity by Name

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Get Identity by Name" language="beanshell">
  <Description>
    Retrieves a specific identity by its unique name (spadmin, etc.).
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.Identity;

String targetName = "spadmin";

// Use getObjectByName convenience method
Identity identity = context.getObjectByName(Identity.class, targetName);

if (identity != null) {
    return "Found identity: " + identity.getDisplayName();
} else {
    return "Identity not found: " + targetName;
}
    ]]>
  </Source>
</Rule>
</sailpoint>
```

---

## Example 3: Search Identities by Attribute

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Search Identities by Attribute" language="beanshell">
  <Description>
    Finds all identities where 'department' is 'Sales'.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.QueryOptions;
import sailpoint.object.Identity;
import sailpoint.object.Filter;
import sailpoint.tools.Util;
import java.util.Iterator;
import java.util.ArrayList;
import java.util.List;

String deptValue = "Sales";

QueryOptions options = new QueryOptions();
options.addFilter(Filter.eq("department", deptValue));

Iterator iterator = context.search(Identity.class, options);
List names = new ArrayList();

while (iterator.hasNext()) {
    Identity id = (Identity) iterator.next();
    names.add(id.getName());
}
Util.flushIterator(iterator);

return names;
    ]]>
  </Source>
</Rule>
</sailpoint>
```

---

## Example 4: Get Links (Accounts) for Identity

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Get Identity Links" language="beanshell">
  <Description>
    Gets all account links associated with an identity.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.Identity;
import sailpoint.object.Link;
import java.util.List;
import java.util.ArrayList;

String identityName = "james.smith";
Identity identity = context.getObjectByName(Identity.class, identityName);

if (identity == null) {
    return "Identity not found";
}

// Get the list of links (accounts)
List links = identity.getLinks();
List appNames = new ArrayList();

if (links != null) {
    for (Link link : links) {
        // Each link belongs to an application
        appNames.add(link.getApplicationName());
    }
}

return appNames;
    ]]>
  </Source>
</Rule>
</sailpoint>
```

---

## Example 5: Update Identity Attribute

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Update Identity Attribute" language="beanshell">
  <Description>
    Updates the 'region' attribute of an identity.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.Identity;

String identityName = "james.smith";
Identity identity = context.getObjectByName(Identity.class, identityName);

if (identity != null) {
    // Set the attribute
    identity.setAttribute("region", "EMEA");
    
    // Save and commit always use this when dealing with commits
    context.saveObject(identity);
    context.commitTransaction();
    
    return "Updated region for " + identityName;
}

return "Identity not found";
    ]]>
  </Source>
</Rule>
</sailpoint>
```

---

## Example 6: Check Identity Capabilities

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Check Identity Capability" language="beanshell">
  <Description>
    Checks if an identity has the SystemAdministrator capability by iterating over assigned capabilities.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.Identity;
import sailpoint.object.Capability;
import java.util.List;
import java.util.Iterator;

String identityName = "spadmin";
String targetCapability = "SystemAdministrator";

Identity identity = context.getObjectByName(Identity.class, identityName);

if (identity != null) {
    boolean hasCap = false;
    List capabilities = identity.getCapabilities();
    
    if (capabilities != null) {
        for (Iterator it = capabilities.iterator(); it.hasNext(); ) {
            Capability cap = (Capability) it.next();
            if (targetCapability.equals(cap.getName())) {
                hasCap = true;
                break;
            }
        }
    }
    
    return hasCap ? "User has " + targetCapability : "User does NOT have " + targetCapability;
}

return "Identity not found";
    ]]>
  </Source>
</Rule>
</sailpoint>
```

---

## Example 7: Get Identity Bundles (Assigned Roles)

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Get Assigned Roles" language="beanshell">
  <Description>
    Retrieves the list of Bundles (Roles) assigned to an identity.
    Uses identity.getAssignedRoles().
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.Identity;
import sailpoint.object.Bundle;
import java.util.List;
import java.util.ArrayList;

String identityName = "james.smith";
Identity identity = context.getObjectByName(Identity.class, identityName);

List roleNames = new ArrayList();

if (identity != null) {
    // Get assigned roles
    List roles = identity.getAssignedRoles();
    
    if (roles != null) {
        for (Bundle role : roles) {
            roleNames.add(role.getName());
        }
    }
}

return roleNames;
    ]]>
  </Source>
</Rule>
</sailpoint>
```

---

## Example 8: Set Default Manager if Missing

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule name="Set Default Manager If Not Exists" language="beanshell">
  <Description>
    Checks if an identity has a manager assigned. If not, assigns a default manager (e.g., 'spadmin') and prevents the backtick syntax error.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.Identity;

String identityName = "Aaron.Nichols";
String defaultManagerName = "spadmin";

Identity identity = context.getObjectByName(Identity.class, identityName);

if (identity != null) {
    // Check if manager is missing (null)
    Identity manager = identity.getManager();
    if (manager == null) {
        
        // Load the default manager identity
        Identity spadmin = context.getObjectByName(Identity.class, defaultManagerName);
        
        if (spadmin != null) {
            identity.setManager(spadmin);
            
            context.saveObject(identity);
            context.commitTransaction();
            
            return "Assigned default manager to " + identityName;
        } else {
            return "Default manager identity not found: " + defaultManagerName;
        }
    }
    return "Manager already exists: " + manager.getName();
}

return "Identity not found: " + identityName;
    ]]>
  </Source>
</Rule>
</sailpoint>
```


