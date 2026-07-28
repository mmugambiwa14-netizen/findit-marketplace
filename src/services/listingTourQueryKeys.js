export const listingTourQueryKeys = Object.freeze({
  all: ['listing-tours'],
  ownerParent: (parentType, parentId) => ['listing-tours', 'owner', parentType, parentId],
  publicParent: (parentType, parentId) => ['listing-tours', 'public', parentType, parentId],
  adminQueue: (status) => ['listing-tours', 'admin', status],
  publicFeed: (filters) => ['listing-tours', 'feed', filters],
});
