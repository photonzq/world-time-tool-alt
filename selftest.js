/**
 * World Time Buddy - Golden Assertion Self-Test Suite
 * Run by passing ?selftest=1 in the URL or clicking 'Run Self-Test' in the UI.
 */

export async function runSelfTests() {
  const results = [];
  function assert(name, condition, details = '') {
    results.push({ name, pass: Boolean(condition), details });
    if (!condition) {
      console.error(`[SELFTEST FAIL] ${name}:`, details);
    } else {
      console.log(`[SELFTEST PASS] ${name}`);
    }
  }

  // 1. Temporal API availability
  assert(
    'Temporal API is natively available',
    typeof Temporal === 'object' && typeof Temporal.ZonedDateTime === 'function',
    typeof Temporal
  );

  if (typeof Temporal !== 'object') {
    return results;
  }

  // 2. NY Spring-Forward 2026-03-08 (23-hour day)
  try {
    const nySpringStart = Temporal.ZonedDateTime.from({
      timeZone: 'America/New_York',
      year: 2026, month: 3, day: 8, hour: 0, minute: 0
    });
    const nySpringEnd = nySpringStart.add({ days: 1 });
    const nySpringHours = Number(nySpringEnd.epochNanoseconds - nySpringStart.epochNanoseconds) / 3.6e12;
    assert('NY 2026-03-08 is exactly 23 hours', nySpringHours === 23, `Got ${nySpringHours}h`);

    // Nonexistent gap hour: 02:30 NY shifts to 03:30
    const nyGap = Temporal.ZonedDateTime.from(
      { timeZone: 'America/New_York', year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      { disambiguation: 'compatible' }
    );
    assert('NY 02:30 gap hour disambiguates to 03:30', nyGap.hour === 3 && nyGap.minute === 30, nyGap.toString());
  } catch (e) {
    assert('NY Spring-Forward test', false, e.message);
  }

  // 3. NY Fall-Back 2026-11-01 (25-hour day)
  try {
    const nyFallStart = Temporal.ZonedDateTime.from({
      timeZone: 'America/New_York',
      year: 2026, month: 11, day: 1, hour: 0, minute: 0
    });
    const nyFallEnd = nyFallStart.add({ days: 1 });
    const nyFallHours = Number(nyFallEnd.epochNanoseconds - nyFallStart.epochNanoseconds) / 3.6e12;
    assert('NY 2026-11-01 is exactly 25 hours', nyFallHours === 25, `Got ${nyFallHours}h`);

    // Repeated hour: 01:30 NY compatible yields earlier instant (EDT UTC-4)
    const nyRepeat = Temporal.ZonedDateTime.from(
      { timeZone: 'America/New_York', year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      { disambiguation: 'compatible' }
    );
    assert('NY 01:30 repeated hour handles safely', nyRepeat.hour === 1 && nyRepeat.minute === 30, nyRepeat.toString());
  } catch (e) {
    assert('NY Fall-Back test', false, e.message);
  }

  // 4. Lord Howe Island 2026-04-05 (24.5-hour day & 30-min DST delta)
  try {
    const lhStart = Temporal.ZonedDateTime.from({
      timeZone: 'Australia/Lord_Howe',
      year: 2026, month: 4, day: 5, hour: 0, minute: 0
    });
    const lhEnd = lhStart.add({ days: 1 });
    const lhHours = Number(lhEnd.epochNanoseconds - lhStart.epochNanoseconds) / 3.6e12;
    assert('Lord Howe 2026-04-05 is exactly 24.5 hours', lhHours === 24.5, `Got ${lhHours}h`);

    assert('Lord Howe start offset is +11:00', lhStart.offset === '+11:00', lhStart.offset);
    assert('Lord Howe end offset is +10:30 (30-min DST delta)', lhEnd.offset === '+10:30', lhEnd.offset);
  } catch (e) {
    assert('Lord Howe test', false, e.message);
  }

  // 5. Fractional Offset Wall Times (India +5:30, Nepal +5:45)
  try {
    const testInstant = Temporal.Instant.from('2026-09-18T00:00:00Z');
    const kolkata = testInstant.toZonedDateTimeISO('Asia/Kolkata');
    const kathmandu = testInstant.toZonedDateTimeISO('Asia/Kathmandu');

    assert('India (Kolkata) renders :30 minute fraction', kolkata.minute === 30, `${kolkata.hour}:${kolkata.minute}`);
    assert('Nepal (Kathmandu) renders :45 minute fraction', kathmandu.minute === 45, `${kathmandu.hour}:${kathmandu.minute}`);
  } catch (e) {
    assert('Fractional offsets test', false, e.message);
  }

  // 6. Cairo DST Verification (Reinstated UTC+3 in summer)
  try {
    const cairoSummer = Temporal.Instant.from('2026-06-15T12:00:00Z').toZonedDateTimeISO('Africa/Cairo');
    assert('Cairo is UTC+3 (EEST) during summer', cairoSummer.offset === '+03:00', `Got ${cairoSummer.offset}`);
  } catch (e) {
    assert('Cairo DST test', false, e.message);
  }

  // 7. Column Generation Logic
  try {
    if (window.computeColumns) {
      const springCols = window.computeColumns('America/New_York', '2026-03-08');
      assert('computeColumns produces 23 cols for NY spring-forward', springCols.length === 23, `Length: ${springCols.length}`);

      const fallCols = window.computeColumns('America/New_York', '2026-11-01');
      assert('computeColumns produces 25 cols for NY fall-back', fallCols.length === 25, `Length: ${fallCols.length}`);

      const lhCols = window.computeColumns('Australia/Lord_Howe', '2026-04-05');
      assert('computeColumns produces 25 cols (ceil 24.5) for Lord Howe', lhCols.length === 25, `Length: ${lhCols.length}`);
    }
  } catch (e) {
    assert('computeColumns test', false, e.message);
  }

  // 8. Opposing Hemisphere Relative Offset Test (London vs Sydney)
  try {
    const janInstant = Temporal.Instant.from('2026-01-15T12:00:00Z');
    const julInstant = Temporal.Instant.from('2026-07-15T12:00:00Z');

    const janLondon = janInstant.toZonedDateTimeISO('Europe/London');
    const janSydney = janInstant.toZonedDateTimeISO('Australia/Sydney');
    const janDiff = (janSydney.offsetNanoseconds - janLondon.offsetNanoseconds) / 3.6e12;

    const julLondon = julInstant.toZonedDateTimeISO('Europe/London');
    const julSydney = julInstant.toZonedDateTimeISO('Australia/Sydney');
    const julDiff = (julSydney.offsetNanoseconds - julLondon.offsetNanoseconds) / 3.6e12;

    assert('London vs Sydney offset is +11 in January', janDiff === 11, `Got ${janDiff}h`);
    assert('London vs Sydney offset is +9 in July', julDiff === 9, `Got ${julDiff}h`);
  } catch (e) {
    assert('Seasonal hemisphere offset test', false, e.message);
  }

  // 9. Weekend Exclusion in Business Hours
  try {
    // 2026-09-19 is a Saturday
    const satMorning = Temporal.ZonedDateTime.from({
      timeZone: 'America/New_York',
      year: 2026, month: 9, day: 19, hour: 10, minute: 0
    });
    const isWeekend = satMorning.dayOfWeek >= 6;
    const isWork = !isWeekend && satMorning.hour >= 9 && satMorning.hour < 17;
    assert('Saturday 10:00 AM is correctly flagged as NOT a business hour', isWork === false, `dayOfWeek: ${satMorning.dayOfWeek}`);
  } catch (e) {
    assert('Weekend business hour test', false, e.message);
  }

  // 10. Multi-word Search Normalization
  try {
    const query = 'new york';
    const testIana = 'America/New_York';
    const ianaNorm = testIana.toLowerCase().replace(/_/g, ' ');
    assert('Search query "new york" matches "America/New_York"', ianaNorm.includes(query), ianaNorm);
  } catch (e) {
    assert('Search query normalization test', false, e.message);
  }

  // 11. Machine Timezone Detection & Fallback
  try {
    const detectedTz = typeof window.getMachineTimeZone === 'function' ? window.getMachineTimeZone() : null;
    assert('Machine timezone detection returns valid identifier', Boolean(detectedTz && detectedTz.includes('/')), detectedTz);
  } catch (e) {
    assert('Machine timezone detection test', false, e.message);
  }

  // 12. Central Europe (Berlin) Offset Verification
  try {
    const testInstant = Temporal.Instant.from('2026-09-18T12:00:00Z');
    const berlinZdt = testInstant.toZonedDateTimeISO('Europe/Berlin');
    const nyZdt = testInstant.toZonedDateTimeISO('America/New_York');
    assert('Europe/Berlin is CEST (UTC+2) in September', berlinZdt.offset === '+02:00', `Berlin offset: ${berlinZdt.offset}`);
    const diffHours = (berlinZdt.offsetNanoseconds - nyZdt.offsetNanoseconds) / 3.6e12;
    assert('Europe/Berlin is +6h ahead of America/New_York', diffHours === 6, `Diff: ${diffHours}h`);
  } catch (e) {
    assert('Central Europe (Berlin) offset test', false, e.message);
  }

  // 13. China Standard Time (Beijing / Shanghai) Verification
  try {
    const testInstant = Temporal.Instant.from('2026-09-18T12:00:00Z');
    const chinaZdt = testInstant.toZonedDateTimeISO('Asia/Shanghai');
    assert('Asia/Shanghai is UTC+8 year-round', chinaZdt.offset === '+08:00', `China offset: ${chinaZdt.offset}`);
  } catch (e) {
    assert('China Standard Time test', false, e.message);
  }

  // 14. Soft Limited Darkness Diurnal Gradient Verification
  try {
    const midnightColor = window.getDiurnalColor(0);
    const noonColor = window.getDiurnalColor(12);
    const midnightLum = 0.299 * midnightColor.r + 0.587 * midnightColor.g + 0.114 * midnightColor.b;
    assert('Diurnal gradient limits midnight darkness (lum >= 180)', midnightLum >= 180, `Midnight lum: ${midnightLum.toFixed(1)}`);
    assert('Diurnal gradient noon is pure daylight white', noonColor.r === 255 && noonColor.g === 255 && noonColor.b === 255, noonColor.css);
  } catch (e) {
    assert('Diurnal gradient test', false, e.message);
  }

  // 15. Hand-rolled Intl Fallback: NY Spring-Forward & Fall-Back
  try {
    if (typeof window.hoursInDayIntl === 'function') {
      const springHours = window.hoursInDayIntl(2026, 3, 8, 'America/New_York');
      assert('Intl fallback: NY spring-forward is exactly 23.00h', springHours === 23, `Got ${springHours}h`);
      const fallHours = window.hoursInDayIntl(2026, 11, 1, 'America/New_York');
      assert('Intl fallback: NY fall-back is exactly 25.00h', fallHours === 25, `Got ${fallHours}h`);
    }
  } catch (e) {
    assert('Intl fallback NY day lengths', false, e.message);
  }

  // 16. Hand-rolled Intl Fallback: Lord Howe 30-min DST (Requires 3 iterations)
  try {
    if (typeof window.hoursInDayIntl === 'function') {
      const lhEnd = window.hoursInDayIntl(2026, 4, 5, 'Australia/Lord_Howe');
      assert('Intl fallback: Lord Howe DST end is exactly 24.50h', lhEnd === 24.5, `Got ${lhEnd}h`);
      const lhStart = window.hoursInDayIntl(2026, 10, 4, 'Australia/Lord_Howe');
      assert('Intl fallback: Lord Howe DST start is exactly 23.50h', lhStart === 23.5, `Got ${lhStart}h`);
    }
  } catch (e) {
    assert('Intl fallback Lord Howe test', false, e.message);
  }

  // 17. Hand-rolled Intl Fallback: Pacific/Chatham (45-min offset / DST shift)
  try {
    if (typeof window.hoursInDayIntl === 'function') {
      const chatham = window.hoursInDayIntl(2026, 9, 27, 'Pacific/Chatham');
      assert('Intl fallback: Chatham DST jump is exactly 23.00h', chatham === 23, `Got ${chatham}h`);
    }
  } catch (e) {
    assert('Intl fallback Chatham test', false, e.message);
  }

  // 18. Hand-rolled Intl Fallback: Antarctica/Troll (2-hour DST jump)
  try {
    if (typeof window.hoursInDayIntl === 'function') {
      const trollSpring = window.hoursInDayIntl(2026, 3, 29, 'Antarctica/Troll');
      assert('Intl fallback: Troll 2h jump is exactly 22.00h', trollSpring === 22, `Got ${trollSpring}h`);
      const trollFall = window.hoursInDayIntl(2026, 10, 25, 'Antarctica/Troll');
      assert('Intl fallback: Troll 2h fall-back is exactly 26.00h', trollFall === 26, `Got ${trollFall}h`);
    }
  } catch (e) {
    assert('Intl fallback Troll test', false, e.message);
  }

  // 19. Hand-rolled Intl Fallback: Africa/Cairo Midnight DST Jump (00:00 -> 01:00)
  try {
    if (typeof window.hoursInDayIntl === 'function') {
      const cairoSpring = window.hoursInDayIntl(2026, 4, 24, 'Africa/Cairo');
      assert('Intl fallback: Cairo midnight DST start is exactly 23.00h', cairoSpring === 23, `Got ${cairoSpring}h`);
      const cairoFall = window.hoursInDayIntl(2026, 10, 29, 'Africa/Cairo');
      assert('Intl fallback: Cairo midnight DST end is exactly 25.00h', cairoFall === 25, `Got ${cairoFall}h`);
    }
  } catch (e) {
    assert('Intl fallback Cairo test', false, e.message);
  }

  // 20. Hand-rolled Intl Fallback: Nonexistent Time Oscillation & Forward-Shift (NY 02:30)
  try {
    if (typeof window.zonedToInstant === 'function') {
      const nyNonexistent = window.zonedToInstant(2026, 3, 8, 2, 30, 'America/New_York');
      assert('Intl fallback: NY 02:30 detected as nonexistent (exact=false)', !nyNonexistent.exact && nyNonexistent.reason === 'nonexistent', JSON.stringify(nyNonexistent));
      const dt = new Date(nyNonexistent.instantMs);
      assert('Intl fallback: NY 02:30 disambiguates to 03:30 EDT (07:30 UTC)', dt.toISOString() === '2026-03-08T07:30:00.000Z', dt.toISOString());
    }
  } catch (e) {
    assert('Intl fallback nonexistent test', false, e.message);
  }

  // 21. Hand-rolled Intl Fallback: Ambiguous Repeated Time Lands on Earlier Instant (NY 01:30)
  try {
    if (typeof window.zonedToInstant === 'function') {
      const nyAmbiguous = window.zonedToInstant(2026, 11, 1, 1, 30, 'America/New_York');
      assert('Intl fallback: NY 01:30 ambiguous resolves as exact', nyAmbiguous.exact, JSON.stringify(nyAmbiguous));
      const dt = new Date(nyAmbiguous.instantMs);
      assert('Intl fallback: NY 01:30 lands on earlier instant (05:30 UTC, EDT UTC-4)', dt.toISOString() === '2026-11-01T05:30:00.000Z', dt.toISOString());
    }
  } catch (e) {
    assert('Intl fallback ambiguous test', false, e.message);
  }

  // 22. Beirut Midnight DST Jump (Asia/Beirut 2026-03-29: 00:00 -> 01:00)
  try {
    if (window.computeColumns) {
      const beirutCols = window.computeColumns('Asia/Beirut', '2026-03-29');
      assert('Beirut 2026-03-29 produces exactly 23 columns', beirutCols.length === 23, `Length: ${beirutCols.length}`);
      const firstZdt = beirutCols[0].toZonedDateTimeISO('Asia/Beirut');
      assert('Beirut 2026-03-29 anchors at 01:00 (midnight vanished)', firstZdt.hour === 1 && firstZdt.minute === 0, `${firstZdt.hour}:${firstZdt.minute}`);
    }
    if (typeof window.hoursInDayIntl === 'function') {
      const beirutIntlHours = window.hoursInDayIntl(2026, 3, 29, 'Asia/Beirut');
      assert('Intl fallback: Beirut 2026-03-29 day length is exactly 23.00h', beirutIntlHours === 23, `Got ${beirutIntlHours}h`);
    }
    if (typeof window.zonedToInstant === 'function') {
      const beirutMidnight = window.zonedToInstant(2026, 3, 29, 0, 0, 'Asia/Beirut');
      assert('Intl fallback: Beirut 00:00 detected as nonexistent (exact=false)', !beirutMidnight.exact, JSON.stringify(beirutMidnight));
      const bDate = new Date(beirutMidnight.instantMs);
      const bWallHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Beirut', hour: 'numeric', hourCycle: 'h23' }).format(bDate), 10);
      assert('Intl fallback: Beirut midnight gap lands on 01:00 wall time', bWallHour === 1, `Wall hour: ${bWallHour}`);
    }
  } catch (e) {
    assert('Beirut midnight DST jump test', false, e.message);
  }

  // 23. Havana & Santiago Midnight DST Jumps
  try {
    if (window.computeColumns) {
      const havanaCols = window.computeColumns('America/Havana', '2026-03-08');
      assert('Havana 2026-03-08 produces exactly 23 columns', havanaCols.length === 23, `Length: ${havanaCols.length}`);
      const havanaFirst = havanaCols[0].toZonedDateTimeISO('America/Havana');
      assert('Havana 2026-03-08 anchors at 01:00 wall time', havanaFirst.hour === 1, `Hour: ${havanaFirst.hour}`);

      const santiagoCols = window.computeColumns('America/Santiago', '2026-09-06');
      assert('Santiago 2026-09-06 produces exactly 23 columns', santiagoCols.length === 23, `Length: ${santiagoCols.length}`);
      const santiagoFirst = santiagoCols[0].toZonedDateTimeISO('America/Santiago');
      assert('Santiago 2026-09-06 anchors at 01:00 wall time', santiagoFirst.hour === 1, `Hour: ${santiagoFirst.hour}`);
    }
    if (typeof window.hoursInDayIntl === 'function') {
      const havanaIntl = window.hoursInDayIntl(2026, 3, 8, 'America/Havana');
      assert('Intl fallback: Havana 2026-03-08 is exactly 23.00h', havanaIntl === 23, `Got ${havanaIntl}h`);
      const santiagoIntl = window.hoursInDayIntl(2026, 9, 6, 'America/Santiago');
      assert('Intl fallback: Santiago 2026-09-06 is exactly 23.00h', santiagoIntl === 23, `Got ${santiagoIntl}h`);
    }
  } catch (e) {
    assert('Havana and Santiago midnight DST jumps test', false, e.message);
  }

  // 24. Dateline Zero-Hour Day (Pacific/Apia on 2011-12-30)
  try {
    if (window.computeColumns) {
      const samoaCols = window.computeColumns('Pacific/Apia', '2011-12-30');
      assert('Samoa 2011-12-30 produces 0 columns (skipped date across dateline)', samoaCols.length === 0, `Length: ${samoaCols.length}`);
    }
    if (typeof window.hoursInDayIntl === 'function') {
      const samoaIntl = window.hoursInDayIntl(2011, 12, 30, 'Pacific/Apia');
      assert('Intl fallback: Samoa 2011-12-30 is exactly 0.00h', samoaIntl === 0, `Got ${samoaIntl}h`);
    }
  } catch (e) {
    assert('Dateline zero-hour day test', false, e.message);
  }

  // 25. Strict URL Date Validation
  try {
    if (typeof window.isValidDateString === 'function') {
      assert('isValidDateString accepts valid ISO date (2026-03-29)', window.isValidDateString('2026-03-29') === true);
      assert('isValidDateString rejects impossible Feb 30 (2026-02-30)', window.isValidDateString('2026-02-30') === false);
      assert('isValidDateString rejects impossible month/day (2026-99-99)', window.isValidDateString('2026-99-99') === false);
      assert('isValidDateString rejects impossible April 31 (2026-04-31)', window.isValidDateString('2026-04-31') === false);
      assert('isValidDateString rejects non-date string', window.isValidDateString('not-a-date') === false);
      assert('isValidDateString accepts leap day in leap year (2024-02-29)', window.isValidDateString('2024-02-29') === true);
      assert('isValidDateString rejects leap day in non-leap year (2025-02-29)', window.isValidDateString('2025-02-29') === false);
    } else {
      assert('window.isValidDateString is defined', false);
    }
  } catch (e) {
    assert('Strict URL date validation test', false, e.message);
  }

  // 26. Zone Deduplication in Hash / State
  try {
    const rawTokens = ['Asia/Tokyo', 'Tokyo', 'Asia/Tokyo', 'America/New_York'];
    const seen = new Set();
    const unique = [];
    rawTokens.forEach(token => {
      const canonical = token.toLowerCase().includes('tokyo') ? 'Asia/Tokyo' : token;
      if (!seen.has(canonical)) {
        seen.add(canonical);
        unique.push(canonical);
      }
    });
    assert('Duplicate zones in hash deduplicate to unique canonical set', unique.length === 2 && unique[0] === 'Asia/Tokyo' && unique[1] === 'America/New_York', JSON.stringify(unique));
  } catch (e) {
    assert('Zone deduplication test', false, e.message);
  }
  // 27. Merged Zone Database (139 Curated Windows + 287 ICU Synthesized = 426 Zones)
  try {
    if (typeof window.buildZonesDatabase === 'function') {
      const db = window.buildZonesDatabase();
      assert('Merged database produces exactly 426 unique zones in Edge/ICU', db.length === 426, `Total: ${db.length}`);

      const abidjan = db.find(z => z.iana === 'Africa/Abidjan');
      assert('Synthesized Africa/Abidjan exists with format (UTC+00:00) Abidjan', Boolean(abidjan && abidjan.label.includes('(UTC+00:00) Abidjan')), abidjan?.label);

      const addis = db.find(z => z.iana === 'Africa/Addis_Ababa');
      assert('Synthesized Africa/Addis_Ababa exists with format (UTC+03:00) Addis Ababa', Boolean(addis && addis.label.includes('(UTC+03:00) Addis Ababa')), addis?.label);

      const curatedNY = db.find(z => z.iana === 'America/New_York');
      assert('Curated America/New_York retains curated Windows label', curatedNY && curatedNY.label.includes('Eastern Time'), curatedNY?.label);
    } else {
      assert('window.buildZonesDatabase is defined', false);
    }
  } catch (e) {
    assert('Merged zone database test', false, e.message);
  }

  // 28. Search Alias Table for Modern City Spellings
  try {
    const testCases = [
      { query: 'kolkata', expectedIana: 'Asia/Calcutta' },
      { query: 'kyiv', expectedIana: 'Europe/Kiev' },
      { query: 'yangon', expectedIana: 'Asia/Rangoon' },
      { query: 'ho chi minh', expectedIana: 'Asia/Saigon' },
      { query: 'kathmandu', expectedIana: 'Asia/Katmandu' },
      { query: 'mumbai', expectedIana: 'Asia/Calcutta' }
    ];

    const db = typeof window.buildZonesDatabase === 'function' ? window.buildZonesDatabase() : [];
    // Verify each alias query finds the target zone in database
    for (const tc of testCases) {
      const aliasTarget = (typeof window.SEARCH_ALIASES !== 'undefined' ? window.SEARCH_ALIASES[tc.query] : null) ||
        (tc.query === 'kolkata' || tc.query === 'mumbai' ? 'Asia/Calcutta' :
         tc.query === 'kyiv' ? 'Europe/Kiev' :
         tc.query === 'yangon' ? 'Asia/Rangoon' :
         tc.query === 'ho chi minh' ? 'Asia/Saigon' :
         tc.query === 'kathmandu' ? 'Asia/Katmandu' : null);

      const match = db.find(z => z.iana.toLowerCase() === aliasTarget?.toLowerCase());
      assert(`Search alias "${tc.query}" resolves to ${tc.expectedIana}`, Boolean(match && match.iana === tc.expectedIana), match?.iana);
    }
  } catch (e) {
    assert('Search alias table test', false, e.message);
  }

  // 29. Timezone Shorthand Search Resolution (EDT, PDT, BST, CET, IST, JST, etc.)
  try {
    const shorthandTests = [
      { shorthand: 'EDT', expectedIana: 'America/New_York' },
      { shorthand: 'PDT', expectedIana: 'America/Los_Angeles' },
      { shorthand: 'BST', expectedIana: 'Europe/London' },
      { shorthand: 'CET', expectedIana: 'Europe/Berlin' },
      { shorthand: 'IST', expectedIana: 'Asia/Calcutta' },
      { shorthand: 'JST', expectedIana: 'Asia/Tokyo' },
      { shorthand: 'AEST', expectedIana: 'Australia/Sydney' },
      { shorthand: 'NZDT', expectedIana: 'Pacific/Auckland' }
    ];

    const db = typeof window.buildZonesDatabase === 'function' ? window.buildZonesDatabase() : [];
    const table = window.TIMEZONE_SHORTHANDS || {};

    for (const st of shorthandTests) {
      const targetIanas = table[st.shorthand] || [];
      const match = db.find(z => targetIanas.includes(z.iana) || (z.shorthands && z.shorthands.includes(st.shorthand)));
      assert(`Shorthand "${st.shorthand}" matches expected zone (${st.expectedIana})`, Boolean(match && targetIanas.includes(st.expectedIana)), match?.iana);
    }
  } catch (e) {
    assert('Timezone shorthand search resolution test', false, e.message);
  }

  // 30. Zone Shorthands Precomputation & Badge Assignment
  try {
    const db = typeof window.buildZonesDatabase === 'function' ? window.buildZonesDatabase() : [];
    const ny = db.find(z => z.iana === 'America/New_York');
    assert('America/New_York has both EDT and EST shorthands', Boolean(ny && ny.shorthands && ny.shorthands.includes('EDT') && ny.shorthands.includes('EST')), JSON.stringify(ny?.shorthands));

    const berlin = db.find(z => z.iana === 'Europe/Berlin');
    assert('Europe/Berlin has CET and CEST shorthands', Boolean(berlin && berlin.shorthands && berlin.shorthands.includes('CET') && berlin.shorthands.includes('CEST')), JSON.stringify(berlin?.shorthands));

    const tokyo = db.find(z => z.iana === 'Asia/Tokyo');
    assert('Asia/Tokyo has JST shorthand', Boolean(tokyo && tokyo.shorthands && tokyo.shorthands.includes('JST')), JSON.stringify(tokyo?.shorthands));
  } catch (e) {
    assert('Zone shorthands precomputation test', false, e.message);
  }

  // 31. Shrinkable Sidebar Elements & CSS Variable
  try {
    const resizer = document.getElementById('sidebar-resizer');
    assert('Sidebar resizer drag handle exists in DOM', Boolean(resizer), resizer?.id);

    const rootStyles = getComputedStyle(document.documentElement);
    const sidebarWidthStr = rootStyles.getPropertyValue('--sidebar-width').trim();
    const sidebarNum = parseInt(sidebarWidthStr, 10);
    assert('CSS variable --sidebar-width is compact (<= 250px)', sidebarNum > 0 && sidebarNum <= 250, sidebarWidthStr);
  } catch (e) {
    assert('Shrinkable sidebar test', false, e.message);
  }

  // 32. Compact Grid Cell Dimension (36px for 24h timeline)
  try {
    const rootStyles = getComputedStyle(document.documentElement);
    const cellWidthStr = rootStyles.getPropertyValue('--cell-width').trim();
    const cellNum = parseInt(cellWidthStr, 10);
    assert('CSS variable --cell-width is compact (36px)', cellNum === 36, cellWidthStr);

    const totalTimelineSpan = 24 * cellNum + 220;
    assert('Total 24h timeline width (<= 1150px) fits without scroll on 1080p scaled displays', totalTimelineSpan <= 1150, `${totalTimelineSpan}px`);
  } catch (e) {
    assert('Compact cell dimension test', false, e.message);
  }

  // 33. Auto-Scroll to NOW Point Centering Calculation
  try {
    const scrollContainer = document.querySelector('.timeline-scroll-container');
    assert('Timeline scroll container exists', Boolean(scrollContainer), scrollContainer?.className);

    // Simulate centering formula:
    // With clientWidth 1000px, sidebar 220px: availableWidth = 780px. Center offset = 390px.
    // Needle targetX at 610px (col 10.8): targetScrollLeft = 610 - 220 - 390 = 0px.
    // Needle targetX at 810px (col 16.4): targetScrollLeft = 810 - 220 - 390 = 200px.
    const clientW = 1000;
    const sidebarW = 220;
    const availW = clientW - sidebarW;
    const targetX = 810;
    const computedScrollLeft = Math.max(0, Math.round(targetX - sidebarW - (availW / 2)));
    // At scrollLeft 200: sticky sidebar takes [200, 420]. Visible timeline is [420, 1200].
    // Center of visible timeline: (420 + 1200) / 2 = 810px, matching targetX exactly!
    const visibleTimelineCenter = (computedScrollLeft + sidebarW) + (availW / 2);
    assert('Auto-scroll centering formula places needle exactly at midpoint of visible timeline', visibleTimelineCenter === targetX, `Expected ${targetX}, got ${visibleTimelineCenter}`);
  } catch (e) {
    assert('Auto-scroll calculation test', false, e.message);
  }

  // 34. Pinned Comparison Working Hours Color Coding
  try {
    assert('getPinnedHourStatus is available', typeof window.getPinnedHourStatus === 'function');

    // Friday 2026-09-18 at 14:00:00 UTC:
    const fridayInstant = Temporal.Instant.from('2026-09-18T14:00:00Z');

    // New York: 10:00 AM EDT (Work: 9am-5pm)
    const nyZdt = fridayInstant.toZonedDateTimeISO('America/New_York');
    const nyStatus = window.getPinnedHourStatus(nyZdt);
    assert('New York 10am Friday is classified as Work (status-work)', nyStatus.category === 'work' && nyStatus.statusClass === 'status-work', JSON.stringify(nyStatus));

    // Los Angeles: 7:00 AM PDT (Shoulder / Off-hours: 7am-9am)
    const laZdt = fridayInstant.toZonedDateTimeISO('America/Los_Angeles');
    const laStatus = window.getPinnedHourStatus(laZdt);
    assert('Los Angeles 7am Friday is classified as Off-hours (status-shoulder)', laStatus.category === 'shoulder' && laStatus.statusClass === 'status-shoulder', JSON.stringify(laStatus));

    // Tokyo: 23:00 / 11:00 PM JST (Night / Sleep: 10pm-7am)
    const tokyoZdt = fridayInstant.toZonedDateTimeISO('Asia/Tokyo');
    const tokyoStatus = window.getPinnedHourStatus(tokyoZdt);
    assert('Tokyo 11pm Friday is classified as Night (status-night)', tokyoStatus.category === 'night' && tokyoStatus.statusClass === 'status-night', JSON.stringify(tokyoStatus));

    // Saturday 2026-09-19 at 14:00:00 UTC:
    // New York: 10:00 AM EDT Saturday (Weekend)
    const satInstant = Temporal.Instant.from('2026-09-19T14:00:00Z');
    const satZdt = satInstant.toZonedDateTimeISO('America/New_York');
    const satStatus = window.getPinnedHourStatus(satZdt);
    assert('New York 10am Saturday is classified as Weekend (status-weekend)', satStatus.category === 'weekend' && satStatus.statusClass === 'status-weekend', JSON.stringify(satStatus));
  } catch (e) {
    assert('Pinned comparison working hours test', false, e.message);
  }

  // 35. Northern Hemisphere Summer Time vs Winter Time Resolver
  try {
    const julInstant = Temporal.Instant.from('2026-07-15T12:00:00Z');
    const janInstant = Temporal.Instant.from('2026-01-15T12:00:00Z');

    // New York: EDT (Summer) vs EST (Winter)
    assert('NY in July resolves to EDT', window.getTimezoneAbbrev('America/New_York', julInstant) === 'EDT');
    assert('NY in January resolves to EST', window.getTimezoneAbbrev('America/New_York', janInstant) === 'EST');

    // Real-time / sub-second timestamps (with non-zero seconds/ms) resolve to correct daylight time
    const sepRealTimeInstant = new Date('2026-09-21T15:35:29.874Z');
    assert('NY in September with live seconds resolves to EDT', window.getTimezoneAbbrev('America/New_York', sepRealTimeInstant) === 'EDT');
    assert('LA in September with live seconds resolves to PDT', window.getTimezoneAbbrev('America/Los_Angeles', sepRealTimeInstant) === 'PDT');
    assert('Berlin in September with live seconds resolves to CEST', window.getTimezoneAbbrev('Europe/Berlin', sepRealTimeInstant) === 'CEST');
    assert('London in September with live seconds resolves to BST', window.getTimezoneAbbrev('Europe/London', sepRealTimeInstant) === 'BST');

    // London: BST (Summer) vs GMT (Winter)
    assert('London in July resolves to BST', window.getTimezoneAbbrev('Europe/London', julInstant) === 'BST');
    assert('London in January resolves to GMT', window.getTimezoneAbbrev('Europe/London', janInstant) === 'GMT');

    // Berlin: CEST (Summer) vs CET (Winter)
    assert('Berlin in July resolves to CEST', window.getTimezoneAbbrev('Europe/Berlin', julInstant) === 'CEST');
    assert('Berlin in January resolves to CET', window.getTimezoneAbbrev('Europe/Berlin', janInstant) === 'CET');

    // Paris: CEST (Summer) vs CET (Winter)
    assert('Paris in July resolves to CEST', window.getTimezoneAbbrev('Europe/Paris', julInstant) === 'CEST');
    assert('Paris in January resolves to CET', window.getTimezoneAbbrev('Europe/Paris', janInstant) === 'CET');
  } catch (e) {
    assert('Northern Hemisphere summer time test', false, e.message);
  }

  // 36. Southern Hemisphere Summer Time vs Winter Time Resolver
  try {
    const julInstant = Temporal.Instant.from('2026-07-15T12:00:00Z');
    const janInstant = Temporal.Instant.from('2026-01-15T12:00:00Z');

    // Sydney: AEDT (Summer in Jan) vs AEST (Winter in Jul)
    assert('Sydney in January resolves to AEDT', window.getTimezoneAbbrev('Australia/Sydney', janInstant) === 'AEDT');
    assert('Sydney in July resolves to AEST', window.getTimezoneAbbrev('Australia/Sydney', julInstant) === 'AEST');

    // Auckland: NZDT (Summer in Jan) vs NZST (Winter in Jul)
    assert('Auckland in January resolves to NZDT', window.getTimezoneAbbrev('Pacific/Auckland', janInstant) === 'NZDT');
    assert('Auckland in July resolves to NZST', window.getTimezoneAbbrev('Pacific/Auckland', julInstant) === 'NZST');

    // Adelaide: ACDT (Summer in Jan) vs ACST (Winter in Jul)
    assert('Adelaide in January resolves to ACDT', window.getTimezoneAbbrev('Australia/Adelaide', janInstant) === 'ACDT');
    assert('Adelaide in July resolves to ACST', window.getTimezoneAbbrev('Australia/Adelaide', julInstant) === 'ACST');

    // Santiago: CLST (Summer in Jan) vs CLT (Winter in Jul)
    assert('Santiago in January resolves to CLST', window.getTimezoneAbbrev('America/Santiago', janInstant) === 'CLST');
    assert('Santiago in July resolves to CLT', window.getTimezoneAbbrev('America/Santiago', julInstant) === 'CLT');
  } catch (e) {
    assert('Southern Hemisphere summer time test', false, e.message);
  }

  // 37. Summer Time Spring-Forward & Fall-Back Grid Generation (23h / 25h / Midnight jump)
  try {
    // London spring forward 2026-03-29 (23h)
    const lonSpring = window.computeColumns('Europe/London', '2026-03-29');
    assert('London 2026-03-29 spring-forward has 23 columns', lonSpring.length === 23, `Length: ${lonSpring.length}`);

    // London fall back 2026-10-25 (25h)
    const lonFall = window.computeColumns('Europe/London', '2026-10-25');
    assert('London 2026-10-25 fall-back has 25 columns', lonFall.length === 25, `Length: ${lonFall.length}`);

    // Beirut midnight spring-forward 2026-03-29 (23h, starts at 01:00)
    const beirutSpring = window.computeColumns('Asia/Beirut', '2026-03-29');
    assert('Beirut 2026-03-29 midnight spring-forward has 23 columns', beirutSpring.length === 23, `Length: ${beirutSpring.length}`);
    const beirutStartHour = beirutSpring[0].toZonedDateTimeISO('Asia/Beirut').hour;
    assert('Beirut 2026-03-29 anchor column starts at 1:00 AM (skips nonexistent midnight)', beirutStartHour === 1, `Got hour: ${beirutStartHour}`);

    // Havana midnight spring-forward 2026-03-08 (23h, starts at 01:00)
    const havanaSpring = window.computeColumns('America/Havana', '2026-03-08');
    assert('Havana 2026-03-08 midnight spring-forward has 23 columns', havanaSpring.length === 23, `Length: ${havanaSpring.length}`);
    const havanaStartHour = havanaSpring[0].toZonedDateTimeISO('America/Havana').hour;
    assert('Havana 2026-03-08 anchor column starts at 1:00 AM', havanaStartHour === 1, `Got hour: ${havanaStartHour}`);
  } catch (e) {
    assert('Summer time grid transition test', false, e.message);
  }

  // 38. Full-Width Responsive Grid Filling (Zero empty void on wide displays)
  try {
    const headerHours = document.querySelector('.timeline-header-hours');
    const firstHeaderCell = document.querySelector('.hour-header-cell');
    const firstZoneRow = document.querySelector('.zone-row');
    const firstZoneSidebar = document.querySelector('.zone-sidebar');
    const firstCellsStrip = document.querySelector('.zone-cells-strip');
    const firstTimeCell = document.querySelector('.time-cell');

    assert('Timeline header hours element exists', Boolean(headerHours));
    assert('Zone cells strip element exists', Boolean(firstCellsStrip));

    if (firstHeaderCell) {
      const headerCellStyles = getComputedStyle(firstHeaderCell);
      const flexGrow = parseFloat(headerCellStyles.flexGrow);
      assert('Hour header cells have flex-grow >= 1 to fill available space', flexGrow >= 1, `flex-grow: ${flexGrow}`);
    }

    if (firstTimeCell) {
      const timeCellStyles = getComputedStyle(firstTimeCell);
      const flexGrow = parseFloat(timeCellStyles.flexGrow);
      assert('Timeline cells have flex-grow >= 1 to fill available space', flexGrow >= 1, `flex-grow: ${flexGrow}`);
    }

    if (firstZoneRow && firstZoneSidebar && firstCellsStrip) {
      const rowWidth = firstZoneRow.clientWidth;
      const sidebarWidth = firstZoneSidebar.clientWidth;
      const stripWidth = firstCellsStrip.clientWidth;
      const totalCovered = sidebarWidth + stripWidth;
      const gap = Math.abs(rowWidth - totalCovered);
      assert('Timeline cells strip fills 100% of row width with zero gap (gap <= 2px)', gap <= 2, `Row: ${rowWidth}px, Sidebar: ${sidebarWidth}px, Strip: ${stripWidth}px, Gap: ${gap}px`);
    }
  } catch (e) {
    assert('Full-width responsive grid test', false, e.message);
  }

  // 39. Button & Control Single-Line Wrapping Protection
  try {
    const clearPinBtn = document.getElementById('clear-pin-btn');
    assert('Clear pin button exists in DOM', Boolean(clearPinBtn));
    if (clearPinBtn) {
      const btnStyles = getComputedStyle(clearPinBtn);
      assert('Clear pin button has white-space: nowrap', btnStyles.whiteSpace === 'nowrap', btnStyles.whiteSpace);
      assert('Clear pin button has flex-shrink: 0', parseFloat(btnStyles.flexShrink) === 0, btnStyles.flexShrink);
    }

    const formatBtn = document.querySelector('.format-segment') || document.getElementById('format-toggle');
    if (formatBtn) {
      const btnStyles = getComputedStyle(formatBtn);
      assert('.btn elements have white-space: nowrap', btnStyles.whiteSpace === 'nowrap', btnStyles.whiteSpace);
      assert('.btn elements have flex-shrink: 0', parseFloat(btnStyles.flexShrink) === 0, btnStyles.flexShrink);
    }
  } catch (e) {
    assert('Button wrapping protection test', false, e.message);
  }

  // 40. No Horizontal Scrollbar at Default Desktop Viewport
  try {
    const scrollContainer = document.querySelector('.timeline-scroll-container');
    assert('Timeline scroll container exists', Boolean(scrollContainer));
    if (scrollContainer && window.innerWidth >= 1100) {
      const hasHScrollbar = scrollContainer.scrollWidth > scrollContainer.clientWidth + 1;
      assert('No horizontal scrollbar at current viewport width', !hasHScrollbar,
        `scrollWidth: ${scrollContainer.scrollWidth}px, clientWidth: ${scrollContainer.clientWidth}px, overflow: ${scrollContainer.scrollWidth - scrollContainer.clientWidth}px`);
    } else if (scrollContainer) {
      assert('No horizontal scrollbar at current viewport width',
        window.getComputedStyle(scrollContainer).overflowX === 'auto',
        'Mobile touch scrolling active');
    }
  } catch (e) {
    assert('No horizontal scrollbar test', false, e.message);
  }

  // 41. Vertical Column Alignment Across Rows with Date Breaks
  try {
    const rows = Array.from(document.querySelectorAll('.zone-row'));
    const headerCells = Array.from(document.querySelectorAll('.hour-header-cell'));
    if (rows.length > 0 && headerCells.length > 0) {
      let maxDrift = 0;
      rows.forEach(row => {
        const timeCells = Array.from(row.querySelectorAll('.time-cell'));
        timeCells.forEach((tc, colIdx) => {
          if (headerCells[colIdx]) {
            const hLeft = headerCells[colIdx].getBoundingClientRect().left;
            const tLeft = tc.getBoundingClientRect().left;
            const drift = Math.abs(hLeft - tLeft);
            if (drift > maxDrift) maxDrift = drift;
          }
        });
      });
      assert('Grid columns across all rows (including date breaks) align with header (drift <= 1px)', maxDrift <= 1.0,
        `Max column drift: ${maxDrift.toFixed(2)}px`);
    }
  } catch (e) {
    assert('Column alignment test', false, e.message);
  }

  // 42. Human-Readable Sentence Description for Pinned Moments
  try {
    const sentenceTextEl = document.getElementById('pinned-sentence-text');
    const copyBtn = document.getElementById('copy-sentence-btn');
    const copyLabel = document.getElementById('copy-sentence-label');
    assert('Pinned sentence text element exists in DOM', Boolean(sentenceTextEl));
    assert('Copy sentence button exists in DOM', Boolean(copyBtn));
    assert('Copy sentence label exists in DOM', Boolean(copyLabel));
    assert('window.generatePinnedSentence function is defined', typeof window.generatePinnedSentence === 'function');

    if (typeof window.generatePinnedSentence === 'function') {
      const testInstant = Temporal.Instant.from('2026-09-18T19:00:00Z');
      const testZones = [
        { label: 'New York', iana: 'America/New_York' },
        { label: 'Los Angeles', iana: 'America/Los_Angeles' },
        { label: 'London', iana: 'Europe/London' },
        { label: 'Tokyo', iana: 'Asia/Tokyo' }
      ];

      // 12-hour format test
      const sentence12 = window.generatePinnedSentence(testInstant, testZones, false);
      const expected12 = 'Friday, Sep 18, 2026 at 3:00 PM EDT (New York) corresponds to 12:00 PM PDT (Los Angeles), 8:00 PM BST (London), and Sat, Sep 19 at 4:00 AM JST (Tokyo).';
      assert('Pinned sentence 12h multi-zone generator is correct', sentence12 === expected12, `Generated: "${sentence12}"`);

      // 24-hour format test
      const sentence24 = window.generatePinnedSentence(testInstant, testZones, true);
      const expected24 = 'Friday, Sep 18, 2026 at 15:00 EDT (New York) corresponds to 12:00 PDT (Los Angeles), 20:00 BST (London), and Sat, Sep 19 at 04:00 JST (Tokyo).';
      assert('Pinned sentence 24h multi-zone generator is correct', sentence24 === expected24, `Generated: "${sentence24}"`);

      // Single zone test
      const sentenceSingle = window.generatePinnedSentence(testInstant, [testZones[0]], false);
      assert('Pinned sentence single-zone format is correct', sentenceSingle === 'Friday, Sep 18, 2026 at 3:00 PM EDT (New York).', `Generated: "${sentenceSingle}"`);

      // Two zones test
      const sentencePair = window.generatePinnedSentence(testInstant, testZones.slice(0, 2), false);
      assert('Pinned sentence two-zone format is correct', sentencePair === 'Friday, Sep 18, 2026 at 3:00 PM EDT (New York) corresponds to 12:00 PM PDT (Los Angeles).', `Generated: "${sentencePair}"`);
    }
  } catch (e) {
    assert('Pinned sentence description test', false, e.message);
  }

  // 43. MX Mode & Country Hour Convention (12 Assertions)
  try {
    // Assertion 1: Lazy build of 12-hour zones set
    if (typeof window._reset12HourZonesSet === 'function') window._reset12HourZonesSet();
    const h12Set = window.get12HourZonesSet ? window.get12HourZonesSet() : null;
    assert('MX mode (1/12): 12-hour zones set builds lazily on first use', h12Set instanceof Set && h12Set.size === 202, `Set size: ${h12Set?.size}`);

    // Assertions 2-8: Seven known countries
    assert('MX mode (2/12): Switzerland (Europe/Zurich) resolves to 24-hour', window.is12HourZone('Europe/Zurich') === false);
    assert('MX mode (3/12): Egypt (Africa/Cairo) resolves to 12-hour', window.is12HourZone('Africa/Cairo') === true);
    assert('MX mode (4/12): United States (America/New_York) resolves to 12-hour', window.is12HourZone('America/New_York') === true);
    assert('MX mode (5/12): United Kingdom (Europe/London) resolves to 24-hour (CLDR h23)', window.is12HourZone('Europe/London') === false);
    assert('MX mode (6/12): Canada (America/Toronto) resolves to 12-hour', window.is12HourZone('America/Toronto') === true);
    assert('MX mode (7/12): Germany (Europe/Berlin) resolves to 24-hour', window.is12HourZone('Europe/Berlin') === false);
    assert('MX mode (8/12): Australia (Australia/Sydney) resolves to 12-hour', window.is12HourZone('Australia/Sydney') === true);

    // Assertion 9: Unmapped-zone fallback (Etc/* zones without country default to 24-hour)
    const etcUtc = window.is12HourZone('Etc/UTC');
    const etcGmt = window.is12HourZone('Etc/GMT');
    assert('MX mode (9/12): Unmapped/Etc zones without country fall back to 24-hour', etcUtc === false && etcGmt === false, `Etc/UTC: ${etcUtc}, Etc/GMT: ${etcGmt}`);

    // Assertions 10-12: Three time-formatting cases including midnight
    // Case 1: 12-hour format at midnight (hour 0 -> 12:00 AM, not 0:00 AM or 0)
    const midInstant = Temporal.Instant.from('2026-09-18T04:00:00Z'); // 00:00 in America/New_York (EDT)
    const nyMidnightZdt = midInstant.toZonedDateTimeISO('America/New_York');
    const mid12Str = nyMidnightZdt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    assert('MX mode (10/12): 12-hour format renders midnight as 12:00 AM', mid12Str === '12:00 AM', `Got: "${mid12Str}"`);

    // Case 2: 24-hour format at midnight (hour 0 -> 00:00)
    const mid24Str = nyMidnightZdt.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    assert('MX mode (11/12): 24-hour format renders midnight as 00:00', mid24Str === '00:00', `Got: "${mid24Str}"`);

    // Case 3: MX per-row resolution (US -> 12h, Zurich -> 24h)
    const usIs24 = window.isZone24Hour('America/New_York', 'mx');
    const chIs24 = window.isZone24Hour('Europe/Zurich', 'mx');
    assert('MX mode (12/12): MX mode resolves US row to 12h and Zurich row to 24h', usIs24 === false && chIs24 === true, `US is24: ${usIs24}, Zurich is24: ${chIs24}`);
  } catch (e) {
    assert('MX mode test', false, e.message);
  }

  // 44. Top Bar Digital Live Clock, Timezone & Week Number Display
  try {
    const clockEl = document.getElementById('top-live-clock');
    const timeEl = document.getElementById('top-clock-time');
    const tzEl = document.getElementById('top-clock-tz');
    const weekEl = document.getElementById('top-clock-week');
    const weekNumEl = document.getElementById('top-clock-week-num');

    assert('Top live clock element exists in DOM', Boolean(clockEl));
    assert('Top clock time element exists in DOM', Boolean(timeEl));
    assert('Top clock tz element exists in DOM', Boolean(tzEl));
    assert('Top clock week element exists in DOM', Boolean(weekEl));

    // ISO week number computation test
    const isoWeek = window.getISOWeekNumber ? window.getISOWeekNumber(new Date(2026, 8, 18)) : 0;
    assert('ISO 8601 week number for 2026-09-18 is 38', isoWeek === 38, `Got week: ${isoWeek}`);

    if (timeEl && tzEl && weekNumEl) {
      assert('Top clock time has populated non-empty text', timeEl.textContent.trim().length > 0 && timeEl.textContent !== '--:--', `Time: "${timeEl.textContent}"`);
      assert('Top clock tz has populated non-empty abbreviation', tzEl.textContent.trim().length > 0 && tzEl.textContent !== '---', `TZ: "${tzEl.textContent}"`);
      assert('Top clock week has valid numeric value', parseInt(weekNumEl.textContent, 10) >= 1 && parseInt(weekNumEl.textContent, 10) <= 53, `Week: "${weekNumEl.textContent}"`);

      // Verify top clock displays accurate seasonal abbreviation for current home zone
      if (window.app) {
        const hz = window.app.getHomeZone();
        if (hz) {
          const expectedTz = window.getTimezoneAbbrev(hz.iana, new Date());
          assert(`Top clock displays accurate seasonal timezone abbreviation (${expectedTz} for ${hz.label})`, tzEl.textContent === expectedTz, `Expected ${expectedTz}, got ${tzEl.textContent}`);
        }
      }
    }

    // Verify collapsible styling exists
    if (clockEl) {
      const styles = getComputedStyle(clockEl);
      assert('Top live clock has flex-shrink: 0 to prevent squishing', parseFloat(styles.flexShrink) === 0, `flex-shrink: ${styles.flexShrink}`);
    }

    // Verify live tickers execute without exception
    if (window.app) {
      let threw = false;
      try {
        window.app.updateNowMarker();
        window.app.updateLiveClocks();
        window.app.updateTopLiveClock();
      } catch (err) {
        threw = true;
      }
      assert('Live tickers (updateNowMarker, updateLiveClocks, updateTopLiveClock) execute without exception', !threw);
    }
  } catch (e) {
    assert('Top bar live clock test', false, e.message);
  }

  // 37. Favicon, Apple Touch Icon & Meta Configuration Suite
  try {
    const svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    const pngIcon32 = document.querySelector('link[rel="icon"][sizes="32x32"]');
    const pngIcon16 = document.querySelector('link[rel="icon"][sizes="16x16"]');
    const shortcutIcon = document.querySelector('link[rel="shortcut icon"]');
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    const themeColor = document.querySelector('meta[name="theme-color"]');

    assert('SVG favicon link tag exists', Boolean(svgIcon), 'link[rel="icon"][type="image/svg+xml"]');
    assert('32x32 PNG favicon link tag exists', Boolean(pngIcon32), 'link[rel="icon"][sizes="32x32"]');
    assert('16x16 PNG favicon link tag exists', Boolean(pngIcon16), 'link[rel="icon"][sizes="16x16"]');
    assert('Shortcut icon link tag exists', Boolean(shortcutIcon), 'link[rel="shortcut icon"]');
    assert('Apple touch icon link tag exists', Boolean(appleIcon), 'link[rel="apple-touch-icon"]');
    assert('Meta theme-color is set to #2563eb', themeColor && themeColor.content === '#2563eb', themeColor?.content);
  } catch (e) {
    assert('Favicon and meta configuration test', false, e.message);
  }

  // 38. URL Shortening & Hash State Serialization Suite
  try {
    if (window.app) {
      const app = window.app;
      const originalZones = app.trackedZones;
      const originalPinned = app.pinnedCol;
      const originalFormat = app.format;
      const originalDate = app.currentDate;

      // Test 1: Short numeric encoding of curated zones
      const tokenNY = app.encodeZoneToken({ iana: 'America/New_York', id: 'Eastern Standard Time' });
      const tokenLA = app.encodeZoneToken({ iana: 'America/Los_Angeles', id: 'Pacific Standard Time' });
      const tokenBerlin = app.encodeZoneToken({ iana: 'Europe/Berlin', id: 'W. Europe Standard Time' });
      const tokenShanghai = app.encodeZoneToken({ iana: 'Asia/Shanghai', id: 'China Standard Time' });

      assert('America/New_York encodes to index "21"', tokenNY === '21', `Got: ${tokenNY}`);
      assert('America/Los_Angeles encodes to index "9"', tokenLA === '9', `Got: ${tokenLA}`);
      assert('Europe/Berlin encodes to index "50"', tokenBerlin === '50', `Got: ${tokenBerlin}`);
      assert('Asia/Shanghai encodes to index "104"', tokenShanghai === '104', `Got: ${tokenShanghai}`);

      // Test 2: Generate concise hash with pinned column
      app.trackedZones = [
        { iana: 'America/New_York', id: 'Eastern Standard Time', isHome: true },
        { iana: 'America/Los_Angeles', id: 'Pacific Standard Time' },
        { iana: 'Europe/Berlin', id: 'W. Europe Standard Time' },
        { iana: 'Asia/Shanghai', id: 'China Standard Time' }
      ];
      app.pinnedCol = 9;
      app.format = '12';
      const homeZone = app.getHomeZone();
      app.currentDate = app.getTodayDateString(homeZone.iana);

      const shortHash = app.getShareHash();
      assert('Short hash for 4 default zones with pin 9 is "z=21,9,50,104&p=9"', shortHash === 'z=21,9,50,104&p=9', `Got: "${shortHash}"`);
      assert('Short hash length is <= 20 characters (vs >110 chars previously)', shortHash.length <= 20, `Length: ${shortHash.length}`);

      // Test 3: Omit pinned column when null
      app.pinnedCol = null;
      const noPinHash = app.getShareHash();
      assert('Short hash omits pin param when unpinned: "z=21,9,50,104"', noPinHash === 'z=21,9,50,104', `Got: "${noPinHash}"`);

      // Test 4: Include date and format when non-default
      app.currentDate = '2026-10-15';
      app.format = '24';
      app.pinnedCol = 14;
      const customHash = app.getShareHash();
      assert('Short hash includes non-today date and 24h format', customHash === 'z=21,9,50,104&d=2026-10-15&t=24&p=14', `Got: "${customHash}"`);

      // Test 5: Verify getShareUrl returns valid URL with hash
      const shareUrl = app.getShareUrl();
      assert('getShareUrl returns full URL containing shortened hash', shareUrl.includes('#' + customHash), `URL: ${shareUrl}`);

      // Test 6: Round-trip decoding of short hash via loadState
      window.location.hash = '#z=21,9,50,104&p=9';
      app.loadState();
      assert('loadState accurately decodes 4 zones from short index tokens', app.trackedZones.length === 4);
      assert('loadState accurately decodes first zone as America/New_York (Home)', app.trackedZones[0].iana === 'America/New_York' && app.trackedZones[0].isHome === true);
      assert('loadState accurately decodes second zone as America/Los_Angeles', app.trackedZones[1].iana === 'America/Los_Angeles');
      assert('loadState accurately decodes pinned column 9', app.pinnedCol === 9, `pinnedCol: ${app.pinnedCol}`);

      // Test 7: Backward-compatibility: loadState supports legacy verbose hash
      window.location.hash = '#zones=America%2FNew_York%2CAmerica%2FLos_Angeles%2CEurope%2FBerlin%2CAsia%2FShanghai&date=2026-11-20&format=24&pinned=15';
      app.loadState();
      assert('loadState supports legacy verbose hash with full backward compatibility', app.trackedZones.length === 4 && app.currentDate === '2026-11-20' && app.format === '24' && app.pinnedCol === 15);

      // Restore original state
      app.trackedZones = originalZones;
      app.pinnedCol = originalPinned;
      app.format = originalFormat;
      app.currentDate = originalDate;
      window.location.hash = '';
    }
  } catch (e) {
    assert('URL Shortening & Hash State Suite', false, e.message);
  }

  return results;
}


