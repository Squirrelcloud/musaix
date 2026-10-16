import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";

// Alic3X has no shell or file tools (defaultTools: false), so it never uses its
// sandbox. eve still requires one; the pure-JS just-bash provider is the
// lightest option and avoids provisioning a Vercel Sandbox per session.
export const environment = JustBashSandbox.environment({ autoInstall: false });
export default defineSandbox(() => environment.open());
