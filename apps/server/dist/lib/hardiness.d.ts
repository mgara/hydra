export interface HardinessZone {
    code: string;
    number: number;
    sub: 'a' | 'b';
    minTempF: number;
    maxTempF: number;
    label: string;
    lastFrostMmDd: string;
    firstFrostMmDd: string;
}
export declare const HARDINESS_ZONES: HardinessZone[];
/** Map an extreme minimum temperature (°F) to a USDA zone code */
export declare function tempToZone(minTempF: number): string;
/** Parse zone code to numeric value (e.g. "5a" → 5.0, "5b" → 5.5) for comparisons */
export declare function zoneToNumber(code: string): number;
/** Get the zone data for a code */
export declare function getZone(code: string): HardinessZone | undefined;
/** Recommend lawn/turf type based on hardiness zone */
export declare function getRecommendedTurfType(zoneCode: string): 'cool_turf' | 'warm_turf';
/** Get all recommended plant types for a zone, ordered by best fit */
export declare function getRecommendedPlantTypes(zoneCode: string): string[];
/** Check if a date is within the growing season for a zone */
export declare function isInGrowingSeason(zoneCode: string, date?: Date): boolean;
/**
 * Detect hardiness zone from lat/lon using Open-Meteo historical weather data.
 * Fetches 5 years of daily minimum temperatures and finds the extreme minimum.
 */
export declare function detectHardinessZone(lat?: number, lon?: number): Promise<{
    zone: string;
    minTempF: number;
    growingSeasonStart: string;
    growingSeasonEnd: string;
}>;
//# sourceMappingURL=hardiness.d.ts.map