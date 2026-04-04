// init.js MUST be first — sets @matter/nodejs/config before platform loads
import './init.js';
import '@matter/nodejs';
import { ServerNode, Endpoint, VendorId } from '@matter/main';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { ValveConfigurationAndControlServer } from '@matter/main/behaviors/valve-configuration-and-control';
import { ValveConfigurationAndControl } from '@matter/main/clusters/valve-configuration-and-control';
import { MATTER_PORT, MATTER_PASSCODE, MATTER_DISCRIMINATOR } from '../config.js';
import { createValveEndpoint, createMasterValveEndpoint } from './valve.js';
import { logPairingInfo } from './commissioner.js';
import { setMatterStatus } from './status.js';
const { ValveState } = ValveConfigurationAndControl;
/** Helper to update valve state on an endpoint via setStateOf (type-safe). */
function setValveState(ep, patch) {
    ep.setStateOf(ValveConfigurationAndControlServer, patch);
}
export async function startMatterServer(zoneManager) {
    const zoneStates = zoneManager.getAllZoneStates();
    const masterOpen = zoneManager.isMasterValveOpen();
    // Create Matter server node (irrigation controller)
    const node = await ServerNode.create({
        id: 'hydra-irrigation',
        basicInformation: {
            vendorName: 'HYDRA',
            vendorId: VendorId(0xFFF1), // Test vendor ID
            productName: 'Irrigation Controller',
            productId: 0x8001,
            serialNumber: 'HYDRA-001',
            nodeLabel: 'HYDRA Irrigation',
        },
        commissioning: {
            passcode: MATTER_PASSCODE,
            discriminator: MATTER_DISCRIMINATOR,
        },
        network: {
            port: MATTER_PORT,
        },
    });
    // Create aggregator (bridge pattern — holds N valve children)
    const aggregator = new Endpoint(AggregatorEndpoint, { id: 'bridge' });
    await node.add(aggregator);
    // Add zone valve endpoints
    const valveEndpoints = new Map();
    for (const state of zoneStates) {
        const endpoint = createValveEndpoint(zoneManager, state.zone, state.name, state.status === 'running');
        await aggregator.add(endpoint);
        valveEndpoints.set(state.zone, endpoint);
    }
    // Add master valve endpoint (read-only, synced from ZoneManager events)
    const masterEndpoint = createMasterValveEndpoint(masterOpen);
    await aggregator.add(masterEndpoint);
    // ── Bidirectional sync: ZoneManager events → Matter state ──
    const onZoneStart = (zoneState) => {
        const ep = valveEndpoints.get(zoneState.zone);
        if (!ep)
            return;
        setValveState(ep, {
            currentState: ValveState.Open,
            targetState: ValveState.Open,
            remainingDuration: zoneState.remainingSeconds,
        });
    };
    const onZoneStop = (zoneState) => {
        const ep = valveEndpoints.get(zoneState.zone);
        if (!ep)
            return;
        setValveState(ep, {
            currentState: ValveState.Closed,
            targetState: ValveState.Closed,
            openDuration: null,
            remainingDuration: null,
        });
    };
    const onMasterOpen = () => {
        setValveState(masterEndpoint, {
            currentState: ValveState.Open,
            targetState: ValveState.Open,
        });
    };
    const onMasterClose = () => {
        setValveState(masterEndpoint, {
            currentState: ValveState.Closed,
            targetState: ValveState.Closed,
        });
    };
    zoneManager.on('zone:start', onZoneStart);
    zoneManager.on('zone:stop', onZoneStop);
    zoneManager.on('master:open', onMasterOpen);
    zoneManager.on('master:close', onMasterClose);
    // Periodic remaining-duration sync (every 10s)
    const syncInterval = setInterval(() => {
        for (const [zone, ep] of valveEndpoints) {
            const state = zoneManager.getZoneState(zone);
            if (state.status === 'running' && state.remainingSeconds != null) {
                setValveState(ep, { remainingDuration: state.remainingSeconds });
            }
        }
    }, 10_000);
    // Start the Matter server
    await node.start();
    logPairingInfo(node);
    // Expose status for the REST API
    const { pairingCodes, commissioned } = node.state.commissioning;
    setMatterStatus({
        enabled: true,
        running: true,
        port: MATTER_PORT,
        commissioned,
        manualPairingCode: pairingCodes.manualPairingCode,
        qrPairingCode: pairingCodes.qrPairingCode,
    });
    console.log(`[MATTER] Server started on port ${MATTER_PORT}`);
    return {
        async stop() {
            clearInterval(syncInterval);
            zoneManager.removeListener('zone:start', onZoneStart);
            zoneManager.removeListener('zone:stop', onZoneStop);
            zoneManager.removeListener('master:open', onMasterOpen);
            zoneManager.removeListener('master:close', onMasterClose);
            await node.close();
            setMatterStatus({ running: false });
            console.log('[MATTER] Server stopped');
        },
    };
}
//# sourceMappingURL=server.js.map