/** Lockup oficial: emblema circular WayUp (original, sin redibujar) + «WayUp Studio».
 *  El emblema cambia con el tema mediante CSS (.wu-logo-light / .wu-logo-dark), sin parpadeo. */
export function BrandLockup({ subtitle, size = 34, compact = false }: { subtitle?: string; size?: number; compact?: boolean }) {
  return <span className="flex min-w-0 items-center gap-2.5">
    <span className="relative inline-flex shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      <img src="/brand/wayup-logo-ivory-disc.svg" width={size} height={size} alt="WayUp" draggable={false}
        className="wu-logo-light h-full w-full rounded-full object-contain ring-1 ring-stroke" />
      <img src="/brand/wayup-logo-cobalt-disc.svg" width={size} height={size} alt="WayUp" draggable={false}
        className="wu-logo-dark h-full w-full rounded-full object-contain" />
    </span>
    {!compact && <span className="min-w-0 leading-none">
      <span className="block whitespace-nowrap font-display text-[19px] font-semibold tracking-[-.01em] text-ink">
        WayUp <span className="italic font-medium text-brand">Studio</span>
      </span>
      {subtitle && <span className="mt-1 block truncate text-[10px] font-medium text-faint">{subtitle}</span>}
    </span>}
  </span>;
}

/** Interruptor de tema accesible (claro/oscuro) para cualquier cabecera. */
export { ThemeToggle } from './theme-toggle';
