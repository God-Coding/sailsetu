module.exports=[24868,(e,t,r)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},93210,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),o=e.i(61916),n=e.i(74677),i=e.i(69741),l=e.i(16795),u=e.i(87718),p=e.i(95169),c=e.i(47587),d=e.i(66012),m=e.i(70101),h=e.i(26937),g=e.i(10372),f=e.i(93695);e.i(52474);var R=e.i(220),A=e.i(89171);async function y(e,t,r){if(!r.url||!r.username||!r.password||!e)throw Error("Missing parameters for workflow launch");let a=r.url.replace(/\/$/,""),s=`${a}/scim/v2/LaunchedWorkflows`,o=Buffer.from(`${r.username}:${r.password}`).toString("base64"),n={schemas:["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow","urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"],"urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow":{workflowName:e,input:Array.isArray(t)?t:Object.keys(t||{}).map(e=>{let r=t[e];return"object"==typeof r&&(r=JSON.stringify(r)),{key:e,value:r}})}};console.log(`[Launch Worklow] ${e} -> ${s}`);let i=await fetch(s,{method:"POST",headers:{Authorization:`Basic ${o}`,"Content-Type":"application/scim+json",Accept:"application/scim+json"},body:JSON.stringify(n)});if(!i.ok){let e=await i.text();throw Error(`SailPoint Error ${i.status}: ${e}`)}return{success:!0,launchResult:await i.json()}}var w=e.i(24868),E=e.i(14747),N=e.i(46786);let O="report_registry.json",T=E.default.join(N.default.tmpdir(),O),I=[T,"c:/Program Files/Apache Software Foundation/Tomcat 9.0/temp/"+O,E.default.join("C:/Temp",O)];async function v(e){try{let t=null;for(let e of I)try{if(await w.default.access(e),(await w.default.stat(e)).size>0){t=e;break}}catch{}if(!t){console.log("Registry missing in candidate paths. Triggering generation...");let r=await y("GetAllReportDefinitions",{},e);if(r.success&&r.launchResult){let e=null,t=r.launchResult,a=t["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow"],s=(e,t)=>e?.find(e=>e.key===t)?.value;if(a?.output&&(e=s(a.output,"reportList")),!e&&t.attributes&&(e=s(t.attributes,"reportList")),e){console.log("Successfully retrieved registry from Workflow Output!");try{let t="string"==typeof e?JSON.parse(e):e;return await w.default.writeFile(T,JSON.stringify(t,null,2)),t}catch(e){console.error("Error parsing/caching workflow output:",e)}}}for(let e=0;e<5;e++){for(let r of(console.log(`Polling for registry file (Attempt ${e+1}/5)...`),await new Promise(e=>setTimeout(e,2e3)),I))try{await w.default.access(r),t=r,console.log(`Found registry at: ${t}`);break}catch{}if(t)break}}if(!t)return console.warn("Registry file could not be found after generation."),[];{let e=await w.default.readFile(t,"utf-8");return JSON.parse(e)}}catch(e){return console.error("Error reading registry:",e),[]}}async function S(e,t){let r=process.env.AZURE_OPENAI_API_KEY,a=process.env.AZURE_OPENAI_ENDPOINT,s=process.env.AZURE_OPENAI_DEPLOYMENT,o=process.env.AZURE_OPENAI_API_VERSION;if(!r||!a||!s)throw Error("Missing Azure OpenAI configuration");let n=`You are an AI assistant for SailPoint IdentityIQ.
Your job is to map a user's natural language query to the correct OOTB Report (TaskDefinition).

Here is the Registry of available reports (Name, Description, Arguments):
${JSON.stringify(e).substring(0,3e4)}

Instructions:
1. Select the most appropriate Report Name from the registry.
2. Extract relevant arguments for that report based on the query.
3. **CRITICAL VALIDATION STEP**: 
   a. Look at the "arguments" array for your chosen report in the registry
   b. Check if the report HAS the parameter you want to use (e.g., "roles", "identity", "applications")
   c. If the parameter does NOT exist in that report's arguments, REJECT that report and find a different one
   d. Match BOTH the description AND the available arguments
   
   **Example Problem**: User asks "members of role Admins"
   - BAD: "Role Members Report" with {"roles": "Admins"} - this report has NO "roles" parameter!
   - GOOD: Find a report that actually accepts "roles" in its arguments array
   
4. Return ONLY a valid JSON object in this format:
   { "reportName": "Exact Task Name", "reportArgs": { "argName": "argValue" } }
5. If no report accepts the exact parameters, choose the closest match and leave reportArgs empty.

IMPORTANT PATTERNS:
- "who has access to **ROLE** X" → X is a BUSINESS ROLE/BUNDLE name, NOT an entitlement
  - Use "Identity Roles Report" with "identityRoles" parameter (NOT "roles"!)
  - Do NOT use "Identity Entitlements Detail Report" for role queries
- "who has access to X" or "members with X" (without "role" keyword) → X is an ENTITLEMENT name
  - Use "entitlementValue" or "entitlement" parameter
- "access for user Y" → Y is an IDENTITY name, use "identity" parameter  
- "members of group Z" → Z is a GROUP/WORKGROUP name, use "workgroup" or related parameter
- "on application A" → A is an APPLICATION name, use "application" parameter
- "who requested/raised/submitted access" → Use ACCESS REQUEST reports, not entitlement reports

ENTITLEMENT FORMAT (CRITICAL):
When you see entitlement names like "APP-attribute-value" (e.g., "TRAKK-capability-super"):
- This represents Application-Attribute-Value
- For "entitlements" parameter in Access Request reports, pass the FULL string as-is: "TRAKK-capability-super"
- Backend will parse and resolve it automatically

KEYWORD DETECTION (CRITICAL - CHECK THIS FIRST):
- Keywords "request", "requested", "raised", "submitted", "pending" → **ALWAYS** use "Access Request Status Report"
- Keywords "has access", "current", "members", "assigned", "entitlements for" → Use "Identity Entitlements Detail Report"
- Keywords "certification", "review", "certified" → Use "Access Review" reports

**PRIORITY RULE**: If query contains BOTH "request" AND "access", choose Access Request report, NOT entitlement report.
Example: "access requests for X" → Access Request Status Report (NOT Identity Entitlements Detail Report)

Examples:
1. Query: "who has access to Admin entitlement" 
   → { "reportName": "Identity Entitlements Detail Report", "reportArgs": { "entitlementValue": "Admin" } }

2. Query: "who has access to role Finance Approver"
   → { "reportName": "Identity Roles Report", "reportArgs": { "identityRoles": "Finance Approver" } }
   **IMPORTANT**: Use parameter "identityRoles" (NOT "roles") for role filtering!

3. Query: "who raised access request for Admin entitlement"
   → { "reportName": "Access Request Status Report", "reportArgs": {} }
   NOTE: Entitlement filtering in Access Request reports requires complex JSON format. 
   For now, return the full report without entitlement filter.

3. Query: "access for user John.Smith" 
   → { "reportName": "Identity Entitlements Detail Report", "reportArgs": { "identity": "John.Smith" } }

4. Query: "access requests by John.Smith"
   → { "reportName": "Access Request Status Report", "reportArgs": { "requestors": "John.Smith" } }

5. Query: "members of Finance group" 
   → { "reportName": "Identity Report", "reportArgs": { "workgroup": "Finance" } }

6. Query: "pending requests for application AD"
   → { "reportName": "Access Request Status Report", "reportArgs": { "applications": "AD", "status": "Pending" } }

7. Query: "give all entitlements for users John.Smith, Jane.Doe, Bob.Wilson"
   → { "reportName": "Identity Entitlements Detail Report", "reportArgs": { "identity": ["John.Smith", "Jane.Doe", "Bob.Wilson"] } }
   NOTE: Parse comma-separated or space-separated lists into arrays when report argument supports multi=true

8. Query: "access requests by users A, B, and C"
   → { "reportName": "Access Request Status Report", "reportArgs": { "requestors": ["A", "B", "C"] } }

MULTI-VALUE PARSING:
- When query contains "users X, Y, Z" or "identities A and B" or "applications P Q R", extract into an array
- Check registry to see if argument is multi=true before passing as array
- Common delimiters: commas, "and", "or", newlines, semicolons

If the argument expects an ID but you only have a name, just send the Name. The backend will resolve it.
If the report requires "identity" (singular) but the registry argument is "identities" (plural), preserve the registry name.

Return ONLY valid JSON, no markdown code blocks.`,i=`${a.replace(/\/$/,"")}/openai/deployments/${s}/chat/completions?api-version=${o}`,l=await fetch(i,{method:"POST",headers:{"Content-Type":"application/json","api-key":r},body:JSON.stringify({messages:[{role:"system",content:n},{role:"user",content:t}],max_tokens:500,temperature:.7})});if(!l.ok){let e=await l.text();throw Error(`Azure OpenAI Error ${l.status}: ${e}`)}let u=await l.json(),p=u.choices?.[0]?.message?.content;if(!p)throw Error("No response from Azure OpenAI");let c=p.replace(/```json/g,"").replace(/```/g,"").trim(),d=c.match(/\{[\s\S]*\}/);d&&(c=d[0]);try{return JSON.parse(c)}catch(e){throw console.error("Failed to parse AI response:",p),Error(`Failed to parse AI response: ${e.message}. Response was: ${p.substring(0,200)}`)}}async function b(e){try{let r,{query:a,url:s,username:o,password:n}=await e.json(),i={url:s,username:o,password:n},l=await v(i);if(!l||0===l.length)return A.NextResponse.json({message:"Initializing Report Registry... Please try again in 5 seconds."});let u=1,p=null;try{r=await S(l,a);let e=l.find(e=>e.name===r.reportName);if(e&&r.reportArgs&&Object.keys(r.reportArgs).length>0){var t;let s,o,n=(t=r.reportArgs,s=new Set(e.arguments?.map(e=>e.name)||[]),o=Object.keys(t).filter(e=>!s.has(e)),{valid:0===o.length,missingParams:o});if(p=n,!n.valid){console.log(`VALIDATION FAILED: Report "${r.reportName}" doesn't accept parameters: ${n.missingParams.join(", ")}`),console.log("Attempting SECOND PASS with filtered registry...");let e=Object.keys(r.reportArgs),t=l.filter(t=>{let r=new Set(t.arguments?.map(e=>e.name)||[]);return e.every(e=>r.has(e))});console.log(`Filtered registry from ${l.length} to ${t.length} reports that accept: ${e.join(", ")}`),t.length>0?(u=2,r=await S(t,a),console.log("SECOND PASS Decision:",r)):(console.log("No reports found that accept the required parameters. Using original decision with empty args."),r.reportArgs={})}}}catch(e){return console.error("Azure OpenAI failed",e),A.NextResponse.json({error:"AI Processing Failed: "+e.message},{status:500})}if(console.log("Final AI Decision:",r),!r||!r.reportName)return A.NextResponse.json({error:"AI could not find a matching report."},{status:400});let c=await y("LaunchOOTBReport",{reportName:r.reportName,reportArgs:JSON.stringify(r.reportArgs||{})},i);return A.NextResponse.json({...c,debug:{query:a,registryCount:l.length,registrySample:l.slice(0,3).map(e=>({name:e.name,args:e.arguments})),aiDecision:r,validationAttempts:u,validationResult:p}})}catch(e){return console.error("AI Route Error:",e),A.NextResponse.json({error:"Internal Server Error: "+e.message},{status:500})}}e.s(["POST",()=>b],75755);var P=e.i(75755);let C=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/ai-reports/route",pathname:"/api/ai-reports",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/ai-reports/route.ts",nextConfigOutput:"standalone",userland:P}),{workAsyncStorage:x,workUnitAsyncStorage:k,serverHooks:D}=C;function q(){return(0,a.patchFetch)({workAsyncStorage:x,workUnitAsyncStorage:k})}async function U(e,t,a){C.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let A="/api/ai-reports/route";A=A.replace(/\/index$/,"")||"/";let y=await C.prepare(e,t,{srcPage:A,multiZoneDraftMode:!1});if(!y)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:w,params:E,nextConfig:N,parsedUrl:O,isDraftMode:T,prerenderManifest:I,routerServerContext:v,isOnDemandRevalidate:S,revalidateOnlyGenerated:b,resolvedPathname:P,clientReferenceManifest:x,serverActionsManifest:k}=y,D=(0,i.normalizeAppPath)(A),q=!!(I.dynamicRoutes[D]||I.routes[P]),U=async()=>((null==v?void 0:v.render404)?await v.render404(e,t,O,!1):t.end("This page could not be found"),null);if(q&&!T){let e=!!I.routes[P],t=I.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(N.experimental.adapterPath)return await U();throw new f.NoFallbackError}}let L=null;!q||C.isDev||T||(L="/index"===(L=P)?"/":L);let $=!0===C.isDev||!q,j=q&&!$;k&&x&&(0,n.setManifestsSingleton)({page:A,clientReferenceManifest:x,serverActionsManifest:k});let _=e.method||"GET",F=(0,o.getTracer)(),H=F.getActiveScopeSpan(),M={params:E,prerenderManifest:I,renderOpts:{experimental:{authInterrupts:!!N.experimental.authInterrupts},cacheComponents:!!N.cacheComponents,supportsDynamicResponse:$,incrementalCache:(0,s.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:N.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>C.onRequestError(e,t,a,s,v)},sharedContext:{buildId:w}},J=new l.NodeNextRequest(e),B=new l.NodeNextResponse(t),K=u.NextRequestAdapter.fromNodeNextRequest(J,(0,u.signalFromNodeResponse)(t));try{let n=async e=>C.handle(K,M).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=F.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${_} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${_} ${A}`)}),i=!!(0,s.getRequestMeta)(e,"minimalMode"),l=async s=>{var o,l;let u=async({previousCacheEntry:r})=>{try{if(!i&&S&&b&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await n(s);e.fetchMetrics=M.renderOpts.fetchMetrics;let l=M.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let u=M.renderOpts.collectedTags;if(!q)return await (0,d.sendResponse)(J,B,o,M.renderOpts.pendingWaitUntil),null;{let e=await o.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(o.headers);u&&(t[g.NEXT_CACHE_TAGS_HEADER]=u),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=g.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,a=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=g.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await C.onRequestError(e,t,{routerKind:"App Router",routePath:A,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:S})},!1,v),t}},p=await C.handleResponse({req:e,nextConfig:N,cacheKey:L,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:I,isRoutePPREnabled:!1,isOnDemandRevalidate:S,revalidateOnlyGenerated:b,responseGenerator:u,waitUntil:a.waitUntil,isMinimalMode:i});if(!q)return null;if((null==p||null==(o=p.value)?void 0:o.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==p||null==(l=p.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});i||t.setHeader("x-nextjs-cache",S?"REVALIDATED":p.isMiss?"MISS":p.isStale?"STALE":"HIT"),T&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let f=(0,m.fromNodeOutgoingHttpHeaders)(p.value.headers);return i&&q||f.delete(g.NEXT_CACHE_TAGS_HEADER),!p.cacheControl||t.getHeader("Cache-Control")||f.get("Cache-Control")||f.set("Cache-Control",(0,h.getCacheControlHeader)(p.cacheControl)),await (0,d.sendResponse)(J,B,new Response(p.value.body,{headers:f,status:p.value.status||200})),null};H?await l(H):await F.withPropagatedContext(e.headers,()=>F.trace(p.BaseServerSpan.handleRequest,{spanName:`${_} ${A}`,kind:o.SpanKind.SERVER,attributes:{"http.method":_,"http.target":e.url}},l))}catch(t){if(t instanceof f.NoFallbackError||await C.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:S})},!1,v),q)throw t;return await (0,d.sendResponse)(J,B,new Response(null,{status:500})),null}}e.s(["handler",()=>U,"patchFetch",()=>q,"routeModule",()=>C,"serverHooks",()=>D,"workAsyncStorage",()=>x,"workUnitAsyncStorage",()=>k],93210)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__2798d876._.js.map