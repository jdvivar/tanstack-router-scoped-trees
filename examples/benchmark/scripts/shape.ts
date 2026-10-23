export const SECTION_COUNT = 40;
export const ROUTES_PER_SECTION = 25;

export function sectionName(section: number): string {
  return `section-${String(section).padStart(2, "0")}`;
}

export function pageName(page: number): string {
  return `page-${String(page).padStart(2, "0")}`;
}
