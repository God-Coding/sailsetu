# Custom Task Rule Example - RuleExecutor Pattern

**AI INSTRUCTION:** Use this for custom scheduled tasks executed by RuleExecutor only used in task definitions.  
**Pattern:** NO type attribute, uses taskResult object

---

## Use This Pattern When:
- User needs custom scheduled task
- Data extraction, reports, bulk operations
- NOT a standard aggregation/refresh task
- User says "create a task to..." with custom logic

---

## Official Pattern:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">

<sailpoint>

<Rule name="Custom Task Rule" language="beanshell">
  <Description>
    Custom rule executed by RuleExecutor task.
    Uses taskResult object to report progress and store results.
  </Description>
  <Source>
    <![CDATA[
    import sailpoint.object.*;
    import sailpoint.api.TaskManager;
    import sailpoint.tools.Util;
    import java.util.*;
    
    //  taskResult object is automatically available
    taskResult.setProgress("Starting custom task...");
    
    // Your custom logic here
    // Query objects, process data, generate reports, etc.
    
    List results = new ArrayList();
    // ... processing logic ...
    
    // Update progress
    taskResult.setProgress("Processing complete");
    
    // Store results
    taskResult.setAttribute("processedCount", results.size());
    taskResult.setAttribute("results", results);
    
    // Set completion status
    taskResult.setCompletionStatus(TaskResult.CompletionStatus.Success);
    
    // Save and commit
    context.saveObject(taskResult);
    context.commitTransaction();
    
    return "Success";
    ]]>
  </Source>
</Rule>

</sailpoint>
```

---

## Key Points:
- **NO type attribute** 
- **taskResult** object automatically available
- **Use for**: Custom scheduled jobs, data extraction, reports
- **Progress**: Use `taskResult.setProgress()`
- **Results**: Store using `taskResult.setAttribute()`
- **Always**: Save taskResult and commit transaction

---

**Source:** SailPoint RuleExecutor Pattern
