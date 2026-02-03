# Entitlement Operations Rule Examples

**Purpose:** Common patterns for working with entitlements and ManagedAttributes in SailPoint rules.



## Rule Structure

All these examples follow standard rule patterns with proper imports and context usage.

---

## Example 1: Count All Entitlement Definitions

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule name="Count All Entitlements" language="beanshell">
  <Description>
    Counts how many ManagedAttribute (entitlement definitions) exist in the system.
    Each ManagedAttribute represents one type of entitlement (e.g., AD Group, Role).
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.QueryOptions;
import sailpoint.object.*;
import sailpoint.tools.Util;
import java.util.*;

// Search for all ManagedAttribute objects
QueryOptions options = new QueryOptions();
Iterator iterator = context.search(ManagedAttribute.class, options);

int count = 0;
while (iterator.hasNext()) {
    iterator.next();
    count++;
}
Util.flushIterator(iterator);

return count;
    ]]>
  </Source>
</Rule>

</sailpoint>
```

---
## Example 2: Get Entitlements for Specific Application

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule name="Get Entitlements by Application" language="beanshell">
  <Description>
    Retrieves all ManagedAttribute objects for a specific application.
  </Description>
  <Signature>
    <Inputs>
      <Input name="applicationName" type="String"/>
    </Inputs>
    <Outputs>
      <Output name="entitlements" type="List"/>
    </Outputs>
  </Signature>
  <Source>
    <![CDATA[
import sailpoint.object.QueryOptions;
import sailpoint.object.*;
import sailpoint.tools.Util;
import java.util.*;

String appName = applicationName;  // Input parameter

    QueryOptions options = new QueryOptions();
    options.addFilter(Filter.eq("application.name", appName));

    Iterator iterator = context.search(ManagedAttribute.class, options);

    List entitlementInfo= new ArrayList();
    while (iterator.hasNext()) {
        ManagedAttribute ma = (ManagedAttribute) iterator.next();
        entitlementInfo.put("displayName", ma.getDisplayName());
        entitlementInfo.put("value", ma.getValue());
    entitlementInfo.put("description", ma.getDescription("en_US"));
    }
    Util.flushIterator(iterator);

    return entitlementInfo;
    ]]>
  </Source>
</Rule>

</sailpoint>
```

---

## Example 3: Extract User's Entitlements from Account

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule name="Extract Account Entitlements" type="IdentityAttribute" language="beanshell">
  <Description>
    Extracts entitlement values from a user's account (Link object).
    Commonly used in IdentityAttribute rules to map account groups to identity.
  </Description>
  <Signature>
    <Inputs>
      <Input name="identity" type="Identity"/>
      <Input name="link" type="Link"/>
    </Inputs>
    <Outputs>
      <Output name="attributeValue" type="Object"/>
    </Outputs>
  </Signature>
  <Source>
    <![CDATA[
import sailpoint.object.*;
import java.util.*;

// Get attributes from the account
    Attributes attrs = link.getAttributes();

    // Extract group memberships (common entitlement attribute)
    List groups = attrs.getList("memberOf");

    // You can also get single-valued entitlements
    // String role = attrs.getString("role");

    return groups;
    ]]>
  </Source>
</Rule>

</sailpoint>
```

---

## Example 4: Get All Entitlements for Specific Identity

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule name="Get Identity Entitlements" language="beanshell">
  <Description>
    Gets all entitlements assigned to a specific identity.
    Two-step process: 1) Get identity's links, 2) Get entitlements from each link.
  </Description>

  <Source>
    <![CDATA[
import sailpoint.object.*;
import sailpoint.tools.Util;
import java.util.*;

// Step 1: Get the identity by name
String identityName = "someIdentityName";
Identity identity = context.getObjectByName(Identity.class, identityName);
if (identity == null) {
    return null;
}

// Step 2: Get all links (accounts) for the identity
List links = identity.getLinks();
if (links == null) {
    return new ArrayList();
}

// Collect entitlements from each link
List entitlements = new ArrayList();
for (Link link : links) {
    List linkEntitlements = link.getEntitlements(Locale.getDefault(), "");
    if (linkEntitlements != null) {
        entitlements.addAll(linkEntitlements);
    }
}
List allEntitlementsAttributeVal = new ArrayList();
  for(Entitlement ent : entitlements){
    enVal = ent.getAttributeValue();
    allEntitlementsAttributeVal.add(enVal);
  }
return allEntitlementsAttributeVal;
  </Source>
</Rule>

</sailpoint>
```

---

## Example 5: Set Description for ManagedAttribute (Entitlement)

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule name="Set Description for Entitlement" language="beanshell">
  <Description>
    Sets the description field for a ManagedAttribute (entitlement definition) identified by application name and entitlement value.
    Update the variables 'applicationName', 'entitlementValue', and 'newDescription' as needed.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.*;
import sailpoint.object.Filter;
import sailpoint.object.QueryOptions;
import sailpoint.tools.Util;
import java.util.*;

// === USER INPUTS ===
String applicationName = "TRAKK"; // Set to target app name
String entitlementValue = "input"; // Set to target entitlement value
String newDescription = "NEW DESCRIPTION HERE"; // Set desired description

// Search for the ManagedAttribute matching app and value
QueryOptions options = new QueryOptions();
options.addFilter(Filter.eq("application.name", applicationName));
options.addFilter(Filter.eq("value", entitlementValue));

Iterator iterator = context.search(ManagedAttribute.class, options);

ManagedAttribute ma = null;
if (iterator.hasNext()) {
    ma = (ManagedAttribute) iterator.next();
}
Util.flushIterator(iterator);

if (ma != null) {
    ma.addDescription("en_US", newDescription);
    context.saveObject(ma);
    context.commitTransaction(); 
    return "Description updated for entitlement: " + entitlementValue;
} else {
    return "Entitlement not found: " + entitlementValue;
}
    ]]>
  </Source>
</Rule>

</sailpoint>
```

## Example 6: Set Owner for Entitlement "input"

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <Rule language='beanshell' type='Owner' name='Set Owner for Entitlement "input"'>
    <Description>
      Sets the owner of the ManagedAttribute (entitlement) with value "input".
      Looks up the entitlement, assigns a new owner Identity, and persists the change.
    </Description>
    <Source>
      <![CDATA[
import sailpoint.object.*;
import sailpoint.tools.Util;

String entitlementValue = "input";          // entitlement to update
String newOwnerName   = "spadmin";          // owner Identity name

// Find the ManagedAttribute by value (you could also search by name)
QueryOptions qo = new QueryOptions();
qo.addFilter(Filter.eq("value", entitlementValue));
Iterator iter = context.search(ManagedAttribute.class, qo);
ManagedAttribute ma = null;
if (iter.hasNext()) {
    ma = (ManagedAttribute) iter.next();
}
Util.flushIterator(iter);

if (ma != null) {
    Identity newOwner = context.getObjectByName(Identity.class, newOwnerName);
    if (newOwner != null) {
        ma.setOwner(newOwner);
        context.saveObject(ma);
        context.commitTransaction();
        log.debug("Owner set for entitlement '" + entitlementValue + "' to " + newOwnerName);
        return newOwner;
    } else {
        log.error("Owner identity not found: " + newOwnerName);
        return null;
    }
} else {
    log.error("Entitlement not found: " + entitlementValue);
    return null;
}
      ]]>
    </Source>
  </Rule>
</sailpoint>
```
---

## Example 7: Set requestable false for entitlement "input"

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <Rule language='beanshell' type='Provisioning' name='Set Requestable False for Entitlement "input"'>
    <Description>                                                                         
      Sets the requestable flag to false for a ManagedAttribute (entitlement) with value "input".
      This prevents users from requesting the entitlement via the UI.
    </Description>
    <Source>
      <![CDATA[
import sailpoint.object.*;
import sailpoint.tools.Util;

// entitlement value to update
String entitlementValue = "input";

// Find the ManagedAttribute by value
QueryOptions qo = new QueryOptions();
qo.addFilter(Filter.eq("value", entitlementValue));
Iterator iter = context.search(ManagedAttribute.class, qo);
ManagedAttribute ma = null;
if (iter.hasNext()) {
    ma = (ManagedAttribute) iter.next();
}
Util.flushIterator(iter);

if (ma != null) {
    // set requestable to false
    ma.setRequestable(false);
    context.saveObject(ma);
    context.commitTransaction();
    log.debug("Requestable set to false for entitlement '" + entitlementValue + "'");
    return "SUCCESS";
} else {
    log.error("Entitlement not found: " + entitlementValue);
    return "FAILURE";
}
      ]]>
    </Source>
  </Rule>
</sailpoint>
```
---
## Example 8: Get Members With Specific Entitlement

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <Rule name="Get Members With Specific Entitlement"
        language="beanshell"
        type="IdentityAttribute">
    <Description>
      Returns a List of identity names that have the entitlement value supplied via the hard‑coded variable.
      Implements the official SailPoint pattern: search identities, iterate links, use Link.getEntitlements(Locale, String).
    </Description>
    <Source>
      <![CDATA[
import sailpoint.object.*;
import sailpoint.tools.Util;
import java.util.*;
import java.util.Locale;

// *** CHANGE THIS TO THE ENTITLEMENT YOU WANT TO SEARCH FOR ***
String targetEntitlement = "YOUR_ENTITLEMENT_VALUE";

List members = new ArrayList();

QueryOptions qo = new QueryOptions();
Iterator identityIter = context.search(Identity.class, qo);

while (identityIter.hasNext()) {
    Identity identity = (Identity) identityIter.next();
    if (identity == null) continue;

    List links = identity.getLinks();
    if (links == null) continue;

    boolean hasEntitlement = false;
    for (Iterator li = links.iterator(); li.hasNext(); ) {
        Link link = (Link) li.next();
        List entitlements = link.getEntitlements(Locale.getDefault(), "");
        if (entitlements == null) continue;
        for (Iterator ei = entitlements.iterator(); ei.hasNext(); ) {
            Entitlement ent = (Entitlement) ei.next();
            Object val = ent.getAttributeValue();
            if (val != null) {
                if (val instanceof String && ((String) val).equals(targetEntitlement)) {
                    hasEntitlement = true;
                    break;
                }
                if (val instanceof Collection && ((Collection) val).contains(targetEntitlement)) {
                    hasEntitlement = true;
                    break;
                }
            }
        }
        if (hasEntitlement) break;
    }
    if (hasEntitlement) {
        members.add(identity.getName());
    }
}
Util.flushIterator(identityIter);
return members;
      ]]>
    </Source>
  </Rule>
</sailpoint>
```
---

## Example 9: Find Roles Granting Entitlement

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule language="beanshell" name="Find Roles Granting Entitlement">
  <Description>
    Uses official Bundle.getProfiles() method from JavaDoc.
    Searches role profiles and constraints for matching entitlements.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.*;
import sailpoint.tools.Util;
import java.util.*;

String targetApp = "TRAKK";
String targetAttr = "capability";
String targetValue = "input";

List matchingRoles = new ArrayList();

// Get Application object
Application app = context.getObjectByName(Application.class, targetApp);
if (app == null) {
    log.error("Application not found: " + targetApp);
    return matchingRoles;
}

// Search all bundles
QueryOptions qo = new QueryOptions();
Iterator iter = context.search(Bundle.class, qo);

while (iter.hasNext()) {
    Bundle bundle = (Bundle) iter.next();
    
    // Get profiles from bundle (official JavaDoc method)
    List profiles = bundle.getProfiles();
    
    if (profiles != null) {
        for (int i = 0; i < profiles.size(); i++) {
            Profile profile = (Profile) profiles.get(i);
            
            // Check if profile is for our target application
            Application profApp = profile.getApplication();
            if (profApp != null && targetApp.equals(profApp.getName())) {
                
                // Get constraints (filters) on this profile
                List constraints = profile.getConstraints();
                
                if (constraints != null) {
                    for (int j = 0; j < constraints.size(); j++) {
                        Filter constraint = (Filter) constraints.get(j);
                        
                        // Convert filter to string and check for our entitlement
                        String filterStr = constraint.toString();
                        
                        // Check if this filter references our attribute and value
                        if (filterStr.contains(targetAttr) && filterStr.contains(targetValue)) {
                            matchingRoles.add(bundle.getName());
                            log.debug("[MATCH] Role '" + bundle.getName() + "' grants " + targetValue);
                            break;
                        }
                    }
                }
            }
        }
    }
}

Util.flushIterator(iter);

log.debug("Total roles found: " + matchingRoles.size());
return matchingRoles;
    ]]>
  </Source>
</Rule>
</sailpoint>
```
---
## Example 10: Get Recently Modified Entitlements

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
<Rule language="beanshell" name="Get Recently Modified Entitlements">
  <Description>
    Fetches entitlements (ManagedAttributes) that have been modified in the last X days.
    Useful for auditing recent changes or syncing updates.
  </Description>
  <Source>
    <![CDATA[
import sailpoint.object.*;
import sailpoint.tools.Util;
import java.util.*;
import java.text.SimpleDateFormat;

// Configuration: Look back 7 days
int daysBack = 7;

// Calculate the cutoff date
Calendar cal = Calendar.getInstance();
cal.add(Calendar.DAY_OF_MONTH, -daysBack);
Date cutoffDate = cal.getTime();

log.debug("Searching for entitlements modified after: " + cutoffDate);

QueryOptions qo = new QueryOptions();
// Filter for 'modified' date greater than or equal to cutoff date
qo.addFilter(Filter.ge("modified", cutoffDate));
// Optional: Sort by modification date descending
qo.setOrderBy("modified");
qo.setOrderAscending(false);

Iterator iter = context.search(ManagedAttribute.class, qo);

List recentUpdates = new ArrayList();

while (iter.hasNext()) {
    ManagedAttribute ma = (ManagedAttribute) iter.next();
    Map info = new HashMap();
    info.put("value", ma.getValue());
    info.put("displayName", ma.getDisplayName());
    info.put("modified", ma.getModified());
    info.put("modifier", ma.getAmodifier()); // Who made the change
    
    recentUpdates.add(info);
}

Util.flushIterator(iter);

return recentUpdates;
    ]]>
  </Source>
</Rule>
</sailpoint>
```
---

## Key Patterns to Remember

### Searching for ManagedAttributes
```java
// Always use context.search() with QueryOptions
QueryOptions options = new QueryOptions();
Iterator iterator = context.search(ManagedAttribute.class, options);

// Loop through results
while (iterator.hasNext()) {
    ManagedAttribute ma = (ManagedAttribute) iterator.next();
    // Process each entitlement...
}

// ALWAYS flush the iterator
Util.flushIterator(iterator);
```

### Getting Attribute Values from Link (Account)
```java
// In rules where 'link' is provided
Attributes attrs = link.getAttributes();

// Multi-valued attributes (like groups)
List groups = attrs.getList("memberOf");

// Single-valued attributes
String role = attrs.getString("role");
```

### Filtering ManagedAttributes
```java
// By application
options.addFilter(Filter.eq("application.name", "Active Directory"));

// By type
options.addFilter(Filter.eq("type", "group"));

// By value (partial match)
options.addFilter(Filter.like("value", "%Admin%"));
```

