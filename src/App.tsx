import { TextAttributes } from "@opentui/core";
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useBindings } from "@opentui/keymap/react";
import { configAtom } from "@app/atoms/config";
import { focusAtom } from "@app/atoms/focus";
import { CommandMap, lookup } from "@app/keymap";
import { Sidebar } from "@app/components/sidebar";
import { borderColor } from "@app/theme";

export function App() {
  const result = useAtomValue(configAtom);
  const focus = useAtomValue(focusAtom);
  const setFocus = useAtomSet(focusAtom);

  useBindings(
    () => ({
      bindings: lookup.bindings,
      commands: [
        { name: CommandMap.focus_sidebar, run: () => setFocus("sidebar") },
        { name: CommandMap.focus_content, run: () => setFocus("content") },
      ],
    }),
    [setFocus],
  );

  if (!Result.isSuccess(result)) {
    return (
      <box flexGrow={1} padding={1}>
        <text attributes={TextAttributes.DIM}>loading config…</text>
      </box>
    );
  }

  return (
    <box flexGrow={1} flexDirection="row">
      <Sidebar />
      <box
        flexGrow={1}
        border
        borderColor={borderColor(focus === "content")}
        title="content"
        padding={1}
      >
        <text attributes={TextAttributes.DIM}>nothing selected</text>
      </box>
    </box>
  );
}
