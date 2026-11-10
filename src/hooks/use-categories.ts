import { useMemo } from 'react';

import { useLang } from '@/lib/i18n';
import { useData } from '@/lib/store';
import { localizeName } from '@/lib/suggestions';
import type { Category } from '@/lib/types';

/**
 * Categories for display. Starter ideas (Coffee, Water…, including the demo
 * data) are stored in whichever language they were added in; here they're
 * renamed to the current app language so switching languages switches them too.
 * Names the user typed themselves are left alone.
 */
export function useCategories(): Category[] {
  const categories = useData((s) => s.categories);
  const lang = useLang();
  return useMemo(
    () =>
      categories.map((c) => {
        const name = localizeName(c.name, lang);
        return name === c.name ? c : { ...c, name };
      }),
    [categories, lang],
  );
}

/** One category for display, by id (see `useCategories`). */
export function useCategory(id: string | undefined): Category | undefined {
  const cat = useData((s) => s.categories.find((c) => c.id === id));
  const lang = useLang();
  return useMemo(() => {
    if (!cat) return cat;
    const name = localizeName(cat.name, lang);
    return name === cat.name ? cat : { ...cat, name };
  }, [cat, lang]);
}
