import { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type SortDirection = 'asc' | 'desc';

interface UseClientTableProps<T> {
  data: T[];
  pageSize?: number;
  initialSortBy?: keyof T;
  initialSortDirection?: SortDirection;
  searchableFields?: (keyof T)[];
  serverSide?: boolean;
  serverCount?: number;
}

export function useClientTable<T>({
  data,
  pageSize = 10,
  initialSortBy,
  initialSortDirection = 'desc',
  searchableFields = [],
  serverSide = false,
  serverCount = 0,
}: UseClientTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL search params
  const urlPage = parseInt(searchParams?.get('page') || '1', 10);
  const urlSearch = searchParams?.get('search') || '';
  const urlSortBy = (searchParams?.get('sortBy') || initialSortBy || '') as keyof T | '';
  const urlSortDirection = (searchParams?.get('sortDirection') || initialSortDirection) as SortDirection;

  const [search, setSearch] = useState(serverSide ? urlSearch : '');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<keyof T | undefined>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);

  // Sync url search param back to input local state if changed from outside
  useEffect(() => {
    if (serverSide) {
      setSearch(urlSearch);
    }
  }, [urlSearch, serverSide]);

  // Debounce search update to URL
  useEffect(() => {
    if (!serverSide) return;
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      // Only navigate if search parameter has actually changed
      if (params.get('search') !== search) {
        if (search) {
          params.set('search', search);
        } else {
          params.delete('search');
        }
        params.set('page', '1'); // Reset to first page on search change
        router.push(`${pathname}?${params.toString()}`);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [search, serverSide, pathname, router, searchParams]);

  const handleSort = (field: keyof T) => {
    if (serverSide) {
      const activeSortBy = urlSortBy === field ? field : undefined;
      const activeDirection = urlSortDirection;
      const nextDir = activeSortBy && activeDirection === 'asc' ? 'desc' : 'asc';
      
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('sortBy', String(field));
      params.set('sortDirection', nextDir);
      params.set('page', '1'); // Reset to first page on sort change
      router.push(`${pathname}?${params.toString()}`);
    } else {
      if (sortBy === field) {
        setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortDirection('asc');
      }
    }
  };

  const setPage = (page: number) => {
    if (serverSide) {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('page', page.toString());
      router.push(`${pathname}?${params.toString()}`);
    } else {
      setCurrentPage(page);
    }
  };

  const processedData = useMemo(() => {
    if (serverSide) return data;
    let result = [...data];

    // Smart Search / Filtering
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(item => {
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
  }, [data, search, sortBy, sortDirection, searchableFields, serverSide]);

  const totalPages = serverSide
    ? Math.max(1, Math.ceil(serverCount / pageSize))
    : Math.max(1, Math.ceil(processedData.length / pageSize));
  
  const validCurrentPage = serverSide ? urlPage : Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (serverSide) return data;
    const startIndex = (validCurrentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, validCurrentPage, pageSize, serverSide, data]);

  return {
    search,
    setSearch,
    currentPage: validCurrentPage,
    setCurrentPage: setPage,
    totalPages,
    sortBy: serverSide ? (urlSortBy || undefined) : sortBy,
    sortDirection: serverSide ? urlSortDirection : sortDirection,
    handleSort,
    paginatedData,
    totalResults: serverSide ? serverCount : processedData.length,
    pageSize
  };
}
