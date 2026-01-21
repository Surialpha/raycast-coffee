import { LocalStorage, updateCommandMetadata } from "@raycast/api";
import { Schedule, startCaffeinate, getSchedule, stopCaffeinate, isCaffeinated } from "./utils";

async function handleScheduledCaffeinate(schedule: Schedule): Promise<boolean> {
  if (!schedule || Object.keys(schedule).length === 0) {
    return false;
  }

  const currentDate = new Date();
  const [startHour, startMinute] = schedule.from.split(":").map(Number);
  const [endHour, endMinute] = schedule.to.split(":").map(Number);
  const currentHour = currentDate.getHours();
  const currentMinute = currentDate.getMinutes();

  const isWithinSchedule =
    (currentHour > startHour || (currentHour === startHour && currentMinute >= startMinute)) &&
    (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute));

  // Change isRunning to false when the schedule has finished its run
  if (isWithinSchedule === false && schedule.IsRunning === true) {
    schedule.IsRunning = false;
    await stopCaffeinate({ menubar: true, status: true });
    await LocalStorage.setItem(schedule.day, JSON.stringify(schedule));
    return false;
  }

  // If the current time is within scheduled time, start caffeination
  if (isWithinSchedule === true && schedule.IsRunning === false) {
    const duration = (endHour - startHour) * 3600 + (endMinute - startMinute) * 60;
    const caffeinationInfo = {
      type: "scheduled" as const,
      startTime: Date.now(),
      endTime: Date.now() + duration * 1000
    };
    await startCaffeinate({ menubar: true, status: true }, undefined, duration, caffeinationInfo);
    schedule.IsRunning = true;
    await LocalStorage.setItem(schedule.day, JSON.stringify(schedule));
    return true;
  }

  return false;
}

// Function to check and handle schedule
export async function checkSchedule() {
  const schedule = await getSchedule();

  if (schedule === undefined) return false;

  if (!schedule.IsManuallyDecafed) {
    const isScheduled = await handleScheduledCaffeinate(schedule);
    return isScheduled;
  }

  return false;
}

export default async function Command() {
  const caffeinated = await isCaffeinated();
  const isScheduled = await checkSchedule();

  let subtitle = "✖ Decaffeinated";

  if (caffeinated) {
    subtitle = "✔ Caffeinated";
  } else if (isScheduled) {
    subtitle = "✔ Caffeinated";
  }

  updateCommandMetadata({ subtitle });
}
