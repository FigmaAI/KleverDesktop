Electron Security Warning (Insecure Content-Security-Policy) This renderer process has either no Content Security
  Policy set or a policy with "unsafe-eval" enabled. This exposes users of
  this app to unnecessary security risks.

For more information and help, consult
https://electronjs.org/docs/tutorial/security.
This warning will not show up
once the app is packaged.
warnAboutInsecureCSP @ VM4 sandbox_bundle:2
logSecurityWarnings @ VM4 sandbox_bundle:2
(anonymous) @ VM4 sandbox_bundle:2
App.tsx:35 [App] Setup check result: {success: true, setupComplete: true}
GitHubLink.tsx:21 Refused to connect to 'https://api.github.com/repos/FigmaAI/KleverDesktop' because it violates the following Content Security Policy directive: "connect-src 'self' http://localhost:* ws://localhost:*".

(anonymous) @ GitHubLink.tsx:21
commitHookEffectListMount @ chunk-WRD5HZVH.js?v=0b6430a1:16915
commitPassiveMountOnFiber @ chunk-WRD5HZVH.js?v=0b6430a1:18156
commitPassiveMountEffects_complete @ chunk-WRD5HZVH.js?v=0b6430a1:18129
commitPassiveMountEffects_begin @ chunk-WRD5HZVH.js?v=0b6430a1:18119
commitPassiveMountEffects @ chunk-WRD5HZVH.js?v=0b6430a1:18109
flushPassiveEffectsImpl @ chunk-WRD5HZVH.js?v=0b6430a1:19490
flushPassiveEffects @ chunk-WRD5HZVH.js?v=0b6430a1:19447
performSyncWorkOnRoot @ chunk-WRD5HZVH.js?v=0b6430a1:18868
flushSyncCallbacks @ chunk-WRD5HZVH.js?v=0b6430a1:9119
commitRootImpl @ chunk-WRD5HZVH.js?v=0b6430a1:19432
commitRoot @ chunk-WRD5HZVH.js?v=0b6430a1:19277
finishConcurrentRender @ chunk-WRD5HZVH.js?v=0b6430a1:18805
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=0b6430a1:18718
workLoop @ chunk-WRD5HZVH.js?v=0b6430a1:197
flushWork @ chunk-WRD5HZVH.js?v=0b6430a1:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=0b6430a1:384
Show 16 more frames
Show less
GitHubLink.tsx:21 Refused to connect to 'https://api.github.com/repos/FigmaAI/KleverDesktop' because it violates the document's Content Security Policy.
(anonymous) @ GitHubLink.tsx:21
commitHookEffectListMount @ chunk-WRD5HZVH.js?v=0b6430a1:16915
commitPassiveMountOnFiber @ chunk-WRD5HZVH.js?v=0b6430a1:18156
commitPassiveMountEffects_complete @ chunk-WRD5HZVH.js?v=0b6430a1:18129
commitPassiveMountEffects_begin @ chunk-WRD5HZVH.js?v=0b6430a1:18119
commitPassiveMountEffects @ chunk-WRD5HZVH.js?v=0b6430a1:18109
flushPassiveEffectsImpl @ chunk-WRD5HZVH.js?v=0b6430a1:19490
flushPassiveEffects @ chunk-WRD5HZVH.js?v=0b6430a1:19447
performSyncWorkOnRoot @ chunk-WRD5HZVH.js?v=0b6430a1:18868
flushSyncCallbacks @ chunk-WRD5HZVH.js?v=0b6430a1:9119
commitRootImpl @ chunk-WRD5HZVH.js?v=0b6430a1:19432
commitRoot @ chunk-WRD5HZVH.js?v=0b6430a1:19277
finishConcurrentRender @ chunk-WRD5HZVH.js?v=0b6430a1:18805
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=0b6430a1:18718
workLoop @ chunk-WRD5HZVH.js?v=0b6430a1:197
flushWork @ chunk-WRD5HZVH.js?v=0b6430a1:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=0b6430a1:384
Show 16 more frames
Show less
GitHubLink.tsx:30 Failed to fetch GitHub stars: TypeError: Failed to fetch
    at GitHubLink.tsx:21:5
    at commitHookEffectListMount (chunk-WRD5HZVH.js?v=0b6430a1:16915:34)
    at commitPassiveMountOnFiber (chunk-WRD5HZVH.js?v=0b6430a1:18156:19)
    at commitPassiveMountEffects_complete (chunk-WRD5HZVH.js?v=0b6430a1:18129:17)
    at commitPassiveMountEffects_begin (chunk-WRD5HZVH.js?v=0b6430a1:18119:15)
    at commitPassiveMountEffects (chunk-WRD5HZVH.js?v=0b6430a1:18109:11)
    at flushPassiveEffectsImpl (chunk-WRD5HZVH.js?v=0b6430a1:19490:11)
    at flushPassiveEffects (chunk-WRD5HZVH.js?v=0b6430a1:19447:22)
    at performSyncWorkOnRoot (chunk-WRD5HZVH.js?v=0b6430a1:18868:11)
    at flushSyncCallbacks (chunk-WRD5HZVH.js?v=0b6430a1:9119:30)
(anonymous) @ GitHubLink.tsx:30
Promise.catch
(anonymous) @ GitHubLink.tsx:29
commitHookEffectListMount @ chunk-WRD5HZVH.js?v=0b6430a1:16915
commitPassiveMountOnFiber @ chunk-WRD5HZVH.js?v=0b6430a1:18156
commitPassiveMountEffects_complete @ chunk-WRD5HZVH.js?v=0b6430a1:18129
commitPassiveMountEffects_begin @ chunk-WRD5HZVH.js?v=0b6430a1:18119
commitPassiveMountEffects @ chunk-WRD5HZVH.js?v=0b6430a1:18109
flushPassiveEffectsImpl @ chunk-WRD5HZVH.js?v=0b6430a1:19490
flushPassiveEffects @ chunk-WRD5HZVH.js?v=0b6430a1:19447
performSyncWorkOnRoot @ chunk-WRD5HZVH.js?v=0b6430a1:18868
flushSyncCallbacks @ chunk-WRD5HZVH.js?v=0b6430a1:9119
commitRootImpl @ chunk-WRD5HZVH.js?v=0b6430a1:19432
commitRoot @ chunk-WRD5HZVH.js?v=0b6430a1:19277
finishConcurrentRender @ chunk-WRD5HZVH.js?v=0b6430a1:18805
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=0b6430a1:18718
workLoop @ chunk-WRD5HZVH.js?v=0b6430a1:197
flushWork @ chunk-WRD5HZVH.js?v=0b6430a1:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=0b6430a1:384
Show 16 more frames
Show less
chunk-JJNU6I37.js?v=0b6430a1:417 `DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users.

If you want to hide the `DialogTitle`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/dialog