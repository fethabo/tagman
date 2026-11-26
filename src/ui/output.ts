/**
 * stdout reservation for `--json` (#71, design D5).
 *
 * clack (and any other UI code) writes to `process.stdout` by default, which
 * interleaves the UI with the final JSON document. Instead of threading an
 * `output` stream through ~100 call sites, `--json` redirects every write on
 * `process.stdout` to stderr once, and the final document is emitted through
 * the original writer captured here. Child processes (git, pnpm publish) use
 * their own file descriptors and are not affected.
 */
let jsonWriter: ((chunk: string) => boolean) | null = null;

export function reserveStdoutForJson(): void {
  if (jsonWriter) return;
  const original = process.stdout.write.bind(process.stdout);
  jsonWriter = (chunk: string) => original(chunk);
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write;
}

/** Write the single machine-readable document to the real stdout. */
export function emitJson(doc: unknown): void {
  const text = JSON.stringify(doc, null, 2) + "\n";
  if (jsonWriter) jsonWriter(text);
  else process.stdout.write(text);
}
