/** Conservative admission policy, not a measurement of available tab memory. */
export interface VoiceDevice {
  userAgent: string;
  maxTouchPoints?: number;
  deviceMemory?: number;
  userAgentData?: { mobile?: boolean };
}
export function voiceGenerationUnavailable(device: VoiceDevice): boolean {
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(device.userAgent) ||
    device.userAgentData?.mobile === true ||
    (/Macintosh|MacIntel/i.test(device.userAgent) &&
      (device.maxTouchPoints ?? 0) > 1)
  );
}

export function chatterboxUnavailable(device: VoiceDevice): boolean {
  return (
    voiceGenerationUnavailable(device) ||
    (typeof device.deviceMemory === "number" && device.deviceMemory <= 4)
  );
}
