const errorCounts: Record<string, number> = {};
const lastErrors: Record<string, string> = {};

export function recordEngineError(engineId: string, message: string) {
  errorCounts[engineId] = (errorCounts[engineId] ?? 0) + 1;
  lastErrors[engineId] = message;
}

export function getEngineErrorCount(engineId: string): number {
  return errorCounts[engineId] ?? 0;
}

export function getLastEngineError(engineId: string): string | null {
  return lastErrors[engineId] ?? null;
}

export function resetEngineErrors(engineId: string) {
  errorCounts[engineId] = 0;
  delete lastErrors[engineId];
}
