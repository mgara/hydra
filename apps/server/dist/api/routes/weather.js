import { fetchWeather, shouldSkipForRain, getHeatWaveStatus, getSolarTimes } from '../../scheduler/weather.js';
export function registerWeatherRoutes(app) {
    // GET /api/weather — current weather + forecast + live heat wave status + solar times
    app.get('/api/weather', async () => {
        const weather = await fetchWeather();
        const heatWave = await getHeatWaveStatus();
        const solar = await getSolarTimes();
        return { ...weather, heatWave, sunrise: solar?.sunrise ?? null, sunset: solar?.sunset ?? null };
    });
    // GET /api/weather/rain-check — should we skip?
    app.get('/api/weather/rain-check', async () => {
        return await shouldSkipForRain();
    });
}
//# sourceMappingURL=weather.js.map