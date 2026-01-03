import type { CurlExitCode } from './curlErrors'

export interface RunResult {
  exitCode: CurlExitCode | null
  stdout: Buffer
  stderr: Buffer
}

export interface RunStreamResult {
  exitCode: CurlExitCode | null
  stderr: Buffer
}
