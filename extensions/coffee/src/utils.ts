/**
 * Cross-Platform Coffee Extension Utils
 * 
 * Automatically detects the operating system and uses the appropriate implementation:
 * - Windows: Uses PowerShell + SetThreadExecutionState API
 * - macOS: Uses native caffeinate command
 */

import { LocalStorage, showHUD } from "@raycast/api";
import * as os from "os";

// Type definitions
type Preferences = {
  preventDisplay: boolean;
  preventSystem: boolean;
  preventDisk?: boolean;
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

// Detect operating system
const platform = os.platform();
const isWindows = platform === "win32";
const isMacOS = platform === "darwin";

// Import the appropriate implementation based on OS
let platformUtils: any;

if (isWindows) {
  console.log("[Coffee] Running on Windows - using PowerShell API");
  platformUtils = require("./utils-windows");
} else if (isMacOS) {
  console.log("[Coffee] Running on macOS - using caffeinate");
  platformUtils = require("./utils-macos");
} else {
  throw new Error(`Unsupported operating system: ${platform}. Coffee only supports Windows and macOS.`);
}

// Re-export all functions from the platform-specific implementation
export const startCaffeinate = platformUtils.startCaffeinate;
export const stopCaffeinate = platformUtils.stopCaffeinate;
export const isCaffeinated = platformUtils.isCaffeinated;
export const numberToDayString = platformUtils.numberToDayString;
export const getSchedule = platformUtils.getSchedule;
export const changeScheduleState = platformUtils.changeScheduleState;
export const isTodaysSchedule = platformUtils.isTodaysSchedule;
export const isNotTodaysSchedule = platformUtils.isNotTodaysSchedule;
export const formatDuration = platformUtils.formatDuration;
export const getCaffeinationInfo = platformUtils.getCaffeinationInfo;

// Re-export types
export type { Schedule, CaffeinationInfo } from "./utils-windows";

// Export platform information for debugging
export const getPlatformInfo = () => ({
  platform,
  isWindows,
  isMacOS,
  implementation: isWindows ? "Windows PowerShell" : isMacOS ? "macOS caffeinate" : "Unknown",
});

// Show platform info on first load
console.log(`[Coffee] Platform: ${platform}, Implementation: ${getPlatformInfo().implementation}`);
