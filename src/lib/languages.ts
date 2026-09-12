export function detectFileExtension(language: string): string {
  const l = language.toLowerCase().trim();

  if (l.includes('c++') || l.includes('cpp') || l.includes('g++') || l.includes('clang++')) {
    return 'cpp';
  }
  if (l.includes('python') || l.includes('pypy')) {
    return 'py';
  }
  if (l.includes('java')) {
    return 'java';
  }
  if (l.includes('rust')) {
    return 'rs';
  }
  if (l.includes('golang') || l === 'go' || l.includes('go ')) {
    return 'go';
  }
  if (l.includes('kotlin')) {
    return 'kt';
  }
  if (l.includes('c#') || l.includes('csharp')) {
    return 'cs';
  }
  if (l.includes('javascript') || l.includes('node')) {
    return 'js';
  }
  if (l.includes('typescript')) {
    return 'ts';
  }
  if (l.includes('pascal')) {
    return 'pas';
  }
  if (l.includes('ruby')) {
    return 'rb';
  }
  if (l.includes('swift')) {
    return 'swift';
  }
  if (l === 'c' || l.startsWith('c ') || l.includes('gcc') || l.includes('clang')) {
    return 'c';
  }

  return 'txt';
}
