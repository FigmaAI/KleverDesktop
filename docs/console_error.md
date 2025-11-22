Uncaught Error: useTerminal must be used within a TerminalProvider
    at useTerminal (useTerminal.tsx:13:11)
    at useIntegrationTest (useIntegrationTest.tsx:6:87)
    at SetupWizard (SetupWizard.tsx:51:7)
    at renderWithHooks (chunk-WRD5HZVH.js?v=d79f5f52:11548:26)
    at mountIndeterminateComponent (chunk-WRD5HZVH.js?v=d79f5f52:14926:21)
    at beginWork (chunk-WRD5HZVH.js?v=d79f5f52:15914:22)
    at HTMLUnknownElement.callCallback2 (chunk-WRD5HZVH.js?v=d79f5f52:3674:22)
    at Object.invokeGuardedCallbackDev (chunk-WRD5HZVH.js?v=d79f5f52:3699:24)
    at invokeGuardedCallback (chunk-WRD5HZVH.js?v=d79f5f52:3733:39)
    at beginWork$1 (chunk-WRD5HZVH.js?v=d79f5f52:19765:15)
useTerminal @ useTerminal.tsx:13
useIntegrationTest @ useIntegrationTest.tsx:6
SetupWizard @ SetupWizard.tsx:51
renderWithHooks @ chunk-WRD5HZVH.js?v=d79f5f52:11548
mountIndeterminateComponent @ chunk-WRD5HZVH.js?v=d79f5f52:14926
beginWork @ chunk-WRD5HZVH.js?v=d79f5f52:15914
callCallback2 @ chunk-WRD5HZVH.js?v=d79f5f52:3674
invokeGuardedCallbackDev @ chunk-WRD5HZVH.js?v=d79f5f52:3699
invokeGuardedCallback @ chunk-WRD5HZVH.js?v=d79f5f52:3733
beginWork$1 @ chunk-WRD5HZVH.js?v=d79f5f52:19765
performUnitOfWork @ chunk-WRD5HZVH.js?v=d79f5f52:19198
workLoopSync @ chunk-WRD5HZVH.js?v=d79f5f52:19137
renderRootSync @ chunk-WRD5HZVH.js?v=d79f5f52:19116
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=d79f5f52:18678
workLoop @ chunk-WRD5HZVH.js?v=d79f5f52:197
flushWork @ chunk-WRD5HZVH.js?v=d79f5f52:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=d79f5f52:384
Show 14 more frames
Show less
useTerminal.tsx:13 Uncaught Error: useTerminal must be used within a TerminalProvider
    at useTerminal (useTerminal.tsx:13:11)
    at useIntegrationTest (useIntegrationTest.tsx:6:87)
    at SetupWizard (SetupWizard.tsx:51:7)
    at renderWithHooks (chunk-WRD5HZVH.js?v=d79f5f52:11548:26)
    at mountIndeterminateComponent (chunk-WRD5HZVH.js?v=d79f5f52:14926:21)
    at beginWork (chunk-WRD5HZVH.js?v=d79f5f52:15914:22)
    at HTMLUnknownElement.callCallback2 (chunk-WRD5HZVH.js?v=d79f5f52:3674:22)
    at Object.invokeGuardedCallbackDev (chunk-WRD5HZVH.js?v=d79f5f52:3699:24)
    at invokeGuardedCallback (chunk-WRD5HZVH.js?v=d79f5f52:3733:39)
    at beginWork$1 (chunk-WRD5HZVH.js?v=d79f5f52:19765:15)
useTerminal @ useTerminal.tsx:13
useIntegrationTest @ useIntegrationTest.tsx:6
SetupWizard @ SetupWizard.tsx:51
renderWithHooks @ chunk-WRD5HZVH.js?v=d79f5f52:11548
mountIndeterminateComponent @ chunk-WRD5HZVH.js?v=d79f5f52:14926
beginWork @ chunk-WRD5HZVH.js?v=d79f5f52:15914
callCallback2 @ chunk-WRD5HZVH.js?v=d79f5f52:3674
invokeGuardedCallbackDev @ chunk-WRD5HZVH.js?v=d79f5f52:3699
invokeGuardedCallback @ chunk-WRD5HZVH.js?v=d79f5f52:3733
beginWork$1 @ chunk-WRD5HZVH.js?v=d79f5f52:19765
performUnitOfWork @ chunk-WRD5HZVH.js?v=d79f5f52:19198
workLoopSync @ chunk-WRD5HZVH.js?v=d79f5f52:19137
renderRootSync @ chunk-WRD5HZVH.js?v=d79f5f52:19116
recoverFromConcurrentError @ chunk-WRD5HZVH.js?v=d79f5f52:18736
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=d79f5f52:18684
workLoop @ chunk-WRD5HZVH.js?v=d79f5f52:197
flushWork @ chunk-WRD5HZVH.js?v=d79f5f52:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=d79f5f52:384
Show 15 more frames
Show less
chunk-WRD5HZVH.js?v=d79f5f52:14032 The above error occurred in the <SetupWizard> component:

    at SetupWizard (http://localhost:5173/src/pages/SetupWizard.tsx:38:41)
    at RenderedRoute (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:4108:5)
    at Routes (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:4578:5)
    at App (http://localhost:5173/src/App.tsx:31:45)
    at Router (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:4521:15)
    at HashRouter (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:5303:5)

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
logCapturedError @ chunk-WRD5HZVH.js?v=d79f5f52:14032
update.callback @ chunk-WRD5HZVH.js?v=d79f5f52:14052
callCallback @ chunk-WRD5HZVH.js?v=d79f5f52:11248
commitUpdateQueue @ chunk-WRD5HZVH.js?v=d79f5f52:11265
commitLayoutEffectOnFiber @ chunk-WRD5HZVH.js?v=d79f5f52:17093
commitLayoutMountEffects_complete @ chunk-WRD5HZVH.js?v=d79f5f52:17980
commitLayoutEffects_begin @ chunk-WRD5HZVH.js?v=d79f5f52:17969
commitLayoutEffects @ chunk-WRD5HZVH.js?v=d79f5f52:17920
commitRootImpl @ chunk-WRD5HZVH.js?v=d79f5f52:19353
commitRoot @ chunk-WRD5HZVH.js?v=d79f5f52:19277
finishConcurrentRender @ chunk-WRD5HZVH.js?v=d79f5f52:18760
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=d79f5f52:18718
workLoop @ chunk-WRD5HZVH.js?v=d79f5f52:197
flushWork @ chunk-WRD5HZVH.js?v=d79f5f52:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=d79f5f52:384
Show 15 more frames
Show less
chunk-WRD5HZVH.js?v=d79f5f52:19413 Uncaught Error: useTerminal must be used within a TerminalProvider
    at useTerminal (useTerminal.tsx:13:11)
    at useIntegrationTest (useIntegrationTest.tsx:6:87)
    at SetupWizard (SetupWizard.tsx:51:7)
    at renderWithHooks (chunk-WRD5HZVH.js?v=d79f5f52:11548:26)
    at mountIndeterminateComponent (chunk-WRD5HZVH.js?v=d79f5f52:14926:21)
    at beginWork (chunk-WRD5HZVH.js?v=d79f5f52:15914:22)
    at beginWork$1 (chunk-WRD5HZVH.js?v=d79f5f52:19753:22)
    at performUnitOfWork (chunk-WRD5HZVH.js?v=d79f5f52:19198:20)
    at workLoopSync (chunk-WRD5HZVH.js?v=d79f5f52:19137:13)
    at renderRootSync (chunk-WRD5HZVH.js?v=d79f5f52:19116:15)
useTerminal @ useTerminal.tsx:13
useIntegrationTest @ useIntegrationTest.tsx:6
SetupWizard @ SetupWizard.tsx:51
renderWithHooks @ chunk-WRD5HZVH.js?v=d79f5f52:11548
mountIndeterminateComponent @ chunk-WRD5HZVH.js?v=d79f5f52:14926
beginWork @ chunk-WRD5HZVH.js?v=d79f5f52:15914
beginWork$1 @ chunk-WRD5HZVH.js?v=d79f5f52:19753
performUnitOfWork @ chunk-WRD5HZVH.js?v=d79f5f52:19198
workLoopSync @ chunk-WRD5HZVH.js?v=d79f5f52:19137
renderRootSync @ chunk-WRD5HZVH.js?v=d79f5f52:19116
recoverFromConcurrentError @ chunk-WRD5HZVH.js?v=d79f5f52:18736
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=d79f5f52:18684
workLoop @ chunk-WRD5HZVH.js?v=d79f5f52:197
flushWork @ chunk-WRD5HZVH.js?v=d79f5f52:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=d79f5f52:384
Show 12 more frames
Show less
App.tsx?t=1763806944434:47 [App] Setup check result: {success: true, setupComplete: false}
useTerminal.tsx:13 Uncaught Error: useTerminal must be used within a TerminalProvider
    at useTerminal (useTerminal.tsx:13:11)
    at useIntegrationTest (useIntegrationTest.tsx:6:87)
    at SetupWizard (SetupWizard.tsx:51:7)
    at renderWithHooks (chunk-WRD5HZVH.js?v=d79f5f52:11548:26)
    at mountIndeterminateComponent (chunk-WRD5HZVH.js?v=d79f5f52:14926:21)
    at beginWork (chunk-WRD5HZVH.js?v=d79f5f52:15914:22)
    at HTMLUnknownElement.callCallback2 (chunk-WRD5HZVH.js?v=d79f5f52:3674:22)
    at Object.invokeGuardedCallbackDev (chunk-WRD5HZVH.js?v=d79f5f52:3699:24)
    at invokeGuardedCallback (chunk-WRD5HZVH.js?v=d79f5f52:3733:39)
    at beginWork$1 (chunk-WRD5HZVH.js?v=d79f5f52:19765:15)
useTerminal @ useTerminal.tsx:13
useIntegrationTest @ useIntegrationTest.tsx:6
SetupWizard @ SetupWizard.tsx:51
renderWithHooks @ chunk-WRD5HZVH.js?v=d79f5f52:11548
mountIndeterminateComponent @ chunk-WRD5HZVH.js?v=d79f5f52:14926
beginWork @ chunk-WRD5HZVH.js?v=d79f5f52:15914
callCallback2 @ chunk-WRD5HZVH.js?v=d79f5f52:3674
invokeGuardedCallbackDev @ chunk-WRD5HZVH.js?v=d79f5f52:3699
invokeGuardedCallback @ chunk-WRD5HZVH.js?v=d79f5f52:3733
beginWork$1 @ chunk-WRD5HZVH.js?v=d79f5f52:19765
performUnitOfWork @ chunk-WRD5HZVH.js?v=d79f5f52:19198
workLoopSync @ chunk-WRD5HZVH.js?v=d79f5f52:19137
renderRootSync @ chunk-WRD5HZVH.js?v=d79f5f52:19116
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=d79f5f52:18678
workLoop @ chunk-WRD5HZVH.js?v=d79f5f52:197
flushWork @ chunk-WRD5HZVH.js?v=d79f5f52:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=d79f5f52:384
Show 14 more frames
Show less
useTerminal.tsx:13 Uncaught Error: useTerminal must be used within a TerminalProvider
    at useTerminal (useTerminal.tsx:13:11)
    at useIntegrationTest (useIntegrationTest.tsx:6:87)
    at SetupWizard (SetupWizard.tsx:51:7)
    at renderWithHooks (chunk-WRD5HZVH.js?v=d79f5f52:11548:26)
    at mountIndeterminateComponent (chunk-WRD5HZVH.js?v=d79f5f52:14926:21)
    at beginWork (chunk-WRD5HZVH.js?v=d79f5f52:15914:22)
    at HTMLUnknownElement.callCallback2 (chunk-WRD5HZVH.js?v=d79f5f52:3674:22)
    at Object.invokeGuardedCallbackDev (chunk-WRD5HZVH.js?v=d79f5f52:3699:24)
    at invokeGuardedCallback (chunk-WRD5HZVH.js?v=d79f5f52:3733:39)
    at beginWork$1 (chunk-WRD5HZVH.js?v=d79f5f52:19765:15)
useTerminal @ useTerminal.tsx:13
useIntegrationTest @ useIntegrationTest.tsx:6
SetupWizard @ SetupWizard.tsx:51
renderWithHooks @ chunk-WRD5HZVH.js?v=d79f5f52:11548
mountIndeterminateComponent @ chunk-WRD5HZVH.js?v=d79f5f52:14926
beginWork @ chunk-WRD5HZVH.js?v=d79f5f52:15914
callCallback2 @ chunk-WRD5HZVH.js?v=d79f5f52:3674
invokeGuardedCallbackDev @ chunk-WRD5HZVH.js?v=d79f5f52:3699
invokeGuardedCallback @ chunk-WRD5HZVH.js?v=d79f5f52:3733
beginWork$1 @ chunk-WRD5HZVH.js?v=d79f5f52:19765
performUnitOfWork @ chunk-WRD5HZVH.js?v=d79f5f52:19198
workLoopSync @ chunk-WRD5HZVH.js?v=d79f5f52:19137
renderRootSync @ chunk-WRD5HZVH.js?v=d79f5f52:19116
recoverFromConcurrentError @ chunk-WRD5HZVH.js?v=d79f5f52:18736
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=d79f5f52:18684
workLoop @ chunk-WRD5HZVH.js?v=d79f5f52:197
flushWork @ chunk-WRD5HZVH.js?v=d79f5f52:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=d79f5f52:384
Show 15 more frames
Show less
chunk-WRD5HZVH.js?v=d79f5f52:14032 The above error occurred in the <SetupWizard> component:

    at SetupWizard (http://localhost:5173/src/pages/SetupWizard.tsx:38:41)
    at RenderedRoute (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:4108:5)
    at Routes (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:4578:5)
    at App (http://localhost:5173/src/App.tsx?t=1763806944434:31:45)
    at Router (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:4521:15)
    at HashRouter (http://localhost:5173/node_modules/.vite/deps/react-router-dom.js?v=d79f5f52:5303:5)

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
logCapturedError @ chunk-WRD5HZVH.js?v=d79f5f52:14032
update.callback @ chunk-WRD5HZVH.js?v=d79f5f52:14052
callCallback @ chunk-WRD5HZVH.js?v=d79f5f52:11248
commitUpdateQueue @ chunk-WRD5HZVH.js?v=d79f5f52:11265
commitLayoutEffectOnFiber @ chunk-WRD5HZVH.js?v=d79f5f52:17093
commitLayoutMountEffects_complete @ chunk-WRD5HZVH.js?v=d79f5f52:17980
commitLayoutEffects_begin @ chunk-WRD5HZVH.js?v=d79f5f52:17969
commitLayoutEffects @ chunk-WRD5HZVH.js?v=d79f5f52:17920
commitRootImpl @ chunk-WRD5HZVH.js?v=d79f5f52:19353
commitRoot @ chunk-WRD5HZVH.js?v=d79f5f52:19277
finishConcurrentRender @ chunk-WRD5HZVH.js?v=d79f5f52:18760
performConcurrentWorkOnRoot @ chunk-WRD5HZVH.js?v=d79f5f52:18718
workLoop @ chunk-WRD5HZVH.js?v=d79f5f52:197
flushWork @ chunk-WRD5HZVH.js?v=d79f5f52:176
performWorkUntilDeadline @ chunk-WRD5HZVH.js?v=d79f5f52:384
Show 15 more frames
Show less
chunk-WRD5HZVH.js?v=d79f5f52:19413 Uncaught Error: useTerminal must be used within a TerminalProvider
    at useTerminal (useTerminal.tsx:13:11)
    at useIntegrationTest (useIntegrationTest.tsx:6:87)
    at SetupWizard (SetupWizard.tsx:51:7)
    at renderWithHooks (chunk-WRD5HZVH.js?v=d79f5f52:11548:26)
    at mountIndeterminateComponent (chunk-WRD5HZVH.js?v=d79f5f52:14926:21)
    at beginWork (chunk-WRD5HZVH.js?v=d79f5f52:15914:22)
    at beginWork$1 (chunk-WRD5HZVH.js?v=d79f5f52:19753:22)
    at performUnitOfWork (chunk-WRD5HZVH.js?v=d79f5f52:19198:20)
    at workLoopSync (chunk-WRD5HZVH.js?v=d79f5f52:19137:13)
    at renderRootSync (chunk-WRD5HZVH.js?v=d79f5f52:19116:15)