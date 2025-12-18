// Type declarations for date-fns v4+
// Needed because of moduleResolution "bundler" compatibility issues
declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string, options?: object): string;
  export function addDays(date: Date | number, amount: number): Date;
  export function setHours(date: Date | number, hours: number): Date;
  export function setMinutes(date: Date | number, minutes: number): Date;
  export function startOfDay(date: Date | number): Date;
  export function isToday(date: Date | number): boolean;
  export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
  export function parseISO(dateString: string): Date;
  export function formatDistance(date: Date | number, baseDate: Date | number, options?: object): string;
  export function formatRelative(date: Date | number, baseDate: Date | number, options?: object): string;
  export function differenceInDays(dateLeft: Date | number, dateRight: Date | number): number;
  export function differenceInHours(dateLeft: Date | number, dateRight: Date | number): number;
  export function differenceInMinutes(dateLeft: Date | number, dateRight: Date | number): number;
  export function addHours(date: Date | number, amount: number): Date;
  export function addMinutes(date: Date | number, amount: number): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function subHours(date: Date | number, amount: number): Date;
  export function isBefore(date: Date | number, dateToCompare: Date | number): boolean;
  export function isAfter(date: Date | number, dateToCompare: Date | number): boolean;
  export function isValid(date: unknown): boolean;
}

