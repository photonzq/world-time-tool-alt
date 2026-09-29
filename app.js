/**
 * World Time Tool - Application Engine
 */

import { runSelfTests } from './selftest.js';

// Hand-rolled Zero-Dependency Intl Time Engine (Fallback & Edge-Case Validator)
window.wallAsUTC = function(instantMs, tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(instantMs));
  const g = t => +p.find(x => x.type === t).value;
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
};

window.zonedToInstant = function(y, mo, d, h, mi, tz) {
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target, lastErr = null;
  for (let i = 0; i < 4; i++) {
    const err = target - window.wallAsUTC(guess, tz);
    if (err === 0) return { instantMs: guess, exact: true };
    if (lastErr !== null && err === -lastErr) {
      // Oscillation detected -> nonexistent wall time in a spring-forward gap.
      // If err > 0, guess is on pre-gap side; add err to land on post-gap.
      // If err < 0, guess is already on post-gap side.
      const instantMs = err > 0 ? guess + err : guess;
      return { instantMs, exact: false, reason: 'nonexistent' };
    }
    lastErr = err;
    guess += err;
  }
  return { instantMs: guess, exact: false, reason: 'no-converge' };
};

window.hoursInDayIntl = function(y, mo, d, tz) {
  const a = window.zonedToInstant(y, mo, d, 0, 0, tz).instantMs;
  const n = new Date(Date.UTC(y, mo - 1, d + 1));
  const b = window.zonedToInstant(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), 0, 0, tz).instantMs;
  return (b - a) / 3600000;
};

// Strict Date Format and Calendar Validation
window.isValidDateString = function(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
};

// ISO 8601 Week Number Calculator
window.getISOWeekNumber = function(dateObj) {
  if (dateObj instanceof Date) {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth() + 1;
    const d = dateObj.getDate();
    try {
      if (typeof Temporal === 'object' && Temporal.PlainDate) {
        return Temporal.PlainDate.from({ year: y, month: m, day: d }).weekOfYear;
      }
    } catch (e) {}
    const target = new Date(Date.UTC(y, m - 1, d));
    const dayNr = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNr);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  }
  try {
    if (typeof Temporal === 'object' && Temporal.Now && typeof Temporal.Now.plainDateISO === 'function') {
      return Temporal.Now.plainDateISO().weekOfYear;
    }
  } catch (e) {}
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
};

// Add minute offset to an Instant (supporting Temporal.Instant and fallback instant objects)
window.addMinutesToInstant = function(instant, minutes) {
  if (!instant) return null;
  const ms = Number(instant.epochMilliseconds !== undefined ? instant.epochMilliseconds : (instant.epochNanoseconds ? instant.epochNanoseconds / 1000000n : instant));
  const newMs = ms + minutes * 60000;
  if (typeof Temporal === 'object' && Temporal.Instant && typeof Temporal.Instant.fromEpochMilliseconds === 'function') {
    return Temporal.Instant.fromEpochMilliseconds(newMs);
  }
  return {
    epochNanoseconds: BigInt(newMs) * 1000000n,
    epochMilliseconds: newMs,
    toZonedDateTimeISO: (tz) => {
      const p = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric',
        weekday: 'short', timeZoneName: 'short'
      }).formatToParts(new Date(newMs));
      const g = t => p.find(x => x.type === t)?.value;
      const hour = parseInt(g('hour'), 10);
      const minute = parseInt(g('minute'), 10);
      const y = parseInt(g('year'), 10);
      const m = parseInt(g('month'), 10);
      const d = parseInt(g('day'), 10);
      const wallUtc = Date.UTC(y, m - 1, d, hour, minute);
      const offsetMs = wallUtc - newMs;
      const offsetNanos = BigInt(offsetMs) * 1000000n;
      const sign = offsetMs >= 0 ? '+' : '-';
      const absOff = Math.abs(offsetMs);
      const offH = String(Math.floor(absOff / 3600000)).padStart(2, '0');
      const offM = String(Math.floor((absOff % 3600000) / 60000)).padStart(2, '0');
      const offsetStr = `${sign}${offH}:${offM}`;
      const dayOfWeek = (new Date(newMs).getUTCDay() || 7);
      return {
        year: y, month: m, day: d, hour, minute,
        dayOfWeek,
        offset: offsetStr,
        offsetNanoseconds: offsetNanos,
        toPlainDate: () => ({
          year: y, month: m, day: d,
          toString: () => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          equals: (other) => other && other.year === y && other.month === m && other.day === d
        }),
        toLocaleString: (loc, opts) => new Intl.DateTimeFormat(loc, { timeZone: tz, ...opts }).format(new Date(newMs))
      };
    }
  };
};

// Working Hours & Status Categorization Helper for Pinned Columns
window.getPinnedHourStatus = function(zdt) {
  const fractionalHour = zdt.hour + zdt.minute / 60;
  const isWeekend = zdt.dayOfWeek >= 6; // 6 = Saturday, 7 = Sunday
  const isWork = !isWeekend && fractionalHour >= 9 && fractionalHour < 17;
  const isShoulder = !isWeekend && ((fractionalHour >= 7 && fractionalHour < 9) || (fractionalHour >= 17 && fractionalHour < 22));

  if (isWeekend) {
    return {
      category: 'weekend',
      statusClass: 'status-weekend',
      statusLabel: 'Weekend',
      tooltip: 'Weekend: Outside business hours'
    };
  }
  if (isWork) {
    return {
      category: 'work',
      statusClass: 'status-work',
      statusLabel: 'Work',
      tooltip: 'Business hours (9:00 AM – 5:00 PM)'
    };
  }
  if (isShoulder) {
    return {
      category: 'shoulder',
      statusClass: 'status-shoulder',
      statusLabel: 'Off-hours',
      tooltip: 'Off-work awake hours (7–9 AM or 5–10 PM)'
    };
  }
  return {
    category: 'night',
    statusClass: 'status-night',
    statusLabel: 'Night',
    tooltip: 'Sleep / night hours (10:00 PM – 7:00 AM)'
  };
};

// Seasonal Timezone Abbreviation & Summer Time / Standard Time Resolver
window.getTimezoneAbbrev = function(iana, instant) {
  try {
    const epochMs = instant
      ? (instant.epochMilliseconds !== undefined
          ? Number(instant.epochMilliseconds)
          : (instant.epochNanoseconds ? Number(instant.epochNanoseconds / 1000000n) : Number(instant)))
      : Date.now();
    const date = new Date(epochMs);

    // Compute seasonal offset check
    const getOffset = (d) => {
      try {
        const p = new Intl.DateTimeFormat('en-US', {
          timeZone: iana,
          hourCycle: 'h23',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).formatToParts(d);
        const g = t => +p.find(x => x.type === t).value;
        const utcMs = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
        return Math.round((utcMs - d.getTime()) / 60000) * 60000;
      } catch { return 0; }
    };

    const y = date.getUTCFullYear();
    const curOff = getOffset(date);
    const janOff = getOffset(new Date(Date.UTC(y, 0, 15, 12, 0)));
    const julOff = getOffset(new Date(Date.UTC(y, 6, 15, 12, 0)));
    const hasDst = janOff !== julOff;
    const isDaylight = hasDst && curOff === Math.max(janOff, julOff);

    // Well-known curated / precomputed shorthands for this zone
    const shorthands = window.getZoneShorthands ? window.getZoneShorthands(iana) : [];

    const isDaylightAbbrev = (s) => {
      if (s.endsWith('DT')) return true;
      if (s === 'BST' || s === 'CEST' || s === 'EEST' || s === 'WEST' || s === 'CLST' || s === 'BRST' || s === 'FJST' || s === 'LHDT') return true;
      return false;
    };

    if (shorthands.length > 0) {
      if (shorthands.length === 1) return shorthands[0];

      const daylight = shorthands.find(s => isDaylightAbbrev(s));
      const standard = shorthands.find(s => !isDaylightAbbrev(s)) || shorthands[0];

      if (daylight && standard) {
        return isDaylight ? daylight : standard;
      }
      return shorthands[0];
    }

    // Fall back to native Intl abbreviation if clean alphabetical
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'short'
    }).formatToParts(date);
    const val = parts.find(p => p.type === 'timeZoneName')?.value;

    if (val && /^[A-Z]{2,5}$/.test(val)) return val;

    return isDaylight ? 'DST' : (val || 'STD');
  } catch {
    return 'DST';
  }
};

// 114 CLDR 12-hour regions as a compact 228-character string
window.H12_REGIONS_STR = 'AEAGALARASAUBBBDBHBMBNBOBSBTCACLCOCRCTCUCYDJDMDODZECEGEHERETFJFMGDGHGMGRGTGUGYHKHNINIQJMJOJTKHKIKNKPKRKWKYLBLCLRLSLYMHMIMOMPMRMWMXMYNANHNINTNZOMPAPCPEPGPHPKPRPSPUPWPYPZQASASBSDSGSLSOSSSVSYSZTCTDTNTOTTTWUMUSUYVCVEVGVIVUWKWSYDYEZM';

let _h12ZonesSet = null;

window.get12HourZonesSet = function() {
  if (_h12ZonesSet !== null) return _h12ZonesSet;
  _h12ZonesSet = new Set();
  try {
    if (typeof Intl === 'object' && typeof Intl.Locale === 'function' && typeof Intl.Locale.prototype?.getTimeZones === 'function') {
      for (let i = 0; i < window.H12_REGIONS_STR.length; i += 2) {
        const region = window.H12_REGIONS_STR.slice(i, i + 2);
        const loc = new Intl.Locale('und', { region });
        const tzs = loc.getTimeZones();
        if (tzs) {
          for (const tz of tzs) {
            _h12ZonesSet.add(tz);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error lazily building 12-hour zones set:', e);
  }
  return _h12ZonesSet;
};

window.is12HourZone = function(iana) {
  if (!iana) return false;
  return window.get12HourZonesSet().has(iana);
};

window.isZone24Hour = function(iana, format = '12') {
  if (format === '24') return true;
  if (format === '12') return false;
  // MX mode: true if not a 12-hour zone (defaults to 24h)
  return !window.is12HourZone(iana);
};

window._reset12HourZonesSet = function() {
  _h12ZonesSet = null;
};

// Natural Language Summary Sentence Generator for Pinned Column / Meeting Range
window.generatePinnedSentence = function(instant, trackedZones, formatOrIs24 = '12', homeZone = null, endInstant = null) {
  if (!instant || !trackedZones || trackedZones.length === 0) return '';
  const home = homeZone || trackedZones[0];
  const isZone24 = (iana) => {
    if (typeof formatOrIs24 === 'string') {
      return window.isZone24Hour ? window.isZone24Hour(iana, formatOrIs24) : (formatOrIs24 === '24');
    }
    return Boolean(formatOrIs24);
  };

  const hasEnd = Boolean(endInstant && endInstant !== instant);
  const homeIs24 = isZone24(home.iana);
  const homeZdt = instant.toZonedDateTimeISO(home.iana);
  const homeEndZdt = hasEnd ? endInstant.toZonedDateTimeISO(home.iana) : null;

  const homeDateFormatted = homeZdt.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const homeTimeStr = homeZdt.toLocaleString('en-US', {
    hour: homeIs24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !homeIs24
  });
  const homeEndTimeStr = homeEndZdt ? homeEndZdt.toLocaleString('en-US', {
    hour: homeIs24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !homeIs24
  }) : '';

  const homeAbbrev = window.getTimezoneAbbrev ? window.getTimezoneAbbrev(home.iana, instant) : '';
  const homeAbbrevStr = homeAbbrev ? ` ${homeAbbrev}` : '';

  const homeClause = hasEnd
    ? `${homeDateFormatted}, ${homeTimeStr} – ${homeEndTimeStr}${homeAbbrevStr} (${home.label})`
    : `${homeDateFormatted} at ${homeTimeStr}${homeAbbrevStr} (${home.label})`;

  const otherZones = trackedZones.slice(1);
  if (otherZones.length === 0) return `${homeClause}.`;

  const formatZoneTime = (zone, zdt, endZdt, includeDate = false, includeYear = false) => {
    const zoneIs24 = isZone24(zone.iana);
    const timeStr = zdt.toLocaleString('en-US', {
      hour: zoneIs24 ? '2-digit' : 'numeric',
      minute: '2-digit',
      hour12: !zoneIs24
    });
    const endTimeStr = endZdt ? endZdt.toLocaleString('en-US', {
      hour: zoneIs24 ? '2-digit' : 'numeric',
      minute: '2-digit',
      hour12: !zoneIs24
    }) : '';
    const abbrev = window.getTimezoneAbbrev ? window.getTimezoneAbbrev(zone.iana, instant) : '';
    const abbrevStr = abbrev ? ` ${abbrev}` : '';
    const timeRange = hasEnd ? `${timeStr} – ${endTimeStr}` : timeStr;

    if (includeDate) {
      const dateOpts = includeYear
        ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
        : { weekday: 'short', month: 'short', day: 'numeric' };
      const dateStr = zdt.toLocaleString('en-US', dateOpts);
      if (hasEnd) {
        return `${dateStr}, ${timeRange}${abbrevStr} (${zone.label})`;
      }
      return `${dateStr} at ${timeStr}${abbrevStr} (${zone.label})`;
    }
    return `${timeRange}${abbrevStr} (${zone.label})`;
  };

  const otherParts = otherZones.map(zone => {
    const zdt = instant.toZonedDateTimeISO(zone.iana);
    const endZdt = hasEnd ? endInstant.toZonedDateTimeISO(zone.iana) : null;
    const isDiffDate = !zdt.toPlainDate().equals(homeZdt.toPlainDate());
    const isDiffYear = zdt.year !== homeZdt.year;
    return formatZoneTime(zone, zdt, endZdt, isDiffDate, isDiffYear);
  });

  if (otherParts.length === 1) {
    return `${homeClause} corresponds to ${otherParts[0]}.`;
  }
  if (otherParts.length === 2) {
    return `${homeClause} corresponds to ${otherParts[0]} and ${otherParts[1]}.`;
  }
  const allButLast = otherParts.slice(0, -1).join(', ');
  const last = otherParts[otherParts.length - 1];
  return `${homeClause} corresponds to ${allButLast}, and ${last}.`;
};

// RFC 5545 iCalendar (.ics) Generator & Downloader
window.generateIcsContent = function(startInstant, endInstant, trackedZones, title = 'Meeting', url = '') {
  if (!startInstant) return '';
  const startMs = Number(startInstant.epochMilliseconds !== undefined ? startInstant.epochMilliseconds : (startInstant.epochNanoseconds ? startInstant.epochNanoseconds / 1000000n : startInstant));
  const endMs = endInstant
    ? Number(endInstant.epochMilliseconds !== undefined ? endInstant.epochMilliseconds : (endInstant.epochNanoseconds ? endInstant.epochNanoseconds / 1000000n : endInstant))
    : (startMs + 3600000);

  const formatUtcIcs = (ms) => {
    const d = new Date(ms);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const dtStart = formatUtcIcs(startMs);
  const dtEnd = formatUtcIcs(endMs);
  const dtStamp = formatUtcIcs(Date.now());
  const uid = `wtb-${startMs}-${Math.random().toString(36).substring(2, 9)}@worldtimebuddy`;

  // Multi-zone summary for invite description
  const descLines = ['Time conversions for attendees:'];
  (trackedZones || []).forEach(zone => {
    try {
      const zdt1 = startInstant.toZonedDateTimeISO(zone.iana);
      const zdt2 = endInstant ? endInstant.toZonedDateTimeISO(zone.iana) : null;
      const t1 = zdt1.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const t2 = zdt2 ? zdt2.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
      const d1 = zdt1.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const abbrev = window.getTimezoneAbbrev ? window.getTimezoneAbbrev(zone.iana, startInstant) : '';
      descLines.push(`• ${zone.label}: ${t1}${t2 ? ' - ' + t2 : ''} ${abbrev} (${d1})`);
    } catch {}
  });
  if (url) {
    descLines.push('');
    descLines.push(`View & adjust in World Time Buddy: ${url}`);
  }
  const cleanDescription = descLines.join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//World Time Buddy Clone//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${cleanDescription}`,
    url ? `URL:${url}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
};

window.downloadIcsFile = function(filename, icsContent) {
  const blob = new Blob(['\uFEFF', icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// DST Drift Scanner: Detects offset shifts within ±3 days
window.scanDstDrift = function(instant, trackedZones, daysWindow = 3) {
  if (!instant || !trackedZones || trackedZones.length < 2) return [];
  const home = trackedZones[0];
  const ms = Number(instant.epochMilliseconds !== undefined ? instant.epochMilliseconds : (instant.epochNanoseconds ? instant.epochNanoseconds / 1000000n : instant));
  const alerts = [];

  const getOffsetDiffHours = (timeMs, zoneIana) => {
    try {
      const getTzOffsetMs = (t, tz) => {
        const p = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hourCycle: 'h23',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        }).formatToParts(new Date(t));
        const g = type => +p.find(x => x.type === type).value;
        const wallUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
        return wallUtc - t;
      };
      const homeOff = getTzOffsetMs(timeMs, home.iana);
      const zoneOff = getTzOffsetMs(timeMs, zoneIana);
      return (zoneOff - homeOff) / 3600000;
    } catch {
      return 0;
    }
  };

  const otherZones = trackedZones.slice(1);
  otherZones.forEach(zone => {
    const baseDiff = getOffsetDiffHours(ms, zone.iana);
    let driftFound = null;

    // Check future shift (+1..+daysWindow)
    for (let d = 1; d <= daysWindow; d++) {
      const futureMs = ms + d * 86400000;
      const futureDiff = getOffsetDiffHours(futureMs, zone.iana);
      if (Math.abs(futureDiff - baseDiff) >= 0.25) {
        const dayWord = d === 1 ? 'tomorrow' : `in ${d} days`;
        const diffBefore = baseDiff >= 0 ? `+${baseDiff}h` : `${baseDiff}h`;
        const diffAfter = futureDiff >= 0 ? `+${futureDiff}h` : `${futureDiff}h`;
        driftFound = {
          type: 'future',
          days: d,
          zoneLabel: zone.label,
          message: `⚠️ ${zone.label} shifts DST ${dayWord} (gap changes from ${diffBefore} to ${diffAfter})`
        };
        break;
      }
    }

    // Check past shift (-daysWindow..-1)
    if (!driftFound) {
      for (let d = 1; d <= daysWindow; d++) {
        const pastMs = ms - d * 86400000;
        const pastDiff = getOffsetDiffHours(pastMs, zone.iana);
        if (Math.abs(pastDiff - baseDiff) >= 0.25) {
          const dayWord = d === 1 ? 'yesterday' : `${d} days ago`;
          const diffBefore = pastDiff >= 0 ? `+${pastDiff}h` : `${pastDiff}h`;
          const diffNow = baseDiff >= 0 ? `+${baseDiff}h` : `${baseDiff}h`;
          driftFound = {
            type: 'past',
            days: -d,
            zoneLabel: zone.label,
            message: `⚠️ ${zone.label} shifted DST ${dayWord} (gap shifted from ${diffBefore} to ${diffNow})`
          };
          break;
        }
      }
    }

    if (driftFound) {
      alerts.push(driftFound);
    }
  });

  return alerts;
};

// "Least-Bad Hours" Optimizer / Slot Scorer
window.computeLeastBadHours = function(columnInstants, trackedZones, durationMin = 60) {
  if (!columnInstants || columnInstants.length === 0 || !trackedZones || trackedZones.length === 0) return [];
  const homeZone = trackedZones[0];

  const getDiscomfortScore = (zdt) => {
    const isWeekend = zdt.dayOfWeek >= 6;
    if (isWeekend) return 15;
    const fHour = zdt.hour + zdt.minute / 60;
    if (fHour >= 9 && fHour < 17) return 0; // standard work
    if (fHour >= 8 && fHour < 9) return 1;
    if (fHour >= 17 && fHour < 18) return 1.5;
    if (fHour >= 18 && fHour < 20) return 3;
    if (fHour >= 7 && fHour < 8) return 3.5;
    if (fHour >= 20 && fHour < 22) return 6;
    return 14; // sleep / late night
  };

  const scores = columnInstants.map((colInstant, colIdx) => {
    let totalPenalty = 0;
    const endInstant = window.addMinutesToInstant(colInstant, durationMin);

    trackedZones.forEach(zone => {
      const zdtStart = colInstant.toZonedDateTimeISO(zone.iana);
      const zdtEnd = endInstant.toZonedDateTimeISO(zone.iana);
      const startScore = getDiscomfortScore(zdtStart);
      const endScore = getDiscomfortScore(zdtEnd);
      totalPenalty += Math.max(startScore, endScore);
    });

    const homeZdt = colInstant.toZonedDateTimeISO(homeZone.iana);
    const homeIs24 = window.isZone24Hour ? window.isZone24Hour(homeZone.iana) : false;
    const hourLabel = homeIs24
      ? `${String(homeZdt.hour).padStart(2, '0')}:00`
      : `${homeZdt.hour % 12 || 12}${homeZdt.hour >= 12 ? 'pm' : 'am'}`;

    return {
      colIdx,
      score: totalPenalty,
      instant: colInstant,
      hourLabel
    };
  });

  return scores;
};

// Global helper for computeColumns (native Temporal when available, fallback to Intl)
window.computeColumns = function(homeIana, dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);

  if (typeof Temporal === 'object' && typeof Temporal.PlainDate === 'function') {
    const plainToday = Temporal.PlainDate.from({ year, month, day });
    const plainTomorrow = plainToday.add({ days: 1 });
    const dayStart = plainToday.toZonedDateTime({ timeZone: homeIana, plainTime: '00:00' });
    const dayEnd = plainTomorrow.toZonedDateTime({ timeZone: homeIana, plainTime: '00:00' });
    const durationHours = Number(dayEnd.epochNanoseconds - dayStart.epochNanoseconds) / 3.6e12;
    const numCols = Math.max(0, Math.ceil(durationHours));

    const instants = [];
    for (let k = 0; k < numCols; k++) {
      instants.push(dayStart.toInstant().add({ hours: k }));
    }
    return instants;
  }

  // Pure Intl Zero-Dependency Fallback
  const startMs = window.zonedToInstant(year, month, day, 0, 0, homeIana).instantMs;
  const durationHours = window.hoursInDayIntl(year, month, day, homeIana);
  const numCols = Math.ceil(durationHours);

  const instants = [];
  for (let k = 0; k < numCols; k++) {
    const epochMs = startMs + k * 3600000;
    instants.push({
      epochNanoseconds: BigInt(epochMs) * 1000000n,
      epochMilliseconds: epochMs,
      toZonedDateTimeISO: (tz) => {
        const p = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hourCycle: 'h23',
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: 'numeric',
          weekday: 'short', timeZoneName: 'short'
        }).formatToParts(new Date(epochMs));
        const g = t => p.find(x => x.type === t)?.value;
        const hour = parseInt(g('hour'), 10);
        const minute = parseInt(g('minute'), 10);
        const y = parseInt(g('year'), 10);
        const m = parseInt(g('month'), 10);
        const d = parseInt(g('day'), 10);
        const wallUtc = Date.UTC(y, m - 1, d, hour, minute);
        const offsetMs = wallUtc - epochMs;
        const offsetNanos = BigInt(offsetMs) * 1000000n;
        return {
          hour,
          minute,
          offsetNanoseconds: offsetNanos,
          toPlainDate: () => ({
            year: y, month: m, day: d,
            toString: () => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            equals: (other) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` === (other.toString ? other.toString() : other),
            toLocaleString: (locale, opts) => new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' })
          })
        };
      }
    });
  }
  return instants;
};

// Global helper for machine timezone detection with graceful fallback
window.getMachineTimeZone = function() {
  try {
    if (typeof Temporal === 'object' && Temporal.Now && typeof Temporal.Now.timeZoneId === 'function') {
      const tz = Temporal.Now.timeZoneId();
      if (tz) return tz;
    }
  } catch (e) {}

  try {
    if (typeof Intl === 'object' && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    }
  } catch (e) {}

  // Default fallback: US East Coast
  return 'America/New_York';
};

// Continuous Diurnal Color Generator: soft, low-contrast daylight-to-night gradient
window.getDiurnalColor = function(hourFloat) {
  const t = ((hourFloat % 24) + 24) % 24;

  // Gentle low-contrast palette:
  // Darkness strictly limited to a soft, light muted slate (#bec8d2, lightness ~78%, lum ~198)
  // Seamlessly transitions through soft morning/evening hues to pure white daytime (#ffffff)
  const keyframes = [
    { hour: 0,  r: 190, g: 200, b: 210 }, // 12:00 AM - soft light muted slate (#bec8d2)
    { hour: 4,  r: 190, g: 200, b: 210 }, // 4:00 AM  - soft light muted slate
    { hour: 5,  r: 202, g: 210, b: 219 }, // 5:00 AM  - gentle dawn rise
    { hour: 6,  r: 215, g: 222, b: 229 }, // 6:00 AM  - soft dawn mist
    { hour: 7,  r: 230, g: 235, b: 240 }, // 7:00 AM  - pale morning
    { hour: 8,  r: 244, g: 247, b: 249 }, // 8:00 AM  - off-white morning prelude
    { hour: 9,  r: 255, g: 255, b: 255 }, // 9:00 AM  - pure white business day
    { hour: 12, r: 255, g: 255, b: 255 }, // 12:00 PM - pure white midday
    { hour: 17, r: 255, g: 255, b: 255 }, // 5:00 PM  - business day end
    { hour: 18, r: 245, g: 248, b: 250 }, // 6:00 PM  - gentle evening fade
    { hour: 19, r: 232, g: 237, b: 242 }, // 7:00 PM  - soft dusk
    { hour: 20, r: 218, g: 225, b: 232 }, // 8:00 PM  - twilight
    { hour: 21, r: 204, g: 212, b: 221 }, // 9:00 PM  - late dusk
    { hour: 22, r: 190, g: 200, b: 210 }, // 10:00 PM - soft light muted slate
    { hour: 24, r: 190, g: 200, b: 210 }  // 12:00 AM - cycle completes
  ];

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k0 = keyframes[i];
    const k1 = keyframes[i + 1];
    if (t >= k0.hour && t <= k1.hour) {
      const ratio = (t - k0.hour) / (k1.hour - k0.hour);
      const r = Math.round(k0.r + (k1.r - k0.r) * ratio);
      const g = Math.round(k0.g + (k1.g - k0.g) * ratio);
      const b = Math.round(k0.b + (k1.b - k0.b) * ratio);
      return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
    }
  }

  return { r: 190, g: 200, b: 210, css: 'rgb(190, 200, 210)' };
};

// Search alias table mapping modern city and colloquial names to legacy ICU/IANA identifiers
const SEARCH_ALIASES = {
  // Cities & colloquial names
  'kolkata': 'Asia/Calcutta',
  'calcutta': 'Asia/Calcutta',
  'mumbai': 'Asia/Calcutta',
  'bombay': 'Asia/Calcutta',
  'delhi': 'Asia/Calcutta',
  'new delhi': 'Asia/Calcutta',
  'bangalore': 'Asia/Calcutta',
  'bengaluru': 'Asia/Calcutta',
  'kyiv': 'Europe/Kiev',
  'kiev': 'Europe/Kiev',
  'yangon': 'Asia/Rangoon',
  'rangoon': 'Asia/Rangoon',
  'ho chi minh': 'Asia/Saigon',
  'saigon': 'Asia/Saigon',
  'kathmandu': 'Asia/Katmandu',
  'katmandu': 'Asia/Katmandu',
  'astana': 'Asia/Almaty',
  'nur-sultan': 'Asia/Almaty',
  'peking': 'Asia/Shanghai',
  'beijing': 'Asia/Shanghai',
  'nyc': 'America/New_York',
  'sf': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'taipei': 'Asia/Taipei',
  'hong kong': 'Asia/Hong_Kong',
  // Countries
  'usa': 'America/New_York',
  'united states': 'America/New_York',
  'uk': 'Europe/London',
  'united kingdom': 'Europe/London',
  'england': 'Europe/London',
  'britain': 'Europe/London',
  'germany': 'Europe/Berlin',
  'france': 'Europe/Paris',
  'china': 'Asia/Shanghai',
  'japan': 'Asia/Tokyo',
  'india': 'Asia/Calcutta',
  'australia': 'Australia/Sydney',
  'canada': 'America/Toronto',
  'brazil': 'America/Sao_Paulo',
  'mexico': 'America/Mexico_City',
  'spain': 'Europe/Madrid',
  'italy': 'Europe/Rome',
  'netherlands': 'Europe/Amsterdam',
  'switzerland': 'Europe/Zurich',
  'russia': 'Europe/Moscow',
  'south korea': 'Asia/Seoul',
  'korea': 'Asia/Seoul',
  'singapore': 'Asia/Singapore',
  'new zealand': 'Pacific/Auckland',
  'ireland': 'Europe/Dublin',
  'sweden': 'Europe/Stockholm',
  'norway': 'Europe/Oslo',
  'denmark': 'Europe/Copenhagen',
  'poland': 'Europe/Warsaw',
  'turkey': 'Europe/Istanbul',
  'uae': 'Asia/Dubai',
  'dubai': 'Asia/Dubai',
  'egypt': 'Africa/Cairo',
  'south africa': 'Africa/Johannesburg',
  'argentina': 'America/Argentina/Buenos_Aires',
  'colombia': 'America/Bogota',
  'chile': 'America/Santiago'
};

// Universal Timezone Shorthands & Abbreviations
window.TIMEZONE_SHORTHANDS = {
  // North America
  'EDT': ['America/New_York', 'America/Detroit', 'America/Toronto', 'America/Montreal'],
  'EST': ['America/New_York', 'America/Detroit', 'America/Toronto', 'America/Panama', 'America/Cancun', 'America/Jamaica'],
  'CDT': ['America/Chicago', 'America/Winnipeg', 'America/Mexico_City'],
  'CST': ['America/Chicago', 'America/Regina', 'America/Guatemala', 'America/Mexico_City', 'Asia/Shanghai', 'Asia/Chongqing', 'Asia/Taipei'],
  'MDT': ['America/Denver', 'America/Edmonton', 'America/Boise'],
  'MST': ['America/Denver', 'America/Phoenix'],
  'PDT': ['America/Los_Angeles', 'America/Vancouver', 'America/Tijuana'],
  'PST': ['America/Los_Angeles', 'America/Vancouver', 'America/Tijuana', 'Asia/Manila'],
  'AKDT': ['America/Anchorage'],
  'AKST': ['America/Anchorage'],
  'HST': ['Pacific/Honolulu'],
  'HDT': ['Pacific/Honolulu'],
  'ADT': ['America/Halifax'],
  'AST': ['America/Halifax', 'America/Puerto_Rico', 'Asia/Riyadh', 'Asia/Baghdad', 'Asia/Kuwait', 'Asia/Qatar'],
  'NDT': ['America/St_Johns'],
  'NST': ['America/St_Johns'],

  // Europe & UK
  'GMT': ['Europe/London', 'Etc/GMT', 'Africa/Abidjan', 'Africa/Accra', 'Atlantic/Reykjavik'],
  'UTC': ['Etc/UTC', 'Etc/GMT'],
  'BST': ['Europe/London', 'Asia/Dhaka'],
  'WET': ['Europe/Lisbon', 'Atlantic/Canary', 'Africa/Casablanca'],
  'WEST': ['Europe/Lisbon', 'Atlantic/Canary', 'Africa/Casablanca'],
  'CET': ['Europe/Berlin', 'Europe/Paris', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Prague', 'Europe/Budapest', 'Europe/Belgrade', 'Europe/Zurich'],
  'CEST': ['Europe/Berlin', 'Europe/Paris', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Prague', 'Europe/Budapest', 'Europe/Belgrade', 'Europe/Zurich'],
  'EET': ['Europe/Athens', 'Europe/Helsinki', 'Europe/Bucharest', 'Europe/Kiev', 'Europe/Sofia', 'Europe/Riga', 'Europe/Tallinn', 'Europe/Vilnius', 'Asia/Beirut', 'Asia/Jerusalem', 'Asia/Damascus', 'Asia/Amman', 'Africa/Cairo', 'Africa/Tripoli'],
  'EEST': ['Europe/Athens', 'Europe/Helsinki', 'Europe/Bucharest', 'Europe/Kiev', 'Europe/Sofia', 'Europe/Riga', 'Europe/Tallinn', 'Europe/Vilnius', 'Asia/Beirut', 'Asia/Jerusalem', 'Asia/Damascus', 'Asia/Amman', 'Africa/Cairo'],
  'MSK': ['Europe/Moscow', 'Europe/Minsk', 'Europe/Simferopol'],

  // Asia
  'IST': ['Asia/Calcutta', 'Asia/Colombo', 'Asia/Jerusalem', 'Europe/Dublin'],
  'JST': ['Asia/Tokyo'],
  'KST': ['Asia/Seoul', 'Asia/Pyongyang'],
  'HKT': ['Asia/Hong_Kong'],
  'SGT': ['Asia/Singapore'],
  'MYT': ['Asia/Kuala_Lumpur'],
  'PHT': ['Asia/Manila'],
  'WIB': ['Asia/Jakarta'],
  'WITA': ['Asia/Makassar'],
  'WIT': ['Asia/Jayapura'],
  'ICT': ['Asia/Bangkok', 'Asia/Saigon', 'Asia/Phnom_Penh', 'Asia/Vientiane'],
  'PKT': ['Asia/Karachi'],
  'BDT': ['Asia/Dhaka'],
  'NPT': ['Asia/Katmandu'],
  'BTT': ['Asia/Thimphu'],
  'MMT': ['Asia/Rangoon'],
  'GST': ['Asia/Dubai', 'Asia/Muscat'],
  'IRST': ['Asia/Tehran'],
  'IRDT': ['Asia/Tehran'],
  'AFT': ['Asia/Kabul'],
  'UZT': ['Asia/Tashkent'],
  'ALMT': ['Asia/Almaty'],

  // Australia & Pacific
  'AEST': ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Hobart', 'Australia/Canberra'],
  'AEDT': ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Hobart', 'Australia/Canberra'],
  'ACST': ['Australia/Adelaide', 'Australia/Darwin'],
  'ACDT': ['Australia/Adelaide'],
  'AWST': ['Australia/Perth'],
  'NZST': ['Pacific/Auckland'],
  'NZDT': ['Pacific/Auckland'],
  'CHAST': ['Pacific/Chatham'],
  'CHADT': ['Pacific/Chatham'],
  'LHST': ['Australia/Lord_Howe'],
  'LHDT': ['Australia/Lord_Howe'],
  'SST': ['Pacific/Pago_Pago', 'Pacific/Apia'],
  'CHST': ['Pacific/Guam', 'Pacific/Saipan'],
  'FJT': ['Pacific/Fiji'],
  'FJST': ['Pacific/Fiji'],
  'TOT': ['Pacific/Tongatapu'],

  // Africa
  'WAT': ['Africa/Lagos', 'Africa/Kinshasa', 'Africa/Luanda'],
  'CAT': ['Africa/Harare', 'Africa/Johannesburg', 'Africa/Maputo', 'Africa/Lusaka', 'Africa/Gaborone'],
  'EAT': ['Africa/Nairobi', 'Africa/Addis_Ababa', 'Africa/Dar_es_Salaam', 'Africa/Kampala', 'Africa/Mogadishu'],
  'SAST': ['Africa/Johannesburg'],

  // South America
  'BRT': ['America/Sao_Paulo', 'America/Rio_Branco'],
  'BRST': ['America/Sao_Paulo'],
  'ART': ['America/Argentina/Buenos_Aires'],
  'CLT': ['America/Santiago'],
  'CLST': ['America/Santiago'],
  'COT': ['America/Bogota'],
  'PET': ['America/Lima'],
  'VET': ['America/Caracas'],
  'BOT': ['America/La_Paz'],
  'PYT': ['America/Asuncion'],
  'PYST': ['America/Asuncion'],
  'UYT': ['America/Montevideo']
};

window.getZoneShorthands = function(iana) {
  const result = new Set();
  for (const [shorthand, ianas] of Object.entries(window.TIMEZONE_SHORTHANDS)) {
    if (ianas.includes(iana)) {
      result.add(shorthand);
    }
  }
  try {
    const getP = (d) => new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' })
      .formatToParts(d).find(p => p.type === 'timeZoneName')?.value;
    const now = getP(new Date());
    const summer = getP(new Date('2026-07-01T12:00:00Z'));
    const winter = getP(new Date('2026-01-01T12:00:00Z'));
    [now, summer, winter].forEach(s => {
      if (s && /^[A-Z]{2,5}$/.test(s)) {
        result.add(s);
      }
    });
  } catch {}
  return Array.from(result);
};

// 139 curated Windows zones + 287 browser ICU supported values = 426 total zones (zero extra bytes)
window.buildZonesDatabase = function() {
  const curated = (window.WINDOWS_ZONES || []).filter((z, i, a) => a.findIndex(x => x.iana === z.iana) === i);
  const known = new Set(curated.map(z => z.iana));
  const intlZones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const synthesized = intlZones.filter(iana => !known.has(iana)).map(iana => {
    const city = iana.split('/').pop().replace(/_/g, ' ');
    const offset = (typeof Temporal === 'object' && typeof Temporal.Now === 'object')
      ? Temporal.Now.zonedDateTimeISO(iana).offset
      : '+00:00';
    return { id: iana, label: `(UTC${offset}) ${city}`, iana };
  });

  const merged = [...curated, ...synthesized];
  merged.forEach(z => {
    z.shorthands = window.getZoneShorthands(z.iana);
  });
  return merged;
};

class WTBApp {
  constructor() {
    window.app = this;
    this.zonesDatabase = window.buildZonesDatabase();
    this.format = '12'; // '12' | '24' | 'mx'
    this.pinnedCol = null;
    this.hoveredCol = null;
    this.pinStartMin = 0;
    this.pinDurationMin = 60;
    this.isFirstRender = true;

    // Initialize default tracked rows: Machine TZ (Home), US West Coast, Europe (Berlin), China (Beijing)
    this.trackedZones = this.getDefaultZones();
    this.currentDate = this.getTodayDateString(this.getHomeZone().iana);

    this.loadState();
    this.initDOM();
    this.attachEvents();
    this.render();

    // Start live clock ticking and current time needle updates (1 second interval for live seconds)
    setInterval(() => {
      try { this.updateLiveClocks(); } catch (e) { console.warn('Ticker error (updateLiveClocks):', e); }
      try { this.updateTopLiveClock(); } catch (e) { console.warn('Ticker error (updateTopLiveClock):', e); }
      try { this.updateNowMarker(); } catch (e) { console.warn('Ticker error (updateNowMarker):', e); }
    }, 1000);

    // Auto-scroll timeline so current hour or pinned hour is centered
    setTimeout(() => {
      this.scrollToActiveTime('auto');
    }, 120);

    // Check URL for self-test trigger or search query
    const params = new URLSearchParams(window.location.search);
    if (params.get('selftest') === '1') {
      this.triggerSelfTestModal();
    }
    const searchParam = params.get('search');
    if (searchParam) {
      this.searchInput.value = searchParam;
      this.handleSearch(searchParam);
    }
  }

  get is24Hour() {
    return this.format === '24';
  }

  set is24Hour(val) {
    if (typeof val === 'string') {
      this.format = val;
    } else {
      this.format = val ? '24' : '12';
    }
  }

  isZone24Hour(iana) {
    return window.isZone24Hour ? window.isZone24Hour(iana, this.format) : (this.format === '24');
  }

  getMachineTimeZone() {
    return window.getMachineTimeZone();
  }

  getDefaultZones() {
    const machineIana = this.getMachineTimeZone();

    // The 4 core regions:
    // 1. US East Coast (New York)
    // 2. US West Coast (Los Angeles)
    // 3. Europe (Berlin, Central Europe)
    // 4. China (Beijing)
    const coreRegions = [
      {
        iana: 'America/New_York',
        id: 'Eastern Standard Time',
        label: 'New York',
        sub: 'United States, Eastern Time',
        regionKey: 'us_east'
      },
      {
        iana: 'America/Los_Angeles',
        id: 'Pacific Standard Time',
        label: 'Los Angeles',
        sub: 'United States, Pacific Time',
        regionKey: 'us_west'
      },
      {
        iana: 'Europe/Berlin',
        id: 'W. Europe Standard Time',
        label: 'Berlin',
        sub: 'Germany, Central Europe',
        regionKey: 'europe'
      },
      {
        iana: 'Asia/Shanghai',
        id: 'China Standard Time',
        label: 'Beijing',
        sub: 'China, Beijing / Shanghai',
        regionKey: 'china'
      }
    ];

    const defaultList = [];
    const matchingCore = coreRegions.find(r => r.iana === machineIana);

    if (matchingCore) {
      // Machine matches one of the core regions -> set as home row
      defaultList.push({
        id: matchingCore.id,
        label: matchingCore.label,
        sub: matchingCore.sub,
        iana: matchingCore.iana,
        isHome: true
      });

      // Append the other core regions
      coreRegions.forEach(r => {
        if (r.iana !== machineIana) {
          defaultList.push({
            id: r.id,
            label: r.label,
            sub: r.sub,
            iana: r.iana,
            isHome: false
          });
        }
      });
    } else {
      // Machine is in a different timezone (e.g. Chicago, Tokyo, Sydney)
      const dbMatch = this.zonesDatabase.find(z => z.iana === machineIana || z.id === machineIana);
      const parsed = dbMatch ? this.parseZoneInfo(dbMatch) : {
        id: machineIana,
        label: machineIana.split('/').pop().replace(/_/g, ' '),
        sub: machineIana.split('/')[0].replace(/_/g, ' '),
        iana: machineIana
      };
      defaultList.push({ ...parsed, isHome: true });

      // Add all 4 core regions as companions
      coreRegions.forEach(r => {
        if (r.iana !== machineIana) {
          defaultList.push({
            id: r.id,
            label: r.label,
            sub: r.sub,
            iana: r.iana,
            isHome: false
          });
        }
      });
    }

    return defaultList;
  }

  getTodayDateString(homeIana) {
    try {
      const tz = homeIana || 'UTC';
      return Temporal.Now.plainDateISO(tz).toString();
    } catch {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  getHomeZone() {
    return this.trackedZones.find(z => z.isHome) || this.trackedZones[0];
  }

  parseZoneInfo(raw) {
    let rawLabel = raw.label || raw.iana || '';
    let id = raw.id || raw.iana;
    let iana = raw.iana;
    let city = raw.label || '';
    let sub = raw.sub || '';

    // City & subtitle dictionary for clean WTB-style presentation
    const FRIENDLY_NAMES = {
      'America/New_York': { city: 'New York', sub: 'United States, Eastern Time' },
      'America/Los_Angeles': { city: 'Los Angeles', sub: 'United States, Pacific Time' },
      'America/Chicago': { city: 'Chicago', sub: 'United States, Central Time' },
      'America/Denver': { city: 'Denver', sub: 'United States, Mountain Time' },
      'Europe/Berlin': { city: 'Berlin', sub: 'Germany, Central Europe' },
      'Europe/London': { city: 'London', sub: 'United Kingdom, England' },
      'Europe/Paris': { city: 'Paris', sub: 'France, Central Europe' },
      'Asia/Shanghai': { city: 'Beijing', sub: 'China, Beijing / Shanghai' },
      'Asia/Tokyo': { city: 'Tokyo', sub: 'Japan' },
      'Asia/Calcutta': { city: 'Kolkata', sub: 'India Standard Time' },
      'Europe/Kiev': { city: 'Kyiv', sub: 'Ukraine, Eastern Europe' },
      'Asia/Rangoon': { city: 'Yangon', sub: 'Myanmar (Burma)' },
      'Asia/Saigon': { city: 'Ho Chi Minh', sub: 'Vietnam, Indochina Time' },
      'Asia/Katmandu': { city: 'Kathmandu', sub: 'Nepal Time' }
    };

    if (iana && FRIENDLY_NAMES[iana]) {
      city = raw.label && !raw.label.startsWith('(UTC') ? raw.label : FRIENDLY_NAMES[iana].city;
      sub = raw.sub || FRIENDLY_NAMES[iana].sub;
      return { id, label: city, sub, iana };
    }

    if (rawLabel.startsWith('(UTC')) {
      const clean = rawLabel.replace(/\(UTC[+-]\d{2}:\d{2}\)\s*/, '');
      const parts = clean.split(',');
      city = parts[0].trim();
      sub = parts.slice(1).join(',').trim() || (iana ? iana.split('/')[0].replace(/_/g, ' ') : '');
    } else if (!sub && iana) {
      city = rawLabel.replace(/_/g, ' ');
      sub = iana.split('/')[0].replace(/_/g, ' ');
    }

    return { id, label: city, sub, iana };
  }

  loadState() {
    // 1. Check URL Hash
    if (window.location.hash.length > 1) {
      try {
        const rawHash = window.location.hash.slice(1);
        let hash;
        if (!rawHash.includes('=')) {
          // Shorthand plain zone list e.g. #21,9,50,104 or #New_York,London
          hash = new URLSearchParams({ z: rawHash });
        } else {
          hash = new URLSearchParams(rawHash);
        }

        const zonesParam = hash.get('z') || hash.get('zones');
        const dateParam = hash.get('d') || hash.get('date');
        const formatParam = hash.get('t') || hash.get('format');
        const pinnedParam = hash.get('p') || hash.get('pinned');

        if (zonesParam) {
          const tokens = zonesParam.split(',');
          const loaded = [];
          const seen = new Set();
          tokens.forEach((token) => {
            const trimmed = token.trim();
            if (!trimmed) return;

            let match = null;

            // 1. Check if numeric index into WINDOWS_ZONES (0..138)
            if (/^\d+$/.test(trimmed)) {
              const idx = parseInt(trimmed, 10);
              if (Array.isArray(window.WINDOWS_ZONES) && idx >= 0 && idx < window.WINDOWS_ZONES.length) {
                match = window.WINDOWS_ZONES[idx];
              }
            }

            // 2. Match against zonesDatabase (by IANA, id, city suffix, or label)
            if (!match) {
              const lower = trimmed.toLowerCase();
              const lowerCity = lower.replace(/ /g, '_');
              match = this.zonesDatabase.find(z => 
                z.iana.toLowerCase() === lower ||
                z.id.toLowerCase() === lower ||
                z.iana.toLowerCase().endsWith('/' + lowerCity) ||
                z.label.toLowerCase().includes(lower)
              );
            }

            if (!match) {
              match = {
                id: trimmed,
                label: trimmed.split('/').pop().replace(/_/g, ' '),
                sub: trimmed.includes('/') ? trimmed.split('/')[0] : '',
                iana: trimmed
              };
            }

            const resolvedIana = match.iana;
            if (seen.has(resolvedIana)) return;
            seen.add(resolvedIana);
            const parsed = this.parseZoneInfo(match);
            loaded.push({
              ...parsed,
              isHome: loaded.length === 0
            });
          });
          if (loaded.length > 0) this.trackedZones = loaded;
        }

        if (dateParam) {
          let cleanDate = dateParam;
          if (/^\d{8}$/.test(dateParam)) {
            cleanDate = `${dateParam.slice(0, 4)}-${dateParam.slice(4, 6)}-${dateParam.slice(6, 8)}`;
          }
          if (window.isValidDateString(cleanDate)) {
            this.currentDate = cleanDate;
          }
        }

        if (formatParam !== null) {
          const norm = formatParam.toLowerCase();
          if (norm === 'mx') {
            this.format = 'mx';
          } else if (norm === '24' || norm === '1') {
            this.format = '24';
          } else {
            this.format = '12';
          }
        }

        if (pinnedParam !== null) {
          const p = parseInt(pinnedParam, 10);
          if (!isNaN(p) && p >= 0) {
            this.pinnedCol = p;
          }
        }

        const minParam = hash.get('m') || hash.get('min');
        if (minParam !== null) {
          const m = parseInt(minParam, 10);
          if ([0, 15, 30, 45].includes(m)) {
            this.pinStartMin = m;
          }
        }

        const durParam = hash.get('l') || hash.get('len') || hash.get('dur');
        if (durParam !== null) {
          const d = parseInt(durParam, 10);
          if (!isNaN(d) && d >= 15 && d <= 1440) {
            this.pinDurationMin = d;
          }
        }
        return;
      } catch (e) {
        console.warn('Could not parse URL hash state:', e);
      }
    }

    // 2. Check localStorage (v3 schema)
    try {
      const savedV3 = localStorage.getItem('wtb_state_v3');
      if (savedV3) {
        const data = JSON.parse(savedV3);
        if (data.trackedZones && data.trackedZones.length > 0) {
          const loaded = [];
          const seen = new Set();
          data.trackedZones.forEach((zone, idx) => {
            if (zone && zone.iana && !seen.has(zone.iana)) {
              seen.add(zone.iana);
              loaded.push({
                ...zone,
                isHome: loaded.length === 0 ? Boolean(zone.isHome || idx === 0) : false
              });
            }
          });
          if (loaded.length > 0) {
            if (!loaded.some(z => z.isHome)) loaded[0].isHome = true;
            this.trackedZones = loaded;
          }
        }
        if (data.format !== undefined) {
          this.format = data.format;
        } else if (data.fmt !== undefined) {
          this.format = data.fmt;
        } else if (data.h24 !== undefined) {
          this.format = data.h24 ? '24' : '12';
        } else if (data.is24Hour !== undefined) {
          this.format = data.is24Hour ? '24' : '12';
        }
        if (data.pinStartMin !== undefined && [0, 15, 30, 45].includes(data.pinStartMin)) {
          this.pinStartMin = data.pinStartMin;
        }
        if (data.pinDurationMin !== undefined && data.pinDurationMin >= 15 && data.pinDurationMin <= 1440) {
          this.pinDurationMin = data.pinDurationMin;
        }
      } else {
        // Clear older schemas so updated full subtitles load cleanly
        localStorage.removeItem('wtb_state_v2');
        localStorage.removeItem('wtb_state');
      }
    } catch (e) {
      console.warn('Could not load localStorage state:', e);
    }
  }

  encodeZoneToken(zone) {
    if (!zone) return '';
    // 1. Prefer curated WINDOWS_ZONES index (0..138)
    if (Array.isArray(window.WINDOWS_ZONES)) {
      const idx = window.WINDOWS_ZONES.findIndex(wz => wz.iana === zone.iana || wz.id === zone.id);
      if (idx !== -1) {
        return idx.toString();
      }
    }
    // 2. Check if clean city name is unique in zonesDatabase
    if (zone.iana && zone.iana.includes('/')) {
      const city = zone.iana.split('/').pop();
      const matches = this.zonesDatabase.filter(z => z.iana.endsWith('/' + city));
      if (matches.length === 1) {
        return city;
      }
      return zone.iana;
    }
    return zone.iana || zone.id || '';
  }

  getShareHash() {
    const parts = [];

    // 1. Zones: encoded as compact tokens
    const zoneTokens = (this.trackedZones || []).map(z => this.encodeZoneToken(z)).filter(Boolean);
    if (zoneTokens.length > 0) {
      parts.push(`z=${zoneTokens.join(',')}`);
    }

    // 2. Date: omit if today, otherwise d=YYYY-MM-DD
    const homeZone = this.getHomeZone ? this.getHomeZone() : (this.trackedZones[0] || {});
    const todayStr = homeZone && homeZone.iana ? this.getTodayDateString(homeZone.iana) : '';
    if (this.currentDate && this.currentDate !== todayStr) {
      parts.push(`d=${this.currentDate}`);
    }

    // 3. Format: omit if '12' (default), otherwise t=24 or t=mx
    if (this.format && this.format !== '12') {
      parts.push(`t=${this.format}`);
    }

    // 4. Pinned Column: omit if null/undefined, otherwise p=colIdx
    if (this.pinnedCol !== null && this.pinnedCol !== undefined) {
      parts.push(`p=${this.pinnedCol}`);
    }

    // 5. Start Minute: omit if 0 (default :00)
    if (this.pinStartMin !== undefined && this.pinStartMin !== 0) {
      parts.push(`m=${this.pinStartMin}`);
    }

    // 6. Meeting Duration: omit if 60 (default 1h)
    if (this.pinDurationMin !== undefined && this.pinDurationMin !== 60) {
      parts.push(`l=${this.pinDurationMin}`);
    }

    return parts.join('&');
  }

  getShareUrl() {
    const shareHash = this.getShareHash();
    const url = new URL(window.location.href);
    url.hash = shareHash ? '#' + shareHash : '';
    return url.toString();
  }

  saveState() {
    try {
      localStorage.setItem('wtb_state_v3', JSON.stringify({
        version: 3,
        trackedZones: this.trackedZones,
        format: this.format,
        is24Hour: this.format === '24',
        pinStartMin: this.pinStartMin,
        pinDurationMin: this.pinDurationMin
      }));

      // Update URL hash with clean, compact shortened format without reloading
      const shareHash = this.getShareHash();
      if (shareHash) {
        history.replaceState(null, '', '#' + shareHash);
      } else {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }

  initDOM() {
    this.searchInput = document.getElementById('search-input');
    this.searchDropdown = document.getElementById('search-dropdown');
    this.topLiveClock = document.getElementById('top-live-clock');
    this.topClockTime = document.getElementById('top-clock-time');
    this.topClockTz = document.getElementById('top-clock-tz');
    this.topClockWeekNum = document.getElementById('top-clock-week-num');
    this.formatSegmented = document.getElementById('format-segmented');
    this.formatSegments = document.querySelectorAll('.format-segment');
    this.formatToggleBtn = document.getElementById('format-toggle');
    this.dateTabsContainer = document.getElementById('date-tabs');
    this.datePicker = document.getElementById('date-picker');
    this.timelineHeaderHours = document.getElementById('timeline-header-hours');
    this.timelineRowsContainer = document.getElementById('timeline-rows');
    this.overlapBanner = document.getElementById('overlap-banner');
    this.pinnedSummary = document.getElementById('pinned-summary');
    this.pinnedChips = document.getElementById('pinned-chips');
    this.pinnedWorkCount = document.getElementById('pinned-work-count');
    this.clearPinBtn = document.getElementById('clear-pin-btn');
    this.pinnedSentenceText = document.getElementById('pinned-sentence-text');
    this.copySentenceBtn = document.getElementById('copy-sentence-btn');
    this.copySentenceLabel = document.getElementById('copy-sentence-label');
    this.rulerCursor = document.getElementById('ruler-cursor');
    this.rulerPinned = document.getElementById('ruler-pinned');
    this.rulerNow = document.getElementById('ruler-now');
    this.todayBtn = document.getElementById('today-btn');
    this.copyLinkBtn = document.getElementById('copy-link-btn');
    this.resetBtn = document.getElementById('reset-btn');
    this.formatText = document.getElementById('format-text');
    this.selftestBtn = document.getElementById('selftest-btn');
    this.testModal = document.getElementById('test-modal');
    this.closeModalBtn = document.getElementById('close-modal-btn');
    this.testResultsContainer = document.getElementById('test-results');

    // Meeting Duration, Steppers & Recommendation Bar Controls
    this.pinStartSegments = document.getElementById('pin-start-segments');
    this.pinLenDec = document.getElementById('pin-len-dec');
    this.pinLenInc = document.getElementById('pin-len-inc');
    this.pinLenLabel = document.getElementById('pin-len-label');
    this.pinPresetSegments = document.getElementById('pin-preset-segments');
    this.pinShiftPrev = document.getElementById('pin-shift-prev');
    this.pinShiftNext = document.getElementById('pin-shift-next');
    this.addToCalendarBtn = document.getElementById('add-to-calendar-btn');
    this.pinnedDriftAlerts = document.getElementById('pinned-drift-alerts');
    this.bestSlotBar = document.getElementById('best-slot-bar');
    this.bestSlotText = document.getElementById('best-slot-text');
    this.bestSlotButtons = document.getElementById('best-slot-buttons');

    this.datePicker.value = this.currentDate;
    this.updateFormatButton();
    this.updatePinControlsUI();
    this.initSidebarResizer();
  }

  initSidebarResizer() {
    // Restore saved width from localStorage if valid (between 150px and 450px)
    try {
      const savedWidth = localStorage.getItem('wtb_sidebar_width');
      if (savedWidth) {
        const num = parseInt(savedWidth, 10);
        if (!isNaN(num) && num >= 150 && num <= 450) {
          document.documentElement.style.setProperty('--sidebar-width', `${num}px`);
        }
      }
    } catch (e) {
      console.warn('Could not read saved sidebar width:', e);
    }

    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 220;

    const onMouseDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      const currentWidthStr = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim();
      startWidth = parseInt(currentWidthStr, 10) || 220;

      document.body.classList.add('resizing-sidebar');
      resizer.classList.add('is-dragging');

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const newWidth = Math.min(420, Math.max(160, Math.round(startWidth + dx)));
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      this.updateNowMarker();
      this.renderRulerHighlights();
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;
      document.body.classList.remove('resizing-sidebar');
      resizer.classList.remove('is-dragging');

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const finalWidthStr = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim();
      try {
        localStorage.setItem('wtb_sidebar_width', finalWidthStr);
      } catch (e) {}

      this.updateNowMarker();
      this.renderRulerHighlights();
      this.scrollToActiveTime('auto');
    };

    resizer.addEventListener('mousedown', onMouseDown);

    // Double-click to reset to default 220px
    resizer.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.documentElement.style.setProperty('--sidebar-width', '220px');
      try {
        localStorage.removeItem('wtb_sidebar_width');
      } catch (e) {}
      this.updateNowMarker();
      this.renderRulerHighlights();
      this.scrollToActiveTime('auto');
    });
  }

  updateFormatButton() {
    if (this.formatSegments) {
      this.formatSegments.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fmt === this.format);
      });
    }
    const label = this.format === '24' ? '24h Mode' : (this.format === 'mx' ? 'MX Mode' : '12h Mode');
    if (this.formatText) {
      this.formatText.textContent = label;
    } else if (this.formatToggleBtn) {
      this.formatToggleBtn.textContent = label;
    }
  }

  attachEvents() {
    // Jump to Today / Current Time
    if (this.todayBtn) {
      this.todayBtn.addEventListener('click', () => {
        this.jumpToNow();
      });
    }

    // Clicking top live clock jumps to current time and scrolls to now needle
    if (this.topLiveClock) {
      this.topLiveClock.style.cursor = 'pointer';
      this.topLiveClock.addEventListener('click', () => {
        this.jumpToNow();
      });
    }

    // Window Resize -> Recalculate Live Now Needle, Pinned Ruler & Re-center NOW if scrollable
    window.addEventListener('resize', () => {
      this.updateNowMarker();
      this.renderRulerHighlights();
      const scrollContainer = document.querySelector('.timeline-scroll-container');
      if (scrollContainer && scrollContainer.scrollWidth > scrollContainer.clientWidth) {
        this.scrollToActiveTime('auto');
      }
    });

    // Segmented format control (am/pm · 24 · MX)
    if (this.formatSegments) {
      this.formatSegments.forEach(btn => {
        btn.addEventListener('click', () => {
          const fmt = btn.dataset.fmt;
          if (fmt && fmt !== this.format) {
            this.format = fmt;
            this.updateFormatButton();
            this.saveState();
            this.render();
          }
        });
      });
    }

    // Format toggle button (cycles 12 -> 24 -> mx -> 12)
    if (this.formatToggleBtn) {
      this.formatToggleBtn.addEventListener('click', () => {
        if (this.format === '12') this.format = '24';
        else if (this.format === '24') this.format = 'mx';
        else this.format = '12';
        this.updateFormatButton();
        this.saveState();
        this.render();
      });
    }

    // Date Picker Input
    this.datePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        this.currentDate = e.target.value;
        this.saveState();
        this.render();
        setTimeout(() => this.scrollToActiveTime('auto'), 50);
      }
    });

    // Search Autocomplete Input
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value.trim());
    });

    this.searchInput.addEventListener('focus', () => {
      if (this.searchInput.value.trim()) {
        this.searchDropdown.classList.add('open');
      }
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (!this.searchDropdown.classList.contains('open')) return;
      const items = Array.from(this.searchDropdown.querySelectorAll('.dropdown-item'));
      if (items.length === 0) return;

      let activeIndex = items.findIndex(el => el.classList.contains('active'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIndex >= 0) items[activeIndex].classList.remove('active');
        activeIndex = (activeIndex + 1) % items.length;
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIndex >= 0) items[activeIndex].classList.remove('active');
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = activeIndex >= 0 ? items[activeIndex] : items[0];
        if (target) target.click();
      } else if (e.key === 'Escape') {
        this.searchDropdown.classList.remove('open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.searchInput.contains(e.target) && !this.searchDropdown.contains(e.target)) {
        this.searchDropdown.classList.remove('open');
      }
    });

    // Copy Link Button
    this.copyLinkBtn.addEventListener('click', () => {
      this.saveState();
      const shareUrl = this.getShareUrl();
      const copyToClipboard = (text) => {
        const fallbackCopy = () => {
          try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(ta);
            return Promise.resolve(successful);
          } catch (err) {
            return Promise.reject(err);
          }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text).catch(fallbackCopy);
        }
        return fallbackCopy();
      };

      copyToClipboard(shareUrl).then(() => {
        const originalText = this.copyLinkBtn.innerHTML;
        this.copyLinkBtn.innerHTML = `✓ Copied!`;
        setTimeout(() => {
          this.copyLinkBtn.innerHTML = originalText;
        }, 1800);
      }).catch(err => {
        console.warn('Copy link error:', err);
      });
    });

    // Hash change listener (for browser back/forward and direct URL hash paste)
    window.addEventListener('hashchange', () => {
      this.loadState();
      this.render();
      this.renderRulerHighlights();
    });

    // Reset Defaults Button
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        try {
          localStorage.removeItem('wtb_state_v3');
          localStorage.removeItem('wtb_state_v2');
          localStorage.removeItem('wtb_state');
          window.location.hash = '';
        } catch (e) {}
        this.trackedZones = this.getDefaultZones();
        this.pinnedCol = null;
        this.currentDate = this.getTodayDateString(this.getHomeZone().iana);
        this.datePicker.value = this.currentDate;
        this.saveState();
        this.render();
      });
    }

    // Clear Pin
    this.clearPinBtn.addEventListener('click', () => {
      this.pinnedCol = null;
      this.rulerPinned.classList.remove('visible');
      this.pinnedSummary.classList.remove('visible');
      this.saveState();
      this.renderRulerHighlights();
    });

    // Copy Natural Language Sentence
    if (this.copySentenceBtn) {
      this.copySentenceBtn.addEventListener('click', () => this.copySentenceToClipboard());
    }
    if (this.pinnedSentenceText) {
      this.pinnedSentenceText.addEventListener('click', () => this.copySentenceToClipboard());
    }

    // Meeting Start Minute Segments (:00, :15, :30, :45)
    if (this.pinStartSegments) {
      this.pinStartSegments.querySelectorAll('.pin-seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = parseInt(btn.dataset.min, 10);
          this.setPinStartMin(m);
        });
      });
    }

    // Meeting Duration Stepper (- / + 15 min)
    if (this.pinLenDec) {
      this.pinLenDec.addEventListener('click', () => this.setPinDuration(this.pinDurationMin - 15));
    }
    if (this.pinLenInc) {
      this.pinLenInc.addEventListener('click', () => this.setPinDuration(this.pinDurationMin + 15));
    }

    // Meeting Duration Presets (30m, 45m, 1h, 1.5h, 2h)
    if (this.pinPresetSegments) {
      this.pinPresetSegments.querySelectorAll('.pin-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const d = parseInt(btn.dataset.dur, 10);
          this.setPinDuration(d);
        });
      });
    }

    // Meeting Shift Controls (‹ 1h and 1h ›)
    if (this.pinShiftPrev) {
      this.pinShiftPrev.addEventListener('click', () => this.shiftMeeting(-1));
    }
    if (this.pinShiftNext) {
      this.pinShiftNext.addEventListener('click', () => this.shiftMeeting(1));
    }

    // Add to Calendar (.ics download)
    if (this.addToCalendarBtn) {
      this.addToCalendarBtn.addEventListener('click', () => this.exportIcsCalendar());
    }

    // Keyboard Shortcuts: ArrowLeft/Right to shift meeting, [/] for duration, T for today, / for search, C for copy
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) {
        if (e.key === 'Escape' && this.searchInput) {
          this.searchInput.blur();
          if (this.searchDropdown) this.searchDropdown.classList.remove('open');
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.altKey || e.shiftKey) {
          this.stepDate(-1);
        } else {
          this.shiftMeeting(-1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.altKey || e.shiftKey) {
          this.stepDate(1);
        } else {
          this.shiftMeeting(1);
        }
      } else if (e.key === '[') {
        e.preventDefault();
        this.setPinDuration(this.pinDurationMin - 15);
      } else if (e.key === ']') {
        e.preventDefault();
        this.setPinDuration(this.pinDurationMin + 15);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.jumpToNow();
      } else if (e.key === '/') {
        e.preventDefault();
        if (this.searchInput) {
          this.searchInput.focus();
          this.searchInput.select();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.copySentenceToClipboard();
        }
      } else if (e.key === 'Escape') {
        if (this.pinnedCol !== null) {
          this.pinnedCol = null;
          this.saveState();
          this.renderRulerHighlights();
        }
        if (this.testModal) this.testModal.classList.remove('open');
        if (this.searchDropdown) this.searchDropdown.classList.remove('open');
      }
    });

    // Self-test modal (if elements exist)
    if (this.selftestBtn) {
      this.selftestBtn.addEventListener('click', () => this.triggerSelfTestModal());
    }
    if (this.closeModalBtn && this.testModal) {
      this.closeModalBtn.addEventListener('click', () => this.testModal.classList.remove('open'));
    }

    // Attach timeline scrub/touch/tap events once
    this.initTimelineEvents();
  }

  setPinStartMin(min) {
    if (![0, 15, 30, 45].includes(min)) return;
    this.pinStartMin = min;
    this.updatePinControlsUI();
    this.saveState();
    this.renderRulerHighlights();
  }

  setPinDuration(durMin) {
    const clamped = Math.max(15, Math.min(1440, durMin));
    this.pinDurationMin = clamped;
    this.updatePinControlsUI();
    this.saveState();
    this.renderRulerHighlights();
  }

  shiftMeeting(deltaHours) {
    const homeZone = this.getHomeZone();
    const columnInstants = window.computeColumns(homeZone.iana, this.currentDate);
    const numCols = columnInstants.length || 24;

    if (this.pinnedCol === null) {
      this.pinnedCol = 9;
    } else {
      let target = this.pinnedCol + deltaHours;
      if (target < 0) {
        this.stepDate(-1);
        this.pinnedCol = 23;
      } else if (target >= numCols) {
        this.stepDate(1);
        this.pinnedCol = 0;
      } else {
        this.pinnedCol = target;
      }
    }
    this.saveState();
    this.renderRulerHighlights();
    this.scrollToActiveTime('smooth');
  }

  stepDate(deltaDays) {
    try {
      const base = Temporal.PlainDate.from(this.currentDate);
      const nextDate = base.add({ days: deltaDays }).toString();
      this.currentDate = nextDate;
      if (this.datePicker) this.datePicker.value = nextDate;
      this.saveState();
      this.render();
      setTimeout(() => this.scrollToActiveTime('auto'), 50);
    } catch {
      const parts = this.currentDate.split('-').map(Number);
      const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
      const nextDate = dt.toISOString().split('T')[0];
      this.currentDate = nextDate;
      if (this.datePicker) this.datePicker.value = nextDate;
      this.saveState();
      this.render();
      setTimeout(() => this.scrollToActiveTime('auto'), 50);
    }
  }

  updatePinControlsUI() {
    if (this.pinStartSegments) {
      this.pinStartSegments.querySelectorAll('.pin-seg-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.min, 10) === this.pinStartMin);
      });
    }

    if (this.pinLenLabel) {
      const h = Math.floor(this.pinDurationMin / 60);
      const m = this.pinDurationMin % 60;
      let text = '';
      if (h > 0) text += `${h}h`;
      if (m > 0) text += `${text ? ' ' : ''}${m}m`;
      if (!text) text = '0m';
      this.pinLenLabel.textContent = text;
    }

    if (this.pinPresetSegments) {
      this.pinPresetSegments.querySelectorAll('.pin-preset-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.dur, 10) === this.pinDurationMin);
      });
    }
  }

  exportIcsCalendar() {
    const homeZone = this.getHomeZone();
    const columnInstants = window.computeColumns(homeZone.iana, this.currentDate);
    const colIdx = this.pinnedCol !== null ? this.pinnedCol : 9;
    const baseInstant = columnInstants[colIdx] || columnInstants[0];
    if (!baseInstant) return;

    const startInstant = window.addMinutesToInstant(baseInstant, this.pinStartMin);
    const endInstant = window.addMinutesToInstant(startInstant, this.pinDurationMin);
    const title = `Sync: ${this.trackedZones.map(z => z.label).slice(0, 3).join(' / ')}`;
    const url = this.getShareUrl();

    const ics = window.generateIcsContent(startInstant, endInstant, this.trackedZones, title, url);
    window.downloadIcsFile('world-time-meeting.ics', ics);

    if (this.addToCalendarBtn) {
      const origText = this.addToCalendarBtn.innerHTML;
      this.addToCalendarBtn.innerHTML = `✓ Downloaded .ics`;
      setTimeout(() => {
        this.addToCalendarBtn.innerHTML = origText;
      }, 2000);
    }
  }

  renderDateTabs() {
    try {
      const homeZone = this.getHomeZone();
      const todayStr = this.getTodayDateString(homeZone.iana);
      const base = Temporal.PlainDate.from(this.currentDate);
      const tabs = [];

      for (let offset = -3; offset <= 3; offset++) {
        const d = base.add({ days: offset });
        const dateStr = d.toString();
        const monthShort = d.toLocaleString('en-US', { month: 'short' });
        const active = dateStr === this.currentDate ? 'active' : '';
        const isToday = dateStr === todayStr ? 'is-today' : '';
        const todayTitle = dateStr === todayStr ? ' (Today)' : '';

        tabs.push(`
          <button class="date-tab ${active} ${isToday}" data-date="${dateStr}" title="${monthShort} ${d.day}${todayTitle}">
            ${monthShort} ${d.day}
          </button>
        `);
      }

      this.dateTabsContainer.innerHTML = tabs.join('');
      this.dateTabsContainer.querySelectorAll('.date-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          this.currentDate = btn.dataset.date;
          this.datePicker.value = this.currentDate;
          this.saveState();
          this.render();
          setTimeout(() => this.scrollToActiveTime('auto'), 50);
        });
      });
    } catch (e) {
      console.warn('Error rendering date tabs:', e);
    }
  }

  handleSearch(query) {
    if (!query) {
      this.searchDropdown.innerHTML = '';
      this.searchDropdown.classList.remove('open');
      return;
    }

    const q = query.toLowerCase().trim();
    const qUpper = query.toUpperCase().trim();

    // Direct shorthand lookup (e.g. "EDT", "BST", "IST")
    const shorthandZones = (window.TIMEZONE_SHORTHANDS && window.TIMEZONE_SHORTHANDS[qUpper]) || [];

    // Parse offset search (e.g. "utc+8", "utc-5", "+5:30", "gmt-3", "+08:00")
    const cleanOffset = q.replace(/^(utc|gmt)\s*/i, '').trim();
    const offsetMatch = cleanOffset.match(/^([+-])(\d{1,2})(?::(\d{2}))?$/);
    let targetOffsetMin = null;
    if (offsetMatch) {
      const sign = offsetMatch[1];
      const h = parseInt(offsetMatch[2], 10);
      const m = offsetMatch[3] ? parseInt(offsetMatch[3], 10) : 0;
      if (h <= 14 && m <= 59) {
        targetOffsetMin = (h * 60 + m) * (sign === '-' ? -1 : 1);
      }
    }

    // Resolve alias (e.g. "kolkata" -> "Asia/Calcutta", "kyiv" -> "Europe/Kiev", "uk" -> "Europe/London")
    const aliasIana = SEARCH_ALIASES[q] || Object.entries(SEARCH_ALIASES).find(([k]) => q === k || q.includes(k) || k.includes(q))?.[1];

    // Normalize underscores to spaces so "new york" matches "America/New_York"
    const matches = this.zonesDatabase.filter(z => {
      const zIana = z.iana;
      const labelNorm = z.label.toLowerCase();
      const ianaNorm = zIana.toLowerCase().replace(/_/g, ' ');
      const idNorm = z.id.toLowerCase();
      const subNorm = (z.sub || '').toLowerCase();

      // 0. Offset match
      if (targetOffsetMin !== null) {
        try {
          const d = new Date();
          const p = new Intl.DateTimeFormat('en-US', {
            timeZone: zIana, hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          }).formatToParts(d);
          const g = type => +p.find(x => x.type === type).value;
          const wallUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
          const offMin = Math.round((wallUtc - d.getTime()) / 60000);
          if (offMin === targetOffsetMin) return true;
        } catch {}
      }

      // 1. Shorthand match (e.g. EDT, EST, BST, CET, IST, JST)
      if (shorthandZones.includes(zIana)) return true;
      if (z.shorthands && z.shorthands.some(s => s.toLowerCase() === q || s.toUpperCase() === qUpper)) return true;

      // 2. City Alias / Country match (e.g. Kolkata -> Calcutta)
      if (aliasIana && zIana.toLowerCase() === aliasIana.toLowerCase()) return true;

      // 3. Subtitle / Country text match
      if (subNorm.includes(q)) return true;

      // 4. Text query match
      return labelNorm.includes(q) || ianaNorm.includes(q) || idNorm.includes(q);
    }).slice(0, 14);

    if (matches.length === 0) {
      this.searchDropdown.innerHTML = `<div class="dropdown-item" style="color:#94a3b8; cursor:default;">No matching timezones found</div>`;
      this.searchDropdown.classList.add('open');
      return;
    }

    this.searchDropdown.innerHTML = matches.map((m, idx) => {
      const offMatch = m.label.match(/^(\(UTC[+-]\d{2}:\d{2}\))\s*(.*)$/);
      const offsetTag = offMatch ? offMatch[1] : '';
      const placeName = offMatch ? offMatch[2] : m.label;
      const ianaClean = m.iana.replace(/_/g, ' ');
      const hasBadges = m.shorthands && m.shorthands.length > 0;
      const badgeText = hasBadges ? m.shorthands.slice(0, 3).join(' / ') : '';

      return `
        <div class="dropdown-item${idx === 0 ? ' active' : ''}" data-iana="${m.iana}" data-id="${m.id}" data-label="${m.label}">
          <div class="dropdown-item-main">
            <div class="dropdown-item-header">
              ${offsetTag ? `<span class="tz-offset">${offsetTag}</span>` : ''}
              <strong class="tz-name">${placeName}</strong>
            </div>
            <div class="tz-iana">${ianaClean}</div>
          </div>
          ${hasBadges ? `<span class="shorthand-badge">${badgeText}</span>` : ''}
        </div>
      `;
    }).join('');

    this.searchDropdown.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        this.searchDropdown.querySelectorAll('.dropdown-item.active').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
      });

      el.addEventListener('click', () => {
        const parsed = this.parseZoneInfo({
          id: el.dataset.id,
          label: el.dataset.label,
          iana: el.dataset.iana
        });

        this.addZone({
          ...parsed,
          isHome: this.trackedZones.length === 0
        });

        this.searchInput.value = '';
        this.searchDropdown.classList.remove('open');
      });
    });

    this.searchDropdown.classList.add('open');
  }

  addZone(zone) {
    if (!this.trackedZones.some(z => z.iana === zone.iana)) {
      this.trackedZones.push(zone);
      this.saveState();
      this.render();
    }
  }

  removeZone(index) {
    if (this.trackedZones.length <= 1) {
      alert('You must keep at least one time zone.');
      return;
    }
    const removed = this.trackedZones.splice(index, 1)[0];
    if (removed.isHome && this.trackedZones.length > 0) {
      this.trackedZones[0].isHome = true;
    }
    this.saveState();
    this.render();
  }

  setHomeZone(index) {
    this.trackedZones.forEach((z, i) => {
      z.isHome = i === index;
    });
    this.saveState();
    this.render();
  }

  moveZone(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= this.trackedZones.length) return;
    const temp = this.trackedZones[index];
    this.trackedZones[index] = this.trackedZones[target];
    this.trackedZones[target] = temp;
    this.saveState();
    this.render();
  }

  render() {
    this.renderDateTabs();
    const homeZone = this.getHomeZone();
    const columnInstants = window.computeColumns(homeZone.iana, this.currentDate);
    const numCols = columnInstants.length;

    // Clamp or clear pinnedCol if it exceeds column count
    if (this.pinnedCol !== null && this.pinnedCol >= numCols) {
      this.pinnedCol = null;
      this.saveState();
    }

    if (numCols === 0) {
      document.documentElement.style.setProperty('--num-cols', '0');
      this.timelineHeaderHours.innerHTML = '';

      const [y, m, d] = this.currentDate.split('-').map(Number);
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
      }).format(new Date(Date.UTC(y, m - 1, d)));

      const locName = (homeZone.label || homeZone.city || homeZone.iana || 'this location').replace(/\(UTC[+-]\d{2}:\d{2}\)\s*/, '');

      this.timelineRowsContainer.innerHTML = `
        <div class="skipped-day-message" style="
          padding: 60px 24px;
          text-align: center;
          background: #ffffff;
          border-radius: 8px;
          border: 1px dashed var(--border-light);
          margin: 20px 0;
          color: var(--text-muted);
        ">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🗓️</div>
          <div style="font-size: 1.15rem; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
            ${formattedDate} never happened in ${locName}
          </div>
          <div style="font-size: 0.95rem; max-width: 500px; margin: 0 auto; line-height: 1.5;">
            The zone skipped this date when it crossed the date line.
          </div>
        </div>
      `;

      if (this.overlapBanner) this.overlapBanner.style.display = 'none';
      if (this.pinnedSummary) this.pinnedSummary.classList.remove('visible');
      if (this.rulerNow) this.rulerNow.classList.remove('visible');
      if (this.rulerPinned) this.rulerPinned.classList.remove('visible');
      if (this.rulerCursor) this.rulerCursor.classList.remove('visible');
      return;
    }

    document.documentElement.style.setProperty('--num-cols', numCols);

    // 1. Render Header Hours
    let headerHtml = '';
    const nowUtc = Temporal.Now.instant();

    columnInstants.forEach((instant, colIdx) => {
      const homeZdt = instant.toZonedDateTimeISO(homeZone.iana);
      const hourVal = homeZdt.hour;
      let displayHour = hourVal;
      let ampm = '';

      const rulerIs24 = this.isZone24Hour(homeZone.iana);
      if (!rulerIs24) {
        ampm = hourVal >= 12 ? 'pm' : 'am';
        displayHour = hourVal % 12;
        if (displayHour === 0) displayHour = 12;
      }

      headerHtml += `
        <div class="hour-header-cell" data-col="${colIdx}">
          <span>${displayHour}</span>
          <span style="font-size:0.65rem; font-weight:normal; opacity:0.8;">${ampm}</span>
        </div>
      `;
    });

    this.timelineHeaderHours.innerHTML = headerHtml;

    // 2. Render Rows & Compute Overlap
    const overlapCols = new Set();
    for (let c = 0; c < numCols; c++) {
      overlapCols.add(c);
    }

    let rowsHtml = '';
    const rowCalculations = [];

    // Anchor instant for relative offset badge & seasonal DST name:
    const anchorInstant = (this.pinnedCol !== null && columnInstants[this.pinnedCol])
      ? columnInstants[this.pinnedCol]
      : columnInstants[Math.floor(numCols / 2)] || columnInstants[0];

    const homeAnchorZdt = anchorInstant.toZonedDateTimeISO(homeZone.iana);
    const homeDatePlain = Temporal.PlainDate.from(this.currentDate);

    this.trackedZones.forEach((zone, rowIdx) => {
      const rowAnchorZdt = anchorInstant.toZonedDateTimeISO(zone.iana);

      // Relative offset to home in hours for the displayed date/pinned instant
      const homeOffsetMinutes = homeAnchorZdt.offsetNanoseconds / 60000000000;
      const rowOffsetMinutes = rowAnchorZdt.offsetNanoseconds / 60000000000;
      const diffHours = (rowOffsetMinutes - homeOffsetMinutes) / 60;
      const diffBadge = zone.isHome ? '0' : (diffHours >= 0 ? `+${diffHours}` : `${diffHours}`);

      // DST Abbreviation for the displayed date
      const shortTzName = this.getTimezoneAbbrev(zone.iana, anchorInstant);

      let prevLocalDate = null;
      const cellsData = [];

      columnInstants.forEach((instant, colIdx) => {
        const zdt = instant.toZonedDateTimeISO(zone.iana);
        const localHour = zdt.hour;
        const localMinute = zdt.minute;
        const fractionalHour = localHour + localMinute / 60;
        const plainDate = zdt.toPlainDate();
        const localDateStr = plainDate.toString();

        // Check if date changed from previous cell or differs from home date on col 0
        let isDateBreak = false;
        let dateBreakLabel = '';
        if (prevLocalDate && localDateStr !== prevLocalDate) {
          isDateBreak = true;
          const dayName = plainDate.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
          dateBreakLabel = `${dayName} ${plainDate.day}`;
        } else if (colIdx === 0 && !plainDate.equals(homeDatePlain)) {
          isDateBreak = true;
          const dayName = plainDate.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
          dateBreakLabel = `${dayName} ${plainDate.day}`;
        }
        prevLocalDate = localDateStr;

        // Classification: weekends are not work hours
        const isWeekend = zdt.dayOfWeek >= 6;
        const isWork = !isWeekend && fractionalHour >= 9 && fractionalHour < 17;

        if (!isWork) {
          overlapCols.delete(colIdx);
        }

        // Continuous diurnal gradient computation
        const cStart = window.getDiurnalColor(fractionalHour);
        const cEnd = window.getDiurnalColor(fractionalHour + 1.0);
        const cMid = window.getDiurnalColor(fractionalHour + 0.5);

        // Perceived luminance at midpoint to guarantee contrast
        const lum = 0.299 * cMid.r + 0.587 * cMid.g + 0.114 * cMid.b;
        const isLight = lum > 160;
        const cellTextColor = isLight ? '#0f172a' : '#ffffff';
        const cellSubColor = isLight ? '#475569' : 'rgba(255, 255, 255, 0.85)';
        const cellBorderColor = isLight ? 'rgba(148, 163, 184, 0.35)' : 'rgba(255, 255, 255, 0.14)';
        const cellBgGradient = `linear-gradient(90deg, ${cStart.css} 0%, ${cEnd.css} 100%)`;

        // Format cell string
        let cellText = '';
        let cellSub = '';
        const rowIs24 = this.isZone24Hour(zone.iana);
        if (rowIs24) {
          const hStr = String(localHour).padStart(2, '0');
          const mStr = localMinute !== 0 ? `:${String(localMinute).padStart(2, '0')}` : '';
          cellText = `${hStr}${mStr}`;
        } else {
          let h12 = localHour % 12;
          if (h12 === 0) h12 = 12;
          const ampm = localHour >= 12 ? 'pm' : 'am';
          const mStr = localMinute !== 0 ? `:${String(localMinute).padStart(2, '0')}` : '';
          cellText = `${h12}${mStr}`;
          cellSub = ampm;
        }

        const cellAbbrev = this.getTimezoneAbbrev(zone.iana, instant);
        const cellOffsetStr = zdt.offset || '';
        const cellTooltip = `${zone.label}: ${cellText}${cellSub ? ' ' + cellSub : ''} ${cellAbbrev}${cellOffsetStr ? ` (${cellOffsetStr})` : ''} • ${localDateStr}`;

        cellsData.push({
          colIdx,
          cellText,
          cellSub,
          cellTooltip,
          isWork,
          isWeekend,
          isDateBreak,
          dateBreakLabel,
          cellBgGradient,
          cellTextColor,
          cellSubColor,
          cellBorderColor
        });
      });

      rowCalculations.push({
        zone,
        rowIdx,
        diffBadge,
        shortTzName,
        cellsData
      });
    });

    // Build Rows HTML
    rowCalculations.forEach(({ zone, rowIdx, diffBadge, shortTzName, cellsData }) => {
      const isHomeClass = zone.isHome ? 'is-home' : '';
      const isFirst = rowIdx === 0;
      const isLast = rowIdx === this.trackedZones.length - 1;
      const upDisabled = isFirst ? 'disabled style="opacity:0.2; cursor:default;"' : '';
      const downDisabled = isLast ? 'disabled style="opacity:0.2; cursor:default;"' : '';

      const cellsHtml = cellsData.map(c => {
        let extraClasses = '';
        if (c.isWork) extraClasses += ' cell-work';
        if (c.isWeekend) extraClasses += ' cell-weekend';
        if (c.isDateBreak) extraClasses += ' date-break-cell';

        const dateBreakAttr = c.isDateBreak ? `data-date-label="${c.dateBreakLabel}"` : '';

        return `
          <div class="time-cell${extraClasses}"
               style="background: ${c.cellBgGradient}; color: ${c.cellTextColor}; border-right-color: ${c.cellBorderColor};"
               ${dateBreakAttr}
               title="${c.cellTooltip}"
               data-col="${c.colIdx}"
               data-row="${rowIdx}">
            <span class="cell-hour">${c.cellText}</span>
            ${c.cellSub ? `<span class="cell-period" style="color: ${c.cellSubColor}">${c.cellSub}</span>` : ''}
          </div>
        `;
      }).join('');

      rowsHtml += `
        <div class="zone-row" data-row="${rowIdx}">
          <div class="zone-sidebar">
            <div class="zone-meta-left">
              <div class="zone-reorder">
                <button class="btn-icon-tiny move-up-btn" data-row="${rowIdx}" title="Move up" ${upDisabled}>▲</button>
                <button class="btn-icon-tiny move-down-btn" data-row="${rowIdx}" title="Move down" ${downDisabled}>▼</button>
              </div>
              <button class="zone-home-btn ${isHomeClass}" data-row="${rowIdx}" title="${zone.isHome ? 'Home zone' : 'Set as home zone'}">
                ${zone.isHome ? '★' : '☆'}
              </button>
              <div class="zone-info" title="${zone.label} (${zone.sub})">
                <div class="zone-name-row">
                  <span class="zone-city" title="${zone.label}">${zone.label}</span>
                </div>
                <div class="zone-sub-row">
                  <span class="zone-offset-badge ${isHomeClass}">${diffBadge}</span>
                  <span class="zone-dst-badge">${shortTzName}</span>
                  <span class="zone-country" title="${zone.sub}">${zone.sub}</span>
                </div>
              </div>
            </div>
            <div class="zone-live-time" data-iana="${zone.iana}" title="Current live time">
              <span class="zone-time-digits">--:--</span>
              <span class="zone-time-day">---</span>
            </div>
            <button class="zone-remove-btn" data-row="${rowIdx}" title="Remove zone">×</button>
          </div>
          <div class="zone-cells-strip">
            ${cellsHtml}
          </div>
        </div>
      `;
    });

    this.timelineRowsContainer.innerHTML = rowsHtml;

    // Highlight Overlap Columns in Header
    const headerCells = this.timelineHeaderHours.querySelectorAll('.hour-header-cell');
    headerCells.forEach(cell => {
      const c = parseInt(cell.dataset.col, 10);
      if (overlapCols.has(c)) {
        cell.classList.add('overlap-col');
        cell.title = 'Mutual business hours (all tracked zones 9am–5pm)';
      }
    });

    // Least-Bad Hours Optimization
    const slotScores = window.computeLeastBadHours ? window.computeLeastBadHours(columnInstants, this.trackedZones, this.pinDurationMin) : [];
    const sortedSlots = [...slotScores].sort((a, b) => a.score - b.score);
    const topSlots = sortedSlots.slice(0, 3);
    const topColSet = new Set(topSlots.map(s => s.colIdx));

    // If no mutual overlap, annotate top slots with ★ in header
    if (overlapCols.size === 0 && this.trackedZones.length > 1) {
      headerCells.forEach(cell => {
        const c = parseInt(cell.dataset.col, 10);
        if (topColSet.has(c)) {
          const matchSlot = topSlots.find(s => s.colIdx === c);
          cell.title = `Recommended compromised slot (Discomfort penalty: ${matchSlot?.score || 0})`;
          const hourSpan = cell.querySelector('span');
          if (hourSpan && !hourSpan.innerHTML.startsWith('★')) {
            hourSpan.innerHTML = `<span style="color:#d97706; font-size:0.75rem; margin-right:1px;">★</span>${hourSpan.innerHTML}`;
          }
        }
      });
    }

    // Update Overlap Banner or Best Slot Recommendation Bar
    if (overlapCols.size > 0) {
      const overlapHours = Array.from(overlapCols).map(c => {
        const homeIs24 = this.isZone24Hour(homeZone.iana);
        const zdt = columnInstants[c].toZonedDateTimeISO(homeZone.iana);
        return homeIs24 ? `${String(zdt.hour).padStart(2, '0')}:00` : `${zdt.hour % 12 || 12}${zdt.hour >= 12 ? 'pm' : 'am'}`;
      });
      this.overlapBanner.style.display = 'flex';
      this.overlapBanner.innerHTML = `
        <span>★ <strong>Mutual Business Hours Available:</strong> ${overlapHours.join(', ')} (${homeZone.label} time)</span>
      `;
      if (this.bestSlotBar) this.bestSlotBar.style.display = 'none';
    } else {
      this.overlapBanner.style.display = 'none';

      // Show Best Slot Bar
      if (this.bestSlotBar && topSlots.length > 0 && this.trackedZones.length > 1) {
        this.bestSlotBar.style.display = 'flex';
        if (this.bestSlotText) {
          this.bestSlotText.textContent = 'No mutual 9–5 hours found across all zones. Least-disruptive slots:';
        }
        if (this.bestSlotButtons) {
          this.bestSlotButtons.innerHTML = topSlots.map(s => `
            <button type="button" class="slot-chip-btn" data-col="${s.colIdx}" title="Jump to ${s.hourLabel} (Score ${s.score})">
              ★ ${s.hourLabel} <span style="font-size:0.7rem; opacity:0.8; font-weight:normal;">(cost ${s.score})</span>
            </button>
          `).join('');
          this.bestSlotButtons.querySelectorAll('.slot-chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const col = parseInt(btn.dataset.col, 10);
              this.pinnedCol = col;
              this.saveState();
              this.renderRulerHighlights();
              this.scrollToActiveTime('smooth');
            });
          });
        }
      } else if (this.bestSlotBar) {
        this.bestSlotBar.style.display = 'none';
      }
    }

    // Attach row events
    this.attachRowEvents(columnInstants);
    this.updateLiveClocks();
    this.updateTopLiveClock();
    this.renderRulerHighlights();
    this.updateNowMarker();

    if (this.isFirstRender) {
      this.isFirstRender = false;
      requestAnimationFrame(() => this.scrollToActiveTime('auto'));
      setTimeout(() => this.scrollToActiveTime('auto'), 50);
    }
  }

  getTimezoneAbbrev(iana, instant) {
    return window.getTimezoneAbbrev(iana, instant);
  }

  attachRowEvents(columnInstants) {
    // Row Actions: Move, Home, Remove
    this.timelineRowsContainer.querySelectorAll('.move-up-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveZone(parseInt(btn.dataset.row, 10), -1);
      });
    });

    this.timelineRowsContainer.querySelectorAll('.move-down-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveZone(parseInt(btn.dataset.row, 10), 1);
      });
    });

    this.timelineRowsContainer.querySelectorAll('.zone-home-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setHomeZone(parseInt(btn.dataset.row, 10));
      });
    });

    this.timelineRowsContainer.querySelectorAll('.zone-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeZone(parseInt(btn.dataset.row, 10));
      });
    });
  }

  initTimelineEvents() {
    const scrollContainer = document.querySelector('.timeline-scroll-container');
    if (!scrollContainer) return;

    let isMouseDown = false;
    let isTouchDown = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let hasTouchMoved = false;
    let lastTouchEndTime = 0;

    // Pointerdown: Handles both touch and mouse
    scrollContainer.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        isTouchDown = true;
        hasTouchMoved = false;
        touchStartX = e.clientX;
        touchStartY = e.clientY;
        if (this.rulerCursor) this.rulerCursor.classList.remove('visible');
        return;
      }

      // Mouse left-click: begin scrub
      if (e.button === 0) {
        const cell = e.target.closest('.time-cell') || e.target.closest('.hour-header-cell');
        if (cell && cell.dataset.col !== undefined) {
          isMouseDown = true;
          const col = parseInt(cell.dataset.col, 10);
          this.pinnedCol = col;
          this.renderRulerHighlights();
        }
      }
    });

    // Pointermove: Distinguishes touch scroll vs mouse scrub/hover
    scrollContainer.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        if (isTouchDown) {
          const dx = Math.abs(e.clientX - touchStartX);
          const dy = Math.abs(e.clientY - touchStartY);
          if (dx > 8 || dy > 8) {
            hasTouchMoved = true;
          }
        }
        return;
      }

      // Mouse hover and drag scrub (ignore synthetic mouse shortly after touch)
      if (Date.now() - lastTouchEndTime < 500) return;

      const cell = e.target.closest('.time-cell') || e.target.closest('.hour-header-cell');
      if (cell && cell.dataset.col !== undefined) {
        const col = parseInt(cell.dataset.col, 10);
        const headerCell = this.timelineHeaderHours.querySelector(`.hour-header-cell[data-col="${col}"]`);
        if (headerCell) {
          this.hoveredCol = col;
          if (this.rulerCursor) {
            const contentContainer = document.querySelector('.timeline-content');
            if (contentContainer) {
              const contentRect = contentContainer.getBoundingClientRect();
              const headerRect = headerCell.getBoundingClientRect();
              this.rulerCursor.style.left = `${headerRect.left - contentRect.left}px`;
              this.rulerCursor.style.width = `${headerRect.width}px`;
            } else {
              this.rulerCursor.style.left = `${headerCell.offsetLeft}px`;
              this.rulerCursor.style.width = `${headerCell.offsetWidth}px`;
            }
            this.rulerCursor.classList.add('visible');
          }
          this.highlightColumn(col);

          if (isMouseDown && this.pinnedCol !== col) {
            this.pinnedCol = col;
            this.renderRulerHighlights();
          }
          return;
        }
      }

      this.hoveredCol = null;
      if (this.rulerCursor) this.rulerCursor.classList.remove('visible');
      this.highlightColumn(null);
    });

    // Pointerup on window so releasing outside container still ends mouse drag
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        if (isTouchDown) {
          isTouchDown = false;
          lastTouchEndTime = Date.now();
          if (!hasTouchMoved) {
            // Clean stationary tap on touchscreen
            const targetEl = e.target || document.elementFromPoint(e.clientX, e.clientY);
            const cell = targetEl ? (targetEl.closest('.time-cell') || targetEl.closest('.hour-header-cell')) : null;
            if (cell && cell.dataset.col !== undefined) {
              const col = parseInt(cell.dataset.col, 10);
              this.pinnedCol = col;
              this.renderRulerHighlights();
              this.saveState();
            }
          }
          if (this.rulerCursor) this.rulerCursor.classList.remove('visible');
        }
        return;
      }

      if (isMouseDown) {
        isMouseDown = false;
        this.saveState();
      }
    });

    window.addEventListener('pointercancel', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        isTouchDown = false;
        hasTouchMoved = true;
        if (this.rulerCursor) this.rulerCursor.classList.remove('visible');
      }
      isMouseDown = false;
    });

    scrollContainer.addEventListener('mouseleave', () => {
      this.hoveredCol = null;
      if (this.rulerCursor) this.rulerCursor.classList.remove('visible');
      this.highlightColumn(null);
    });

    // Fallback click handler for non-pointer devices, keyboard, or programmatic `.click()`
    scrollContainer.addEventListener('click', (e) => {
      if (Date.now() - lastTouchEndTime < 400) return; // ignore synthetic click after touch tap
      const cell = e.target.closest('.time-cell') || e.target.closest('.hour-header-cell');
      if (cell && cell.dataset.col !== undefined) {
        const col = parseInt(cell.dataset.col, 10);
        this.pinnedCol = col;
        this.renderRulerHighlights();
        this.saveState();
      }
    });
  }

  highlightColumn(colIdx) {
    const startH = (this.pinnedCol !== null) ? (this.pinnedCol + (this.pinStartMin || 0) / 60) : -999;
    const endH = startH + ((this.pinDurationMin || 60) / 60);

    document.querySelectorAll('.hour-header-cell').forEach(c => {
      const cIdx = parseInt(c.dataset.col, 10);
      const isPinned = (cIdx + 1 > startH && cIdx < endH);
      const isHovered = colIdx !== null && cIdx === colIdx;
      c.classList.toggle('pinned-col', isPinned);
      c.classList.toggle('active-col', isHovered || isPinned);
    });
  }

  renderRulerHighlights() {
    const contentContainer = document.querySelector('.timeline-content');
    if (this.pinnedCol !== null && contentContainer) {
      const headerCell = this.timelineHeaderHours.querySelector(`.hour-header-cell[data-col="${this.pinnedCol}"]`);
      if (headerCell) {
        const contentRect = contentContainer.getBoundingClientRect();
        const headerRect = headerCell.getBoundingClientRect();
        const colWidth = headerRect.width;
        const leftOffset = (headerRect.left - contentRect.left) + colWidth * ((this.pinStartMin || 0) / 60);
        const pinWidth = colWidth * ((this.pinDurationMin || 60) / 60);

        this.rulerPinned.style.left = `${leftOffset}px`;
        this.rulerPinned.style.width = `${pinWidth}px`;
        this.rulerPinned.classList.add('visible');
      }
      const homeZone = this.getHomeZone();
      const columnInstants = window.computeColumns(homeZone.iana, this.currentDate);
      this.updatePinnedSummary(columnInstants);
    } else {
      this.rulerPinned.classList.remove('visible');
      this.pinnedSummary.classList.remove('visible');
    }
    this.highlightColumn(this.hoveredCol);
  }

  scrollToActiveTime(behavior = 'auto') {
    const scrollContainer = document.querySelector('.timeline-scroll-container');
    if (!scrollContainer) return;

    // If total content width fits entirely inside scrollContainer without overflow, reset scroll to 0
    if (scrollContainer.scrollWidth <= scrollContainer.clientWidth) {
      scrollContainer.scrollLeft = 0;
      return;
    }

    const sidebarEl = document.querySelector('.timeline-header-left');
    const sidebarWidth = sidebarEl ? sidebarEl.getBoundingClientRect().width : 220;
    const availableWidth = scrollContainer.clientWidth - sidebarWidth;

    let targetX = null;

    // 1. If a column is pinned, prioritize centering on the pinned column
    if (this.pinnedCol !== null) {
      const pinnedCell = this.timelineHeaderHours.querySelector(`.hour-header-cell[data-col="${this.pinnedCol}"]`);
      if (pinnedCell) {
        targetX = pinnedCell.offsetLeft + (pinnedCell.offsetWidth / 2);
      }
    }

    // 2. Otherwise, if today and rulerNow needle is visible, center exactly on the needle
    const homeZone = this.getHomeZone();
    const todayStr = this.getTodayDateString(homeZone.iana);

    if (targetX === null && this.currentDate === todayStr && this.rulerNow && this.rulerNow.classList.contains('visible')) {
      const leftPx = parseFloat(this.rulerNow.style.left);
      if (!isNaN(leftPx) && leftPx > 0) {
        targetX = leftPx;
      }
    }

    // 3. If today, find current hour column directly from columnInstants
    if (targetX === null && this.currentDate === todayStr) {
      const nowMs = Date.now();
      const columnInstants = window.computeColumns(homeZone.iana, this.currentDate);
      for (let k = 0; k < columnInstants.length; k++) {
        const colStartMs = Number(columnInstants[k].epochMilliseconds || (columnInstants[k].epochNanoseconds / 1000000n));
        const nextStartMs = (k + 1 < columnInstants.length)
          ? Number(columnInstants[k + 1].epochMilliseconds || (columnInstants[k + 1].epochNanoseconds / 1000000n))
          : colStartMs + 3600000;
        if (nowMs >= colStartMs && nowMs < nextStartMs) {
          const headerCell = this.timelineHeaderHours.querySelector(`.hour-header-cell[data-col="${k}"]`);
          if (headerCell) {
            const frac = Math.max(0, Math.min(1, (nowMs - colStartMs) / (nextStartMs - colStartMs)));
            targetX = headerCell.offsetLeft + frac * headerCell.offsetWidth;
          }
          break;
        }
      }
    }

    // 4. If viewing another date without pin, default to 9:00 AM (col 9) or first cell
    if (targetX === null) {
      const defaultCell = this.timelineHeaderHours.querySelector('.hour-header-cell[data-col="9"]')
        || this.timelineHeaderHours.querySelector('.hour-header-cell');
      if (defaultCell) {
        targetX = defaultCell.offsetLeft + (defaultCell.offsetWidth / 2);
      }
    }

    if (targetX !== null && availableWidth > 0) {
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      const targetScrollLeft = Math.max(0, Math.min(maxScroll, Math.round(targetX - sidebarWidth - (availableWidth / 2))));
      scrollContainer.scrollLeft = targetScrollLeft;
    }
  }

  jumpToNow() {
    const homeZone = this.getHomeZone();
    this.currentDate = this.getTodayDateString(homeZone.iana);
    this.datePicker.value = this.currentDate;
    this.saveState();
    this.render();

    setTimeout(() => {
      this.scrollToActiveTime('auto');
    }, 60);
  }

  updateNowMarker() {
    if (!this.rulerNow) return;

    try {
      const homeZone = this.getHomeZone();
      const todayStr = this.getTodayDateString(homeZone.iana);

      // If user is viewing a different date, hide the real-time needle & current-hour styles
      if (this.currentDate !== todayStr) {
        this.rulerNow.classList.remove('visible');
        document.querySelectorAll('.hour-header-cell.is-current-hour').forEach(el => el.classList.remove('is-current-hour'));
        return;
      }

      const columnInstants = window.computeColumns(homeZone.iana, this.currentDate);
      const nowMs = Date.now();

      // Find which column in columnInstants contains the current moment
      let targetColIdx = -1;
      let fraction = 0;

      for (let k = 0; k < columnInstants.length; k++) {
        const colStartMs = Number(columnInstants[k].epochMilliseconds || (columnInstants[k].epochNanoseconds / 1000000n));
        const nextStartMs = (k + 1 < columnInstants.length)
          ? Number(columnInstants[k + 1].epochMilliseconds || (columnInstants[k + 1].epochNanoseconds / 1000000n))
          : colStartMs + 3600000;

        if (nowMs >= colStartMs && nowMs < nextStartMs) {
          targetColIdx = k;
          fraction = Math.max(0, Math.min(1, (nowMs - colStartMs) / (nextStartMs - colStartMs)));
          break;
        }
      }

      if (targetColIdx === -1) {
        this.rulerNow.classList.remove('visible');
        return;
      }

      // Toggle .is-current-hour class on header cells
      document.querySelectorAll('.hour-header-cell').forEach(el => {
        const cIdx = parseInt(el.dataset.col, 10);
        el.classList.toggle('is-current-hour', cIdx === targetColIdx);
      });

      const contentContainer = document.querySelector('.timeline-content');
      const headerCell = this.timelineHeaderHours.querySelector(`.hour-header-cell[data-col="${targetColIdx}"]`);

      if (headerCell && contentContainer) {
        const contentRect = contentContainer.getBoundingClientRect();
        const xPos = headerCell.offsetLeft + fraction * headerCell.offsetWidth;

        this.rulerNow.style.left = `${xPos}px`;
        this.rulerNow.classList.add('visible');

        const pill = this.rulerNow.querySelector('.now-pill');
        if (pill) {
          if (xPos + 50 > contentRect.width) {
            pill.style.left = 'auto';
            pill.style.right = '0px';
            pill.style.transform = 'none';
          } else if (xPos < 25) {
            pill.style.left = '0px';
            pill.style.right = 'auto';
            pill.style.transform = 'none';
          } else {
            pill.style.left = '50%';
            pill.style.right = 'auto';
            pill.style.transform = 'translateX(-50%)';
          }
        }

        const nowTextEl = document.getElementById('now-time-text');
        try {
          const homeIs24 = this.isZone24Hour(homeZone.iana);
          const homeTimeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: homeZone.iana,
            hour: homeIs24 ? '2-digit' : 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: !homeIs24
          }).format(new Date(nowMs));
          this.rulerNow.title = `Current Time: ${homeTimeStr} (${homeZone.label})`;
        } catch {
          this.rulerNow.title = 'Current Time';
        }
        if (nowTextEl) {
          nowTextEl.textContent = 'NOW';
        }
      }
    } catch (e) {
      console.warn('Error updating now marker:', e);
    }
  }

  getPinnedHourStatus(zdt) {
    return window.getPinnedHourStatus(zdt);
  }

  updatePinnedSummary(columnInstants) {
    if (this.pinnedCol === null || !columnInstants[this.pinnedCol]) return;

    const baseInstant = columnInstants[this.pinnedCol];
    const startInstant = window.addMinutesToInstant(baseInstant, this.pinStartMin || 0);
    const endInstant = window.addMinutesToInstant(startInstant, this.pinDurationMin || 60);
    const homeZone = this.getHomeZone();

    let workCount = 0;

    const chipsHtml = this.trackedZones.map(zone => {
      const zdtStart = startInstant.toZonedDateTimeISO(zone.iana);
      const zdtEnd = endInstant.toZonedDateTimeISO(zone.iana);
      const is24 = this.isZone24Hour(zone.iana);

      const timeStartStr = zdtStart.toLocaleString('en-US', {
        hour: is24 ? '2-digit' : 'numeric',
        minute: '2-digit',
        hour12: !is24
      });
      const timeEndStr = zdtEnd.toLocaleString('en-US', {
        hour: is24 ? '2-digit' : 'numeric',
        minute: '2-digit',
        hour12: !is24
      });

      const dateStr = zdtStart.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Compare dates relative to home zone date for clear date badges
      const homePlainDate = startInstant.toZonedDateTimeISO(homeZone.iana).toPlainDate();
      const zonePlainDate = zdtStart.toPlainDate();
      let dateBadge = '';
      if (!zonePlainDate.equals(homePlainDate)) {
        try {
          const dayDiff = zonePlainDate.since ? zonePlainDate.since(homePlainDate).days : (zonePlainDate.day - homePlainDate.day);
          dateBadge = `<span class="date-diff-pill ${dayDiff > 0 ? 'next-day' : 'prev-day'}">${dayDiff > 0 ? `+${dayDiff}d` : `${dayDiff}d`}</span>`;
        } catch {
          dateBadge = `<span class="date-diff-pill next-day">diff date</span>`;
        }
      }

      // Check if meeting crosses midnight locally
      if (!zdtStart.toPlainDate().equals(zdtEnd.toPlainDate())) {
        dateBadge += `<span class="date-diff-pill next-day" title="Ends next day">ends next day</span>`;
      }

      // Working status over entire span:
      const st1 = this.getPinnedHourStatus(zdtStart);
      const st2 = this.getPinnedHourStatus(zdtEnd);

      let effectiveStatus = st1;
      if (st1.category === 'weekend' || st2.category === 'weekend') {
        effectiveStatus = { category: 'weekend', statusClass: 'status-weekend', statusLabel: 'Weekend', tooltip: 'Touches weekend' };
      } else if (st1.category === 'night' || st2.category === 'night') {
        effectiveStatus = { category: 'night', statusClass: 'status-night', statusLabel: 'Night', tooltip: 'Touches sleep / night hours' };
      } else if (st1.category === 'work' && st2.category === 'work') {
        effectiveStatus = { category: 'work', statusClass: 'status-work', statusLabel: 'Work', tooltip: 'Entirely within business hours (9am–5pm)' };
      } else {
        effectiveStatus = { category: 'shoulder', statusClass: 'status-shoulder', statusLabel: 'Off-hours', tooltip: 'Partially or wholly in off-work awake hours' };
      }

      if (effectiveStatus.category === 'work') {
        workCount++;
      }

      const abbrev = window.getTimezoneAbbrev ? window.getTimezoneAbbrev(zone.iana, startInstant) : '';

      return `
        <div class="pinned-chip ${effectiveStatus.statusClass}" title="${zone.label}: ${effectiveStatus.tooltip}">
          <span class="pinned-status-dot ${effectiveStatus.statusClass}"></span>
          <span class="pinned-zone-name">${zone.label}:</span>
          <span class="pinned-time">${timeStartStr} – ${timeEndStr}</span>
          ${abbrev ? `<span class="pinned-tz-code">${abbrev}</span>` : ''}
          <span class="pinned-date">(${dateStr})</span>
          ${dateBadge}
          <span class="pinned-status-badge ${effectiveStatus.statusClass}">${effectiveStatus.statusLabel}</span>
        </div>
      `;
    }).join('');

    this.pinnedChips.innerHTML = chipsHtml;

    if (this.pinnedWorkCount) {
      const total = this.trackedZones.length;
      if (workCount === total && total > 0) {
        this.pinnedWorkCount.innerHTML = `<span class="work-counter-pill all-work">★ All ${total} in work hours</span>`;
      } else if (workCount > 0) {
        this.pinnedWorkCount.innerHTML = `<span class="work-counter-pill partial-work">${workCount} of ${total} in work hours</span>`;
      } else {
        this.pinnedWorkCount.innerHTML = `<span class="work-counter-pill none-work">0 of ${total} in work hours</span>`;
      }
    }

    // DST Drift Alerts
    if (this.pinnedDriftAlerts) {
      const alerts = window.scanDstDrift ? window.scanDstDrift(startInstant, this.trackedZones, 3) : [];
      if (alerts.length > 0) {
        this.pinnedDriftAlerts.innerHTML = alerts.map(a => `<div class="drift-alert-pill">${a.message}</div>`).join('');
        this.pinnedDriftAlerts.style.display = 'flex';
      } else {
        this.pinnedDriftAlerts.style.display = 'none';
      }
    }

    if (this.pinnedSentenceText) {
      this.pinnedSentenceText.textContent = this.generatePinnedSentence(startInstant, endInstant);
    }

    this.pinnedSummary.classList.add('visible');
  }

  generatePinnedSentence(instant, endInstant = null) {
    return window.generatePinnedSentence(instant, this.trackedZones, this.format, this.getHomeZone(), endInstant);
  }

  copySentenceToClipboard() {
    if (!this.pinnedSentenceText) return;
    const text = this.pinnedSentenceText.textContent.trim();
    if (!text) return;

    const onSuccess = () => {
      if (this.copySentenceBtn) this.copySentenceBtn.classList.add('copied');
      if (this.copySentenceLabel) this.copySentenceLabel.textContent = 'Copied!';
      setTimeout(() => {
        if (this.copySentenceBtn) this.copySentenceBtn.classList.remove('copied');
        if (this.copySentenceLabel) this.copySentenceLabel.textContent = 'Copy Description';
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        this.fallbackCopyText(text);
        onSuccess();
      });
    } else {
      this.fallbackCopyText(text);
      onSuccess();
    }
  }

  fallbackCopyText(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (e) {
      console.warn('Fallback copy failed:', e);
    }
  }

  updateLiveClocks() {
    try {
      const hasTemporal = (typeof Temporal === 'object' && typeof Temporal.Now === 'object' && typeof Temporal.Now.instant === 'function');
      const nowInstant = hasTemporal ? Temporal.Now.instant() : null;
      const nowDate = hasTemporal ? null : new Date();

      document.querySelectorAll('.zone-live-time').forEach(el => {
        const iana = el.dataset.iana;
        if (!iana) return;

        try {
          let timeDigits, dayStr;
          const is24 = this.isZone24Hour(iana);

          if (hasTemporal) {
            const zdt = nowInstant.toZonedDateTimeISO(iana);
            timeDigits = zdt.toLocaleString('en-US', {
              hour: is24 ? '2-digit' : 'numeric',
              minute: '2-digit',
              hour12: !is24
            });
            dayStr = zdt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          } else {
            timeDigits = new Intl.DateTimeFormat('en-US', {
              timeZone: iana,
              hour: is24 ? '2-digit' : 'numeric',
              minute: '2-digit',
              hour12: !is24
            }).format(nowDate);
            dayStr = new Intl.DateTimeFormat('en-US', {
              timeZone: iana,
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            }).format(nowDate);
          }

          const digitsEl = el.querySelector('.zone-time-digits');
          const dayEl = el.querySelector('.zone-time-day');
          if (digitsEl) digitsEl.textContent = timeDigits;
          if (dayEl) dayEl.textContent = dayStr;
        } catch (e) {
          console.warn(`Clock error for ${iana}:`, e);
        }
      });
    } catch (e) {
      console.warn('Error updating live clocks:', e);
    }
  }

  updateTopLiveClock() {
    if (!this.topClockTime || !this.topClockTz || !this.topClockWeekNum) return;
    try {
      const homeZone = this.getHomeZone() || { iana: this.getMachineTimeZone(), label: 'Local' };
      const is24 = this.isZone24Hour(homeZone.iana);
      let timeStr, tzAbbrev, weekNum;

      const hasTemporal = (typeof Temporal === 'object' && typeof Temporal.Now === 'object' && typeof Temporal.Now.instant === 'function');

      if (hasTemporal) {
        const now = Temporal.Now.instant();
        const zdt = now.toZonedDateTimeISO(homeZone.iana);
        timeStr = zdt.toLocaleString('en-US', {
          hour: is24 ? '2-digit' : 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: !is24
        });
        tzAbbrev = this.getTimezoneAbbrev(homeZone.iana, now);
        weekNum = zdt.weekOfYear || (window.getISOWeekNumber ? window.getISOWeekNumber() : 38);
      } else {
        const now = new Date();
        timeStr = new Intl.DateTimeFormat('en-US', {
          timeZone: homeZone.iana,
          hour: is24 ? '2-digit' : 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: !is24
        }).format(now);
        tzAbbrev = this.getTimezoneAbbrev(homeZone.iana, now);
        weekNum = window.getISOWeekNumber ? window.getISOWeekNumber(now) : 38;
      }

      this.topClockTime.textContent = timeStr;
      this.topClockTz.textContent = tzAbbrev || homeZone.label;
      this.topClockWeekNum.textContent = weekNum;

      if (this.topLiveClock) {
        this.topLiveClock.title = `Current Time: ${timeStr} ${tzAbbrev} (${homeZone.label}) • ISO Week ${weekNum} • Click to jump to current time`;
      }
    } catch (e) {
      console.warn('Error updating top live clock:', e);
    }
  }

  async triggerSelfTestModal() {
    this.testModal.classList.add('open');
    this.testResultsContainer.innerHTML = `<div style="padding:10px; color:#64748b;">Running golden assertion test suite...</div>`;
    const results = await runSelfTests();

    let allPass = true;
    const itemsHtml = results.map(r => {
      if (!r.pass) allPass = false;
      return `
        <div class="test-item">
          <div>
            <strong>${r.name}</strong>
            ${r.details ? `<div style="color:#64748b; font-size:0.78rem;">${r.details}</div>` : ''}
          </div>
          <span class="test-badge ${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS' : 'FAIL'}</span>
        </div>
      `;
    }).join('');

    const summaryBanner = `
      <div style="margin-bottom:12px; padding:8px 12px; border-radius:6px; font-weight:700; ${allPass ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
        ${allPass ? `✓ ALL ${results.length} GOLDEN ASSERTIONS PASSED` : '✕ SOME TESTS FAILED'}
      </div>
    `;

    this.testResultsContainer.innerHTML = summaryBanner + itemsHtml;
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.wtbApp = new WTBApp();
});
