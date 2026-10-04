import { ContinueWithChatGPTButton } from './continue-button.js';
import { ActionButton, ChatGPTMark, classes } from './shared.js';
import type { ChatGPTBrandProps } from './shared.js';
import { ChatGPTManageUsageButton } from './manage-usage.js';

export type ChatGPTConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reauth_required';

export interface ChatGPTConnectionCardProps extends ChatGPTBrandProps {
  status: ChatGPTConnectionStatus;
  sharing: boolean;
  identity?: { name?: string; email?: string };
  onConnect: () => void;
  onDisconnect?: () => void;
  onManageUsage?: () => void;
  appName?: string;
  onConnectCodex?: () => void;
  context?: 'default' | 'setup';
}

export function ChatGPTConnectionCard({ logoSrc, status, sharing, identity, onConnect, onDisconnect, onManageUsage, appName = 'this app', onConnectCodex, context = 'default', className }: ChatGPTConnectionCardProps) {
  const connected = status === 'connected';
  if (!connected) {
    const title = status === 'reauth_required' ? 'Reconnect to ChatGPT' : 'Connect your ChatGPT plan';
    const description = status === 'connecting'
      ? 'Finish connecting in your browser.'
      : status === 'reauth_required'
        ? 'Reconnect to renew your ChatGPT connection.'
        : context === 'setup'
          ? `Use your ChatGPT plan in ${appName}.`
          : `Sign in with ChatGPT to use your plan in ${appName}.`;
    return (
      <section className={classes('siwc', 'siwc-connection', `siwc-connection--${context}`, className)} aria-label="ChatGPT connection">
        <div className="siwc-connection__content">
          <div className="siwc-connection__message" aria-live="polite">
            <h2 className="siwc-connection__title">{title}</h2>
            <p className="siwc-connection__description">{description}</p>
          </div>
          <ContinueWithChatGPTButton logoSrc={logoSrc} onClick={onConnect} loading={status === 'connecting'} />
        </div>
        {onConnectCodex && <button type="button" className="siwc-connection__codex" onClick={onConnectCodex} disabled={status === 'connecting'}>Connect through Codex</button>}
      </section>
    );
  }
  return (
    <section className={classes('siwc', 'siwc-connection', 'siwc-connection--connected', className)} aria-label="ChatGPT connection">
      <div className="siwc-connection__header">
        <ChatGPTMark src={logoSrc} kind="card" />
        <div className="siwc-connection__identity">
          <strong>{identity?.name || 'Connected with ChatGPT'}</strong>
          {identity?.email && <span>{identity.email}</span>}
        </div>
        <span className="siwc-connection__status">Connected</span>
      </div>
      <p className="siwc-connection__description" aria-live="polite">
        {sharing ? 'Usage sharing is enabled.' : 'You’re signed in. Usage sharing is off.'}
      </p>
      <div className="siwc-connection__actions">
        {!sharing && <ActionButton onClick={onConnect}>Enable usage sharing</ActionButton>}
        {sharing && onManageUsage && <ChatGPTManageUsageButton onClick={onManageUsage} />}
        {onDisconnect && <ActionButton onClick={onDisconnect} secondary>Disconnect</ActionButton>}
      </div>
    </section>
  );
}
