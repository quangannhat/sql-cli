import { TextAttributes } from "@opentui/core";
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useKeyboard } from "@opentui/react";
import { configAtom } from "@app/atoms/config";
import { focusAtom } from "@app/atoms/focus";
import { keyModeAtom } from "@app/atoms/keymap";
import { resolve } from "@app/keymap";
import { Sidebar } from "@app/components/sidebar";
import { borderColor } from "@app/theme";

export function App() {
  const result = useAtomValue(configAtom);
  const focus = useAtomValue(focusAtom);
  const setFocus = useAtomSet(focusAtom);
  const keyMode = useAtomValue(keyModeAtom);
  const setKeyMode = useAtomSet(keyModeAtom);

  useKeyboard((key) => {
    const action = resolve(keyMode, key);

    if (action === undefined) {
      if (keyMode !== "normal") setKeyMode("normal");
      return;
    }

    switch (action._tag) {
      case "EnterMode":
        setKeyMode(action.mode);
        break;
      case "FocusPane":
        setFocus(action.pane);
        setKeyMode("normal");
        break;
    }
  });

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
