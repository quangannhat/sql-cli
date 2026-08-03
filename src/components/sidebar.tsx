import { Result, useAtomValue } from "@effect-atom/atom-react";
import { configAtom } from "../config";
import { focusAtom } from "../focus";

export function Sidebar() {
  const result = useAtomValue(configAtom);
  const focus = useAtomValue(focusAtom);
  const connections = Result.isSuccess(result) ? result.value.connections : [];

  return (
    <box
      width={30}
      border
      borderColor={focus === "sidebar" ? "#ffffff" : "#444444"}
      title="connections"
      padding={1}
    >
      {connections.map((connection) => (
        <text key={connection.name}>{connection.name}</text>
      ))}
    </box>
  );
}
