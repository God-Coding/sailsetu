module.exports=[24868,(e,t,r)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},93210,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),n=e.i(61916),o=e.i(74677),i=e.i(69741),l=e.i(16795),p=e.i(87718),u=e.i(95169),c=e.i(47587),d=e.i(66012),m=e.i(70101),h=e.i(26937),R=e.i(10372),g=e.i(93695);e.i(52474);var A=e.i(220),f=e.i(89171);async function y(e,t,r){if(!r.url||!r.username||!r.password||!e)throw Error("Missing parameters for workflow launch");let a=r.url.replace(/\/$/,""),s=`${a}/scim/v2/LaunchedWorkflows`,n=Buffer.from(`${r.username}:${r.password}`).toString("base64"),o={schemas:["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow","urn:ietf:params:scim:schemas:sailpoint:1.0:TaskResult"],"urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow":{workflowName:e,input:Array.isArray(t)?t:Object.keys(t||{}).map(e=>{let r=t[e];return"object"==typeof r&&(r=JSON.stringify(r)),{key:e,value:r}})}},i=await fetch(s,{method:"POST",headers:{Authorization:`Basic ${n}`,"Content-Type":"application/scim+json",Accept:"application/scim+json"},body:JSON.stringify(o)});if(!i.ok){let e=await i.text();throw Error(`SailPoint Error ${i.status}: ${e}`)}return{success:!0,launchResult:await i.json()}}var E=e.i(24868);let w="c:/Program Files/Apache Software Foundation/Tomcat 9.0/temp/report_registry.json";async function N(e){try{try{await E.default.access(w)}catch{await y("GetAllReportDefinitions",{},e),await new Promise(e=>setTimeout(e,4e3))}let t=await E.default.readFile(w,"utf-8");return JSON.parse(t)}catch(e){return console.error("Error reading registry:",e),[]}}async function O(e,t){let r=process.env.AZURE_OPENAI_API_KEY,a=process.env.AZURE_OPENAI_ENDPOINT,s=process.env.AZURE_OPENAI_DEPLOYMENT,n=process.env.AZURE_OPENAI_API_VERSION;if(!r||!a||!s)throw Error("Missing Azure OpenAI configuration");let o=`You are an AI assistant for SailPoint IdentityIQ.
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

Return ONLY valid JSON, no markdown code blocks.`,i=`${a.replace(/\/$/,"")}/openai/deployments/${s}/chat/completions?api-version=${n}`,l=await fetch(i,{method:"POST",headers:{"Content-Type":"application/json","api-key":r},body:JSON.stringify({messages:[{role:"system",content:o},{role:"user",content:t}],max_tokens:500,temperature:.7})});if(!l.ok){let e=await l.text();throw Error(`Azure OpenAI Error ${l.status}: ${e}`)}let p=await l.json(),u=p.choices?.[0]?.message?.content;if(!u)throw Error("No response from Azure OpenAI");let c=u.replace(/```json/g,"").replace(/```/g,"").trim(),d=c.match(/\{[\s\S]*\}/);d&&(c=d[0]);try{return JSON.parse(c)}catch(e){throw console.error("Failed to parse AI response:",u),Error(`Failed to parse AI response: ${e.message}. Response was: ${u.substring(0,200)}`)}}async function T(e){try{let r,{query:a,url:s,username:n,password:o}=await e.json(),i={url:s,username:n,password:o},l=await N(i);if(!l||0===l.length)return f.NextResponse.json({message:"Initializing Report Registry... Please try again in 5 seconds."});let p=1,u=null;try{r=await O(l,a);let e=l.find(e=>e.name===r.reportName);if(e&&r.reportArgs&&Object.keys(r.reportArgs).length>0){var t;let s,n,o=(t=r.reportArgs,s=new Set(e.arguments?.map(e=>e.name)||[]),n=Object.keys(t).filter(e=>!s.has(e)),{valid:0===n.length,missingParams:n});if(u=o,!o.valid){let e=Object.keys(r.reportArgs),t=l.filter(t=>{let r=new Set(t.arguments?.map(e=>e.name)||[]);return e.every(e=>r.has(e))});t.length>0?(p=2,r=await O(t,a)):r.reportArgs={}}}}catch(e){return console.error("Azure OpenAI failed",e),f.NextResponse.json({error:"AI Processing Failed: "+e.message},{status:500})}if(!r||!r.reportName)return f.NextResponse.json({error:"AI could not find a matching report."},{status:400});let c=await y("LaunchOOTBReport",{reportName:r.reportName,reportArgs:JSON.stringify(r.reportArgs||{})},i);return f.NextResponse.json({...c,debug:{query:a,registryCount:l.length,registrySample:l.slice(0,3).map(e=>({name:e.name,args:e.arguments})),aiDecision:r,validationAttempts:p,validationResult:u}})}catch(e){return console.error("AI Route Error:",e),f.NextResponse.json({error:"Internal Server Error: "+e.message},{status:500})}}e.s(["POST",()=>T],75755);var I=e.i(75755);let v=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/ai-reports/route",pathname:"/api/ai-reports",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/ai-reports/route.ts",nextConfigOutput:"standalone",userland:I}),{workAsyncStorage:S,workUnitAsyncStorage:b,serverHooks:C}=v;function P(){return(0,a.patchFetch)({workAsyncStorage:S,workUnitAsyncStorage:b})}async function x(e,t,a){v.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let f="/api/ai-reports/route";f=f.replace(/\/index$/,"")||"/";let y=await v.prepare(e,t,{srcPage:f,multiZoneDraftMode:!1});if(!y)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:E,params:w,nextConfig:N,parsedUrl:O,isDraftMode:T,prerenderManifest:I,routerServerContext:S,isOnDemandRevalidate:b,revalidateOnlyGenerated:C,resolvedPathname:P,clientReferenceManifest:x,serverActionsManifest:q}=y,k=(0,i.normalizeAppPath)(f),D=!!(I.dynamicRoutes[k]||I.routes[P]),U=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,O,!1):t.end("This page could not be found"),null);if(D&&!T){let e=!!I.routes[P],t=I.dynamicRoutes[k];if(t&&!1===t.fallback&&!e){if(N.experimental.adapterPath)return await U();throw new g.NoFallbackError}}let _=null;!D||v.isDev||T||(_="/index"===(_=P)?"/":_);let L=!0===v.isDev||!D,j=D&&!L;q&&x&&(0,o.setManifestsSingleton)({page:f,clientReferenceManifest:x,serverActionsManifest:q});let $=e.method||"GET",F=(0,n.getTracer)(),H=F.getActiveScopeSpan(),M={params:w,prerenderManifest:I,renderOpts:{experimental:{authInterrupts:!!N.experimental.authInterrupts},cacheComponents:!!N.cacheComponents,supportsDynamicResponse:L,incrementalCache:(0,s.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:N.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>v.onRequestError(e,t,a,s,S)},sharedContext:{buildId:E}},B=new l.NodeNextRequest(e),J=new l.NodeNextResponse(t),K=p.NextRequestAdapter.fromNodeNextRequest(B,(0,p.signalFromNodeResponse)(t));try{let o=async e=>v.handle(K,M).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=F.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${$} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${$} ${f}`)}),i=!!(0,s.getRequestMeta)(e,"minimalMode"),l=async s=>{var n,l;let p=async({previousCacheEntry:r})=>{try{if(!i&&b&&C&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await o(s);e.fetchMetrics=M.renderOpts.fetchMetrics;let l=M.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let p=M.renderOpts.collectedTags;if(!D)return await (0,d.sendResponse)(B,J,n,M.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(n.headers);p&&(t[R.NEXT_CACHE_TAGS_HEADER]=p),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=R.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,a=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=R.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:A.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await v.onRequestError(e,t,{routerKind:"App Router",routePath:f,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:b})},!1,S),t}},u=await v.handleResponse({req:e,nextConfig:N,cacheKey:_,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:I,isRoutePPREnabled:!1,isOnDemandRevalidate:b,revalidateOnlyGenerated:C,responseGenerator:p,waitUntil:a.waitUntil,isMinimalMode:i});if(!D)return null;if((null==u||null==(n=u.value)?void 0:n.kind)!==A.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(l=u.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});i||t.setHeader("x-nextjs-cache",b?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),T&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let g=(0,m.fromNodeOutgoingHttpHeaders)(u.value.headers);return i&&D||g.delete(R.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||g.get("Cache-Control")||g.set("Cache-Control",(0,h.getCacheControlHeader)(u.cacheControl)),await (0,d.sendResponse)(B,J,new Response(u.value.body,{headers:g,status:u.value.status||200})),null};H?await l(H):await F.withPropagatedContext(e.headers,()=>F.trace(u.BaseServerSpan.handleRequest,{spanName:`${$} ${f}`,kind:n.SpanKind.SERVER,attributes:{"http.method":$,"http.target":e.url}},l))}catch(t){if(t instanceof g.NoFallbackError||await v.onRequestError(e,t,{routerKind:"App Router",routePath:k,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:b})},!1,S),D)throw t;return await (0,d.sendResponse)(B,J,new Response(null,{status:500})),null}}e.s(["handler",()=>x,"patchFetch",()=>P,"routeModule",()=>v,"serverHooks",()=>C,"workAsyncStorage",()=>S,"workUnitAsyncStorage",()=>b],93210)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__2798d876._.js.map