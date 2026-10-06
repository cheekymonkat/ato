// ATCC's Tarot Technology cards use a 620.16 × 359.04 landscape layout above 820px.
export const coreTechnologyLayout = { breakpoint: 820, width: 620.16, height: 359.04, narrowWidth: 326.4 } as const;
export function coreTechnologyWidth(availableWidth: number, screenWidth: number): number {
  return Math.max(160, Math.min(screenWidth >= coreTechnologyLayout.breakpoint ? coreTechnologyLayout.width : coreTechnologyLayout.narrowWidth, availableWidth));
}
