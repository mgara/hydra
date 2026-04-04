import { Endpoint } from '@matter/main';
import { WaterValveDevice } from '@matter/main/devices/water-valve';
import { ValveConfigurationAndControlServer } from '@matter/main/behaviors/valve-configuration-and-control';
import { ValveConfigurationAndControl } from '@matter/main/clusters/valve-configuration-and-control';
import { BridgedDeviceBasicInformationServer } from '@matter/main/behaviors/bridged-device-basic-information';
const { ValveState } = ValveConfigurationAndControl;
// WaterValve + BridgedDeviceBasicInformation so each endpoint gets a name in smart home apps
const BridgedValveDevice = WaterValveDevice.with(BridgedDeviceBasicInformationServer);
/**
 * Create a Matter WaterValve endpoint for a HYDRA zone.
 * Uses closure to capture zoneManager/zoneNumber — each zone gets its own behavior class.
 */
export function createValveEndpoint(zoneManager, zoneNumber, zoneName, isOpen) {
    class HydraValveServer extends ValveConfigurationAndControlServer {
        async open(request) {
            const durationSeconds = request.openDuration ?? null;
            const durationMinutes = durationSeconds != null ? Math.ceil(durationSeconds / 60) : undefined;
            const result = await zoneManager.startZone(zoneNumber, durationMinutes, 'manual');
            if (!result.success) {
                console.log(`[MATTER] Zone ${zoneNumber} open rejected: ${result.error}`);
                return;
            }
            this.state.currentState = ValveState.Open;
            this.state.targetState = ValveState.Open;
            if (durationSeconds != null) {
                this.state.openDuration = durationSeconds;
            }
        }
        async close() {
            const result = await zoneManager.stopZone(zoneNumber, 'manual_stop');
            if (!result.success) {
                console.log(`[MATTER] Zone ${zoneNumber} close rejected: ${result.error}`);
                return;
            }
            this.state.currentState = ValveState.Closed;
            this.state.targetState = ValveState.Closed;
            this.state.openDuration = null;
            this.state.remainingDuration = null;
        }
    }
    const CustomValveDevice = BridgedValveDevice.with(HydraValveServer);
    return new Endpoint(CustomValveDevice, {
        id: `valve-zone-${zoneNumber}`,
        bridgedDeviceBasicInformation: {
            nodeLabel: zoneName,
            reachable: true,
        },
        valveConfigurationAndControl: {
            currentState: isOpen ? ValveState.Open : ValveState.Closed,
            targetState: isOpen ? ValveState.Open : ValveState.Closed,
            openDuration: null,
            remainingDuration: null,
        },
    });
}
/**
 * Create a read-only WaterValve endpoint for the master valve.
 * State is synced from ZoneManager events; Matter commands are ignored.
 */
export function createMasterValveEndpoint(isOpen) {
    class ReadOnlyValveServer extends ValveConfigurationAndControlServer {
        async open() {
            // Master valve is auto-managed by ZoneManager — ignore Matter commands
        }
        async close() {
            // Master valve is auto-managed by ZoneManager — ignore Matter commands
        }
    }
    const MasterValveDevice = BridgedValveDevice.with(ReadOnlyValveServer);
    return new Endpoint(MasterValveDevice, {
        id: 'master-valve',
        bridgedDeviceBasicInformation: {
            nodeLabel: 'Master Valve',
            reachable: true,
        },
        valveConfigurationAndControl: {
            currentState: isOpen ? ValveState.Open : ValveState.Closed,
            targetState: isOpen ? ValveState.Open : ValveState.Closed,
            openDuration: null,
            remainingDuration: null,
        },
    });
}
//# sourceMappingURL=valve.js.map