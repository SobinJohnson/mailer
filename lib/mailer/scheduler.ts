export function calculateSendTimes(
  recipientCount: number,
  startAt: Date,
  gapMinutes: number,
  jitterPct: number,
  sendTime?: string | null,
  endDate?: Date | null
): Date[] {
  const times: Date[] = [];
  let cursor = new Date(startAt);

  let [startHour, startMinute] = [9, 0];
  if (sendTime) {
    const [h, m] = sendTime.split(':').map(Number);
    startHour = isNaN(h) ? 9 : h;
    startMinute = isNaN(m) ? 0 : m;
  }

  for (let i = 0; i < recipientCount; i++) {
    // Determine the exact slot respecting business hours
    const nextSlot = nextBusinessSlot(cursor, startHour, startMinute);
    
    // If we exceed endDate, we cap it
    if (endDate && nextSlot > endDate) {
      times.push(new Date(endDate));
    } else {
      times.push(new Date(nextSlot));
    }

    // Move cursor forward by gap + jitter for the NEXT recipient
    const jitterFraction = (Math.random() * 2 - 1) * (jitterPct / 100);
    const jitteredGapMs = gapMinutes * 60 * 1000 * (1 + jitterFraction);
    
    cursor = new Date(nextSlot.getTime() + jitteredGapMs);
  }

  return times;
}

function nextBusinessSlot(dt: Date, startHour: number, startMinute: number): Date {
  if (isNaN(dt.getTime())) {
    throw new Error("Invalid start date provided to scheduler.");
  }

  const IST_OFFSET = 5.5 * 60; // minutes
  const local = new Date(dt.getTime() + IST_OFFSET * 60000);
  
  let hour = local.getUTCHours();
  let minute = local.getUTCMinutes();

  // If outside business hours, push forward
  let pushed = false;

  const currentTotalMins = hour * 60 + minute;
  const startTotalMins = startHour * 60 + startMinute;
  
  // Ensure the end time is at least 1 hour after the start time, otherwise it would loop indefinitely 
  const endTotalMins = Math.max(19 * 60, startTotalMins + 60);

  if (currentTotalMins < startTotalMins) { // Too early
    local.setUTCHours(startHour, startMinute, 0, 0);
    pushed = true;
  } else if (currentTotalMins >= endTotalMins) { // Too late
    // Push to start time next day
    local.setUTCDate(local.getUTCDate() + 1);
    local.setUTCHours(startHour, startMinute, 0, 0);
    pushed = true;
  }

  // If we pushed forward, double check the new slot
  if (pushed) {
    const doubleCheck = new Date(local.getTime() - IST_OFFSET * 60000);
    return nextBusinessSlot(doubleCheck, startHour, startMinute);
  }

  return new Date(local.getTime() - IST_OFFSET * 60000);
}
