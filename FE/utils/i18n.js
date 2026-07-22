export function t(locale, map) {
  return map[locale] ?? map.vi ?? '';
}
