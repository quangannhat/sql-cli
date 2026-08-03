import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "@app/App";
import { AppKeymapProvider } from "@app/components/keymap-provider";

const renderer = await createCliRenderer();
createRoot(renderer).render(
  <AppKeymapProvider>
    <App />
  </AppKeymapProvider>,
);
