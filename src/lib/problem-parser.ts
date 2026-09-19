import { htmlToMarkdown } from './html-to-markdown';

export function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&le;/g, '<=')
    .replace(/&ge;/g, '>=')
    .replace(/&ne;/g, '!=');
}

export function extractCodeforcesStatement(statementEl: Element): string {
  const clone = statementEl.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('#cpbase-cf-sync-container, [id^="cpbase-"]').forEach((el) => el.remove());
  clone.querySelector('.header')?.remove();
  clone.querySelectorAll('.input-copy, .output-copy, .copy-button, .clipboard-copy').forEach((el) => el.remove());
  clone.querySelectorAll('.MJX_Assistive_MathML, .MathJax_Preview, .MathJax_Processing').forEach((el) => el.remove());

  clone.querySelectorAll('script[type="math/tex"]').forEach((script) => {
    const formula = script.textContent?.trim() || '';
    const textNode = document.createTextNode(`$${formula}$`);
    script.parentNode?.replaceChild(textNode, script);
  });

  clone.querySelectorAll('.MathJax').forEach((mathEl) => {
    const formula = mathEl.textContent?.trim() || '';
    if (formula) {
      const textNode = document.createTextNode(`$${formula}$`);
      mathEl.parentNode?.replaceChild(textNode, mathEl);
    } else {
      mathEl.remove();
    }
  });

  const sampleTestsContainer = clone.querySelector('.sample-tests');
  let sampleTestsMarkdown = '';

  if (sampleTestsContainer) {
    const sectionTitle = sampleTestsContainer.querySelector('.section-title')?.textContent?.trim() || 'Examples';
    const sampleTests = sampleTestsContainer.querySelectorAll('.sample-test');
    const examplesParts: string[] = [`## ${sectionTitle}\n`];

    sampleTests.forEach((test, idx) => {
      const inputs = test.querySelectorAll('.input');
      const outputs = test.querySelectorAll('.output');
      const count = Math.max(inputs.length, outputs.length);

      for (let i = 0; i < count; i++) {
        if (count > 1 || sampleTests.length > 1) {
          examplesParts.push(`### Example ${idx + 1}${count > 1 ? `.${i + 1}` : ''}\n`);
        }

        const inputEl = inputs[i];
        if (inputEl) {
          const pre = inputEl.querySelector('pre');
          let inputText = '';
          if (pre) {
            const lineEls = pre.querySelectorAll('.test-example-line');
            if (lineEls.length > 0) {
              inputText = Array.from(lineEls)
                .map((l) => l.textContent || '')
                .join('\n');
            } else {
              inputText = pre.innerHTML
                .replace(/<div[^>]*>/gi, '')
                .replace(/<\/div>/gi, '\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '');
              inputText = decodeEntities(inputText);
            }
          }
          examplesParts.push('**Input**');
          examplesParts.push('```text');
          examplesParts.push(inputText.trim());
          examplesParts.push('```\n');
        }

        const outputEl = outputs[i];
        if (outputEl) {
          const pre = outputEl.querySelector('pre');
          let outputText = '';
          if (pre) {
            const lineEls = pre.querySelectorAll('.test-example-line');
            if (lineEls.length > 0) {
              outputText = Array.from(lineEls)
                .map((l) => l.textContent || '')
                .join('\n');
            } else {
              outputText = pre.innerHTML
                .replace(/<div[^>]*>/gi, '')
                .replace(/<\/div>/gi, '\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '');
              outputText = decodeEntities(outputText);
            }
          }
          examplesParts.push('**Output**');
          examplesParts.push('```text');
          examplesParts.push(outputText.trim());
          examplesParts.push('```\n');
        }
      }
    });

    sampleTestsMarkdown = examplesParts.join('\n');
    sampleTestsContainer.remove();
  }

  const inputSpec = clone.querySelector('.input-specification');
  let inputSpecMarkdown = '';
  if (inputSpec) {
    inputSpec.querySelector('.section-title')?.remove();
    const raw = htmlToMarkdown(inputSpec.innerHTML).trim();
    if (raw) {
      inputSpecMarkdown = `### Input\n\n${raw}`;
    }
    inputSpec.remove();
  }

  const outputSpec = clone.querySelector('.output-specification');
  let outputSpecMarkdown = '';
  if (outputSpec) {
    outputSpec.querySelector('.section-title')?.remove();
    const raw = htmlToMarkdown(outputSpec.innerHTML).trim();
    if (raw) {
      outputSpecMarkdown = `### Output\n\n${raw}`;
    }
    outputSpec.remove();
  }

  const noteSpec = clone.querySelector('.note');
  let noteSpecMarkdown = '';
  if (noteSpec) {
    noteSpec.querySelector('.section-title')?.remove();
    const raw = htmlToMarkdown(noteSpec.innerHTML).trim();
    if (raw) {
      noteSpecMarkdown = `## Note\n\n${raw}`;
    }
    noteSpec.remove();
  }

  const descriptionMarkdown = htmlToMarkdown(clone.innerHTML).trim();

  const sections: string[] = [];
  if (descriptionMarkdown) sections.push(descriptionMarkdown);
  if (inputSpecMarkdown) sections.push(inputSpecMarkdown);
  if (outputSpecMarkdown) sections.push(outputSpecMarkdown);
  if (sampleTestsMarkdown) sections.push(sampleTestsMarkdown);
  if (noteSpecMarkdown) sections.push(noteSpecMarkdown);

  return sections.join('\n\n').trim();
}

export function extractTLXStatement(contentEl: Element): string {
  const clone = contentEl.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('#cpbase-tlx-sync-btn, [id^="cpbase-"]').forEach((el) => el.remove());
  clone.querySelectorAll('.katex-html, .MJX_Assistive_MathML').forEach((el) => el.remove());
  clone.querySelectorAll('button, .copy-btn, .copy-button').forEach((el) => el.remove());

  return htmlToMarkdown(clone.innerHTML).trim();
}
