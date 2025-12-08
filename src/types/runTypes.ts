export interface RunResult {
  exitCode: number | null
  stdout: Buffer
  stderr: Buffer
}
