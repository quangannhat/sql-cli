import { TextAttributes } from "@opentui/core";
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useKeyboard } from "@opentui/react";
import { configAtom } from "./config";
import { focusAtom, windowPendingAtom } from "./focus";
import { Sidebar } from "./components/sidebar";

export function App() {
  const result = useAtomValue(configAtom);
  const focus = useAtomValue(focusAtom);
  const setFocus = useAtomSet(focusAtom);
  const windowPending = useAtomValue(windowPendingAtom);
  const setWindowPending = useAtomSet(windowPendingAtom);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "w") {
      setWindowPending(true);
      return;
    }

    if (!windowPending) return;
    setWindowPending(false);

    if (key.name === "h") setFocus("sidebar");
    if (key.name === "l") setFocus("content");
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
        borderColor={focus === "content" ? "#ffffff" : "#444444"}
        title="content"
        padding={1}
      >
        <text attributes={TextAttributes.DIM}>nothing selected</text>
      </box>
    </box>
  );
}
