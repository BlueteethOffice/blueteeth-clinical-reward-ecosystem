/**
 * JsonLd Component — Google Structured Data (Schema.org)
 * Rich snippets ke liye — Google search mein better display hota hai
 */

interface JsonLdProps {
  data: Record<string, unknown>;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── Pre-built schema helpers ──────────────────────────────────────

export const OrganizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Blueteeth Associate Portal',
  url: 'https://blueteeth-associate-reward-ecosystem.vercel.app',
  logo: 'https://blueteeth-associate-reward-ecosystem.vercel.app/logo.png',
  description:
    "India's premier associate referral portal. Partners earn reward points for referred cases and redeem as real cash.",
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: ['English', 'Hindi'],
  },
  sameAs: [],
};

export const WebsiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Blueteeth Associate Portal',
  url: 'https://blueteeth-associate-reward-ecosystem.vercel.app',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://blueteeth-associate-reward-ecosystem.vercel.app/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export const MedicalWebpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'MedicalWebPage',
  name: 'Blueteeth | Associate Reward & Referral System',
  url: 'https://blueteeth-associate-reward-ecosystem.vercel.app',
  description:
    "India's premier referral reward portal for partners. Earn reward points on case referrals and redeem as real monetary payouts.",
  medicalAudience: {
    '@type': 'MedicalAudience',
    audienceType: 'Associate',
  },
  about: {
    '@type': 'MedicalCondition',
    name: 'Case Referral Management',
  },
};
