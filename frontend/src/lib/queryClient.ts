import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Các khóa truy vấn công khai được giữ khi đổi người dùng */
const PUBLIC_QUERY_ROOTS: readonly string[] = ['hotels', 'locations', 'amenities', 'health'];

/** Xóa dữ liệu của người dùng hiện tại, giữ dữ liệu công khai */
export function clearUserCache(client: QueryClient = queryClient): void {
  client.removeQueries({ predicate: (query) => !PUBLIC_QUERY_ROOTS.includes(String(query.queryKey[0])) });
  client.getMutationCache().clear();
}
