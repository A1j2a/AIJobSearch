export function cleanPdfTextStream(text: string): string {
  if (!text) return '';

  let clean = text
    .replace(/sRGB IEC[0-9.-]+/gi, '')
    .replace(/http:\/\/www\.color\.org[^\s]*/gi, '')
    .replace(/Adobe Identity/gi, '')
    .replace(/DAGh[a-zA-Z0-9,/_-]+/g, '')
    .replace(/D:[0-9+']+/g, '')
    .replace(/en-GB/gi, '');

  const tokens = clean.split(/\s+/);
  const validTokens: string[] = [];

  for (const t of tokens) {
    if (!t) continue;
    if (t.length === 1 && !['c', 'r', 'a', 'i', '&', '|', '+'].includes(t.toLowerCase())) {
      continue;
    }
    if (/[\^%\$\{\}\[\]\<\>\~#*]/.test(t) && !t.includes('c++') && !t.includes('c#')) {
      continue;
    }
    validTokens.push(t);
  }

  let result = validTokens.join(' ');

  const words = result.split(/\s+/);
  const dedupWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const curr = words[i];
    const prev = dedupWords[dedupWords.length - 1];
    if (prev && curr.toLowerCase() === prev.toLowerCase() && !['react', 'native'].includes(curr.toLowerCase())) {
      continue;
    }
    dedupWords.push(curr);
  }

  result = dedupWords.join(' ');
  result = result.replace(/\b([A-Za-z0-9\s.+]{4,30})\s+\1\b/gi, '$1');

  return result.trim();
}

const sample = `CONTACT CONTACT SKILLS SKILLS LANGUAGES LANGUAGES 7400525311 ajpatidar481@gmail.com Ahmedabad, Gujarat Linkedin Project Management React native JavaScript TypeScript REST API Firebase Git Redux Async Storage Shopify Team Collaboration Supabase Intermediate Fluent AJAY PATIDAR AJAY PATIDAR REACT NATIVE DEVELOPER REACT NATIVE DEVELOPER WORK EXPERIENCE WORK EXPERIENCE PROFILE PROFILE AUGUST/2024 - PRESENT Dynamic dreamz - shopify, shopify plus, website design agency React native & Shopify Appmaker DayNightCare, YouMayAlsoLike, KeyBenefits POPins, Kwickpass Checkout, Wizzy Strengthened React Native CLI and Expo workflows for managing and deploying cross-platform builds. EDUCATION Master of Computer Applications. Bachelor of Science. Hyperlink Infosystem, Ahmedabad, Gujarat JAN/2023 - FEB/2024 Develop cross-platform mobile apps using React Native, collaborating on backend integration and ensuring code quality. Implement UI designs, create reusable components, and manage state efficiently using Redux or Context API.`;

console.log('CLEANED CANVA TEXT PREVIEW:\n', cleanPdfTextStream(sample));
