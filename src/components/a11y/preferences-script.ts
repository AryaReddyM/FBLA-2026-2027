// Shared by the root layout (server) and the preferences store (client).
// Lives in its own non-"use client" module so the server can read the string.

export const PREF_KEYS = {
  theme: "et-theme",
  contrast: "et-contrast",
  textSize: "et-text",
  motion: "et-motion",
} as const

/**
 * Runs synchronously in <head> before anything is painted, so the page never
 * flashes the wrong theme, contrast or text size. Plain ES5 in a string
 * because it runs before React or any bundle has loaded.
 */
export const PREFERENCES_SCRIPT = `(function(){try{
var d=document.documentElement;
function g(k){var p=document.cookie.split('; ');for(var i=0;i<p.length;i++){var kv=p[i].split('=');if(kv[0]===k)return decodeURIComponent(kv[1]||'')}try{return localStorage.getItem(k)}catch(e){return null}}
var t=g('${PREF_KEYS.theme}')||'system',c=g('${PREF_KEYS.contrast}')||'normal',s=g('${PREF_KEYS.textSize}')||'100',m=g('${PREF_KEYS.motion}')||'auto';
var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
if(dark)d.classList.add('dark');d.style.colorScheme=dark?'dark':'light';
if(c==='high'||c==='colorsafe')d.setAttribute('data-contrast',c);
if(s==='115'||s==='130'||s==='150')d.setAttribute('data-text-size',s);
if(m==='reduce')d.setAttribute('data-motion','reduce');
}catch(e){}})()`
