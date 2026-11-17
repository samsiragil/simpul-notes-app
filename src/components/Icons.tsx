import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 15): SVGProps<SVGSVGElement> => ({ width: size, height: size, viewBox: "0 0 16 16", fill: "none" });

export const IconAll = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2" y="4.5" width="10" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M5 2.5h7a2 2 0 0 1 2 2V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
);
export const IconTrash = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
);
export const IconSettings = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" /></svg>
);
export const IconSidebar = ({ size, ...p }: P) => (
  <svg {...base(size ?? 16)} {...p}><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.5" stroke="currentColor" strokeWidth="1.3" /><path d="M6 3v10" stroke="currentColor" strokeWidth="1.3" /></svg>
);
export const IconList = ({ size, ...p }: P) => (
  <svg {...base(size ?? 16)} {...p}><path d="M3 4.5h10M3 8h10M3 11.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size ?? 12)} {...p}><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
export const IconNote = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}><rect x="3" y="2" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
);
export const IconTodo = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5.3 8.2l1.8 1.8 3.6-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IconPin = ({ size, filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size)} {...p}><path d="M10 2.5l3.5 3.5-2.2.8-2.4 2.4.3 2.8-1 1-2.1-2.1L3 14l-.1-.1 3.1-3.1L3.9 8.7l1-1 2.8.3 2.4-2.4L10 2.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill={filled ? "currentColor" : "none"} /></svg>
);
export const IconRestore = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 7.5A5 5 0 1 1 4.5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M2.5 4v3.5H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size ?? 12)} {...p}><path d="M3.5 8.3l3 3 6-6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IconGrip = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}>
    {[4, 8, 12].map((y) => [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}
  </svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
);
export const IconFocus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
);
