import { getPreferenceValues, launchCommand, LaunchType, LocalStorage, showHUD, showToast, Toast } from "@raycast/api";
import { exec, execSync, spawn, ChildProcess } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

type Preferences = {
  preventDisplay: boolean;
  preventSystem: boolean;
  icon: string;
};

type Updates = {
  menubar: boolean;
  status: boolean;
};

export interface Schedule {
  day: string;
  from: string;
  to: string;
  IsManuallyDecafed: boolean;
  IsRunning: boolean;
}

export interface CaffeinationInfo {
  type: "manual" | "timed" | "until" | "while" | "scheduled";
  startTime: number;
  endTime?: number;
  appName?: string;
  appPid?: string;
}

const PROCESS_MARKER = "RAYCAST_COFFEE_CAFFEINATE";
let caffeinateProcess: ChildProcess | null = null;

// Helper to find PowerShell executable
function getPowerShellPath(): string {
  // Try PowerShell Core first (pwsh), fallback to Windows PowerShell
  try {
    execSync("where pwsh", { stdio: "ignore" });
    return "pwsh";
  } catch {
    return "powershell.exe";
  }
}

// PowerShell script to prevent sleep on Windows
function generatePowerShellScript(duration?: number, windowTitle?: string): string {
  const preferences = getPreferenceValues<Preferences>();
  
  // ES_CONTINUOUS = 0x80000000 (2147483648 as UInt32)
  // ES_SYSTEM_REQUIRED = 0x00000001
  // ES_DISPLAY_REQUIRED = 0x00000002
  let executionState = "2147483648"; // ES_CONTINUOUS as unsigned int
  
  if (preferences.preventSystem) {
    executionState = "2147483649"; // ES_CONTINUOUS | ES_SYSTEM_REQUIRED
  }
  
  if (preferences.preventDisplay) {
    executionState = preferences.preventSystem ? "2147483651" : "2147483650"; // add ES_DISPLAY_REQUIRED
  }

  const title = windowTitle || PROCESS_MARKER;

  const script = `
# Set console window title for identification
$host.UI.RawUI.WindowTitle = "${title}"

Add-Type @'
using System;
using System.Runtime.InteropServices;

public class PowerUtil {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
'@

$ES_FLAGS = [uint32]${executionState}

try {
    $result = [PowerUtil]::SetThreadExecutionState($ES_FLAGS)
    if ($result -eq 0) {
        Write-Error "Failed to set execution state"
        exit 1
    }
    
    Write-Host "${PROCESS_MARKER}_STARTED"
    
    ${duration ? `Start-Sleep -Seconds ${duration}` : "while($true) { Start-Sleep -Seconds 1 }"}
    
} finally {
    # Always reset to normal state (ES_CONTINUOUS only)
    [PowerUtil]::SetThreadExecutionState([uint32]2147483648)
    Write-Host "${PROCESS_MARKER}_STOPPED"
}
`;

  return script;
}

export async function startCaffeinate(
  updates: Updates,
  hudMessage?: string,
  duration?: number,
  caffeinationInfo?: CaffeinationInfo
) {
  if (hudMessage) {
    await showHUD(hudMessage);
  }
  
  await stopCaffeinate({ menubar: false, status: false });
  
  const windowTitle = `${PROCESS_MARKER}_${randomUUID()}`;
  const script = generatePowerShellScript(duration, windowTitle);
  const scriptPath = join(tmpdir(), `raycast-coffee-${randomUUID()}.ps1`);
  
  try {
    writeFileSync(scriptPath, script, "utf-8");
    
    const powershell = getPowerShellPath();
    
    // Execute PowerShell script with output capture for error detection
    caffeinateProcess = spawn(powershell, [
      "-ExecutionPolicy",
      "Bypass",
      "-NoProfile",
      "-WindowStyle",
      "Hidden",
      "-File",
      scriptPath
    ], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    
    // Monitor for startup errors
    let startupError = "";
    let started = false;
    
    caffeinateProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes(`${PROCESS_MARKER}_STARTED`)) {
        started = true;
      }
    });
    
    caffeinateProcess.stderr?.on("data", (data) => {
      startupError += data.toString();
    });
    
    caffeinateProcess.on("error", async (error) => {
      console.error("PowerShell process error:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "❌ Caffeination failed",
        message: error.message
      });
    });
    
    caffeinateProcess.on("exit", async (code) => {
      if (code !== 0 && !started) {
        console.error("PowerShell script failed:", startupError);
        await showToast({
          style: Toast.Style.Failure,
          title: "❌ Caffeination failed",
          message: "PowerShell script error"
        });
      }
      
      // Clean up when process exits
      caffeinateProcess = null;
      
      if (existsSync(scriptPath)) {
        try {
          unlinkSync(scriptPath);
        } catch (e) {
          console.error("Failed to cleanup script:", e);
        }
      }
      
      // Update UI when caffeination ends naturally
      if (code === 0 && duration) {
        await showToast({
          style: Toast.Style.Success,
          title: "☕ Caffeination complete",
          message: "Your PC can sleep now"
        });
        await update(updates, false);
      }
    });
    
    caffeinateProcess.unref();
    
    // Wait a bit to check if startup succeeded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!caffeinateProcess || caffeinateProcess.exitCode !== null) {
      throw new Error("PowerShell process failed to start");
    }
    
    // Store process info for later termination
    if (caffeinateProcess.pid) {
      await LocalStorage.setItem("caffeinate_pid", caffeinateProcess.pid.toString());
      await LocalStorage.setItem("caffeinate_window_title", windowTitle);
      await LocalStorage.setItem("caffeinate_script", scriptPath);
    }
    
    // Store caffeination info
    if (caffeinationInfo) {
      await LocalStorage.setItem("caffeination_info", JSON.stringify(caffeinationInfo));
    }
    
    await update(updates, true);
  } catch (error) {
    console.error("Failed to start caffeination:", error);
    
    // Cleanup on error
    if (existsSync(scriptPath)) {
      try {
        unlinkSync(scriptPath);
      } catch (e) {
        // Ignore
      }
    }
    
    await showToast({
      style: Toast.Style.Failure,
      title: "❌ Caffeination failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
    
    throw error;
  }
}

export async function stopCaffeinate(updates: Updates, hudMessage?: string) {
  if (hudMessage) {
    await showHUD(hudMessage);
  }
  
  try {
    const storedPid = await LocalStorage.getItem<string>("caffeinate_pid");
    const windowTitle = await LocalStorage.getItem<string>("caffeinate_window_title");
    const scriptPath = await LocalStorage.getItem<string>("caffeinate_script");
    
    if (storedPid) {
      try {
        // Try direct kill by PID first
        try {
          process.kill(parseInt(storedPid), 0); // Check if process exists
          process.kill(parseInt(storedPid), "SIGTERM"); // Terminate gracefully
        } catch (e) {
          // Process doesn't exist or we can't kill it, try taskkill
          try {
            execSync(`taskkill /PID ${storedPid} /F`, { stdio: "ignore" });
          } catch (killError) {
            // Process might already be dead
          }
        }
        
        // Fallback: kill by window title if we have it
        if (windowTitle) {
          const powershell = getPowerShellPath();
          try {
            execSync(
              `${powershell} -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*${windowTitle}*' } | Stop-Process -Force"`,
              { stdio: "ignore", timeout: 5000 }
            );
          } catch (e) {
            // Ignore, process might already be stopped
          }
        }
      } catch (error) {
        console.error("Error killing process:", error);
      }
      
      await LocalStorage.removeItem("caffeinate_pid");
      await LocalStorage.removeItem("caffeinate_window_title");
    }
    
    // Clean up script file
    if (scriptPath && existsSync(scriptPath)) {
      try {
        unlinkSync(scriptPath);
      } catch (e) {
        console.error("Failed to cleanup script:", e);
      }
      await LocalStorage.removeItem("caffeinate_script");
    }
    
    // Clean up caffeination info
    await LocalStorage.removeItem("caffeination_info");
    
    // Reset execution state to normal (insurance)
    const powershell = getPowerShellPath();
    const resetScript = `
Add-Type @'
using System;
using System.Runtime.InteropServices;

public class PowerUtil {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
'@

[PowerUtil]::SetThreadExecutionState([uint32]2147483648)
`;
    
    const resetScriptPath = join(tmpdir(), `raycast-coffee-reset-${randomUUID()}.ps1`);
    try {
      writeFileSync(resetScriptPath, resetScript, "utf-8");
      
      execSync(`${powershell} -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "${resetScriptPath}"`, {
        stdio: "ignore",
        timeout: 5000
      });
      
      unlinkSync(resetScriptPath);
    } catch (e) {
      console.error("Failed to reset execution state:", e);
      // Cleanup temp file even on error
      if (existsSync(resetScriptPath)) {
        try {
          unlinkSync(resetScriptPath);
        } catch (cleanupError) {
          // Ignore
        }
      }
    }
    
    // Clear process reference
    caffeinateProcess = null;
    
  } catch (error) {
    console.error("Error stopping caffeination:", error);
  }
  
  await update(updates, false);
}

async function update(updates: Updates, caffeinated: boolean) {
  if (updates.menubar) {
    await tryLaunchCommand("index", { caffeinated });
  }
  if (updates.status) {
    await tryLaunchCommand("status", { caffeinated });
  }
}

async function tryLaunchCommand(commandName: string, context: { caffeinated: boolean }) {
  try {
    await launchCommand({ name: commandName, type: LaunchType.Background, context });
  } catch (error) {
    // Handle error if command is not enabled
  }
}

export function numberToDayString(dayIndex: number): string {
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return daysOfWeek[dayIndex];
}

export async function getSchedule() {
  const currentDate = new Date();
  const currentDayString = numberToDayString(currentDate.getDay()).toLowerCase();

  const getSchedule: string | undefined = await LocalStorage.getItem(currentDayString);
  if (getSchedule === undefined) return undefined;

  const schedule: Schedule = JSON.parse(getSchedule);
  return schedule;
}

export async function changeScheduleState(operation: string, schedule: Schedule) {
  switch (operation) {
    case "caffeinate": {
      schedule.IsManuallyDecafed = false;
      schedule.IsRunning = false;
      await LocalStorage.setItem(schedule.day, JSON.stringify(schedule));
      break;
    }
    case "decaffeinate": {
      if (schedule.IsRunning === true || isNotTodaysSchedule(schedule)) {
        schedule.IsManuallyDecafed = true;
        schedule.IsRunning = false;
        await LocalStorage.setItem(schedule.day, JSON.stringify(schedule));
      }
      break;
    }

    default:
      break;
  }
}

export function isTodaysSchedule(schedule: Schedule) {
  const currentDate = new Date();
  const currentDayString = numberToDayString(currentDate.getDay()).toLowerCase();

  if (schedule.day === currentDayString) return true;
  else return false;
}

export function isNotTodaysSchedule(schedule: Schedule) {
  const currentDate = new Date();
  const currentDayString = numberToDayString(currentDate.getDay()).toLowerCase();

  if (schedule.day === currentDayString) return false;
  else return true;
}

export function formatDuration(seconds: number): string {
  const units = [
    { label: "d", value: 86400 },
    { label: "h", value: 3600 },
    { label: "m", value: 60 },
    { label: "s", value: 1 },
  ];

  const result: string[] = [];

  for (const unit of units) {
    const amount = Math.floor(seconds / unit.value);
    seconds %= unit.value;
    if (amount > 0) {
      result.push(`${amount}${unit.label}`);
    }
  }

  return result.join(" ");
}

export async function getCaffeinationInfo(): Promise<CaffeinationInfo | null> {
  const infoStr = await LocalStorage.getItem<string>("caffeination_info");
  if (!infoStr) return null;
  
  try {
    return JSON.parse(infoStr) as CaffeinationInfo;
  } catch (error) {
    return null;
  }
}

export async function isCaffeinated(): Promise<boolean> {
  const storedPid = await LocalStorage.getItem<string>("caffeinate_pid");
  
  if (!storedPid) {
    return false;
  }
  
  try {
    // Use Node's process.kill with signal 0 to check if process exists
    // This doesn't actually kill the process, just checks existence
    process.kill(parseInt(storedPid), 0);
    return true;
  } catch (e) {
    // Process not found, clean up
    await LocalStorage.removeItem("caffeinate_pid");
    await LocalStorage.removeItem("caffeinate_window_title");
    
    const scriptPath = await LocalStorage.getItem<string>("caffeinate_script");
    if (scriptPath) {
      await LocalStorage.removeItem("caffeinate_script");
      if (existsSync(scriptPath)) {
        try {
          unlinkSync(scriptPath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
    
    await LocalStorage.removeItem("caffeination_info");
    return false;
  }
}

// Get list of running applications (Windows-specific)
export async function getRunningApplications(): Promise<Array<{ name: string; pid: number }>> {
  return new Promise((resolve, reject) => {
    const powershell = getPowerShellPath();
    const script = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -Property ProcessName, Id | ConvertTo-Json`;
    
    exec(`${powershell} -Command "${script}"`, (error, stdout, stderr) => {
      if (error) {
        console.error("Failed to get running applications:", error);
        resolve([]);
        return;
      }
      
      try {
        const processes = JSON.parse(stdout);
        const apps = (Array.isArray(processes) ? processes : [processes])
          .filter(p => p && p.ProcessName && p.Id)
          .map(p => ({ name: p.ProcessName, pid: p.Id }));
        resolve(apps);
      } catch (e) {
        console.error("Failed to parse process list:", e);
        resolve([]);
      }
    });
  });
}

// Monitor an application and stop caffeination when it exits
export async function caffeinateWhileAppRunning(appName: string, pid: number, updates: Updates) {
  const caffeinationInfo: CaffeinationInfo = {
    type: "while",
    startTime: Date.now(),
    appName: appName,
    appPid: pid.toString()
  };
  
  // Start caffeination without duration
  await startCaffeinate(updates, `☕ Keeping awake while ${appName} runs`, undefined, caffeinationInfo);
  
  // Monitor the process
  const checkInterval = setInterval(async () => {
    try {
      process.kill(pid, 0); // Check if process exists
    } catch (e) {
      // Process no longer exists
      clearInterval(checkInterval);
      await stopCaffeinate(updates);
      await showToast({
        style: Toast.Style.Success,
        title: "💤 App closed",
        message: `${appName} has stopped running`
      });
    }
  }, 5000); // Check every 5 seconds
  
  // Store the interval ID so we can clean it up
  await LocalStorage.setItem("monitor_interval", checkInterval.toString());
}
