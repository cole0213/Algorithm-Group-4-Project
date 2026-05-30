// Lucide icons sourced via Iconify MCP (lucide set)

const B = (size, cls) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  'aria-hidden': 'true',
  className: `ic${cls ? ' ' + cls : ''}`,
});

export function IcSettings({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
        <circle cx="12" cy="12" r="3" />
      </g>
    </svg>
  );
}

export function IcColumns2({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M12 3v18" />
      </g>
    </svg>
  );
}

export function IcNotebookPen({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4M2 6h4m-4 4h4m-4 4h4m-4 4h4" />
        <path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
      </g>
    </svg>
  );
}

export function IcArrowRight({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-7-7l7 7l-7 7" />
    </svg>
  );
}

export function IcUpload({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12m5-7l-5-5l-5 5m14 7v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}

export function IcMaximize2({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 3h6v6m0-6l-7 7M3 21l7-7m-1 7H3v-6" />
    </svg>
  );
}

export function IcMinimize2({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m14 10l7-7m-1 7h-6V4M3 21l7-7m-6 0h6v6" />
    </svg>
  );
}

export function IcEye({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </g>
    </svg>
  );
}

export function IcEyeOff({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242" />
        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20" />
      </g>
    </svg>
  );
}

export function IcTrash2({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IcBookmark({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function IcBookmarkCheck({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />
        <path d="m9 10l2 2l4-4" />
      </g>
    </svg>
  );
}

export function IcCircleCheck({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12l2 2l4-4" />
      </g>
    </svg>
  );
}

export function IcCirclePause({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M10 15V9m4 6V9" />
      </g>
    </svg>
  );
}

export function IcCircleX({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9l-6 6m0-6l6 6" />
      </g>
    </svg>
  );
}

export function IcCircle({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function IcSearch({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="m21 21l-4.34-4.34" />
        <circle cx="11" cy="11" r="8" />
      </g>
    </svg>
  );
}

export function IcX({ size = 16, className }) {
  return (
    <svg {...B(size, className)}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
