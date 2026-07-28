export const LEGAL_REVIEW_DATE = '26 July 2026';

export const legalDocuments = {
  privacy: {
    title: 'Privacy Policy',
    summary: 'How FindIt collects, uses, shares, and protects information when you use the marketplace.',
    sections: [
      {
        title: '1. Who this policy applies to',
        paragraphs: [
          'This policy applies to visitors, account holders, buyers, sellers, service providers, business-profile owners, and administrators who use FindIt. FindIt is a marketplace that helps people discover offers, advertise, evaluate listings, and contact one another.',
          'This is a working policy draft for founder and legal review. The operator’s final legal name, registered address, and privacy contact details must be inserted before public launch.',
        ],
      },
      {
        title: '2. Information we collect',
        bullets: [
          'Account information such as email address, name, phone number, profile image, and authentication provider.',
          'Marketplace content such as listings, services, business details, photos, prices, locations, and seller contact preferences.',
          'Communications sent through FindIt, including text-only marketplace messages, reports, and support requests.',
          'Operational data such as login events, device and browser information, IP-derived security signals, audit records, and error logs.',
          'Preferences such as favourites, notification state, and cookie choices.',
        ],
      },
      {
        title: '3. How we use information',
        bullets: [
          'Provide authentication, profiles, listings, search, messaging, favourites, support, moderation, and account security.',
          'Display information that you intentionally publish, including public listings and business or dealer profiles.',
          'Prevent abuse, investigate reports, enforce marketplace rules, and protect users and the service.',
          'Maintain, troubleshoot, measure, and improve FindIt.',
          'Meet legal obligations and respond to valid legal requests where applicable.',
        ],
      },
      {
        title: '4. Sharing and public information',
        paragraphs: [
          'FindIt does not sell personal information. Public listing and profile information is visible to other users and may be indexed or shared by them. Contact information is shown only where the seller chooses to provide it through a listing or profile.',
          'We may use infrastructure and service providers such as hosting, authentication, storage, monitoring, and email-delivery providers. They receive only the information needed to provide their service and are expected to protect it.',
        ],
      },
      {
        title: '5. Retention and deletion',
        paragraphs: [
          'We keep information for as long as necessary to operate FindIt, maintain security and audit records, resolve disputes, and meet legal obligations. Retention periods should be finalised before launch. Account deletion requests may be subject to limited retention for fraud prevention, legal claims, and audit integrity.',
        ],
      },
      {
        title: '6. Your choices and rights',
        paragraphs: [
          'Depending on where you live, you may have rights to access, correct, export, restrict, object to, or delete personal information. You can update core profile information in Settings and contact support for other requests. We may need to verify your identity before completing a request.',
        ],
      },
      {
        title: '7. Children, international use, and changes',
        paragraphs: [
          'FindIt is not intended for children who cannot legally enter marketplace transactions in their country. Information may be processed in countries other than your own, subject to appropriate safeguards where required. We will publish material policy changes and update the review date on this page.',
        ],
      },
    ],
  },
  'data-protection': {
    title: 'Data Protection Statement',
    summary: 'The practical safeguards and operating principles FindIt uses to protect marketplace data.',
    sections: [
      {
        title: '1. Protection principles',
        bullets: [
          'Collect only information needed for a clear marketplace or security purpose.',
          'Use information fairly, transparently, and only for compatible purposes.',
          'Keep information accurate, limited, and no longer than reasonably necessary.',
          'Protect information with access controls, encryption in transit, private storage, and audit trails.',
          'Respect applicable data-subject rights and document important handling decisions.',
        ],
      },
      {
        title: '2. Security controls',
        paragraphs: [
          'FindIt uses Supabase authentication, database Row Level Security, private media buckets, signed media access, restricted administrative functions, and server-side validation. Administrative actions are recorded. Secrets must never be placed in browser code or the repository.',
          'No security system is perfect. Users should use a unique password, protect their email account, avoid sharing sensitive documents in marketplace messages, and report suspicious activity.',
        ],
      },
      {
        title: '3. Data requests',
        paragraphs: [
          'Requests to access, correct, delete, or export data can be submitted through Contact Support. FindIt will record the request, verify the requester where appropriate, and respond within the period required by applicable law. A self-service export and deletion workflow is future work and must not be represented as available until implemented.',
        ],
      },
      {
        title: '4. Incidents and processors',
        paragraphs: [
          'Suspected data incidents are investigated, contained, documented, and notified to affected people or authorities when required. Service providers should be reviewed for security, data location, retention, subprocessors, and contractual protections before production use.',
        ],
      },
      {
        title: '5. International baseline',
        paragraphs: [
          'FindIt intends to serve users in multiple countries. This statement is a general operational baseline and does not replace country-specific notices, consent language, age rules, tax obligations, or legal advice. Local requirements must be reviewed as the marketplace enters each country.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    summary: 'The basic rules for accessing FindIt, publishing offers, and contacting other marketplace users.',
    sections: [
      {
        title: '1. Marketplace role',
        paragraphs: [
          'FindIt provides tools to discover, advertise, evaluate, and contact. Unless expressly stated, FindIt is not the buyer, seller, agent, insurer, payment provider, escrow provider, or guarantor in a transaction. Users are responsible for deciding whether an offer and counterparty are suitable.',
        ],
      },
      {
        title: '2. Accounts',
        bullets: [
          'Provide accurate information and keep account access secure.',
          'Use one account for yourself or an organisation you are authorised to represent.',
          'Do not sell, transfer, impersonate, or misuse an account.',
          'FindIt may restrict or close accounts that create safety, legal, fraud, or platform-integrity risks.',
        ],
      },
      {
        title: '3. Listings and services',
        bullets: [
          'Advertise only items, property, vehicles, machinery, or services you may lawfully offer.',
          'Use accurate titles, prices, locations, images, descriptions, and contact details.',
          'Do not publish counterfeit, stolen, dangerous, misleading, discriminatory, or prohibited offers.',
          'Remove or update offers promptly when they are no longer available.',
          'Do not scrape, spam, manipulate search, or create duplicate listings to gain unfair visibility.',
        ],
      },
      {
        title: '4. Transactions and safety',
        paragraphs: [
          'Users must inspect offers, confirm ownership and authority, keep appropriate records, and follow applicable laws. Never send money merely because a listing appears on FindIt. Meet safely, use traceable communication, and seek professional advice for high-value or regulated transactions.',
        ],
      },
      {
        title: '5. Content licence and moderation',
        paragraphs: [
          'You keep ownership of content you submit. You grant FindIt a non-exclusive, worldwide, royalty-free licence to host, reproduce, resize, display, and distribute that content only as needed to operate and promote the marketplace. FindIt may review, limit, reject, or remove content that violates these terms or creates risk.',
        ],
      },
      {
        title: '6. Availability and liability',
        paragraphs: [
          'FindIt is provided on an as-available basis. To the extent permitted by law, FindIt does not guarantee uninterrupted availability, seller identity, listing accuracy, transaction completion, or fitness for a particular purpose. Nothing in these terms excludes rights or liability that cannot legally be excluded.',
        ],
      },
      {
        title: '7. Changes and contact',
        paragraphs: [
          'These draft terms will be updated before launch with the operator identity, governing law, dispute process, minimum age, prohibited-items schedule, and country-specific terms. Questions may be submitted through Contact Support.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    summary: 'How FindIt uses browser storage and similar technologies.',
    sections: [
      {
        title: '1. Essential storage',
        paragraphs: [
          'FindIt uses essential browser storage to keep users signed in, protect authentication flows, remember interface preferences such as theme, and maintain security. Disabling essential storage may prevent account features from working.',
        ],
      },
      {
        title: '2. Analytics and marketing',
        paragraphs: [
          'FindIt Version 1 does not intentionally enable advertising cookies or cross-site behavioural marketing. Any future analytics or marketing technology must be documented here and, where required, placed behind a consent choice before activation.',
        ],
      },
      {
        title: '3. Managing choices',
        paragraphs: [
          'You can clear browser storage or block cookies through your browser. This may sign you out and reset preferences. A dedicated consent manager should be added before any non-essential tracking is introduced.',
        ],
      },
    ],
  },
  'community-guidelines': {
    title: 'Community and Marketplace Rules',
    summary: 'The behaviour and content standards that keep FindIt useful and safer.',
    sections: [
      {
        title: 'Be accurate',
        paragraphs: [
          'Describe offers honestly. Use current photos, a realistic price, the correct category and location, and disclose important defects or conditions. Do not manufacture urgency, reviews, credentials, or availability.',
        ],
      },
      {
        title: 'Be respectful',
        paragraphs: [
          'Do not threaten, harass, discriminate, impersonate, exploit, or repeatedly contact someone who has asked you to stop. Marketplace messages are for genuine buyer-to-seller communication.',
        ],
      },
      {
        title: 'Keep transactions lawful and safe',
        paragraphs: [
          'Do not advertise illegal, stolen, counterfeit, recalled, dangerous, or regulated items without the permissions required by law. Do not request passwords, authentication codes, unnecessary identity documents, or untraceable advance payments.',
        ],
      },
      {
        title: 'Report responsibly',
        paragraphs: [
          'Use reporting tools for genuine safety, fraud, content, and conduct concerns. Include specific facts. Do not weaponise reports against competitors or people involved in a personal disagreement.',
        ],
      },
      {
        title: 'Enforcement',
        paragraphs: [
          'FindIt may reject content, limit features, suspend accounts, preserve evidence, or refer matters to appropriate authorities where justified. Decisions should be proportionate, documented, and open to review through Contact Support where practical.',
        ],
      },
    ],
  },
};
