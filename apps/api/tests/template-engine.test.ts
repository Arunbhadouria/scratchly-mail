import { describe, it, expect } from 'vitest';
import {
  renderTemplatePlaceholders,
  sanitizeHtmlContent,
  escapeHtml,
} from '@scratchly/shared';

describe('Template Substitution & Sanitization Engine', () => {
  it('should substitute {{placeholders}} with provided variables', () => {
    const template = 'Hello {{first_name}}, welcome to {{company}}!';
    const variables = { first_name: 'Alex', company: 'Acme Corp' };

    const rendered = renderTemplatePlaceholders(template, variables);
    expect(rendered).toBe('Hello Alex, welcome to Acme Corp!');
  });

  it('should escape dangerous HTML characters in user variables by default', () => {
    const template = 'Hi {{first_name}}';
    const variables = { first_name: '<script>alert(1)</script>' };

    const rendered = renderTemplatePlaceholders(template, variables, { escapeValues: true });
    expect(rendered).toBe('Hi &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('should strip script tags and javascript: URIs from raw template HTML', () => {
    const dangerousHtml = `
      <div>
        <h1>Welcome</h1>
        <script>window.stealCookies();</script>
        <a href="javascript:alert('xss')">Click Here</a>
      </div>
    `;

    const sanitized = sanitizeHtmlContent(dangerousHtml);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('</script>');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).toContain('blocked-protocol:');
  });

  it('should handle missing placeholders gracefully without errors', () => {
    const template = 'Hello {{first_name}}, your role is {{role}}';
    const variables = { first_name: 'Jordan' };

    const rendered = renderTemplatePlaceholders(template, variables);
    expect(rendered).toBe('Hello Jordan, your role is ');
  });
});
