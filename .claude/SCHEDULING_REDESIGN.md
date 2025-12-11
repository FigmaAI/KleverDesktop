# Task Scheduling Redesign

## 🎯 New Approach Overview

Based on the analysis of the current implementation, we propose a complete redesign with a focus on:

1. **Centralized Schedule Management** - Dedicated UI for all scheduled tasks
2. **Sequential Execution Queue** - Tasks execute one-by-one in order
3. **Silent Background Execution** - Auto-run tasks without disrupting the user

---

## 📐 Design Principles

### 1. **Separate Concerns**
- **Scheduling Logic** - Main process only
- **Schedule UI** - Top-level menu section
- **Task UI** - Remains focused on task details/results

### 2. **User-Centric**
- All scheduled tasks visible at a glance
- Clear execution order and status
- Non-intrusive auto-execution

### 3. **Reliability**
- No renderer process dependency
- Persistent queue across app restarts
- Proper error handling and recovery

---

## 🏗️ Architecture

### Data Layer

**New File**: `main/utils/schedule-queue.ts`

```typescript
interface ScheduledTask {
  id: string;                    // Unique schedule ID (schedule_${timestamp})
  projectId: string;
  taskId: string;
  scheduledAt: string;           // ISO datetime
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
  error?: string;
  // Silent execution flag
  silent: boolean;               // Don't open terminal, don't show toast (optional notification only)
}

interface ScheduleQueue {
  schedules: ScheduledTask[];
}
```

**Storage**: `~/.klever-desktop/schedules.json`

```json
{
  "schedules": [
    {
      "id": "schedule_1733820000000",
      "projectId": "proj_123",
      "taskId": "task_456",
      "scheduledAt": "2025-12-15T10:00:00Z",
      "status": "pending",
      "createdAt": "2025-12-10T05:00:00Z",
      "silent": true
    }
  ]
}
```

---

### Service Layer

**New File**: `main/utils/schedule-queue-manager.ts`

```typescript
class ScheduleQueueManager {
  private schedules: Map<string, ScheduledTask> = new Map();
  private activeExecution: string | null = null; // Only ONE task runs at a time
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize on app start
   */
  initialize(): void {
    this.loadSchedules();
    this.startPolling();
  }

  /**
   * Load schedules from schedules.json
   */
  private loadSchedules(): void {
    // Read schedules.json
    // Filter only 'pending' status
    // Load into Map
  }

  /**
   * Polling check every minute (not setTimeout for each task)
   */
  private startPolling(): void {
    this.checkInterval = setInterval(() => {
      this.checkAndExecuteDue();
    }, 60000); // Check every 60 seconds
  }

  /**
   * Check for due schedules and execute sequentially
   */
  private async checkAndExecuteDue(): Promise<void> {
    if (this.activeExecution) {
      console.log('[schedule] Task already running, skipping check');
      return;
    }

    const now = Date.now();
    const dueSchedules = Array.from(this.schedules.values())
      .filter(s => s.status === 'pending' && new Date(s.scheduledAt).getTime() <= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    if (dueSchedules.length > 0) {
      await this.executeSchedule(dueSchedules[0]);
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeSchedule(schedule: ScheduledTask): Promise<void> {
    this.activeExecution = schedule.id;
    schedule.status = 'running';
    schedule.executedAt = new Date().toISOString();
    this.saveSchedules();

    // Notify renderer (for UI update only, not for execution)
    this.notifyRenderer('schedule:started', { scheduleId: schedule.id });

    try {
      // Call task execution directly (no renderer round-trip)
      const result = await this.taskExecutor.execute(
        schedule.projectId,
        schedule.taskId,
        { silent: schedule.silent }
      );

      schedule.status = result.success ? 'completed' : 'failed';
      schedule.error = result.error;
    } catch (error) {
      schedule.status = 'failed';
      schedule.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      schedule.completedAt = new Date().toISOString();
      this.activeExecution = null;
      this.saveSchedules();

      // Notify completion
      this.notifyRenderer('schedule:completed', {
        scheduleId: schedule.id,
        status: schedule.status,
        error: schedule.error
      });

      // Check for next due schedule
      this.checkAndExecuteDue();
    }
  }

  /**
   * Add new schedule
   */
  addSchedule(projectId: string, taskId: string, scheduledAt: string, silent = true): ScheduledTask {
    const schedule: ScheduledTask = {
      id: `schedule_${Date.now()}`,
      projectId,
      taskId,
      scheduledAt,
      status: 'pending',
      createdAt: new Date().toISOString(),
      silent
    };

    this.schedules.set(schedule.id, schedule);
    this.saveSchedules();

    // Notify renderer
    this.notifyRenderer('schedule:added', schedule);

    return schedule;
  }

  /**
   * Cancel schedule
   */
  cancelSchedule(scheduleId: string): void {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || schedule.status !== 'pending') {
      return;
    }

    schedule.status = 'cancelled';
    this.saveSchedules();

    this.notifyRenderer('schedule:cancelled', { scheduleId });
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): ScheduledTask[] {
    return Array.from(this.schedules.values())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Singleton
export const scheduleQueueManager = new ScheduleQueueManager();
```

**Key Benefits**:
- ✅ **No setTimeout overflow** - Polling every 60 seconds instead
- ✅ **Sequential execution** - Only one task runs at a time
- ✅ **Persistent** - Survives app restarts
- ✅ **No renderer dependency** - Direct task execution
- ✅ **Simple** - Easy to understand and debug

---

### UI Layer

**New Page**: `src/pages/ScheduledTasks.tsx`

```typescript
/**
 * Scheduled Tasks Page
 * Shows all scheduled tasks across all projects in a centralized view
 */
export function ScheduledTasks() {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);

  useEffect(() => {
    loadSchedules();

    // Listen for schedule events
    window.electronAPI.onScheduleAdded(() => loadSchedules());
    window.electronAPI.onScheduleStarted(() => loadSchedules());
    window.electronAPI.onScheduleCompleted(() => loadSchedules());
    window.electronAPI.onScheduleCancelled(() => loadSchedules());
  }, []);

  const loadSchedules = async () => {
    const result = await window.electronAPI.scheduleList();
    if (result.success) {
      setSchedules(result.schedules);
    }
  };

  const handleCancel = async (scheduleId: string) => {
    await window.electronAPI.scheduleCancel(scheduleId);
  };

  return (
    <div className="p-6">
      <h1>Scheduled Tasks</h1>

      {/* Pending Schedules */}
      <section>
        <h2>Upcoming</h2>
        {schedules.filter(s => s.status === 'pending').map(schedule => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            onCancel={handleCancel}
          />
        ))}
      </section>

      {/* Running Schedule (max 1) */}
      <section>
        <h2>Currently Running</h2>
        {schedules.filter(s => s.status === 'running').map(schedule => (
          <ScheduleCard key={schedule.id} schedule={schedule} />
        ))}
      </section>

      {/* Completed/Failed Schedules */}
      <section>
        <h2>History</h2>
        {schedules.filter(s => s.status === 'completed' || s.status === 'failed').map(schedule => (
          <ScheduleCard key={schedule.id} schedule={schedule} />
        ))}
      </section>
    </div>
  );
}
```

**Navigation**: Add to `src/components/app-sidebar.tsx`

```typescript
<SidebarMenuItem>
  <SidebarMenuButton asChild>
    <Link to="/schedules">
      <Calendar className="h-4 w-4" />
      <span>Scheduled Tasks</span>
      {pendingCount > 0 && (
        <Badge variant="secondary">{pendingCount}</Badge>
      )}
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

---

### Silent Execution

**Modified**: `main/handlers/task.ts`

```typescript
interface TaskStartOptions {
  silent?: boolean; // Don't open terminal, don't show notifications
}

ipcMain.handle('task:start', async (_event, projectId: string, taskId: string, options?: TaskStartOptions) => {
  // ... existing validation ...

  const silent = options?.silent ?? false;

  // ... existing task execution ...

  taskProcess.stdout?.on('data', (data) => {
    const output = data.toString();

    if (!silent) {
      // Only send to renderer if NOT silent
      mainWindow?.webContents.send('task:output', { projectId, taskId, output });
    }

    // Always save to task.output for later viewing
    const currentData = loadProjects();
    const currentTask = currentProject?.tasks.find(t => t.id === taskId);
    if (currentTask) {
      currentTask.output = (currentTask.output || '') + output;
      saveProjects(currentData);
    }
  });

  taskProcess.on('close', (code) => {
    // ... update task status ...

    if (!silent) {
      // Show completion notification
      mainWindow?.webContents.send('task:complete', { projectId, taskId, code });
    }

    // Always update database
    saveProjects(currentData);
  });
});
```

**Terminal Context**: `src/contexts/TerminalContext.tsx`

```typescript
// Don't auto-open terminal for silent tasks
useEffect(() => {
  const handleTaskOutput = (data: { projectId: string; taskId: string; output: string }) => {
    // Only open terminal if task is NOT silent
    // This info should come from task metadata
    setIsOpen(true);
  };

  window.electronAPI.onTaskOutput(handleTaskOutput);
}, []);
```

---

## 🔄 Task Creation Flow Changes

### Current Flow (feature/schedule)

```
1. User creates task with scheduledAt
2. Task saved with isScheduled=true
3. TaskScheduler.scheduleTask() called
4. setTimeout registered
5. Time arrives → send 'task:auto-start' to renderer
6. Renderer calls taskStart()
7. Task executes
```

### New Flow (Redesigned)

```
1. User creates task (normal task)
2. User clicks "Schedule" button
3. Schedule dialog opens
   - Select date/time
   - Choose "Silent mode" (default: ON)
4. Schedule saved to schedules.json
5. ScheduleQueueManager adds to queue
6. Polling checks every minute
7. Time arrives → Direct task execution (silent mode)
8. Task completes → UI shows notification (optional)
9. User can view results in task detail page
```

**Key Changes**:
- ❌ Remove `isScheduled` and `scheduledAt` from Task type
- ✅ Task remains a simple execution record
- ✅ Schedule is a separate entity that references a task

---

## 📊 Data Model Comparison

### Before (feature/schedule)

```typescript
interface Task {
  // ... other fields
  scheduledAt?: string;    // ❌ Mixed concern
  isScheduled?: boolean;   // ❌ Duplicate state
}
```

**Problems**:
- Task is both a "task definition" and a "schedule"
- No way to schedule same task multiple times
- Hard to show all schedules in one place

### After (Redesigned)

```typescript
interface Task {
  // ... clean task fields only
  // NO scheduling fields
}

interface ScheduledTask {
  id: string;              // Separate schedule ID
  projectId: string;
  taskId: string;          // References a Task
  scheduledAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  silent: boolean;
}
```

**Benefits**:
- ✅ Clear separation of concerns
- ✅ Can schedule same task multiple times
- ✅ Easy to query all schedules
- ✅ Clean task lifecycle

---

## 🎨 UI/UX Improvements

### Centralized Schedule View

**Location**: Top-level sidebar menu item "Scheduled Tasks"

**Features**:
1. **Upcoming Queue**
   - Show all pending schedules sorted by time
   - Display: Project name, Task goal, Scheduled time, Silent mode badge
   - Actions: Cancel, Edit time

2. **Currently Running** (max 1 task)
   - Show active schedule with progress
   - Live output preview (collapsible)
   - Action: Stop execution

3. **History**
   - Show completed/failed schedules
   - Filter by date range, project, status
   - Action: View results, Re-schedule

### Task Detail Page Integration

**Add "Schedule" Button**:
```
[Run Now]  [Schedule]  [Edit]  [Delete]
```

**Schedule Dialog**:
```
┌─────────────────────────────────────┐
│  Schedule Task                      │
├─────────────────────────────────────┤
│  Date & Time: [DateTimePicker]     │
│                                     │
│  ☑ Silent Mode                     │
│  └─ Run in background without      │
│     opening terminal               │
│                                     │
│  [ Cancel ]          [ Schedule ]  │
└─────────────────────────────────────┘
```

### Silent Mode Behavior

**When Silent = ON** (default):
- ❌ Don't auto-open terminal
- ❌ Don't show toast notifications during execution
- ✅ Show subtle badge on "Scheduled Tasks" menu item when running
- ✅ Show system notification on completion (optional, configurable)
- ✅ Save full output to task.output for later viewing

**When Silent = OFF**:
- ✅ Current behavior (open terminal, show progress)

---

## 🔧 Implementation Plan

### Phase 1: Core Infrastructure (Priority 1)

**Files to Create**:
1. `main/utils/schedule-storage.ts` - Read/write schedules.json
2. `main/utils/schedule-queue-manager.ts` - Queue manager singleton
3. `main/handlers/schedule.ts` - IPC handlers for schedules

**Files to Modify**:
1. `main/handlers/index.ts` - Register schedule handlers
2. `main/index.ts` - Initialize schedule manager
3. `main/handlers/task.ts` - Add `silent` option support

**Estimated Time**: 6-8 hours

### Phase 2: UI Implementation (Priority 2)

**Files to Create**:
1. `src/pages/ScheduledTasks.tsx` - Schedule list page
2. `src/components/ScheduleCard.tsx` - Schedule item component
3. `src/components/ScheduleDialog.tsx` - Schedule creation dialog

**Files to Modify**:
1. `src/App.tsx` - Add route for /schedules
2. `src/components/app-sidebar.tsx` - Add menu item
3. `src/components/TaskDetail.tsx` - Add "Schedule" button
4. `src/types/electron.d.ts` - Add schedule IPC types
5. `main/preload.ts` - Expose schedule IPC methods

**Estimated Time**: 8-10 hours

### Phase 3: Silent Mode & Polish (Priority 3)

**Files to Modify**:
1. `src/contexts/TerminalContext.tsx` - Skip auto-open for silent tasks
2. `main/handlers/task.ts` - Conditional output streaming
3. System notification integration (Electron Notification API)

**Estimated Time**: 4-6 hours

### Phase 4: Migration & Cleanup (Priority 4)

**Tasks**:
1. Remove old scheduling code from TaskScheduler
2. Remove `isScheduled`, `scheduledAt` from Task type
3. Update TaskCreateDialog to remove inline scheduling
4. Data migration script (migrate existing scheduled tasks)

**Estimated Time**: 4-6 hours

**Total Estimated Time**: 22-30 hours

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('ScheduleQueueManager', () => {
  it('should add schedule to queue')
  it('should execute due schedules in order')
  it('should execute only one schedule at a time')
  it('should persist schedules across restarts')
  it('should cancel pending schedules')
  it('should handle task execution failures')
  it('should skip running check if task already executing')
});
```

### Integration Tests

```typescript
describe('Schedule Lifecycle', () => {
  it('should create schedule from task detail page')
  it('should show schedule in centralized view')
  it('should execute task at scheduled time (silent mode)')
  it('should not open terminal for silent tasks')
  it('should save output even in silent mode')
  it('should execute next schedule after completion')
});
```

### Manual Test Cases

1. **Sequential Execution**
   - Schedule 3 tasks for same time
   - Verify they execute one-by-one

2. **Silent Mode**
   - Schedule task with silent=true
   - Verify terminal doesn't open
   - Verify output is saved
   - Verify results viewable in task detail

3. **App Restart**
   - Schedule task for 5 minutes later
   - Restart app
   - Verify schedule persists
   - Verify task executes on time

4. **Long-term Schedule**
   - Schedule task for 7 days later
   - Verify no setTimeout overflow
   - Verify polling continues to work

---

## 📈 Benefits Over Current Implementation

| Aspect | Current (feature/schedule) | Redesigned |
|--------|---------------------------|------------|
| **Schedule Visibility** | Hidden in task properties | Centralized dedicated page |
| **Execution Order** | Concurrent (multiple setTimeout) | Sequential queue |
| **Renderer Dependency** | Required for execution | None (main process only) |
| **Terminal Popup** | Always auto-opens | Optional (silent mode) |
| **Long-term Schedules** | setTimeout overflow (>24.8 days) | Polling-based (no limit) |
| **Data Model** | Mixed Task + Schedule | Clean separation |
| **User Experience** | Disruptive auto-execution | Silent background execution |
| **Debugging** | Complex event chain | Simple polling loop |
| **Testing** | Hard (renderer involved) | Easy (pure main process) |

---

## 🚀 Migration Path

For users with existing scheduled tasks (if any):

```typescript
// Migration script (run once on app startup)
async function migrateScheduledTasks() {
  const projects = loadProjects();
  const schedules: ScheduledTask[] = [];

  for (const project of projects.projects) {
    for (const task of project.tasks) {
      if (task.isScheduled && task.scheduledAt && task.status === 'pending') {
        // Create schedule entity
        schedules.push({
          id: `schedule_${Date.now()}_${task.id}`,
          projectId: project.id,
          taskId: task.id,
          scheduledAt: task.scheduledAt,
          status: 'pending',
          createdAt: task.createdAt,
          silent: true // Default to silent mode
        });

        // Clean task
        delete task.isScheduled;
        delete task.scheduledAt;
      }
    }
  }

  // Save schedules
  saveSchedules({ schedules });
  saveProjects(projects);

  console.log(`[migration] Migrated ${schedules.length} scheduled tasks`);
}
```

---

## 💡 Future Enhancements

### 1. Recurring Schedules
```typescript
interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  time: string; // "10:00"
  endDate?: string;
}
```

### 2. Schedule Templates
```typescript
interface ScheduleTemplate {
  name: string;
  description: string;
  tasks: Array<{ taskId: string; delay: number }>; // Sequence of tasks
}
```

### 3. Dependency Chains
```typescript
interface ScheduledTask {
  // ... existing fields
  dependsOn?: string; // scheduleId of prerequisite
  runIf?: 'always' | 'success' | 'failure'; // Condition
}
```

### 4. Schedule Notifications
```typescript
interface NotificationSettings {
  onStart: boolean;
  onComplete: boolean;
  onFailure: boolean;
  soundEnabled: boolean;
  emailEnabled: boolean;
}
```

---

## 📝 Summary

### What We're Changing

**Remove**:
- ❌ TaskScheduler class (setTimeout-based)
- ❌ `isScheduled` and `scheduledAt` from Task type
- ❌ Inline scheduling in TaskCreateDialog
- ❌ Renderer-dependent execution path

**Add**:
- ✅ ScheduleQueueManager (polling-based)
- ✅ Separate Schedule entity and storage
- ✅ Dedicated Scheduled Tasks page
- ✅ Silent mode for background execution
- ✅ Sequential execution queue

### Why This is Better

1. **Simpler Architecture** - Clear separation, easier to understand
2. **Better UX** - Centralized view, silent mode, non-disruptive
3. **More Reliable** - No setTimeout limits, no renderer dependency
4. **Easier to Test** - Pure main process logic
5. **More Flexible** - Easy to add recurring, templates, dependencies

### Next Steps

1. ✅ Review this design document
2. ⏳ Get approval to proceed
3. ⏳ Implement Phase 1 (Core infrastructure)
4. ⏳ Implement Phase 2 (UI)
5. ⏳ Implement Phase 3 (Silent mode)
6. ⏳ Implement Phase 4 (Migration & cleanup)
7. ⏳ Testing and refinement

---

**Last Updated**: 2025-12-10
**Status**: Design Complete, Awaiting Approval
**Estimated Implementation**: 22-30 hours
