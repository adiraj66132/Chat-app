import { useQuery } from '@tanstack/react-query';
import { listConversations } from '../api/conversations';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
    refetchInterval: 30_000,
  });
}
