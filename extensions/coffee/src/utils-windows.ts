import { getPreferenceValues, launchCommand, LaunchType, LocalStorage, showHUD } from "@raycast/api";
import { exec, execSync, spawn, ChildProcess } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

// PowerShell script to prevent sleep on Windows
function generatePowerShellScript(duration?: number): string {
  const preferences = getPreferenceValues<Preferences>();
  
  let executionState = "0x80000000"; // ES_CONTINUOUS
  
  if (preferences.preventSystem) {
    executionState += " + 0x00000001"; // ES_SYSTEM_REQUIRED
  }
  
  if (preferences.preventDisplay) {
    executionState += " + 0x00000002"; // ES_DISPLAY_REQUIRED
  }

  const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;

public class PowerUtil {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
'@

$ES_CONTINUOUS = ${executionState}

Write-Host "${PROCESS_MARKER}"
[PowerUtil]::SetThreadExecutionState($ES_CONTINUOUS)

${duration ? `Start-Sleep -Seconds ${duration}` : "while($true) { Start-Sleep -Seconds 1 }"}

# Reset to normal state
[PowerUtil]::SetThreadExecutionState(0x80000000)
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
  
  const script = generatePowerShellScript(duration);
  const scriptPath = join(tmpdir(), `raycast-coffee-${Date.now()}.ps1`);
  
  try {
    writeFileSync(scriptPath, script, "utf-8");
    
    // Execute PowerShell script
    caffeinateProcess = spawn("powershell.exe", [
      "-ExecutionPolicy",
      "Bypass",
      "-NoProfile",
      "-File",
      scriptPath
    ], {
      detached: true,
      stdio: "ignore"
    });
    
    caffeinateProcess.unref();
    
    // Store process ID for later termination
    if (caffeinateProcess.pid) {
      await LocalStorage.setItem("caffeinate_pid", caffeinateProcess.pid.toString());
      await LocalStorage.setItem("caffeinate_script", scriptPath);
    }
    
    // Store caffeination info
    if (caffeinationInfo) {
      await LocalStorage.setItem("caffeination_info", JSON.stringify(caffeinationInfo));
    }
    
    await update(updates, true);
  } catch (error) {
    console.error("Failed to start caffeination:", error);
    throw error;
  }
}

export async function stopCaffeinate(updates: Updates, hudMessage?: string) {
  if (hudMessage) {
    await showHUD(hudMessage);
  }
  
  try {
    // Try to kill the process using stored PID
    const storedPid = await LocalStorage.getItem<string>("caffeinate_pid");
    const scriptPath = await LocalStorage.getItem<string>("caffeinate_script");
    
    if (storedPid) {
      try {
        // Kill PowerShell processes with our marker
        execSync(`powershell.exe -Command "Get-Process | Where-Object { $_.ProcessName -eq 'powershell' } | ForEach-Object { try { if ((Get-Content $_.MainModule.FileName -ErrorAction SilentlyContinue) -match '${PROCESS_MARKER}') { Stop-Process -Id $_.Id -Force } } catch {} }"`, {
          stdio: "ignore"
        });
      } catch (e) {
        // Ignore errors, process might already be stopped
      }
      
      await LocalStorage.removeItem("caffeinate_pid");
    }
    
    // Clean up script file
    if (scriptPath && existsSync(scriptPath)) {
      try {
        unlinkSync(scriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      await LocalStorage.removeItem("caffeinate_script");
    }
    
    // Clean up caffeination info
    await LocalStorage.removeItem("caffeination_info");
    
    // Reset execution state to normal
    const resetScript = `
Add-Type @'
using System;
using System.Runtime.InteropServices;

public class PowerUtil {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
}
'@

[PowerUtil]::SetThreadExecutionState(0x80000000)
`;
    
    const resetScriptPath = join(tmpdir(), `raycast-coffee-reset-${Date.now()}.ps1`);
    writeFileSync(resetScriptPath, resetScript, "utf-8");
    
    execSync(`powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${resetScriptPath}"`, {
      stdio: "ignore"
    });
    
    unlinkSync(resetScriptPath);
    
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
    // Check if the process is still running
    execSync(`powershell.exe -Command "Get-Process -Id ${storedPid} -ErrorAction SilentlyContinue"`, {
      stdio: "ignore"
    });
    return true;
  } catch (e) {
    // Process not found, clean up
    await LocalStorage.removeItem("caffeinate_pid");
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
    return false;
  }
}
