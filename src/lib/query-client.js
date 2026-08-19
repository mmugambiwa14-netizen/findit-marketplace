import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// A PWA can be backgrounded for hours. Revalidate when it becomes
			// active or reconnects instead of serving offline-era marketplace data.
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 60, // 1 hour
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			retry: 1,
		},
	},
});
