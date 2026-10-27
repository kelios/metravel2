import { useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/** Keep typing immediate while catalogue matching waits for a pause (#1826). */
export function useQuestCatalogSearchQuery() {
    const [searchQuery, setSearchQuery] = useState('');
    const searchTerm = useDebouncedValue(searchQuery.trim().toLowerCase(), 200);

    return { searchQuery, setSearchQuery, searchTerm };
}
