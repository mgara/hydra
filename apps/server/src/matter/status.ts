export interface MatterStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  commissioned: boolean;
  manualPairingCode: string | null;
  qrPairingCode: string | null;
}

let currentStatus: MatterStatus = {
  enabled: false,
  running: false,
  port: 5540,
  commissioned: false,
  manualPairingCode: null,
  qrPairingCode: null,
};

export function getMatterStatus(): MatterStatus {
  return { ...currentStatus };
}

export function setMatterStatus(patch: Partial<MatterStatus>): void {
  currentStatus = { ...currentStatus, ...patch };
}
