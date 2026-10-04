import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { ChatGPTMark, classes } from './shared.js';
import type { ChatGPTBrandProps } from './shared.js';

export interface ContinueWithChatGPTButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, ChatGPTBrandProps {
  loading?: boolean;
  appearance?: 'black' | 'white';
  label?: 'continue' | 'sign-in';
  /** Compatibility alias: solid maps to black, outline to the borderless white design. */
  variant?: 'solid' | 'outline';
}

export const ContinueWithChatGPTButton = forwardRef<HTMLButtonElement, ContinueWithChatGPTButtonProps>(
  function ContinueWithChatGPTButton({ logoSrc, loading = false, appearance, label = 'continue', variant, className, disabled, type = 'button', ...props }, ref) {
    const color = appearance ?? (variant === 'outline' ? 'white' : 'black');
    return (
      <button {...props} ref={ref} type={type} className={classes('siwc', 'siwc-continue', `siwc-continue--${color}`, className)} disabled={disabled || loading} aria-busy={loading || undefined}>
        <ChatGPTMark src={logoSrc} kind={color === 'black' ? 'button-white' : 'button-black'} />
        <span>{loading ? 'Opening ChatGPT…' : label === 'sign-in' ? 'Sign-in with ChatGPT' : 'Continue with ChatGPT'}</span>
      </button>
    );
  },
);
