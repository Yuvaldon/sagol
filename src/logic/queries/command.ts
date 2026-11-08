import type { Result } from '@contracts'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { QUERY_KEYS } from './client'

/**
 * A command that answers once the reads it changed have been refreshed, so the screen that asked already
 * shows the result. The change feed refreshes every other view.
 */
export function useCommand<Input, Output>(keys: readonly QueryKey[], run: (input: Input) => Promise<Result<Output>>) {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: async (result) => {
      if (result.ok) {
        await Promise.all(
          [...keys, QUERY_KEYS.can].map((queryKey) => client.invalidateQueries({ queryKey })),
        )
      }
    },
  })
  return { run: mutation.mutateAsync, isPending: mutation.isPending }
}
