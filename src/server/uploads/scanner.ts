import "server-only";

// Malware scanning behind one interface (D-076). The Presidency's IT has not chosen a scanner yet,
// so the only implementation is a no-op: files are NOT scanned. No screen or document may say that
// they are. A real scanner (e.g. clamd) implements `scan` and the pipeline refuses infected files.

export type ScanResult = { clean: true } | { clean: false; reason: string };

export interface MalwareScanner {
  /** True when this scanner really inspects files. */
  readonly active: boolean;
  scan(localPath: string): Promise<ScanResult>;
}

/** NO-OP: performs no scanning at all. Placeholder until the real scanner is decided. */
export class NoopMalwareScanner implements MalwareScanner {
  readonly active = false;
  async scan(): Promise<ScanResult> {
    return { clean: true };
  }
}

let scanner: MalwareScanner = new NoopMalwareScanner();

export function getMalwareScanner(): MalwareScanner {
  return scanner;
}

/** Test hook: replaces the scanner and returns the previous one. */
export function setMalwareScanner(next: MalwareScanner): MalwareScanner {
  const previous = scanner;
  scanner = next;
  return previous;
}
