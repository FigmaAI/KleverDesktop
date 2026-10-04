import { ChatGPTMark, classes } from './shared.js';
import type { ChatGPTBrandProps } from './shared.js';
import { ChatGPTManageUsageButton } from './manage-usage.js';

export type ChatGPTUsageSource = 'plan' | 'credits' | 'unknown';
export type ChatGPTLimitWindow = 'five_hour' | 'weekly' | 'unknown';

export interface ChatGPTUsageIndicatorProps extends ChatGPTBrandProps {
  /** Pass only a source confirmed by the runtime; sign-in alone cannot establish it. */
  source: ChatGPTUsageSource;
  onManageUsage: () => void;
  limitReached?: boolean;
  limitWindow?: ChatGPTLimitWindow;
  disabled?: boolean;
}

export function usageLimitLabel(window: ChatGPTLimitWindow = 'unknown'): string {
  if (window === 'weekly') return 'ChatGPT weekly usage limit reached';
  if (window === 'five_hour') return 'ChatGPT five-hour usage limit reached';
  return 'ChatGPT usage limit reached';
}

export function ChatGPTUsageIndicator({ logoSrc, source, onManageUsage, limitReached = false, limitWindow, disabled = false, className }: ChatGPTUsageIndicatorProps) {
  const label = source === 'unknown' ? 'Connected with ChatGPT' : `Using ChatGPT ${source}`;
  return (
    <div className={classes('siwc', 'siwc-usage', limitReached && 'siwc-usage--with-detail', source === 'unknown' && 'siwc-usage--unknown', className)}>
      <ChatGPTMark src={logoSrc} kind="usage" />
      <div className="siwc-usage__copy" aria-live="polite" aria-atomic="true">
        <span>{label}</span>
        {limitReached && <span className="siwc-usage__detail">{usageLimitLabel(limitWindow)}</span>}
      </div>
      <ChatGPTManageUsageButton onClick={onManageUsage} disabled={disabled} />
    </div>
  );
}
