// Agent portal design tokens, "Signal box": greyscale slate, and colour only ever means state.
// Shared by the portal shell (portal.cjs) and the kit injected into agent pages (kit.cjs).
// Values and contrast checks: the visual design review, 2026-11-08.
const TOKENS=`:root{color-scheme:light;
--agl-font:"IBM Plex Sans","Segoe UI Variable",system-ui,-apple-system,"Noto Sans",sans-serif;--agl-mono:ui-monospace,"IBM Plex Mono","Cascadia Mono",monospace;
--agl-ground:#F2F4F5;--agl-surface:#FFFFFF;--agl-surface-2:#F7F8F9;--agl-line:#DCE0E4;--agl-line-strong:#C3C9CF;
--agl-ink:#18212B;--agl-ink-2:#3D4853;--agl-ink-3:#5E6873;--agl-bar:#1F2A33;--agl-bar-ink:#E9EEF2;--agl-bar-muted:#A9B4BE;
--agl-primary:#18212B;--agl-on-primary:#FFFFFF;--agl-focus:#2F6FD0;--agl-shadow:0 12px 32px rgba(16,24,40,.22);
--agl-needs-you:#A3260F;--agl-needs-you-bg:#FCE8E3;--agl-needs-you-rail:#D2421F;
--agl-blocked:#7A5100;--agl-blocked-bg:#FBF0D0;--agl-blocked-rail:#AD7700;
--agl-working:#1A4FA0;--agl-working-bg:#E4EDFA;--agl-working-rail:#2F6FD0;
--agl-done:#1D6B3C;--agl-done-bg:#E2F2E7;--agl-done-rail:#2E8B4E;
--agl-idle:#535D68;--agl-idle-bg:#ECEEF1;--agl-idle-rail:#7A848E}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;
--agl-ground:#12171C;--agl-surface:#1A2128;--agl-surface-2:#212931;--agl-line:#2E3842;--agl-line-strong:#3E4954;
--agl-ink:#E6EAEE;--agl-ink-2:#BCC4CC;--agl-ink-3:#8E99A4;--agl-bar:#0D1216;--agl-bar-ink:#E6EAEE;--agl-bar-muted:#8E99A4;
--agl-primary:#E6EAEE;--agl-on-primary:#12171C;--agl-focus:#7FB0FF;--agl-shadow:0 12px 32px rgba(0,0,0,.5);
--agl-needs-you:#FF9C85;--agl-needs-you-bg:#3A1C16;--agl-needs-you-rail:#F0714F;
--agl-blocked:#F2C55C;--agl-blocked-bg:#33290F;--agl-blocked-rail:#E0A82E;
--agl-working:#8DB8FF;--agl-working-bg:#172A45;--agl-working-rail:#5B93E8;
--agl-done:#7DD3A0;--agl-done-bg:#15301F;--agl-done-rail:#48B26F;
--agl-idle:#B3BCC5;--agl-idle-bg:#262E36;--agl-idle-rail:#7F8A95}}`;
// One rule per state: chip colours, rail and dot colour.
const STATES=['needs-you','blocked','working','done','idle'];
const STATE_CSS=STATES.map(s=>`.s-${s}{--rail:var(--agl-${s}-rail);--fg:var(--agl-${s});--bg:var(--agl-${s}-bg)}`).join('');
// An agent's identity: the same gradient every time from its name, different per agent, dark enough for light text.
function gradientOf(name){let h=2166136261;for(const c of String(name))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;const a=h%360,b=(a+40+((h>>>9)%80))%360,angle=90+((h>>>20)%91);return`linear-gradient(${angle}deg,hsl(${a} 55% 26%),hsl(${b} 60% 20%))`;}
module.exports={TOKENS,STATE_CSS,STATES,gradientOf};
