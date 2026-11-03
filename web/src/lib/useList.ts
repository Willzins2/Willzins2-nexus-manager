import { useState } from 'react';
import { useDebounced } from '../components/ui';

/** Estado padrão de listagens (busca com debounce + página). */
export function useListState() {
  const [search, setSearchRaw] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const setSearch = (v: string) => {
    setSearchRaw(v);
    setPage(1);
  };
  return { search, setSearch, debounced, page, setPage };
}
