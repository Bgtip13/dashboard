"use client";

const PATHS: Record<string, React.ReactNode> = {
  "⚠️": (<><path d="M12 3.5 2.8 20h18.4L12 3.5Z" /><line x1="12" y1="10" x2="12" y2="14.6" /><circle cx="12" cy="17.3" r="0.4" fill="currentColor" /></>),
  "📉": (<><polyline points="3.5,7 10,13 13.5,10 20.5,16.5" /><polyline points="15,16.5 20.5,16.5 20.5,11" /></>),
  "🎯": (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>),
  "✅": (<><circle cx="12" cy="12" r="9" /><polyline points="8,12.4 11,15.4 16.4,9.4" /></>),
  "🌟": (<path d="M12 3.2l2.5 5.4 5.9.6-4.4 4 1.2 5.8L12 16.1l-5.2 2.9 1.2-5.8-4.4-4 5.9-.6L12 3.2z" />),
  "🏆": (<><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 5.5H5a3 3 0 0 0 3 3.8M16 5.5h3a3 3 0 0 1-3 3.8" /><path d="M12 13v3.2" /><path d="M9.5 20h5l-.6-3.8h-3.8L9.5 20Z" /></>),
  "📊": (<><line x1="5" y1="20" x2="5" y2="12.5" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="19" y1="20" x2="19" y2="10" /></>),
  "☀️": (<><circle cx="12" cy="12" r="4" /><line x1="12" y1="2.8" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21.2" /><line x1="2.8" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21.2" y2="12" /><line x1="5.5" y1="5.5" x2="7" y2="7" /><line x1="17" y1="17" x2="18.5" y2="18.5" /><line x1="18.5" y1="5.5" x2="17" y2="7" /><line x1="7" y1="17" x2="5.5" y2="18.5" /></>),
  "🌙": (<path d="M20 13.6A8.1 8.1 0 0 1 10.4 4 7.6 7.6 0 1 0 20 13.6Z" />),
};

export default function Icn({ e, className = "h-3.5 w-3.5" }: { e: string; className?: string }) {
  const body = PATHS[e];
  if (!body) return <span>{e}</span>;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={`inline-block align-[-2px] shrink-0 ${className}`}>
      {body}
    </svg>
  );
}
