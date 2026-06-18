import { useState, useMemo } from 'react';

type SortDirection = 'asc' | 'desc';

interface UseClientTableProps<T> {
  data: T[];
  pageSize?: number;
  initialSortBy?: keyof T;
  initialSortDirection?: SortDirection;
  searchableFields?: (keyof T)[];
}

export function useClientTable<T>({
  data,
  pageSize = 10,
  initialSortBy,
  initialSortDirection = 'desc',
  searchableFields = [],
}: UseClientTableProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<keyof T | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);

  const handleSort = (field: keyof T) => {
    if (sortBy === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const processedData = useMemo(() => {
    let result = [...data];

    // Smart Search / Filtering
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(item => {
        // If specific fields are provided, search only those, else search all string values
        const fieldsToSearch = searchableFields.length > 0 
          ? searchableFields 
          : (Object.keys(item as any) as (keyof T)[]);

        return fieldsToSearch.some(field => {
          const value = item[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(lowerSearch);
          }
          if (typeof value === 'number') {
            return value.toString().includes(lowerSearch);
          }
          return false;
        });
      });
    }

    // Sorting
    if (sortBy) {
      result.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal === bVal) return 0;
        
        // Handle null/undefined
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        
        return 0;
      });
    }

    return result;
  }, [data, search, sortBy, sortDirection, searchableFields]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
  
  // Ensure current page is valid after filtering
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, validCurrentPage, pageSize]);

  return {
    search,
    setSearch,
    currentPage: validCurrentPage,
    setCurrentPage,
    totalPages,
    sortBy,
    sortDirection,
    handleSort,
    paginatedData,
    totalResults: processedData.length,
    pageSize
  };
}
