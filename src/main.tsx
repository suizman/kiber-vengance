import "./ui/instruments.css";
import "./ui/styles/tokens.css";
import "./ui/styles/shell.css";
import "./ui/styles/components.css";
import { mountStudioShell } from "./ui/shell";
// The runtime owns music and persisted project data; shell updates never recreate it.
await import("./app");
mountStudioShell();

performance.mark("studio-ready");
