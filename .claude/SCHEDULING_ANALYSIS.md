# Task Scheduling Feature Analysis

## 📋 Current Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   TaskScheduler                          │
│  (main/utils/task-scheduler.ts)                         │
│  - Singleton pattern                                     │
│  - Map<taskId, ScheduledTaskInfo>                       │
│  - Uses setTimeout for scheduling                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Task Handlers Integration                   │
│  (main/handlers/task.ts)                                │
│  - task:create → scheduleTask()                         │
│  - initializeTaskScheduler()                            │
│  - taskStartHandler → sends 'task:auto-start' event     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Renderer Process                       │
│  (src/App.tsx)                                          │
│  - Listens for 'task:auto-start' event                 │
│  - Calls window.electronAPI.taskStart()                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  Task Execution                          │
│  (main/handlers/task.ts)                                │
│  - task:start IPC handler                               │
│  - Spawns Python subprocess                             │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Task Creation with Schedule**:
   ```
   UI → task:create IPC → Save to projects.json → scheduleTask()
   ```

2. **App Startup**:
   ```
   App Start → initializeTaskScheduler() → loadScheduledTasks() → scheduleTask() for each
   ```

3. **Scheduled Execution**:
   ```
   setTimeout expires → executeScheduledTask() →
   Send 'task:auto-start' event → Renderer listens →
   Calls taskStart() IPC → Actual execution
   ```

---

## 🔍 Code Structure Analysis

### TaskScheduler Class (211 lines)

**Key Methods**:
- `initialize()` - Setup with window accessor and task handler
- `loadScheduledTasks()` - Load from projects.json on startup
- `scheduleTask()` - Schedule using setTimeout
- `cancelTask()` - Clear timeout
- `executeScheduledTask()` - Execute when time arrives
- `rescheduleTask()` - Cancel + reschedule

**State Management**:
```typescript
private scheduledTasks: Map<string, ScheduledTaskInfo> = new Map();
private getMainWindow: (() => BrowserWindow | null) | null = null;
private taskStartHandler: ((projectId: string, taskId: string) => Promise<void>) | null = null;
```

### Task Handler Integration (lines 669-682)

```typescript
export function initializeTaskScheduler(getMainWindow: () => BrowserWindow | null): void {
  const taskStartHandler = async (projectId: string, taskId: string): Promise<void> => {
    // ❌ INDIRECT: Sends event to renderer instead of starting task directly
    const mainWindow = getMainWindow();
    mainWindow?.webContents.send('task:auto-start', { projectId, taskId });
  };

  taskScheduler.initialize(getMainWindow, taskStartHandler);
}
```

### Renderer Integration (src/App.tsx lines 129-167)

```typescript
useEffect(() => {
  const handleAutoStart = async (data: { projectId: string; taskId: string }) => {
    // Receives event from main process
    const result = await window.electronAPI.taskStart(data.projectId, data.taskId)

    if (result.success) {
      await loadProjects()
      // Update UI...
    }
  }

  window.electronAPI.onTaskAutoStart(handleAutoStart)
}, [loadProjects])
```

---

## ⚠️ Critical Issues

### 1. 🔴 **Indirect Task Execution (High Priority)**

**Problem**: Unnecessary round-trip through renderer process

```
TaskScheduler → Renderer (task:auto-start event) → IPC (taskStart) → Task Handler
```

**Why it's a problem**:
- Adds latency (~100-500ms)
- Requires renderer to be running (what if minimized/background?)
- Fragile: If renderer event listener fails, task never starts
- Violates separation of concerns (main process → renderer → main process)

**Root Cause**:
The `task:start` IPC handler has 570 lines of complex logic that's hard to reuse. Instead of extracting this logic into a reusable function, the scheduler takes a shortcut by emitting an event.

**Impact**:
- Scheduled tasks won't start if app is in background
- No proper error handling for failed auto-start
- Difficult to test scheduler in isolation

---

### 2. 🟡 **Missing Schedule Lifecycle Management (Medium Priority)**

**Problem**: Schedule cancellation not integrated with task lifecycle

**Current Behavior**:
```typescript
// ✅ task:create → schedules the task
// ❌ task:update → does NOT reschedule
// ❌ task:delete → does NOT cancel schedule
// ❌ task:start (manual) → does NOT cancel schedule
```

**Example Bug Scenario**:
```
1. User creates task scheduled for tomorrow
2. User manually starts the task today
3. Tomorrow: Task starts AGAIN (duplicate execution!)
```

**Missing in task:delete handler** (line 159-194):
```typescript
// Should add:
if (task.isScheduled) {
  taskScheduler.cancelTask(taskId);
}
```

---

### 3. 🟡 **setTimeout Limitations (Medium Priority)**

**Problem**: JavaScript setTimeout max value is 2,147,483,647ms (~24.8 days)

**Current Code** (task-scheduler.ts:81-83):
```typescript
const timeoutId = setTimeout(() => {
  this.executeScheduledTask(projectId, task.id);
}, delay);  // ❌ What if delay > 24.8 days?
```

**Failure Mode**:
```typescript
// Schedule task for 30 days from now
const delay = 30 * 24 * 60 * 60 * 1000; // 2,592,000,000ms

setTimeout(callback, delay); // ❌ Fires immediately instead!
```

**Impact**:
- Tasks scheduled > 24.8 days in future execute immediately
- Silent failure (no error thrown)

---

### 4. 🟠 **State Inconsistency Risk (Low Priority)**

**Problem**: No validation between `status` and `isScheduled` fields

**Inconsistent States Possible**:
```typescript
// Valid
{ status: 'pending', isScheduled: true, scheduledAt: '2025-12-15' }

// ❌ Invalid but not prevented
{ status: 'running', isScheduled: true, scheduledAt: '2025-12-15' }
{ status: 'completed', isScheduled: true, scheduledAt: '2025-12-15' }
{ status: 'pending', isScheduled: false, scheduledAt: '2025-12-15' }
```

**Missing Validation** (task-scheduler.ts:45-46):
```typescript
for (const task of project.tasks) {
  if (task.isScheduled && task.scheduledAt && task.status === 'pending') {
    this.scheduleTask(project.id, task);
  }
}
// ✅ Only schedules if status=pending
// ❌ But no validation prevents creating invalid states
```

---

### 5. 🟢 **No Initialization Hook (Low Priority)**

**Problem**: Unclear where `initializeTaskScheduler()` is called

**Search Results**:
```bash
$ grep -r "initializeTaskScheduler" main/
main/handlers/task.ts:export function initializeTaskScheduler(...)
main/handlers/index.ts:  # ❌ NOT FOUND!
```

**Expected in** `main/handlers/index.ts`:
```typescript
export function registerAllHandlers(ipcMain: IpcMain, getMainWindow: ...) {
  registerTaskHandlers(ipcMain, getMainWindow);
  // ❌ MISSING: initializeTaskScheduler(getMainWindow);
}
```

**Impact**:
- Scheduled tasks might not load on app startup
- Need to verify in main/index.ts

---

## 🔧 Refactoring Recommendations

### Priority 1: Direct Task Execution ⭐⭐⭐

**Goal**: Remove renderer round-trip

**Implementation**:

```typescript
// Step 1: Extract task execution logic (task.ts)
export async function startTaskExecution(
  projectId: string,
  taskId: string,
  getMainWindow: () => BrowserWindow | null
): Promise<{ success: boolean; pid?: number; error?: string }> {
  // Move all logic from task:start handler here
  // ... 570 lines ...
}

// Step 2: Update IPC handler to use extracted function
ipcMain.handle('task:start', async (_event, projectId: string, taskId: string) => {
  return startTaskExecution(projectId, taskId, getMainWindow);
});

// Step 3: Use in scheduler directly
export function initializeTaskScheduler(getMainWindow: () => BrowserWindow | null): void {
  const taskStartHandler = async (projectId: string, taskId: string): Promise<void> => {
    const result = await startTaskExecution(projectId, taskId, getMainWindow);

    if (!result.success) {
      console.error('[task-scheduler] Failed to start task:', result.error);
    }
  };

  taskScheduler.initialize(getMainWindow, taskStartHandler);
}
```

**Benefits**:
- ✅ No renderer dependency
- ✅ Works when app is minimized/background
- ✅ Easier to test
- ✅ Faster execution (no IPC round-trip)

---

### Priority 2: Lifecycle Integration ⭐⭐

**Goal**: Auto-cancel schedules when task is deleted/updated/started

**Implementation**:

```typescript
// task:delete handler (after line 173)
const task = project.tasks[taskIndex];

// Cancel schedule if task is scheduled
if (task.isScheduled) {
  taskScheduler.cancelTask(taskId);
  console.log(`[task:delete] Cancelled schedule for task ${taskId}`);
}

// task:update handler (after line 142)
const oldTask = project.tasks[taskIndex];
project.tasks[taskIndex] = { ...oldTask, ...updates, updatedAt: new Date().toISOString() };
const updatedTask = project.tasks[taskIndex];

// Reschedule if schedule changed
if (updates.scheduledAt !== undefined || updates.isScheduled !== undefined) {
  if (updatedTask.isScheduled && updatedTask.scheduledAt) {
    taskScheduler.rescheduleTask(projectId, updatedTask);
  } else {
    taskScheduler.cancelTask(taskId);
  }
}

// task:start handler (after line 322)
// Cancel schedule if manually started
if (task.isScheduled) {
  taskScheduler.cancelTask(taskId);
  console.log(`[task:start] Cancelled schedule for manually started task ${taskId}`);
}
```

**Benefits**:
- ✅ Prevents duplicate execution
- ✅ Keeps schedule state consistent
- ✅ Better user experience

---

### Priority 3: Long-term Schedule Handling ⭐

**Goal**: Handle schedules > 24.8 days

**Option A: Reject in UI** (Simplest)
```typescript
// TaskCreateDialog.tsx
const MAX_SCHEDULE_DAYS = 30;
const delay = scheduledDateTime.getTime() - Date.now();

if (delay > MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
  alert('Cannot schedule tasks more than 30 days in advance');
  return;
}
```

**Option B: Periodic Check-ins** (More complex)
```typescript
// task-scheduler.ts
const MAX_TIMEOUT = 2147483647; // ~24.8 days

scheduleTask(projectId: string, task: Task): void {
  const delay = scheduledTime - now;

  if (delay > MAX_TIMEOUT) {
    // Schedule a check-in every 24 hours
    const checkInDelay = 24 * 60 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      this.scheduleTask(projectId, task); // Re-evaluate
    }, checkInDelay);
  } else {
    // Normal scheduling
    const timeoutId = setTimeout(() => {
      this.executeScheduledTask(projectId, task.id);
    }, delay);
  }
}
```

**Recommendation**: Start with Option A (UI validation)

---

### Priority 4: Status Validation ⭐

**Goal**: Prevent invalid state combinations

**Implementation**:

```typescript
// task-scheduler.ts:60 (scheduleTask)
scheduleTask(projectId: string, task: Task): void {
  // Validation
  if (!task.scheduledAt || !task.isScheduled) {
    console.warn('[task-scheduler] Task is not configured for scheduling:', task.id);
    return;
  }

  // ✅ ADD: Validate status
  if (task.status !== 'pending') {
    console.warn('[task-scheduler] Scheduled task must be pending, found:', task.status);
    return;
  }

  // ... rest of logic
}

// task.ts:88 (task:create)
const newTask: Task = {
  id: `task_${Date.now()}`,
  // ... other fields
  scheduledAt: taskInput.scheduledAt,
  isScheduled: taskInput.isScheduled,

  // ✅ ADD: Validation
  status: (taskInput.isScheduled && taskInput.scheduledAt)
    ? 'pending'
    : 'pending', // Force pending for scheduled tasks
};

// Validate scheduling fields
if (taskInput.isScheduled && !taskInput.scheduledAt) {
  return { success: false, error: 'Scheduled task must have scheduledAt' };
}
```

---

## 📊 Code Quality Metrics

### Current State

| Metric | Value | Assessment |
|--------|-------|------------|
| Task Scheduler LOC | 211 lines | ✅ Reasonable |
| Task Handler LOC | 683 lines | ⚠️ Very long |
| Circular Dependencies | 0 | ✅ Good |
| Event Listeners | 6 | ⚠️ Many |
| Singleton Usage | 1 | ✅ Appropriate |
| Test Coverage | 0% | 🔴 Missing |

### Complexity Analysis

**TaskScheduler Complexity**: ⭐⭐ (Low-Medium)
- Simple Map-based storage
- Clear method responsibilities
- Well-structured

**Task Handler Complexity**: ⭐⭐⭐⭐ (High)
- 570-line task:start handler
- Multiple concerns (validation, setup, execution, metrics)
- Hard to test in isolation
- **Should be refactored into smaller functions**

---

## 🎯 Implementation Plan

### Phase 1: Critical Fixes (1-2 days)

1. ✅ Extract `startTaskExecution()` function
2. ✅ Update scheduler to use direct execution
3. ✅ Add schedule cancellation to task:delete
4. ✅ Add schedule cancellation to manual task:start
5. ✅ Verify initializeTaskScheduler() is called

### Phase 2: Improvements (1 day)

6. ✅ Add status validation
7. ✅ Add rescheduling to task:update
8. ✅ Add UI validation for max schedule days

### Phase 3: Polish (1 day)

9. ✅ Add unit tests for TaskScheduler
10. ✅ Add error recovery mechanisms
11. ✅ Improve logging and debugging

---

## 🧪 Testing Strategy

### Unit Tests Needed

```typescript
describe('TaskScheduler', () => {
  it('should schedule task at correct time')
  it('should execute task when time arrives')
  it('should cancel scheduled task')
  it('should reschedule task with new time')
  it('should load scheduled tasks on startup')
  it('should handle past scheduled times (execute immediately)')
  it('should reject schedules > 30 days')
  it('should only schedule pending tasks')
});
```

### Integration Tests Needed

```typescript
describe('Task Lifecycle with Scheduling', () => {
  it('should cancel schedule when task is deleted')
  it('should cancel schedule when task is manually started')
  it('should reschedule when scheduledAt is updated')
  it('should not execute cancelled schedules')
});
```

---

## 📝 Summary

### What Works Well ✅

- Clean separation of scheduling logic into TaskScheduler class
- Persistence of scheduled tasks in projects.json
- Automatic loading on app restart
- Event notifications to renderer for UI updates
- Graceful handling of past scheduled times

### What Needs Improvement ⚠️

1. **Indirect execution path** (main → renderer → main)
2. **Missing lifecycle integration** (delete/update/manual start)
3. **setTimeout limitations** for long-term schedules
4. **No status validation** for scheduled tasks
5. **Missing initialization verification**

### Recommended Priority

1. 🔴 **High**: Fix indirect execution (removes renderer dependency)
2. 🟡 **Medium**: Add lifecycle integration (prevents bugs)
3. 🟢 **Low**: Add validation and long-term schedule handling

### Estimated Effort

- Phase 1 (Critical): 8-12 hours
- Phase 2 (Improvements): 4-6 hours
- Phase 3 (Polish): 4-6 hours
- **Total**: 16-24 hours of focused development

---

**Last Updated**: 2025-12-10
**Status**: Analysis Complete, Ready for Refactoring
