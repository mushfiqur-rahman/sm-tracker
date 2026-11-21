export function Logo({ withText = true }: { withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight" translate="no">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand text-brand-fg">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12l16-8-6 16-2.5-6.5z" />
          <path d="M11.5 13.5L20 4" />
        </svg>
      </span>
      {withText && <span className="notranslate text-[17px]">PostPilot</span>}
    </span>
  );
}
