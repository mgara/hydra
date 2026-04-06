import { useCallback } from 'react';
import type { WeatherData, RainSkipEvent } from '@/lib/api';
import { updateSettings } from '@/lib/api';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { formatWeekday, formatTime } from '@/lib/locale';

interface WeatherWidgetProps {
  weather: WeatherData;
  tempUnit: 'F' | 'C';
  onUnitChange: (unit: 'F' | 'C') => void;
  rainDelayActive?: boolean;
  rainSkips?: RainSkipEvent[];
}

function wmoToIcon(code: number): string {
  if (code === 0) return 'sunny';
  if (code <= 2) return 'partly_cloudy_day';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'foggy';
  if (code >= 51 && code <= 55) return 'grain';
  if (code >= 61 && code <= 65) return 'rainy';
  if (code >= 71 && code <= 75) return 'ac_unit';
  if (code >= 80 && code <= 82) return 'rainy';
  if (code >= 95) return 'thunderstorm';
  return 'cloud';
}

function toC(f: number): number {
  return (f - 32) * 5 / 9;
}

function fmtTemp(f: number, unit: 'F' | 'C'): string {
  const val = unit === 'C' ? toC(f) : f;
  return `${Math.round(val)}°`;
}

function dayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return formatWeekday(d);
}

export function WeatherWidget({ weather, tempUnit, onUnitChange, rainDelayActive, rainSkips }: WeatherWidgetProps) {
  const toggleUnit = useCallback(async () => {
    const next = tempUnit === 'F' ? 'C' : 'F';
    onUnitChange(next);
    await updateSettings({ temp_unit: next });
  }, [tempUnit, onUnitChange]);

  const hasAnySkip = weather.forecastDays.some(d => d.shouldSkip);

  return (
    <Card className={`p-5 relative overflow-hidden ${rainDelayActive ? 'pb-6' : ''}`}>
      {/* Main weather row */}
      <div className="flex items-center gap-5">
        {/* Large icon */}
        <Icon
          name={wmoToIcon(weather.weatherCode)}
          className="text-primary"
          size={48}
        />

        {/* Temp + description + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="font-headline text-display-sm text-on-surface">
              {fmtTemp(weather.temperatureF, tempUnit)}
            </span>
            <button
              onClick={toggleUnit}
              className="rounded-lg bg-surface-container-high px-2.5 py-1 text-label-sm font-medium text-on-surface-variant hover:bg-surface-container-highest transition-colors"
            >
              °{tempUnit === 'F' ? 'C' : 'F'}
            </button>
          </div>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {weather.description} | Humidity {weather.humidity}%
          </p>
        </div>
      </div>

      {/* Rain delay alert */}
      {rainDelayActive && (
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-[#3D3A20]/60 border border-[#FFB800]/25 px-4 py-3">
          <Icon name="thunderstorm" className="text-secondary shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-secondary">Rain Delay Active</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Skipping next cycle based on precipitation forecast.
            </p>
          </div>
        </div>
      )}

      {/* Recent rain skip events */}
      {rainSkips && rainSkips.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {rainSkips.slice(0, 3).map((skip, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Icon name="block" size={12} className="text-secondary shrink-0" />
              <span className="truncate">
                <span className="text-secondary font-medium">{skip.zoneName}</span>
                {' '}skipped — {skip.reason ?? 'rain delay'}
              </span>
              <span className="shrink-0 text-on-surface-variant/50 ml-auto">
                {formatTime(skip.skippedAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 5-day forecast strip */}
      {weather.forecastDays.length > 0 && (
        <div className="mt-4 pt-4 border-t border-outline-variant/15">
          <p className="text-[0.625rem] uppercase tracking-widest text-on-surface-variant mb-3">
            {hasAnySkip ? 'Rain Skip Forecast' : 'Forecast'} / Next {weather.forecastDays.length} Days
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {weather.forecastDays.map((day) => (
              <div
                key={day.date}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-center ${
                  day.shouldSkip
                    ? 'bg-surface-container-highest'
                    : ''
                }`}
              >
                <span className={`text-label-sm uppercase ${
                  day.shouldSkip ? 'text-secondary font-bold' : 'text-on-surface-variant'
                }`}>
                  {dayName(day.date)}
                </span>
                <Icon
                  name={wmoToIcon(day.weatherCode)}
                  size={20}
                  className={day.shouldSkip ? 'text-secondary' : 'text-on-surface-variant'}
                />
                {day.shouldSkip ? (
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-secondary">Skip</span>
                ) : (
                  <span className="text-xs text-on-surface-variant">
                    {day.precipitationProbability}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom amber glow bar when rain delay is active */}
      {rainDelayActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FFB800]" />
      )}
    </Card>
  );
}
