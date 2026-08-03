import { useEffect, useMemo, type ReactNode } from "react";
import { useRenderer } from "@opentui/react";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/react";
import {
  registerBackspacePopsPendingSequence,
  registerBaseLayoutFallback,
  registerCommaBindings,
  registerEscapeClearsPendingSequence,
  registerTimedLeader,
} from "@opentui/keymap/addons/opentui";
import { LEADER_TOKEN, LeaderTimeoutDefault, leaderKey } from "@app/keymap";

export function AppKeymapProvider({ children }: { children: ReactNode }) {
  const renderer = useRenderer();
  const keymap = useMemo(() => createDefaultOpenTuiKeymap(renderer), [renderer]);

  useEffect(() => {
    const leader = leaderKey();
    const disposers = [
      registerCommaBindings(keymap),
      registerBaseLayoutFallback(keymap),
      registerEscapeClearsPendingSequence(keymap),
      registerBackspacePopsPendingSequence(keymap),
      leader
        ? registerTimedLeader(keymap, {
            trigger: leader,
            name: LEADER_TOKEN,
            timeoutMs: LeaderTimeoutDefault,
          })
        : () => {},
    ];

    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, [keymap]);

  return <KeymapProvider keymap={keymap}>{children}</KeymapProvider>;
}
