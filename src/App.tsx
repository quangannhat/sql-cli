import { TextAttributes } from "@opentui/core";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { configAtom } from "./config";

export function App() {
  const result = useAtomValue(configAtom);

  if (!Result.isSuccess(result)) {
    return (
      <box flexGrow={1} padding={1}>
        <text attributes={TextAttributes.DIM}>loading config…</text>
      </box>
    );
  }

  return (
    <box flexGrow={1} padding={1}>
      <text attributes={TextAttributes.DIM}>config</text>
      <text>{JSON.stringify(result.value, null, 2)}</text>
    </box>
  );
}
