const clients = new Set();
export function registerWebSocket(app, zoneManager, flowMonitor, mqttClient) {
    app.get('/ws', { websocket: true }, (socket) => {
        clients.add(socket);
        console.log(`[WS] Client connected (${clients.size} total)`);
        // Send initial state on connect
        sendToClient(socket, 'system:status', {
            zones: zoneManager.getAllZoneStates(),
            masterValve: zoneManager.isMasterValveOpen() ? 'open' : 'closed',
            rainDelay: zoneManager.getRainDelayInfo(),
        });
        socket.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                handleClientMessage(msg, zoneManager);
            }
            catch {
                // ignore malformed messages
            }
        });
        socket.on('close', () => {
            clients.delete(socket);
            console.log(`[WS] Client disconnected (${clients.size} total)`);
        });
    });
    // Forward zone manager events to all WS clients
    zoneManager.on('zone:start', (data) => broadcast('zone:start', data));
    zoneManager.on('zone:stop', (data) => broadcast('zone:stop', data));
    zoneManager.on('master:open', () => broadcast('system:status', { masterValve: 'open' }));
    zoneManager.on('master:close', () => broadcast('system:status', { masterValve: 'closed' }));
    zoneManager.on('rain:delay', (data) => broadcast('weather:update', data));
    zoneManager.on('schedule:triggered', (data) => broadcast('schedule:triggered', data));
    // Forward flow monitor events
    if (flowMonitor) {
        flowMonitor.on('flow:reading', (data) => broadcast('flow:reading', data));
        flowMonitor.on('flow:alarm', (data) => broadcast('alert:new', data));
    }
    // Forward MQTT soil sensor events
    if (mqttClient) {
        mqttClient.on('soil:reading', (data) => broadcast('soil:reading', data));
    }
    // Periodic zone state broadcast every 2 seconds (for countdown timers etc.)
    setInterval(() => {
        if (clients.size > 0 && zoneManager.getRunningZones().length > 0) {
            broadcast('zone:update', zoneManager.getAllZoneStates());
        }
    }, 2000);
}
function handleClientMessage(msg, zoneManager) {
    switch (msg.action) {
        case 'start_zone':
            if (msg.zone)
                zoneManager.startZone(msg.zone, msg.duration);
            break;
        case 'stop_zone':
            if (msg.zone)
                zoneManager.stopZone(msg.zone);
            break;
        case 'stop_all':
            zoneManager.stopAll();
            break;
        case 'get_status':
            broadcast('zone:update', zoneManager.getAllZoneStates());
            break;
    }
}
function broadcast(type, data) {
    const event = {
        type,
        data,
        timestamp: new Date().toISOString(),
    };
    const payload = JSON.stringify(event);
    for (const client of clients) {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(payload);
        }
    }
}
function sendToClient(client, type, data) {
    const event = { type, data, timestamp: new Date().toISOString() };
    if (client.readyState === 1) {
        client.send(JSON.stringify(event));
    }
}
//# sourceMappingURL=websocket.js.map