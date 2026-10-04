import type { ReactNode } from 'react';

export interface ChatGPTBrandProps {
  /** Override the bundled mark with a URL suitable for the surface. */
  logoSrc?: string;
  className?: string;
}

export function classes(...values: (string | undefined | false)[]): string {
  return values.filter(Boolean).join(' ');
}

const marks = {
  'button-black': [new URL('./assets/brand/chatgpt-button-black-21.svg', import.meta.url).href, 21],
  'button-white': [new URL('./assets/brand/chatgpt-button-white-21.svg', import.meta.url).href, 21],
  usage: [new URL('./assets/brand/chatgpt-usage-20.svg', import.meta.url).href, 20],
  callout: [new URL('./assets/brand/chatgpt-callout-24.svg', import.meta.url).href, 24],
  dialog: [new URL('./assets/brand/chatgpt-dialog-72.svg', import.meta.url).href, 72],
  card: [new URL('./assets/brand/chatgpt-card-24.svg', import.meta.url).href, 24],
} as const;

export function ChatGPTMark({ src, kind = 'card' }: { src?: string; kind?: keyof typeof marks }) {
  const [bundled, size] = marks[kind];
  return <img className="siwc-mark" src={src ?? bundled} alt="" aria-hidden="true" width={size} height={size} />;
}

const externalIcons = {
  'black-16': [new URL('./assets/icons/external-black-16.svg', import.meta.url).href, 16],
  'white-16': [new URL('./assets/icons/external-white-16.svg', import.meta.url).href, 16],
  'white-20': [new URL('./assets/icons/external-white-20.svg', import.meta.url).href, 20],
} as const;

export function ExternalLinkIcon({ kind }: { kind: keyof typeof externalIcons }) {
  const [src, size] = externalIcons[kind];
  return <img className="siwc-mark" src={src} alt="" aria-hidden="true" width={size} height={size} />;
}

export function ActionButton({ children, onClick, secondary = false, disabled = false, external = false }: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
  external?: boolean;
}) {
  return (
    <button className={classes('siwc-action', secondary && 'siwc-action--secondary')} type="button" onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      {external && <ExternalLinkIcon kind="white-20" />}
    </button>
  );
}
