import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { ChatGPTMark, ExternalLinkIcon, classes } from './shared.js';
import type { ChatGPTBrandProps } from './shared.js';

export interface ChatGPTManageUsageButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  appearance?: 'primary' | 'secondary';
}

export const ChatGPTManageUsageButton = forwardRef<HTMLButtonElement, ChatGPTManageUsageButtonProps>(
  function ChatGPTManageUsageButton({ appearance = 'secondary', type = 'button', className, ...props }, ref) {
    return (
      <button aria-label="Manage ChatGPT usage (opens in browser)" {...props} ref={ref} type={type} className={classes('siwc', 'siwc-manage', `siwc-manage--${appearance}`, className)}>
        <span>Manage usage</span>
        <ExternalLinkIcon kind={appearance === 'primary' ? 'white-16' : 'black-16'} />
      </button>
    );
  },
);

export interface ChatGPTUsageCalloutProps extends ChatGPTBrandProps {
  onManageUsage: () => void;
  disabled?: boolean;
}

export function ChatGPTUsageCallout({ logoSrc, onManageUsage, disabled, className }: ChatGPTUsageCalloutProps) {
  return (
    <div className={classes('siwc', 'siwc-usage-callout', className)}>
      <div className="siwc-usage-callout__message">
        <ChatGPTMark src={logoSrc} kind="callout" />
        <span>View and manage your ChatGPT usage</span>
      </div>
      <ChatGPTManageUsageButton appearance="primary" onClick={onManageUsage} disabled={disabled} />
    </div>
  );
}
