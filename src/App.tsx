import { TextAttributes } from "@opentui/core";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { configAtom } from "@app/atoms/config";
import { Sidebar } from "@app/components/sidebar";

export function App() {
  const result = useAtomValue(configAtom);

  if (!AsyncResult.isSuccess(result)) {
    return (
      <box flexGrow={1} padding={1}>
        <text attributes={TextAttributes.DIM}>loading config…</text>
      </box>
    );
  }

  return (
    <box flexGrow={1} flexDirection="row">
      <Sidebar />
      <box flexGrow={1} border title="content" padding={1}>
        <text attributes={TextAttributes.DIM}>nothing selected</text>
      </box>
    </box>
  );
}
