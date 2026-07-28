import ListingGrid from './ListingGrid';

export default function MachineryGrid({ listings = [], isLoading = false, onSave, savedIds = [] }) {
  return <ListingGrid listings={listings} type="machinery" isLoading={isLoading} onSave={onSave} savedIds={savedIds} />;
}
