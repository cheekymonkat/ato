import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { theme } from '../../theme/tokens';
import { GearPreviewContent } from './GearPreviewContent';
import type { GearPreviewProps } from './GearPreviewContent';

export function GearPreviewTrigger(props: GearPreviewProps) {
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<'hover' | 'press' | null>(null), [position, setPosition] = useState({ left: 16, top: 16, width: 320 });
  const panelId = useId();
  const cancelClose = useCallback(() => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } }, []);
  const close = useCallback(() => { cancelClose(); setMode(null); }, [cancelClose]);
  const leave = () => {
    cancelClose();
    // A small grace period lets the pointer cross the gap between link and card.
    if (mode === 'hover') timer.current = setTimeout(() => setMode(null), 180);
  };
  useEffect(() => cancelClose, [cancelClose]);
  useLayoutEffect(() => {
    if (!mode) return;
    const bounds = trigger.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = Math.min(320, window.innerWidth - 48), outerWidth = width + 16;
    const height = Math.min(panel.current?.getBoundingClientRect().height ?? 600, window.innerHeight - 32);
    const beside = bounds.right + 8 + outerWidth <= window.innerWidth - 16 ? bounds.right + 8 : bounds.left - 8 - outerWidth;
    setPosition({ width, left: Math.max(16, Math.min(beside, window.innerWidth - 16 - outerWidth)), top: Math.max(16, Math.min(bounds.top, window.innerHeight - 16 - height)) });
  }, [mode]);
  useEffect(() => {
    if (!mode) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) close();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); trigger.current?.focus(); }
    };
    const scroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keydown);
      window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', close); window.removeEventListener('blur', close);
    };
  }, [mode, close]);
  return <>
    <button ref={trigger} type="button" aria-label={`Preview ${props.label}`} aria-expanded={Boolean(mode)} aria-controls={mode ? panelId : undefined}
      onPointerEnter={event => { if (event.pointerType === 'mouse') { cancelClose(); setMode('hover'); } }} onPointerLeave={leave}
      onClick={event => { cancelClose(); setMode(mode === 'hover' && event.detail > 0 ? 'hover' : 'press'); }}
      style={{ padding: 0, border: 0, background: 'transparent', color: '#89E2EC', textDecoration: 'underline', fontSize: 13, lineHeight: '19px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      {props.label}
    </button>
    {mode && typeof document !== 'undefined' && createPortal(<div ref={panel} id={panelId} role="dialog" aria-label="Gear preview"
      onPointerEnter={cancelClose} onPointerLeave={leave} onFocus={cancelClose}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) close(); }}
      style={{ position: 'fixed', zIndex: 1000, left: position.left, top: position.top, width: position.width, padding: 8, boxSizing: 'content-box', maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', background: theme.paper, borderRadius: 10, boxShadow: '0 8px 30px #29272355' }}>
      <button type="button" aria-label="Close Gear preview" onClick={() => { close(); trigger.current?.focus(); }}
        style={{ display: 'block', marginLeft: 'auto', marginBottom: 6, border: 0, background: 'transparent', color: theme.ink, fontSize: 22, cursor: 'pointer' }}>×</button>
      <GearPreviewContent {...props} width={position.width} onReference={(id, name) => { close(); props.onReference?.(id, name); }} />
    </div>, document.body)}
  </>;
}
