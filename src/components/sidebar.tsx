import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { configAtom } from "@app/atoms/config";

export function Sidebar() {
  const result = useAtomValue(configAtom);
  const connections = AsyncResult.isSuccess(result) ? result.value.connections : [];

  return (
    <box width={30} border title="connections" padding={1}>
      {connections.map((connection) => (
        <text key={connection.name}>{connection.name}</text>
      ))}
    </box>
  );
}
