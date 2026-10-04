import { useEffect, useId, useRef } from 'react';
import { ActionButton, ChatGPTMark, classes } from './shared.js';
import type { ChatGPTBrandProps } from './shared.js';
import type { ChatGPTLimitWindow } from './usage-indicator.js';
import { usageLimitLabel } from './usage-indicator.js';

export type ChatGPTRecoveryKind = 'usage_limit' | 'sharing_declined' | 'reauth_required' | 'connection_error';

export interface ChatGPTRecoveryNoticeProps extends ChatGPTBrandProps {
  kind: ChatGPTRecoveryKind;
  appName?: string;
  limitWindow?: ChatGPTLimitWindow;
  onPrimaryAction: () => void;
  primaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  onDismiss?: () => void;
  busy?: boolean;
}

export interface ChatGPTRecoveryDialogProps extends ChatGPTRecoveryNoticeProps {
  open: boolean;
  onDismiss: () => void;
}

function recoveryCopy(kind: ChatGPTRecoveryKind, appName: string, limitWindow: ChatGPTLimitWindow) {
  switch (kind) {
    case 'usage_limit':
      return {
        title: usageLimitLabel(limitWindow),
        description: 'Review your usage settings in ChatGPT.',
        action: 'Manage usage',
      };
    case 'sharing_declined':
      return {
        title: 'You’re signed in with ChatGPT',
        description: `Usage sharing is off. Enable it to use your ChatGPT plan in ${appName}.`,
        action: 'Enable usage sharing',
      };
    case 'reauth_required':
      return {
        title: 'Reconnect to ChatGPT',
        description: `Your connection needs to be renewed before ${appName} can use ChatGPT again.`,
        action: 'Reconnect to ChatGPT',
      };
    case 'connection_error':
      return {
        title: 'Couldn’t connect to ChatGPT',
        description: 'Check your connection and try again. Your existing billing choice stays the same.',
        action: 'Try again',
      };
  }
}

function RecoveryContent({ logoSrc, kind, appName = 'this app', limitWindow = 'unknown', onPrimaryAction, primaryActionLabel, onSecondaryAction, secondaryActionLabel, onDismiss, busy, titleId, descriptionId, modal = false }: ChatGPTRecoveryNoticeProps & { titleId: string; descriptionId: string; modal?: boolean }) {
  const copy = recoveryCopy(kind, appName, limitWindow);
  const usageLimit = kind === 'usage_limit';
  return (
    <>
      {onDismiss && (!modal || !usageLimit) && <button className="siwc-recovery__dismiss" type="button" onClick={onDismiss} aria-label={modal ? 'Close dialog' : 'Dismiss notice'}>Close</button>}
      {!modal && <div className="siwc-recovery__header"><ChatGPTMark src={logoSrc} kind="card" /><span>ChatGPT</span></div>}
      <div className="siwc-recovery__content">
        {modal && <ChatGPTMark src={logoSrc} kind="dialog" />}
        <div className="siwc-recovery__copy">
          <h2 id={titleId} className="siwc-recovery__title">{copy.title}</h2>
          <p id={descriptionId} className="siwc-recovery__description">{copy.description}</p>
        </div>
      </div>
      <div className="siwc-recovery__actions">
        <ActionButton onClick={onPrimaryAction} disabled={busy} external={usageLimit}>{primaryActionLabel ?? copy.action}</ActionButton>
        {onSecondaryAction && secondaryActionLabel && <ActionButton onClick={onSecondaryAction} disabled={busy} secondary>{secondaryActionLabel}</ActionButton>}
      </div>
    </>
  );
}

export function ChatGPTRecoveryNotice({ className, ...props }: ChatGPTRecoveryNoticeProps) {
  const id = useId();
  return (
    <section className={classes('siwc', 'siwc-recovery', 'siwc-recovery--inline', props.kind !== 'usage_limit' && 'siwc-recovery--integration', className)} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={props.busy || undefined}>
      <RecoveryContent {...props} titleId={`${id}-title`} descriptionId={`${id}-description`} />
    </section>
  );
}

export function ChatGPTRecoveryDialog({ open, onDismiss, className, ...props }: ChatGPTRecoveryDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && (document.activeElement === document.body || dialog.contains(document.activeElement))) {
        previousFocus.focus();
      }
    };
  }, [open]);

  return (
    <dialog ref={ref} className={classes('siwc', 'siwc-recovery', 'siwc-recovery--dialog', props.kind !== 'usage_limit' && 'siwc-recovery--integration', className)} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={props.busy || undefined} onCancel={(event) => { event.preventDefault(); onDismiss(); }} onClose={() => { if (open && !ref.current?.open) onDismiss(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
    }}>
      <RecoveryContent {...props} onDismiss={onDismiss} titleId={`${id}-title`} descriptionId={`${id}-description`} modal />
    </dialog>
  );
}
