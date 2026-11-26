import { spawn } from "node:child_process";
import { getRunMode } from "../ui/mode.js";

export function publishPackage(pkgDir: string, access: "public" | "restricted"): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("pnpm", ["publish", `--access=${access}`, "--no-git-checks"], {
      cwd: pkgDir,
      // Under --json the child's stdout goes to our stderr: an inherited fd 1
      // bypasses the stdout redirection and would corrupt the JSON document (#71).
      stdio: ["inherit", getRunMode().json ? 2 : "inherit", "inherit"],
      // On Windows `pnpm` is a `.cmd` shim; spawn without a shell throws ENOENT.
      // Args are constant and controlled, so shell interpretation is safe here.
      shell: process.platform === "win32",
    });
    proc.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm publish salió con código ${code}`));
    });
    proc.on("error", reject);
  });
}
