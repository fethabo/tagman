import { spawn } from "node:child_process";

export function publishPackage(pkgDir: string, access: "public" | "restricted"): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("pnpm", ["publish", `--access=${access}`, "--no-git-checks"], {
      cwd: pkgDir,
      stdio: "inherit",
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
