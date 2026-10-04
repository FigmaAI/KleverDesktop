# Native application test recorder

## Implemented foundation

The runtime is direct Electron/Node: Android SDK processes, ChatGPT OAuth, a short screen-understanding instruction, strict JSON decisions, validated native actions, and durable evidence. Legacy local models, provider setup, browser automation, secondary interpreter installation and AppAgent execution have been removed.

Courses are reusable definitions with revisions. Each execution freezes its goal, source/build alias and selected device, then records actual app/device versions, actions, screenshots and visual assessment. Completed manifests are immutable. Previous verified intentions can guide a later build; current screenshots always determine the action.

These structures stay internal. The user interface retains the original task list and continuous Markdown reports; the result page adds only the requested Report/Terminal switch. The old bottom terminal and the proposed JSON report/comparison interface are removed. Explicit test deletion removes its owned artifacts and manifest while protecting other records.

Manual and scheduled runs use the same owned job and recording lifecycle. Cancellation waits for the job to stop before sealing evidence. Interrupted records recover as unverified, preserving old files and results.

## Next: desktop MCP

Expose existing course/run operations and history through a local MCP transport. External agents should use the same stored courses and invoke the same runner, with explicit local access and concurrency boundaries. Do not duplicate another agent framework or harness per client.

## Later: iOS

Add a native device/simulator adapter behind the existing course/run contracts. Keep common records, while platform actions remain explicit.

## Later: unattended launch and wake

Add OS launch/wake integration and recovery for sleep, fully quit applications, expired accounts and disconnected devices. Current schedules require the app process to remain running.
