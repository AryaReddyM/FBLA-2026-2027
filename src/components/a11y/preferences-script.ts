// Shared by the root layout (server) and the preferences store (client).
// Lives in its own non-"use client" module so the server can read the string.

export const PREF_KEYS = {
  theme: "et-theme",
  contrast: "et-contrast",
  textSize: "et-text",
  motion: "et-motion",
  font: "et-font",
  spacing: "et-spacing",
  links: "et-links",
  focus: "et-focus",
  guide: "et-guide",
} as const

/**
 * Preferences that become an attribute on <html> (e.g. data-font="lexend"),
 * with the values allowed for each. The CSS in globals.css does the rest.
 * The first value of each list is the default, which sets no attribute.
 */
export const HTML_ATTRIBUTE_PREFS = {
  contrast: { attr: "data-contrast", values: ["normal", "high", "colorsafe"] },
  textSize: { attr: "data-text-size", values: ["100", "115", "130", "150"] },
  motion: { attr: "data-motion", values: ["auto", "reduce"] },
  font: { attr: "data-font", values: ["default", "hyperlegible", "lexend"] },
  spacing: { attr: "data-spacing", values: ["normal", "wide"] },
  links: { attr: "data-links", values: ["default", "underline"] },
  focus: { attr: "data-focus", values: ["default", "strong"] },
} as const

const ATTRS = Object.entries(HTML_ATTRIBUTE_PREFS).map(([key, { attr, values }]) => [
  PREF_KEYS[key as keyof typeof HTML_ATTRIBUTE_PREFS],
  attr,
  values,
])

/**
 * Runs synchronously in <head> before anything is painted, so the page never
 * flashes the wrong theme, font, contrast or size. Plain ES5 in a string
 * because it runs before React or any bundle has loaded.
 */
export const PREFERENCES_SCRIPT = `(function(){try{
var d=document.documentElement;
function g(k){var p=document.cookie.split('; ');for(var i=0;i<p.length;i++){var kv=p[i].split('=');if(kv[0]===k)return decodeURIComponent(kv[1]||'')}try{return localStorage.getItem(k)}catch(e){return null}}
var t=g('${PREF_KEYS.theme}')||'system';
var dark=t==='dark'||(t!=='light'&&!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
if(dark)d.classList.add('dark');d.style.colorScheme=dark?'dark':'light';
var a=${JSON.stringify(ATTRS)};
for(var j=0;j<a.length;j++){var v=g(a[j][0]);if(v&&v!==a[j][2][0]&&a[j][2].indexOf(v)>-1)d.setAttribute(a[j][1],v)}
}catch(e){}})()`
