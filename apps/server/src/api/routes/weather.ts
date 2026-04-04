import type { FastifyInstance } from 'fastify';
import { fetchWeather, shouldSkipForRain, getHeatWaveStatus } from '../../scheduler/weather.js';

export function registerWeatherRoutes(app: FastifyInstance): void {

  // GET /api/weather — current weather + forecast + live heat wave status
  app.get('/api/weather', async () => {
    const weather = await fetchWeather();
    const heatWave = await getHeatWaveStatus();
    return { ...weather, heatWave };
  });

  // GET /api/weather/rain-check — should we skip?
  app.get('/api/weather/rain-check', async () => {
    return await shouldSkipForRain();
  });
}
