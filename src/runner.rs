use crate::error::{CuimpError, Result};
use std::process::Stdio;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

#[derive(Debug)]
pub struct RunResult {
    pub exit_code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

pub async fn run_binary(
    bin_path: &str,
    args: &[String],
    timeout_ms: Option<u64>,
) -> Result<RunResult> {
    let mut child = Command::new(bin_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| CuimpError::RequestFailed(format!("Failed to spawn process: {}", e)))?;

    let stdout_handle = child.stdout.take().ok_or_else(|| {
        CuimpError::RequestFailed("Failed to capture stdout".to_string())
    })?;

    let stderr_handle = child.stderr.take().ok_or_else(|| {
        CuimpError::RequestFailed("Failed to capture stderr".to_string())
    })?;

    // Read stdout and stderr concurrently
    let (stdout_result, stderr_result) = tokio::join!(
        read_stream(stdout_handle),
        read_stream(stderr_handle)
    );

    let stdout = stdout_result?;
    let stderr = stderr_result?;

    // Wait for the child process with optional timeout
    let status = if let Some(timeout_ms) = timeout_ms {
        match timeout(Duration::from_millis(timeout_ms), child.wait()).await {
            Ok(Ok(status)) => status,
            Ok(Err(e)) => {
                return Err(CuimpError::RequestFailed(format!(
                    "Process error: {}",
                    e
                )))
            }
            Err(_) => {
                // Timeout occurred, kill the process
                let _ = child.kill().await;
                return Err(CuimpError::Timeout(format!(
                    "Request timed out after {} ms",
                    timeout_ms
                )));
            }
        }
    } else {
        child
            .wait()
            .await
            .map_err(|e| CuimpError::RequestFailed(format!("Process wait error: {}", e)))?
    };

    Ok(RunResult {
        exit_code: status.code(),
        stdout,
        stderr,
    })
}

async fn read_stream<R: tokio::io::AsyncRead + Unpin>(
    mut stream: R,
) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    stream
        .read_to_end(&mut buffer)
        .await
        .map_err(|e| CuimpError::IoError(e))?;
    Ok(buffer)
}
