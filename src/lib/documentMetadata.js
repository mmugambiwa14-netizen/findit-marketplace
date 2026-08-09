const DEFAULT_DESCRIPTION = 'Browse Zimbabwe listings, services and public Peeks on PeekaListing.';

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function applyListingDocumentMetadata({ title, description, imageUrl, path }) {
  const cleanTitle = `${String(title || 'Listing').trim()} | PeekaListing`;
  const cleanDescription = String(description || DEFAULT_DESCRIPTION).trim().replace(/\s+/g, ' ').slice(0, 220);
  const canonical = new URL(path || window.location.pathname, window.location.origin).toString();
  const image = imageUrl && /^https:\/\//i.test(imageUrl)
    ? imageUrl
    : new URL('/brand/peekalisting-icon-512.png', window.location.origin).toString();
  document.title = cleanTitle;
  setMeta('name', 'description', cleanDescription);
  setMeta('property', 'og:title', cleanTitle);
  setMeta('property', 'og:description', cleanDescription);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:title', cleanTitle);
  setMeta('name', 'twitter:description', cleanDescription);
  setMeta('name', 'twitter:image', image);
}
