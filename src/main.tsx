import "./ui/instruments.css";
import "./ui/styles/tokens.css";
import "./ui/styles/shell.css";
import "./ui/styles/components.css";
import "./ui/styles/interactions.css";
import "./ui/styles/appearance.css";
import { setupAppearance } from "./ui/appearance";
import { setupControlFeedback } from "./ui/control-feedback";
import { mountStudioShell } from "./ui/shell";
// The runtime owns music and persisted project data; shell updates never recreate it.
await import("./app");
mountStudioShell();
setupControlFeedback();
setupAppearance();

performance.mark("studio-ready");
