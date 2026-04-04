import type { WeatherData, HeatWaveStatus } from '../types.js';
export declare function fetchWeather(): Promise<WeatherData>;
export declare function shouldSkipForRain(): Promise<{
    skip: boolean;
    probability: number;
}>;
/**
 * Get today's sunrise and sunset times as HH:MM strings (local time).
 * Uses Open-Meteo daily forecast which includes sunrise/sunset.
 * Cached per day + location.
 */
export declare function getSolarTimes(): Promise<{
    sunrise: string;
    sunset: string;
} | null>;
/**
 * Compute the effective HH:MM trigger time for a solar schedule.
 * Returns null if solar times are unavailable.
 */
export declare function computeSolarTime(baseTime: string, // "HH:MM" from sunrise or sunset
offsetMinutes: number): string | null;
/** Get current heat wave status — always reads the latest threshold from settings */
export declare function getHeatWaveStatus(): Promise<HeatWaveStatus>;
//# sourceMappingURL=weather.d.ts.map