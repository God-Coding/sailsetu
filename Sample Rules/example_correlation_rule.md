# Correlation Rule Example - Email-Based Correlation

**AI INSTRUCTION:** Use this example when user needs to correlate accounts to identities during aggregation using email address.  
**Source:** SailPoint examplerules.xml - Official Example

---

## Use This Pattern When:
- Correlating accounts by email address
- Matching during aggregation
- Preventing duplicate identities
- User asks to "correlate by email" or "match accounts"

---

## Official SailPoint Example:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule language='beanshell' name='Example Identity Email Correlation Rule'
      type='Correlation'>
  <Description>
   In this example we are going to use the new account's
   email address to try and locate an existing Identity
   to hang the new account from. This rule uses the email attribute
   on the identity object to attempt to find an owner
   for the incoming link.
  </Description>
  <Signature returnType='Map'>
    <Inputs>
      <Argument name='context'>
        <Description>
          A sailpoint.api.SailPointContext object that can be used to
          query the database to aid in correlation.
        </Description>
      </Argument>
      <Argument name='environment' type='Map'>
        <Description>
          Arguments passed to the aggregation task.
        </Description>
      </Argument>
      <Argument name='application'>
        <Description>
          Application being aggregated.
        </Description>
      </Argument>
      <Argument name='account'>
        <Description>
          A sailpoint.object.ResourceObject returned from the
          collector.
        </Description>
      </Argument>
      <Argument name='link'>
        <Description>
          Existing link to this account.
        </Description>
      </Argument>
    </Inputs>
    <Returns>
      <Argument name='identityName'>
        <Description>
          The name of an Identity object.
        </Description>
      </Argument>
      <Argument name='identity'>
        <Description>
          A fully resolved Identity object if the rule wants
          to do its own queries.
        </Description>
      </Argument>
      <Argument name='identityAttributeName'>
        <Description>
          The name of the extended attribute that can be used
          to locate an existing identity.
        </Description>
      </Argument>
      <Argument name='identityAttributeValue'>
        <Description>
          The value of the named extended attribute that can be used
          to locate an existing identity. This attribute is used
          together with the identityAttributeName argument.
        </Description>
      </Argument>
    </Returns>
  </Signature>
  <Source>
    <![CDATA[
    Map returnMap = new HashMap();

    String email = account.getStringAttribute("email");
    if ( email != null ) {
        returnMap.put("identityAttributeName", "email");
        returnMap.put("identityAttributeValue", email);
    }
    return returnMap;
    ]]>
  </Source>
</Rule>

</sailpoint>
```

---

## Key Points:
- **Type**: `Correlation` (REQUIRED for account correlation)
- **Inputs**: context, environment, application, account, link
- **Returns**: Map with identityAttributeName and identityAttributeValue
- **Pattern**: Extract attribute from account, return in Map
- **Common Attributes**: email, employeeNumber, username

---

**Source:** SailPoint IdentityIQ examplerules.xml (Official Example)
