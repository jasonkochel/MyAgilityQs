import type { CompetitionClass } from "@my-agility-qs/shared";

/**
 * Utility functions to create links to ViewRunsPage with specific filters
 */

interface ViewRunsFilters {
  dog?: string;
  class?: CompetitionClass;
  level?: 'current' | 'all';
  from?: string;
}

export function createViewRunsLink(filters: ViewRunsFilters = {}): string {
  const params = new URLSearchParams();
  
  if (filters.dog) params.set('dog', filters.dog);
  if (filters.class) params.set('class', filters.class);
  if (filters.level && filters.level !== 'all') params.set('level', filters.level);
  if (filters.from) params.set('from', filters.from);
  
  const search = params.toString();
  return `/view-runs${search ? '?' + search : ''}`;
}

// Convenience functions for common filter combinations
export const viewRunsLinks = {
  all: () => '/view-runs',
  forDog: (dogId: string) => createViewRunsLink({ dog: dogId }),
  forClass: (className: CompetitionClass) => createViewRunsLink({ class: className }),
  currentLevel: () => createViewRunsLink({ level: 'current' }),
  forDogAndClass: (dogId: string, className: CompetitionClass) => 
    createViewRunsLink({ dog: dogId, class: className }),
  forDogCurrentLevel: (dogId: string) => 
    createViewRunsLink({ dog: dogId, level: 'current' }),
};