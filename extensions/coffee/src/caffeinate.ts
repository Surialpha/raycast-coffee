import { startCaffeinate, getSchedule, changeScheduleState } from "./utils";

export default async () => {
  const schedule = await getSchedule();
  if (schedule != undefined) await changeScheduleState("decaffeinate", schedule);
  
  const caffeinationInfo = {
    type: "manual" as const,
    startTime: Date.now(),
  };
  
  await startCaffeinate({ menubar: true, status: true }, "☕ Your computer is now caffeinated!", undefined, caffeinationInfo);
};
