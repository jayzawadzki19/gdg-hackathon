import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(() => {
    pipe = new MarkdownPipe();
  });

  it('renders emphasis and strong text', () => {
    const html = pipe.transform('This is **bold** and *italic*.');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders lists', () => {
    const html = pipe.transform('- one\n- two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });

  it('renders fenced code blocks', () => {
    const html = pipe.transform('```ts\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('const x = 1;');
  });

  it('treats single newlines as line breaks (chat style)', () => {
    const html = pipe.transform('line one\nline two');
    expect(html).toContain('<br>');
  });

  it('returns an empty string for empty input', () => {
    expect(pipe.transform('')).toBe('');
  });
});
