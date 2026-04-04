let currentStatus = {
    enabled: false,
    running: false,
    port: 5540,
    commissioned: false,
    manualPairingCode: null,
    qrPairingCode: null,
};
export function getMatterStatus() {
    return { ...currentStatus };
}
export function setMatterStatus(patch) {
    currentStatus = { ...currentStatus, ...patch };
}
//# sourceMappingURL=status.js.map