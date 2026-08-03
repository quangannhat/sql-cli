import { Result, useAtomValue } from "@effect-atom/atom-react";
import { configAtom } from "@app/atoms/config";
import { focusAtom } from "@app/atoms/focus";
import { borderColor } from "@app/theme";

export function Sidebar() {
  const result = useAtomValue(configAtom);
  const focus = useAtomValue(focusAtom);
  const isFocus = focus === "sidebar";
  const connections = Result.isSuccess(result) ? result.value.connections : [];

  return (
    <box
      width={30}
      border
      borderColor={borderColor(isFocus)}
      title="connections"
      padding={1}
    >
      {connections.map((connection) => (
        <text key={connection.name}>{connection.name}</text>
      ))}
    </box>
  );
}
