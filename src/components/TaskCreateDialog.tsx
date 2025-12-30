import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Loader2,
  Plus,
  Smartphone,
  Globe,
  FileBox,
  Info,
  X,
} from "lucide-react";
import PlayStoreIcon from "@/assets/play-store.svg?react";
import { ScheduleQuickDialog } from "@/components/ScheduleQuickDialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { ModelSelector, ModelSelection } from "./ModelSelector";
import type { Task, Project, ApkSourceType, ApkSource } from "../types/project";
import { Analytics } from "@/utils/analytics";

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjectId?: string;
  onTaskCreated?: (task: Task) => void;
  onCreateProject?: () => void;
}

export function TaskCreateDialog({
  open,
  onClose,
  projects,
  selectedProjectId,
  onTaskCreated,
  onCreateProject,
}: TaskCreateDialogProps) {
  const { t } = useTranslation();
  const [goal, setGoal] = useState("");
  const [url, setUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState<
    ModelSelection | undefined
  >();
  const [registeredProviders, setRegisteredProviders] = useState<string[]>([]);
  const [runImmediately, setRunImmediately] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(
    selectedProjectId
  );
  const [maxRounds, setMaxRounds] = useState<number>(20);
  const [globalMaxRounds, setGlobalMaxRounds] = useState<number>(20);

  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  // APK Source state (Android only) - Required
  const [apkSourceType, setApkSourceType] =
    useState<ApkSourceType>("play_store_url");
  const [apkFilePath, setApkFilePath] = useState("");
  const [playStoreUrl, setPlayStoreUrl] = useState("");
  const [extractedPackageName, setExtractedPackageName] = useState("");

  // Get current project
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const platform = currentProject?.platform || "android";

  // Update currentProjectId when selectedProjectId changes (only if provided)
  useEffect(() => {
    if (selectedProjectId) {
      setCurrentProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Load last used APK source when project changes
  useEffect(() => {
    if (
      currentProject?.lastApkSource &&
      currentProject.platform === "android"
    ) {
      const { type, path, url, packageName } = currentProject.lastApkSource;
      setApkSourceType(type);
      if (type === "apk_file" && path) {
        setApkFilePath(path);
      } else if (type === "play_store_url" && url) {
        setPlayStoreUrl(url);
      }
      if (packageName) {
        setExtractedPackageName(packageName);
      }
    } else {
      // Reset to defaults if no last APK source
      setApkSourceType("play_store_url");
      setApkFilePath("");
      setPlayStoreUrl("");
      setExtractedPackageName("");
    }
  }, [currentProject]);

  // Load saved model configuration (multi-provider format)
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const result = await window.electronAPI.configLoad();
        if (result.success && result.config) {
          // Load model configuration
          if (result.config.model) {
            const { providers, lastUsed } = result.config.model;

            // Set registered providers for filtering
            if (providers && providers.length > 0) {
              setRegisteredProviders(providers.map((p) => p.id));

              // Use lastUsed if available, otherwise use first provider
              if (lastUsed?.provider && lastUsed?.model) {
                setSelectedModel({
                  provider: lastUsed.provider,
                  model: lastUsed.model,
                });
              } else {
                const firstProvider = providers[0];
                setSelectedModel({
                  provider: firstProvider.id,
                  model: firstProvider.preferredModel,
                });
              }
            }
          }

          // Load execution configuration for max rounds
          if (result.config.execution?.maxRounds) {
            const globalMaxRounds = result.config.execution.maxRounds;
            setGlobalMaxRounds(globalMaxRounds);
            setMaxRounds(globalMaxRounds);
          }
        }
      } catch (error) {
        console.error("Failed to load saved config:", error);
      }
    };

    if (open) {
      loadSavedConfig();
    }
  }, [open]);

  const handleSelectApkFile = async () => {
    const result = await window.electronAPI.apkSelectFile();
    if (result.success && result.path) {
      setApkFilePath(result.path);
      setExtractedPackageName("");
    }
  };

  const handlePlayStoreUrlChange = async (inputUrl: string) => {
    setPlayStoreUrl(inputUrl);
    setExtractedPackageName("");

    if (inputUrl && inputUrl.includes("play.google.com")) {
      const result = await window.electronAPI.playstoreParseUrl(inputUrl);
      if (result.success && result.packageName) {
        setExtractedPackageName(result.packageName);
      }
    }
  };

  const buildApkSource = useCallback((): ApkSource | undefined => {
    if (platform !== "android") return undefined;

    if (apkSourceType === "apk_file" && apkFilePath) {
      return {
        type: "apk_file",
        path: apkFilePath,
        packageName: extractedPackageName || undefined,
      };
    } else if (apkSourceType === "play_store_url" && playStoreUrl) {
      return {
        type: "play_store_url",
        url: playStoreUrl,
        packageName: extractedPackageName || undefined,
      };
    }

    return undefined;
  }, [platform, apkSourceType, apkFilePath, playStoreUrl, extractedPackageName]);

  // Check if APK source is valid (required for Android)
  const isApkSourceValid = useCallback(() => {
    if (platform !== "android") return true;
    if (apkSourceType === "apk_file") return !!apkFilePath;
    if (apkSourceType === "play_store_url") return !!playStoreUrl;
    return false;
  }, [platform, apkSourceType, apkFilePath, playStoreUrl]);

  // Validate form before submission
  const validateForm = useCallback(() => {
    if (!currentProjectId) {
      alert(t("tasks.alerts.selectProject"));
      return false;
    }
    if (!goal.trim()) {
      alert(t("tasks.alerts.enterDescription"));
      return false;
    }
    if (platform === "web" && !url.trim()) {
      alert(t("tasks.alerts.enterUrl"));
      return false;
    }
    if (platform === "android" && !isApkSourceValid()) {
      alert(t("tasks.alerts.provideApk"));
      return false;
    }
    if (!selectedModel?.provider || !selectedModel?.model) {
      alert(t("tasks.alerts.selectModel"));
      return false;
    }
    return true;
  }, [currentProjectId, goal, platform, url, isApkSourceValid, selectedModel, t]);

  // Create task and optionally schedule it
  const createTask = useCallback(async (scheduledAt?: Date) => {
    if (!currentProjectId || !selectedModel) return null;

    const taskInput = {
      projectId: currentProjectId,
      name: `Task ${new Date().toLocaleString()}`,
      goal: goal.trim(),
      url: platform === 'web' ? url.trim() : undefined,
      apkSource: buildApkSource(),
      modelProvider: selectedModel.provider,
      modelName: selectedModel.model,
      maxRounds: maxRounds !== globalMaxRounds ? maxRounds : undefined,
    };

    const result = await window.electronAPI.taskCreate(taskInput);

    if (result.success && result.task) {
      // Update lastUsed in config
      try {
        await window.electronAPI.configUpdateLastUsed({
          provider: selectedModel.provider,
          model: selectedModel.model,
        });
      } catch (error) {
        console.warn("[TaskCreateDialog] Failed to update lastUsed:", error);
      }

      // If scheduled, create a schedule entry
      if (scheduledAt) {
        const scheduleResult = await window.electronAPI.scheduleAdd(
          currentProjectId,
          result.task.id,
          scheduledAt.toISOString()
        );
        if (!scheduleResult.success) {
          throw new Error(scheduleResult.error || 'Failed to schedule task');
        }
      }

      return result.task;
    } else {
      throw new Error(result.error || "Failed to create task");
    }
  }, [currentProjectId, goal, platform, url, buildApkSource, selectedModel, maxRounds, globalMaxRounds]);

  // Check if any task is currently running across all projects
  // Fetches fresh data from main process to ensure accurate status
  const hasRunningTask = useCallback(async (): Promise<boolean> => {
    try {
      const result = await window.electronAPI.projectList();
      if (result.success && result.projects) {
        for (const project of result.projects) {
          for (const task of project.tasks) {
            if (task.status === 'running') {
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('[TaskCreateDialog] Error checking running tasks:', error);
      // Fall back to prop-based check if API fails
      for (const project of projects) {
        for (const task of project.tasks) {
          if (task.status === 'running') {
            return true;
          }
        }
      }
      return false;
    }
  }, [projects]);

  // Handle immediate run
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const task = await createTask();

      // Track task creation
      if (task) {
        Analytics.taskCreated({
          platform: platform,
          modelProvider: selectedModel!.provider,
          modelName: selectedModel!.model,
          isScheduled: false,
          hasUrl: platform === 'web' && !!url.trim(),
          hasApkSource: platform === 'android' && isApkSourceValid(),
          customMaxRounds: maxRounds !== globalMaxRounds,
        });
      }

      if (task && runImmediately && currentProjectId) {
        // Check if another task is already running (fetches fresh data)
        if (await hasRunningTask()) {
          // Queue the task instead of running immediately
          const scheduledAt = new Date(); // Schedule for now (will run when queue is free)
          const scheduleResult = await window.electronAPI.scheduleAdd(
            currentProjectId,
            task.id,
            scheduledAt.toISOString()
          );

          if (scheduleResult.success) {
            // Track task queueing
            Analytics.taskQueued(platform, 1);

            toast.info(t('tasks.createDialog.taskQueued'), {
              description: t('tasks.createDialog.taskQueuedDesc'),
            });
          } else {
            console.error('Failed to queue task:', scheduleResult.error);
            toast.error(t('tasks.createDialog.failedToQueue'));
          }
        } else {
          // No task running, start immediately
          await window.electronAPI.taskStart(currentProjectId, task.id);
        }
      }

      onTaskCreated?.(task!);
      handleClose();
    } catch (error) {
      console.error("Error creating task:", error);
      alert(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    setGoal("");
    setUrl("");
    setApkSourceType("play_store_url");
    setApkFilePath("");
    setPlayStoreUrl("");
    setExtractedPackageName("");
    setRunImmediately(true);
    setMaxRounds(globalMaxRounds);
    onClose();
  }, [globalMaxRounds, onClose]);

  // Handle scheduled run (called from ScheduleQuickDialog)
  const handleScheduledSubmit = useCallback(async (scheduledAt: Date) => {
    if (!validateForm()) return;

    const task = await createTask(scheduledAt);

    // Track schedule creation
    if (task) {
      const futureMinutes = Math.round((scheduledAt.getTime() - Date.now()) / 60000);
      Analytics.scheduleCreated(platform, 'custom', futureMinutes);
    }

    onTaskCreated?.(task!);
    handleClose();
  }, [validateForm, createTask, onTaskCreated, handleClose, platform]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // ⌥⌘⏎ or Alt+Ctrl+Enter: Open schedule dialog
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === "Enter") {
      e.preventDefault();
      if (isEligible && !loading) {
        setScheduleDialogOpen(true);
      }
      return;
    }
    // ⌘⏎ or Ctrl+Enter: Run immediately
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit();
    }
  };

  const isEligible =
    currentProjectId &&
    goal.trim() &&
    (platform === "web" ? url.trim() : isApkSourceValid()) &&
    selectedModel?.model;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-2xl"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('tasks.createDialog.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('tasks.createDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label>{t('tasks.createDialog.project')}</Label>
            <Select
              value={currentProjectId || ""}
              onValueChange={(value) => {
                if (value === "__create_new__") {
                  onCreateProject?.();
                } else {
                  setCurrentProjectId(value);
                  // APK source will be loaded from project.lastApkSource by useEffect
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('tasks.createDialog.selectProject')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => {
                  const PlatformIcon =
                    project.platform === "android" ? Smartphone : Globe;
                  return (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{project.name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
                {onCreateProject && (
                  <>
                    {projects.length > 0 && (
                      <div className="h-px bg-border my-1" />
                    )}
                    <SelectItem value="__create_new__" className="text-primary">
                      <span className="flex items-center gap-2">
                        <Plus className="h-3 w-3" />
                        {t('tasks.createDialog.createNewProject')}
                      </span>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* URL Input (Web Platform Only) */}
          {platform === "web" && (
            <div className="space-y-2">
              <Label>
                {t('tasks.createDialog.websiteUrl')} <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          {/* APK Source (Android Platform Only) - Required */}
          {platform === "android" && (
            <div className="space-y-2">
              <Label>
                {t('tasks.createDialog.appSource')} <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                {t('tasks.createDialog.appSourceDesc')}
              </p>

              {/* Styled Container for Radio Group */}
              <div className="rounded-lg border bg-muted/30 p-2">
                <RadioGroup
                  value={apkSourceType}
                  onValueChange={(value) =>
                    setApkSourceType(value as ApkSourceType)
                  }
                  className="gap-1"
                >
                  {/* Play Store URL Option - Wrapper */}
                  <div
                    className={`rounded-md transition-colors ${apkSourceType === "play_store_url" ? "bg-background shadow-sm" : "hover:bg-background/40"}`}
                  >
                    <label
                      htmlFor="task_play_store_url"
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    >
                      <RadioGroupItem
                        value="play_store_url"
                        id="task_play_store_url"
                      />
                      <PlayStoreIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('tasks.createDialog.playStoreUrl')}</span>
                    </label>

                    {/* Play Store URL Input */}
                    {apkSourceType === "play_store_url" && (
                      <div className="px-3 pb-3 pt-0 ml-7 space-y-1.5">
                        <Input
                          value={playStoreUrl}
                          onChange={(e) =>
                            handlePlayStoreUrlChange(e.target.value)
                          }
                          placeholder={t('tasks.createDialog.playStorePlaceholder')}
                          className="text-sm h-8"
                        />
                        {extractedPackageName && (
                          <p className="text-xs text-muted-foreground">
                            {t('tasks.createDialog.package')}{" "}
                            <span className="font-mono text-foreground">
                              {extractedPackageName}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* APK File Option - Wrapper */}
                  <div
                    className={`rounded-md transition-colors ${apkSourceType === "apk_file" ? "bg-background shadow-sm" : "hover:bg-background/40"}`}
                  >
                    <label
                      htmlFor="task_apk_file"
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    >
                      <RadioGroupItem value="apk_file" id="task_apk_file" />
                      <FileBox className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('tasks.createDialog.apkFile')}</span>
                    </label>

                    {/* APK File Input */}
                    {apkSourceType === "apk_file" && (
                      <div className="px-3 pb-3 pt-0 ml-7 flex gap-2">
                        <Input
                          readOnly
                          value={apkFilePath}
                          placeholder={t('tasks.createDialog.selectApkFile')}
                          className="flex-1 text-sm h-8"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectApkFile}
                          className="h-8"
                        >
                          {t('projects.createDialog.browse')}
                        </Button>
                        {apkFilePath && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setApkFilePath("")}
                            className="h-8 px-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Task Description */}
          <div className="space-y-2">
            <Label>
              {t('tasks.createDialog.taskDescription')} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder={
                platform === "web"
                  ? t('tasks.createDialog.taskPlaceholderWeb')
                  : t('tasks.createDialog.taskPlaceholderAndroid')
              }
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              className="resize-none font-sans text-base"
            />
          </div>

          {/* Max Rounds Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-medium">{t('tasks.createDialog.maxRounds')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {t('tasks.createDialog.maxRoundsTooltip')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('tasks.createDialog.maxRoundsDesc')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('tasks.createDialog.globalDefault', { value: globalMaxRounds })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-semibold text-muted-foreground cursor-help">
                      {maxRounds}{" "}
                      {maxRounds === globalMaxRounds && t('tasks.createDialog.default')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('tasks.createDialog.currentSetting', { value: maxRounds })}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('tasks.createDialog.globalDefault', { value: globalMaxRounds })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Slider
              value={[maxRounds]}
              onValueChange={(value) => setMaxRounds(value[0])}
              min={5}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between gap-4 pt-2">
            {/* Left: Model Selection - now editable with registered providers filter */}
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
              registeredProviders={
                registeredProviders.length > 0 ? registeredProviders : undefined
              }
            />

            {/* Right: Split Button (Run + Schedule dropdown) */}
            <div className="flex shrink-0">
              {/* Main Run Button */}
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!isEligible || loading}
                className="rounded-r-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    {t('tasks.running')}
                  </>
                ) : (
                  <>
                    {t('tasks.run')}
                    <span className="ml-1.5 text-xs opacity-60">
                      {window.navigator.platform.toLowerCase().includes('mac') ? '⌘⏎' : 'Ctrl+⏎'}
                    </span>
                  </>
                )}
              </Button>

              {/* Dropdown Trigger */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    disabled={!isEligible || loading}
                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
                    <span className="flex-1">{t('tasks.createDialog.scheduleRun')}</span>
                    <span className="ml-4 text-xs text-muted-foreground">
                      {window.navigator.platform.toLowerCase().includes('mac') ? '⌥⌘⏎' : 'Alt+Ctrl+⏎'}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Schedule Quick Dialog */}
      <ScheduleQuickDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onSchedule={handleScheduledSubmit}
      />
    </Dialog>
  );
}
