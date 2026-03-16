import { describe, expect, it } from 'vitest';
import { getCliSystemPrompt } from '@/shared/prompts-cli';
import { getSystemPrompt } from '@/shared/prompts';

describe('getCliSystemPrompt', () => {
  it('should include the base identity and methodology', () => {
    const prompt = getCliSystemPrompt();
    expect(prompt).toContain('gh-admin');
    expect(prompt).toContain('3-D METHODOLOGY');
    expect(prompt).toContain('DECONSTRUCT');
    expect(prompt).toContain('DIAGNOSE');
    expect(prompt).toContain('DELIVER');
  });

  it('should use markdown tables instead of json-render', () => {
    const prompt = getCliSystemPrompt();
    expect(prompt).toContain('markdown table');
    expect(prompt).not.toContain('json-render Table component');
    expect(prompt).not.toContain('must be in a spec block');
  });

  it('should not include the json-render catalog prompt', () => {
    const webPrompt = getSystemPrompt();
    const cliPrompt = getCliSystemPrompt();

    // Web prompt includes json-render catalog instructions
    expect(webPrompt).toContain('spec');

    // CLI prompt should be shorter (no catalog)
    expect(cliPrompt.length).toBeLessThan(webPrompt.length);
  });

  it('should preserve error handling section', () => {
    const prompt = getCliSystemPrompt();
    expect(prompt).toContain('ERROR HANDLING');
    expect(prompt).toContain('Tool errors');
    expect(prompt).toContain('Rate limit errors');
  });

  it('should preserve tool parameter guidelines', () => {
    const prompt = getCliSystemPrompt();
    expect(prompt).toContain('TOOL PARAMETER GUIDELINES');
    expect(prompt).toContain('Omit optional fields');
  });

  it('should preserve scheduling section', () => {
    const prompt = getCliSystemPrompt();
    expect(prompt).toContain('SCHEDULING');
    expect(prompt).toContain('scheduleTask');
  });

  it('should include terminal-friendly formatting rules', () => {
    const prompt = getCliSystemPrompt();
    expect(prompt).toContain('terminal');
    expect(prompt).toContain('No spec blocks');
    expect(prompt).toContain('markdown table syntax');
  });
});
