$ErrorActionPreference = "Stop"

function Invoke-PrecommitStep {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,

        [Parameter(Mandatory = $true)]
        [string] $Command,

        [Parameter(Mandatory = $true)]
        [int] $TimeoutSeconds
    )

	Write-Host ""
	Write-Host "==> $Name"

	$process = [System.Diagnostics.Process]::new()
	$pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
	if ($pwsh) {
		$process.StartInfo.FileName = $pwsh.Source
	} else {
		$process.StartInfo.FileName = "powershell.exe"
	}
	$workingDirectory = (Get-Location).Path.Replace("'", "''")
	$script = "Set-Location -LiteralPath '$workingDirectory'; $Command; if (`$LASTEXITCODE -ne `$null) { exit `$LASTEXITCODE }"
	$encodedScript = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
	$process.StartInfo.ArgumentList.Add("-NoLogo")
	$process.StartInfo.ArgumentList.Add("-NoProfile")
	$process.StartInfo.ArgumentList.Add("-NonInteractive")
	$process.StartInfo.ArgumentList.Add("-ExecutionPolicy")
	$process.StartInfo.ArgumentList.Add("Bypass")
	$process.StartInfo.ArgumentList.Add("-EncodedCommand")
	$process.StartInfo.ArgumentList.Add($encodedScript)
	$process.StartInfo.WorkingDirectory = (Get-Location).Path
	$process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true

    [void] $process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()

    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        try {
            $process.Kill($true)
        } catch {
            $process.Kill()
        }
        Write-Error "$Name timed out after $TimeoutSeconds seconds: $Command"
        exit 124
    }

    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()

	if ($stdout) {
		Write-Host $stdout.TrimEnd()
	}
	if ($stderr) {
		Write-Host $stderr.TrimEnd()
	}

    if ($process.ExitCode -ne 0) {
        Write-Error "$Name failed with exit code $($process.ExitCode): $Command"
        exit $process.ExitCode
    }
}

Invoke-PrecommitStep "Biome format" "npx --no-install biome format . --write" 120
Invoke-PrecommitStep "Biome check" "npx --no-install biome check ." 120

$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

$runFullGate = $env:CEITS_PRECOMMIT_FULL -eq "1"
$runSemgrep = $env:CEITS_PRECOMMIT_SEMGREP -eq "1" -or $runFullGate
if ($runSemgrep) {
    $stagedFiles = git diff --cached --name-only --diff-filter=ACMR | Where-Object {
        $_ -match '\.(js|jsx|ts|tsx|json|html|css|ya?ml|sh|ps1)$'
    }
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
    if ($stagedFiles.Count -gt 0) {
        $semgrepTargets = ($stagedFiles | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join " "
        Invoke-PrecommitStep "Semgrep staged files" "semgrep scan --config auto --error $semgrepTargets" 180
    } else {
        Write-Host ""
        Write-Host "==> Semgrep staged files"
        Write-Host "No staged frontend/security files to scan."
    }
} else {
    Write-Host ""
    Write-Host "==> Semgrep"
    Write-Host "Skipped in pre-commit because Semgrep --config auto can hang on Windows. Run npm run security:scan manually, or set CEITS_PRECOMMIT_SEMGREP=1 to opt in."
}

Invoke-PrecommitStep "Boundary lint" "npm run lint:boundaries" 120

if ($runFullGate) {
    Invoke-PrecommitStep "Web build" "npm run build:web" 300
    Invoke-PrecommitStep "Marketing build" "npm run build:marketing" 240
} else {
    Write-Host ""
    Write-Host "==> Build gate"
    Write-Host "Skipped in fast pre-commit. Run npm run build:web and npm run build:marketing manually, or set CEITS_PRECOMMIT_FULL=1 to opt in."
}
