"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import styles from "./collapsible-workspace.module.css";

const preferenceEvent = "dolziklub:disclosure";
const memory = new Map<string, boolean>();

export function useStoredDisclosure(scope: string, memberId?: string | null) {
  const key = `dolziklub:disclosure:v1:${memberId ?? "guest"}:${scope}`;
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(preferenceEvent, notify);
    window.addEventListener("storage", notify);
    return () => {
      window.removeEventListener(preferenceEvent, notify);
      window.removeEventListener("storage", notify);
    };
  }, []);
  const read = useCallback(() => {
    if (memory.has(key)) return memory.get(key) ?? true;
    try { return localStorage.getItem(key) !== "closed"; }
    catch { return true; }
  }, [key]);
  const open = useSyncExternalStore(subscribe, read, () => true);
  const setOpen = useCallback((next: boolean) => {
    try {
      localStorage.setItem(key, next ? "open" : "closed");
      memory.delete(key);
    }
    catch { memory.set(key, next); }
    window.dispatchEvent(new Event(preferenceEvent));
  }, [key]);
  return { open, setOpen };
}

export function DisclosureButton({ id, title, open, onToggle }: { id: string; title: string; open: boolean; onToggle: () => void }) {
  return <button type="button" className={styles.collapseButton} aria-label={`${open ? "Réduire" : "Déplier"} ${title}`} aria-expanded={open} aria-controls={id} onClick={onToggle}>
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 6 6 6 6-6m-12 6 6 6 6-6" />
    </svg>
  </button>;
}

export function DisclosureContent({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return <div id={id} className={styles.content} hidden={!open}>{children}</div>;
}
