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
  name: 'Blueteeth Clinical Portal',
  url: 'https://blueteeth.vercel.app',
  logo: 'https://blueteeth.vercel.app/logo.png',
  description:
    "India's premier clinical reward portal. Doctors earn B-Points for patient cases and redeem as real cash.",
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
  name: 'Blueteeth Clinical Portal',
  url: 'https://blueteeth.vercel.app',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://blueteeth.vercel.app/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export const MedicalWebpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'MedicalWebPage',
  name: 'Blueteeth | Doctor B-Points Clinical Reward System',
  url: 'https://blueteeth.vercel.app',
  description:
    "India's premier clinical reward portal for qualified doctors. Earn B-Points on case submissions and redeem as real monetary payouts.",
  medicalAudience: {
    '@type': 'MedicalAudience',
    audienceType: 'Clinician',
  },
  about: {
    '@type': 'MedicalCondition',
    name: 'Clinical Case Management',
  },
};
