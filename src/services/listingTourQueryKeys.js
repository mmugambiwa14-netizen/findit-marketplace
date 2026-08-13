export const listingTourQueryKeys = Object.freeze({
  all: ['listing-tours'],
  ownerParent: (parentType, parentId, userId = null) => ['listing-tours', 'owner', parentType, parentId, userId],
  publicParent: (parentType, parentId) => ['listing-tours', 'public', parentType, parentId],
  adminQueue: (status) => ['listing-tours', 'admin', status],
  publicFeed: (filters) => ['listing-tours', 'feed', filters],
});
