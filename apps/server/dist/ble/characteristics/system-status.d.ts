export declare function createSystemStatusCharacteristic(bleno: any, getStatus: () => {
    uptime: number;
    wifiRssi: number;
    activeZones: number;
    flowRate: number;
    firmware: string;
}): {
    characteristic: any;
    notifyStatus(): void;
};
//# sourceMappingURL=system-status.d.ts.map