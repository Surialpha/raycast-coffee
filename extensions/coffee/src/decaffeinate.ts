import { stopCaffeinate, getSchedule } from "./utils";
import { showToast, Toast } from "@raycast/api";

export default async () => {
  const schedule = await getSchedule();
  if (schedule != undefined && schedule.IsRunning == true)
    await showToast(Toast.Style.Failure, "⏸️ Caffeination schedule is running - pause it to decaffeinate");
  else await stopCaffeinate({ menubar: true, status: true }, "💤 Your computer is now decaffeinated");
};
