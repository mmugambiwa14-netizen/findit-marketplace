function currentBrand(paragraph) {
  return paragraph;
}

export function legalParagraph(document, paragraph) {
  if (document === 'privacy' && paragraph.startsWith('There is currently no one-click self-service export or account-deletion button.')) {
    return 'You can delete your account from Settings. Deletion closes access immediately, removes public profile and contact information, unpublishes listings and services, and deletes disposable account data. Certain transaction, safety, moderation, dispute, and audit records may be retained in anonymised form where they are still needed. Data export requests continue to be handled through support.';
  }

  if (document === 'data-protection' && paragraph.startsWith('A self-service export and deletion workflow is planned but not yet built')) {
    return 'Self-service account deletion is available in Settings. It removes public and disposable personal data immediately and anonymises retained safety, dispute, transaction, and audit records. Self-service data export is not yet available and export requests are handled through support.';
  }

  return currentBrand(paragraph);
}
