export function deteksiEkstensiFile(bahasa?: string, kodeSumber?: string): string {
  if (bahasa) {
    const namaBahasa = bahasa.toLowerCase().trim();

    if (
      namaBahasa.includes('c++') ||
      namaBahasa.includes('cpp') ||
      namaBahasa.includes('g++') ||
      namaBahasa.includes('clang++')
    ) {
      return 'cpp';
    }
    if (namaBahasa.includes('python') || namaBahasa.includes('pypy')) {
      return 'py';
    }
    if (namaBahasa.includes('java') && !namaBahasa.includes('javascript')) {
      return 'java';
    }
    if (namaBahasa.includes('rust')) {
      return 'rs';
    }
    if (
      namaBahasa.includes('golang') ||
      namaBahasa === 'go' ||
      namaBahasa.startsWith('go ') ||
      namaBahasa.includes('go (')
    ) {
      return 'go';
    }
    if (namaBahasa.includes('kotlin')) {
      return 'kt';
    }
    if (namaBahasa.includes('c#') || namaBahasa.includes('csharp')) {
      return 'cs';
    }
    if (namaBahasa.includes('javascript') || namaBahasa.includes('node')) {
      return 'js';
    }
    if (namaBahasa.includes('typescript')) {
      return 'ts';
    }
    if (namaBahasa.includes('pascal') || namaBahasa.includes('fpc')) {
      return 'pas';
    }
    if (namaBahasa.includes('ruby')) {
      return 'rb';
    }
    if (namaBahasa.includes('swift')) {
      return 'swift';
    }
    if (
      namaBahasa === 'c' ||
      namaBahasa.startsWith('c ') ||
      namaBahasa.includes('gcc') ||
      namaBahasa.includes('clang')
    ) {
      return 'c';
    }
  }

  if (kodeSumber && kodeSumber.trim().length > 0) {
    const ekstensiDariSintaks = tebakEkstensiDariSintaks(kodeSumber);
    if (ekstensiDariSintaks) {
      return ekstensiDariSintaks;
    }
  }

  return 'txt';
}

export function tebakEkstensiDariSintaks(kode: string): string | null {
  const cuplikanTeks = kode.slice(0, 2000);

  if (
    cuplikanTeks.includes('#include') ||
    cuplikanTeks.includes('using namespace std') ||
    cuplikanTeks.includes('ios_base::sync_with_stdio') ||
    cuplikanTeks.includes('std::') ||
    /\bcin\s*>>/.test(cuplikanTeks) ||
    /\bcout\s*<</.test(cuplikanTeks)
  ) {
    return 'cpp';
  }

  if (
    cuplikanTeks.includes('public class ') ||
    cuplikanTeks.includes('import java.') ||
    cuplikanTeks.includes('System.out.println')
  ) {
    return 'java';
  }

  if (
    /^\s*(import|from)\s+[a-zA-Z0-9_]+/m.test(cuplikanTeks) ||
    /def\s+[a-zA-Z0-9_]+\s*\(.*?\):/.test(cuplikanTeks) ||
    cuplikanTeks.includes('sys.stdin') ||
    cuplikanTeks.includes('if __name__ ==')
  ) {
    return 'py';
  }

  if (
    cuplikanTeks.includes('fn main()') ||
    cuplikanTeks.includes('use std::') ||
    cuplikanTeks.includes('println!')
  ) {
    return 'rs';
  }

  if (
    cuplikanTeks.includes('package main') ||
    cuplikanTeks.includes('func main()')
  ) {
    return 'go';
  }

  if (
    cuplikanTeks.includes('fun main(') ||
    cuplikanTeks.includes('fun main()')
  ) {
    return 'kt';
  }

  if (
    cuplikanTeks.includes('using System;') ||
    cuplikanTeks.includes('Console.WriteLine')
  ) {
    return 'cs';
  }

  if (
    /\bprogram\s+[a-zA-Z0-9_]+;/i.test(cuplikanTeks) ||
    (/\bbegin\b/i.test(cuplikanTeks) && /\bend\./i.test(cuplikanTeks))
  ) {
    return 'pas';
  }

  if (
    cuplikanTeks.includes('#include <stdio.h>') ||
    cuplikanTeks.includes('printf(')
  ) {
    return 'c';
  }

  return null;
}

export const detectFileExtension = deteksiEkstensiFile;
