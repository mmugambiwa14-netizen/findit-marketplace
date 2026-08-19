// Legal content served at /legal/:document by src/pages/LegalPage.jsx.
//
// Every factual claim below is intended to describe what the application
// actually does. When a data flow, provider, retention period, or feature is
// changed, this file must be updated in the same change -- a policy that
// misdescribes real processing is worse than a shorter accurate one.
//
// Items still requiring the operator's input are marked with [TO BE
// COMPLETED: ...] so they are greppable and cannot ship unnoticed.

export const LEGAL_REVIEW_DATE = '30 July 2026';

export const legalDocuments = {
  privacy: {
    title: 'Privacy Policy',
    summary: 'What information PeekaListing collects, why we collect it, who can see it, how long we keep it, and the choices and rights you have.',
    sections: [
      {
        title: '1. About this policy',
        paragraphs: [
          'This policy explains how PeekaListing handles personal information. It applies to everyone who uses the marketplace: visitors who browse without an account, registered buyers and sellers, service providers, business-profile owners, and administrators.',
          'PeekaListing is operated by [TO BE COMPLETED: operator legal name], registered at [TO BE COMPLETED: registered address]. Privacy questions and data-rights requests can be sent to [TO BE COMPLETED: privacy contact email] or submitted through Contact Support in the application.',
          'PeekaListing is a marketplace. It provides tools to publish offers, search, evaluate listings, and contact other users. PeekaListing is not a party to the transactions users arrange between themselves.',
          'This is a working policy draft prepared for founder and legal review. The operator’s legal name, registered address, privacy contact details, and confirmed retention periods must be completed, and the whole document reviewed by a qualified lawyer, before public launch.',
        ],
      },
      {
        title: '2. Account and profile information',
        bullets: [
          'Email address, which is required to create an account and is used to sign in and to contact you about your account.',
          'Full name and phone number, where you provide them.',
          'Your chosen authentication method. If you sign in with Google, we receive your email address, name, and profile image from Google; we never receive your Google password.',
          'Phone verification state, and a temporary one-time code and its expiry while a verification is in progress. The code is short-lived and is not retained after verification completes or expires.',
          'Business-profile details where you create one, including company name, business address, business email, and business phone. Business profiles are published and are visible to anyone.',
        ],
      },
      {
        title: '3. Identity verification information',
        paragraphs: [
          'If you request verification, PeekaListing collects the identity document you upload, a trade or business document where relevant, and a selfie image used to check that the document belongs to you. We also store the name, email address, and phone number read from those documents, and the values confirmed by a reviewer.',
          'This is sensitive information and is treated accordingly. It is used only to confirm identity, to reduce fraud and impersonation, and to keep a record that a verification decision was made. It is not published, is not shown to other users, is not used for advertising, and is not used to personalise what you see.',
          'Verification is optional. If you do not request verification, none of this information is collected. Where a verification request is rejected, we retain the decision and its reason so the outcome can be reviewed or appealed.',
        ],
      },
      {
        title: '4. Listings, media, and location',
        bullets: [
          'Listing and service content you publish: title, description, category, price and currency, condition and specifications, availability, and the contact methods you choose to display.',
          'Contact details you attach to a listing -- phone, WhatsApp number, and email. These are published with the listing. Only provide the ones you are willing to make public.',
          'Photographs you upload for listings and profiles, and video you upload as a Peek. Media is held in private storage and served through short-lived signed links rather than public URLs.',
          'Location, at two different levels of precision. A coarse public location -- an area label and an approximate point -- is shown with your listing. Where you supply a precise address or exact coordinates, these are stored separately, are marked private, and are never included in public listing data or search results.',
        ],
      },
      {
        title: '5. Messages, engagement, and support',
        bullets: [
          'Messages and enquiries you send through the marketplace, including the name you present to the other party. Messages are text-only.',
          'Engagement records such as saved listings, sellers you follow, reviews and ratings you leave, and whether you are currently active in the application.',
          'Reports you submit about listings, Peeks, or conduct, including the reason you give.',
          'Support requests and tickets, including the contact email or phone number you supply, the content of your request, and any file you attach.',
        ],
      },
      {
        title: '6. Usage and security information',
        bullets: [
          'Interaction events used to order and recommend listings: the type of action (viewing a listing, saving it, watching a Peek, starting a chat, searching, following a seller, and whether a recommendation was shown or clicked), the listing or seller involved, and limited context such as which surface it happened on.',
          'These events are linked either to your account, if you are signed in, or to a random session identifier held only in your browser tab if you are not. That identifier is not linked to your name, email, or device fingerprint, and is discarded when the tab is closed.',
          'Administrative and audit records when an administrator acts on an account, listing, report, or verification. These include who acted, what changed, why, and the IP address the action came from. They exist so that moderation and administration can be reviewed.',
          'Technical error and delivery logs generated by our hosting and database providers in the ordinary course of running the service.',
        ],
      },
      {
        title: '7. Why we use information, and our legal bases',
        bullets: [
          'To provide the service you asked for -- creating your account, publishing your listings, running search, delivering messages, and handling support. Legal basis: performance of a contract with you.',
          'To keep the marketplace safe and honest -- detecting fraud and abuse, reviewing reports, moderating content, and enforcing our rules. Legal basis: our legitimate interest in protecting users and the service.',
          'To verify identity where you request it. Legal basis: your consent, and our legitimate interest in reducing impersonation.',
          'To personalise recommendations. Legal basis: your consent, which you can withdraw at any time.',
          'To meet legal obligations and respond to lawful requests from authorities. Legal basis: compliance with a legal obligation.',
          'We do not sell personal information, and we do not use it for cross-site behavioural advertising.',
        ],
      },
      {
        title: '8. Personalisation and your consent',
        paragraphs: [
          'Personalised recommendations are optional and consent-based. PeekaListing records whether you have enabled personalisation, the version of the consent you agreed to, and when you turned it on or off, so that a change in what we ask for does not silently carry over an old agreement.',
          'If you turn personalisation off, PeekaListing stops using your activity to tailor recommendations to you. You will still see listings ordered by general relevance, recency, and popularity, which does not depend on your personal history.',
        ],
      },
      {
        title: '9. What other people can see',
        paragraphs: [
          'Anything you publish is public. Listings, service offerings, business profiles, seller display names, reviews you write, and the contact details you attach to a listing are visible to anyone who visits PeekaListing, including people without an account. They may be copied, cached, or indexed by search engines, and PeekaListing cannot retrieve copies that others have already made.',
          'Your email address is not published unless you choose to display it on a listing or business profile. Your precise address, your identity documents, your selfie, your saved listings, your support requests, and your verification status details are never published.',
        ],
      },
      {
        title: '10. Service providers and international transfers',
        bullets: [
          'Supabase provides our database, authentication, file storage, and server-side functions. Marketplace data is held there. The staging and production databases are hosted in the European Union (London and Ireland regions).',
          'Cloudflare Pages serves the application front-end.',
          'Google provides optional sign-in, where you choose to use it.',
          'A third-party video service processes uploaded Peek video into a playable format and generates thumbnails.',
          'An email delivery provider sends account and notification email.',
          'Because our infrastructure is hosted outside Zimbabwe, your information is transferred internationally. We rely on the contractual and technical protections offered by these providers. [TO BE COMPLETED: confirm the transfer mechanism and each provider contract before public launch.]',
        ],
      },
      {
        title: '11. How long we keep information',
        bullets: [
          'Account and profile information: while your account exists, and for a limited period afterwards where needed for fraud prevention, legal claims, or audit integrity.',
          'Listings and their media: while published, and for a limited period after removal so that disputes and reports can be resolved.',
          'Original uploaded Peek video: deleted approximately seven days after processing. Only the processed playback file and thumbnail are retained while the Peek is live.',
          'Recommendation and interaction events: each event carries its own expiry and is deleted automatically when it is reached. Aggregated daily popularity counts, which do not identify individuals, are retained longer.',
          'Administrative and audit records: retained longer than ordinary data, because their purpose is to allow past decisions to be reviewed.',
          '[TO BE COMPLETED: confirm exact retention periods for each category and state them here in days or months before public launch.]',
        ],
      },
      {
        title: '12. Your rights',
        paragraphs: [
          'You have the right to ask what personal information we hold about you, to have inaccurate information corrected, to ask for deletion, to object to or ask us to restrict certain processing, to withdraw consent where processing relies on it, and to receive a copy of information you provided in a portable form.',
          'You can change your profile details, your listings, and your personalisation choice yourself in the application at any time. For anything else, contact us using the details in section 1. We may need to confirm your identity before acting, and we will respond within the period required by applicable law.',
          'There is currently no one-click self-service export or account-deletion button. Requests are handled manually through support. We will not describe that workflow as automated until it exists.',
          'If you are in Zimbabwe, the Cyber and Data Protection Act [Chapter 12:07] applies and you may complain to the Postal and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ) as the Data Protection Authority. If you are in the European Economic Area or the United Kingdom, you may complain to your local supervisory authority.',
        ],
      },
      {
        title: '13. Children',
        paragraphs: [
          'PeekaListing is not intended for children. You must be at least 18 years old to create an account, publish a listing, or transact through the marketplace. If we learn that an account belongs to someone under 18, we will close it and delete the associated personal information.',
        ],
      },
      {
        title: '14. Security',
        paragraphs: [
          'We protect information with database-level access rules, private file storage with short-lived signed access, encryption in transit, restricted administrative functions, and audit logging of administrative actions. Section 2 of the Data Protection Statement describes these controls in more detail.',
          'No system is completely secure. Use a unique password, protect your email account, and never share passwords, one-time codes, or identity documents in marketplace messages. Report anything suspicious through Contact Support.',
        ],
      },
      {
        title: '15. Changes to this policy',
        paragraphs: [
          'We will update this page when our practices change, and we will update the review date shown at the top. Where a change materially affects your rights, we will give notice in the application before it takes effect.',
        ],
      },
    ],
  },
  'data-protection': {
    title: 'Data Protection Statement',
    summary: 'The operating principles and concrete technical controls PeekaListing uses to protect marketplace data, and how to raise a data request or report an incident.',
    sections: [
      {
        title: '1. Protection principles',
        bullets: [
          'Collect only what a clear marketplace or safety purpose requires.',
          'Use information transparently and only for purposes compatible with why it was collected.',
          'Keep information accurate and no longer than reasonably necessary.',
          'Separate what is published from what is private by design, rather than by convention.',
          'Record decisions that affect a person so they can be reviewed.',
        ],
      },
      {
        title: '2. Technical controls',
        bullets: [
          'Row Level Security is enabled on every application table, so access is enforced by the database itself and not only by application code.',
          'All file storage buckets are private. Nothing is served from a public bucket. Media is delivered through short-lived signed links.',
          'Uploads are constrained by type and size: images must be JPEG, PNG, or WebP and at most 5 MB; Peek video must be MP4, QuickTime, or WebM and at most 250 MB.',
          'Precise location is stored in a separate, private table from the listing, so the public projection cannot accidentally expose an exact address.',
          'Privileged database functions run with a pinned search path and explicit permission grants, limiting what browser-facing roles may execute.',
          'Administrative capability is restricted, and administrative actions are written to an audit log recording the actor, the change, the reason, and the originating IP address.',
        ],
      },
      {
        title: '3. Deletion and lifecycle',
        paragraphs: [
          'Automated maintenance removes data that has passed its purpose: original Peek uploads are deleted after processing, orphaned media is cleaned up, and interaction events are deleted when their recorded expiry is reached.',
          'Deletion of an account is handled manually through support. Some records are retained after deletion where required for fraud prevention, legal claims, or audit integrity, and those records are minimised to what that purpose needs.',
        ],
      },
      {
        title: '4. Data requests',
        paragraphs: [
          'Requests to access, correct, delete, restrict, or export personal information can be submitted through Contact Support or the privacy contact address in the Privacy Policy. Each request is recorded, the requester is verified where appropriate, and a response is issued within the period required by applicable law.',
          'A self-service export and deletion workflow is planned but not yet built, and must not be represented to users as available until it is.',
        ],
      },
      {
        title: '5. Incidents',
        paragraphs: [
          'Suspected incidents are investigated, contained, and documented. Where an incident is likely to result in a risk to people, affected users and the relevant authority are notified within the timeframe applicable law requires. Under the Cyber and Data Protection Act this means notifying POTRAZ; under the GDPR it means notifying the lead supervisory authority within 72 hours of becoming aware.',
        ],
      },
      {
        title: '6. Processors',
        paragraphs: [
          'Service providers are listed in section 10 of the Privacy Policy. Before a provider is used in production it should be reviewed for security posture, data location, retention behaviour, its own subprocessors, and contractual protections. [TO BE COMPLETED: record the completed review and signed data-processing terms for each provider.]',
        ],
      },
      {
        title: '7. Scope of this statement',
        paragraphs: [
          'This statement is an operational baseline. It does not replace country-specific notices, consent wording, age rules, tax obligations, or legal advice, and it does not itself constitute legal advice. Local requirements must be reviewed before PeekaListing operates in an additional country.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    summary: 'The rules for using PeekaListing: your account, what you may publish, how transactions work, and the limits of our responsibility.',
    sections: [
      {
        title: '1. Agreement and operator',
        paragraphs: [
          'These terms are an agreement between you and [TO BE COMPLETED: operator legal name], registered at [TO BE COMPLETED: registered address], which operates PeekaListing. By using PeekaListing you accept these terms. If you do not accept them, do not use the service.',
          'These terms are governed by the laws of Zimbabwe, and the courts of Zimbabwe have jurisdiction over disputes arising from them. This does not remove any protection available to you under the mandatory law of the country where you live.',
        ],
      },
      {
        title: '2. Our role in the marketplace',
        paragraphs: [
          'PeekaListing provides tools to discover, advertise, evaluate, and make contact. PeekaListing is not the buyer, the seller, an agent, a broker, an insurer, an escrow provider, a payment processor, or a guarantor in any transaction, and does not take custody of goods or funds.',
          'PeekaListing does not verify the accuracy of listings, the condition or ownership of items, or the identity of every user. Verified status, where shown, means a document check was performed at a point in time. It is not a guarantee of honesty, quality, solvency, or performance.',
          'You are responsible for deciding whether an offer and a counterparty are suitable, and for meeting any legal obligations that apply to your own dealings, including licensing, tax, and consumer-protection requirements.',
        ],
      },
      {
        title: '3. Eligibility and accounts',
        bullets: [
          'You must be at least 18 years old and able to enter into a binding contract.',
          'Provide accurate registration information and keep it current.',
          'Keep your credentials secure. You are responsible for activity under your account until you tell us it is compromised.',
          'Hold one account for yourself, or for an organisation you are authorised to represent.',
          'Do not sell, rent, transfer, or share an account, impersonate another person or business, or create a new account to evade a restriction.',
          'We may restrict, suspend, or close accounts that create safety, legal, fraud, or platform-integrity risks.',
        ],
      },
      {
        title: '4. What you may publish',
        bullets: [
          'Advertise only goods, property, vehicles, machinery, or services you may lawfully offer and are entitled to sell.',
          'Use accurate titles, prices, categories, locations, images, descriptions, and contact details, and disclose material defects.',
          'Use your own images, or images you have the right to use. Do not upload someone else’s photographs or a manufacturer’s marketing images as if they showed your item.',
          'Remove or update an offer promptly once it is no longer available.',
          'Do not scrape the service, send spam, manipulate search ranking, inflate engagement, or publish duplicate listings for unfair visibility.',
        ],
      },
      {
        title: '5. Prohibited items and conduct',
        bullets: [
          'Stolen, counterfeit, or illegally obtained goods, and anything you cannot lawfully transfer.',
          'Firearms, ammunition, explosives, and controlled weapons, except where you hold every licence the law requires and the sale is lawful.',
          'Illegal drugs, drug paraphernalia, and unapproved or prescription-only medicines.',
          'Protected wildlife, ivory, and products whose trade is restricted by conservation law.',
          'Human remains, organs, and bodily fluids.',
          'Sexual services, sexual content, and any material involving minors.',
          'Government identity documents, passports, licences, academic certificates, and forged or fraudulent documents of any kind.',
          'Stolen credentials, payment-card data, personal databases, hacking tools, and services designed to gain unauthorised access.',
          'Recalled, unsafe, or hazardous goods, and items whose sale requires a licence you do not hold.',
          'Pyramid schemes, money-transfer offers, unlicensed financial services, and offers whose main purpose is to move funds rather than trade goods.',
          'Requests for passwords, one-time codes, unnecessary identity documents, or untraceable advance payments.',
        ],
      },
      {
        title: '6. Transactions and safety',
        paragraphs: [
          'Transactions are arranged directly between users. Inspect before you pay, confirm ownership and authority to sell, keep records, and use traceable payment and communication methods. Never send money merely because a listing appears on PeekaListing.',
          'Meet in public places where possible, tell someone where you are going, and take particular care with high-value, regulated, or remotely arranged transactions. Seek independent professional advice where the amount or the risk justifies it.',
          'Payment, escrow, and subscription features are not currently offered through PeekaListing. Any funds you exchange are exchanged outside the platform and at your own risk.',
        ],
      },
      {
        title: '7. Your content and the licence you grant',
        paragraphs: [
          'You keep ownership of the content you submit. You grant PeekaListing a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, resize, transcode, display, and distribute that content for the purpose of operating and promoting the marketplace. For video, this expressly includes processing it into playback formats and generating thumbnails.',
          'This licence lasts while your content is published and for the limited retention period afterwards described in the Privacy Policy. You confirm that you hold the rights necessary to grant it.',
          'If you believe content on PeekaListing infringes your rights, contact us through Contact Support with enough detail to identify the content and your claim.',
        ],
      },
      {
        title: '8. Moderation and enforcement',
        paragraphs: [
          'PeekaListing may review, limit, reject, or remove content, and may restrict or close accounts, where these terms or the Community and Marketplace Rules are breached or where there is risk to users or the service. Uploaded video is reviewed before it is shown publicly.',
          'We aim to act proportionately and to record the reason for a decision. If you believe a decision about your account or content was wrong, you may ask for it to be reviewed through Contact Support.',
        ],
      },
      {
        title: '9. Availability and liability',
        paragraphs: [
          'PeekaListing is provided on an as-is and as-available basis. We do not guarantee uninterrupted availability, that listings are accurate, that a counterparty will perform, or that the service is fit for a particular purpose.',
          'To the fullest extent permitted by law, PeekaListing is not liable for indirect or consequential loss, loss of profit, loss of data, or loss arising from a transaction or dealing between users. Nothing in these terms excludes liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence, or for fraud.',
          '[TO BE COMPLETED: confirm whether an aggregate liability cap is to be stated, and its amount, with legal advice.]',
        ],
      },
      {
        title: '10. Disputes',
        paragraphs: [
          'Disputes between users about a transaction are between those users. PeekaListing is not an arbitrator and cannot compel a refund, a delivery, or a return.',
          'If you have a dispute with PeekaListing itself, contact us first through Contact Support so we can try to resolve it directly. If it cannot be resolved within a reasonable period, it may be referred to the courts of Zimbabwe. [TO BE COMPLETED: confirm whether a mediation or arbitration step should precede litigation.]',
        ],
      },
      {
        title: '11. Changes and contact',
        paragraphs: [
          'We may update these terms as the service develops. Material changes will be notified in the application before they take effect, and the review date at the top of this page will be updated. Continuing to use PeekaListing after a change takes effect means you accept the updated terms.',
          'Questions about these terms may be submitted through Contact Support.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    summary: 'PeekaListing does not use tracking or advertising cookies. This page explains the browser storage it does use, and why.',
    sections: [
      {
        title: '1. PeekaListing uses browser storage rather than tracking cookies',
        paragraphs: [
          'PeekaListing does not set advertising cookies, does not use cross-site tracking pixels, and does not share browsing behaviour with advertising networks.',
          'Instead the application uses your browser’s own local and session storage to keep you signed in and to remember your preferences. Unlike cookies, these values are not transmitted with every request to the server; they stay in your browser and are read by the application when it loads.',
          'Our hosting and infrastructure providers may set strictly necessary cookies of their own to route requests and protect the service from abuse.',
        ],
      },
      {
        title: '2. Essential storage',
        bullets: [
          'Your authentication session, stored by our authentication provider so that you stay signed in between visits. Clearing it signs you out.',
          'A short-lived value used only while you are completing a password-recovery flow.',
        ],
      },
      {
        title: '3. Preference storage',
        bullets: [
          'Your light or dark theme choice.',
          'Your most recent searches, so they can be offered back to you as suggestions.',
          'The location you last browsed from, so results stay relevant between visits.',
          'Whether you chose to show prices on the map view.',
        ],
      },
      {
        title: '4. Measurement storage',
        paragraphs: [
          'If you are not signed in, PeekaListing generates a random session identifier and keeps it in session storage for the current browser tab. It is attached to interaction events -- such as viewing a listing or watching a Peek -- so that recommendations and popularity ordering work for visitors without an account.',
          'This identifier is random. It is not derived from your device, is not shared with third parties, is not used to build an advertising profile, and is discarded when you close the tab.',
        ],
      },
      {
        title: '5. Managing your choices',
        paragraphs: [
          'You can clear browser storage or block cookies at any time through your browser settings. Doing so will sign you out and reset your saved preferences, and some account features will not work without essential storage.',
          'You can turn off personalised recommendations in the application without clearing anything. See section 8 of the Privacy Policy.',
          'If PeekaListing ever introduces non-essential analytics or marketing technology, it will be described here and placed behind a consent choice before it is switched on.',
        ],
      },
    ],
  },
  'community-guidelines': {
    title: 'Community and Marketplace Rules',
    summary: 'The behaviour and content standards that keep PeekaListing useful, honest, and safer for everyone.',
    sections: [
      {
        title: 'Be accurate',
        paragraphs: [
          'Describe what you are actually offering. Use current photographs of the real item, a realistic price, the correct category and location, and disclose important defects, damage, or conditions of sale.',
          'Do not manufacture urgency, invent reviews or credentials, advertise stock you do not have, or use a low headline price to attract contacts for a different offer.',
        ],
      },
      {
        title: 'Be respectful',
        paragraphs: [
          'Do not threaten, harass, discriminate against, impersonate, or exploit anyone, and do not keep contacting someone who has asked you to stop.',
          'Marketplace messages are for genuine buyer-to-seller communication about an offer. Do not use them for bulk marketing, recruitment, or unrelated solicitation.',
        ],
      },
      {
        title: 'Keep transactions lawful and safe',
        paragraphs: [
          'Do not advertise anything on the prohibited list in section 5 of the Terms of Use, and do not offer regulated goods or services without the permissions the law requires.',
          'Never ask another user for a password, a one-time verification code, or an untraceable advance payment. Legitimate buyers and sellers do not need these, and any request for them should be reported.',
        ],
      },
      {
        title: 'Respect other people’s privacy',
        paragraphs: [
          'Do not publish another person’s address, phone number, identity document, or photograph without their agreement. When you upload a Peek, be aware of who and what is visible in the frame, including neighbours, number plates, and documents.',
          'Do not share private messages or a counterparty’s contact details publicly.',
        ],
      },
      {
        title: 'Report responsibly',
        paragraphs: [
          'Use the reporting tools for genuine safety, fraud, content, and conduct concerns, and include specific facts so the report can be assessed.',
          'Do not use reports as a competitive tactic or to continue a personal disagreement. Repeated bad-faith reporting is itself a breach of these rules.',
        ],
      },
      {
        title: 'Enforcement',
        paragraphs: [
          'Depending on severity and history, PeekaListing may edit or remove content, limit features, suspend or close an account, preserve evidence, or refer a matter to the appropriate authorities.',
          'Decisions should be proportionate and recorded. If you believe a decision about you was wrong, you may ask for it to be reviewed through Contact Support.',
        ],
      },
    ],
  },
};
