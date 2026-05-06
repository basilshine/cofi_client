/** Shared Ceits wordmark on auth screens: lighter than headlines, softer navy, open tracking. */
const ceitsAuthWordmarkBase =
	"inline-block rounded-sm font-serif font-light leading-none tracking-[0.055em] text-[#2A3D4C] antialiased transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/28 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F4EF]";

/** Landing / entry — ~40% larger than previous `text-2xl` (1.5rem). */
export const ceitsAuthWordmarkEntryClass = `${ceitsAuthWordmarkBase} text-[2.1rem] md:text-[2.28rem]`;

/** Login — ~15–20% larger than 1.5rem. */
export const ceitsAuthWordmarkLoginClass = `${ceitsAuthWordmarkBase} text-[1.76rem] md:text-[1.82rem]`;

/** Register — ~12% larger than 1.5rem, balanced for centered column. */
export const ceitsAuthWordmarkRegisterClass = `${ceitsAuthWordmarkBase} text-[1.7rem] md:text-[1.78rem]`;
