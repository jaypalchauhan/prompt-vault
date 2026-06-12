/** Starter prompts seeded on first run. Two use {{variables}} to show the feature. */
export const SAMPLE_PROMPTS = [
  {
    id: 'sample-explain',
    title: 'Explain like I am five',
    body: 'Explain {{topic}} in simple words, as if I were five years old. Use a short analogy from everyday life.',
    tags: ['learning'],
    uses: 0,
  },
  {
    id: 'sample-review',
    title: 'Code review',
    body: 'Review the following code. Point out bugs, security issues and readability problems, in order of importance. Suggest a fix for each:\n\n',
    tags: ['coding'],
    uses: 0,
  },
  {
    id: 'sample-summarize',
    title: 'Summarize in bullets',
    body: 'Summarize the following text in {{count}} short bullet points. Keep only the key facts:\n\n',
    tags: ['writing'],
    uses: 0,
  },
  {
    id: 'sample-email',
    title: 'Professional email',
    body: 'Rewrite the following text as a short, polite, professional email. Keep it under 120 words:\n\n',
    tags: ['writing'],
    uses: 0,
  },
];
