import { execSync } from "child_process";
import { startCaffeinate, stopCaffeinate } from "./utils";

export default async () => {
  try {
    execSync("pgrep caffeinate");

    await stopCaffeinate({ menubar: true, status: true }, "💤 Your computer is now decaffeinated");
  } catch (error) {
    const caffeinationInfo = {
      type: "manual" as const,
      startTime: Date.now(),
    };
    
    await startCaffeinate({ menubar: true, status: true }, "☕ Your computer is now caffeinated!", undefined, caffeinationInfo);
  }
};
