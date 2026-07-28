/**
 * Invalidates every client cache that projects canonical listing or service
 * identity. Prefix invalidation is deliberate: filters, cursor state and user
 * IDs live deeper in each key and must all observe lifecycle changes.
 */
export async function invalidateCanonicalParentQueries(queryClient, {
  parentType,
  parentId,
  kind = null,
} = {}) {
  if (!queryClient || !parentId) return;

  const commonKeys = [
    ['public-listing-search'],
    ['public-search-suggestions'],
    ['favourite-listings'],
    ['seller-public-page'],
    ['public-business-profile'],
    ['message-inbox'],
    ['message-conversation'],
    ['listing-tours', 'feed'],
  ];

  const parentKeys = parentType === 'service'
    ? [['services'], ['service', parentId], ['my-services']]
    : [
        ['property', parentId],
        ['car', parentId],
        ['machinery', parentId],
        ['my-listings'],
        ...(kind ? [[kind, parentId]] : []),
      ];

  const uniqueKeys = [...commonKeys, ...parentKeys]
    .filter((key, index, keys) => keys.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(key)) === index);

  await Promise.all(uniqueKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
