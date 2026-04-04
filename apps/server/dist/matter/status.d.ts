export interface MatterStatus {
    enabled: boolean;
    running: boolean;
    port: number;
    commissioned: boolean;
    manualPairingCode: string | null;
    qrPairingCode: string | null;
}
export declare function getMatterStatus(): MatterStatus;
export declare function setMatterStatus(patch: Partial<MatterStatus>): void;
//# sourceMappingURL=status.d.ts.map