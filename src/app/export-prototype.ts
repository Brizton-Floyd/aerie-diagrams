// Disposable export comparison: three views on the existing route, ?export-prototype&variant=A|B|C.
import assets from './export-prototype.assets.json';
import './export-prototype.css';

export function showExportPrototype(root: HTMLElement) {
  let variant = new URLSearchParams(location.search).get('variant') || 'B';
  let audience: 'exec' | 'engineer' = 'exec';
  let step = 1;
  const titles: Record<string, string> = {
    A: 'Compare export scope',
    B: 'Static document',
    C: 'Interactive flow',
  };
  const data = () => assets['big-picture'][audience];
  const drawing = (view: 'big-picture' | 'inside' = 'big-picture') => assets[view][audience].svg;
  const legend = () =>
    data()
      .steps.map(
        (s) =>
          `<section class="xp-explanation"><span class="xp-number">${s.number}</span><div><h3>${s.sentence}</h3><p>${s.about ?? s.caption}</p></div></section>`,
      )
      .join('');
  function pageHeader(title: string, subtitle: string) {
    return `<div class="xp-doc-heading"><div class="xp-eyebrow">${audience === 'exec' ? 'PLAIN WORDING' : 'TECHNICAL WORDING'}</div><h2>${title}</h2><p>${subtitle}</p></div>`;
  }
  function render() {
    root.className = 'xp-root';
    root.innerHTML = `<header class="xp-app-header"><b>◈ Aerie</b><span>How Aerie works</span><span class="xp-prototype">Disposable export prototype</span></header>
    <div class="xp-toolbar"><div><div class="xp-eyebrow">EXPORT EXPLORATION</div><h1>${titles[variant]}</h1></div><div class="xp-wording"><span>Wording</span><button data-audience="exec" aria-pressed="${audience === 'exec'}">Plain</button><button data-audience="engineer" aria-pressed="${audience === 'engineer'}">Technical</button></div></div>
    <main>${variant === 'A' ? scope() : variant === 'B' ? staticPage() : interactivePage()}</main>
    <nav class="xp-switcher" aria-label="Prototype variants"><button data-cycle="-1" aria-label="Previous prototype">←</button>${Object.entries(
      titles,
    )
      .map(
        ([key, value]) =>
          `<button data-variant="${key}" aria-current="${variant === key ? 'page' : 'false'}">${key} · ${value}</button>`,
      )
      .join('')}<button data-cycle="1" aria-label="Next prototype">→</button></nav>`;
    root.querySelectorAll<HTMLElement>('[data-audience]').forEach(
      (b) =>
        (b.onclick = () => {
          audience = b.dataset['audience'] as typeof audience;
          render();
        }),
    );
    root
      .querySelectorAll<HTMLElement>('[data-variant]')
      .forEach((b) => (b.onclick = () => switchTo(b.dataset['variant']!)));
    root
      .querySelectorAll<HTMLElement>('[data-cycle]')
      .forEach((b) => (b.onclick = () => cycle(Number(b.dataset['cycle']))));
    root
      .querySelectorAll<HTMLElement>('[data-open]')
      .forEach((b) => (b.onclick = () => switchTo(b.dataset['open']!)));
    root.querySelectorAll<HTMLElement>('[data-select-step]').forEach(
      (b) =>
        (b.onclick = () => {
          step = Number(b.dataset['selectStep']);
          render();
        }),
    );
    if (variant === 'C') {
      root.querySelectorAll<SVGElement>('.overview-step').forEach((b) => {
        const select = () => {
          step = Number(b.dataset['step']);
          render();
        };
        b.onclick = select;
        b.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select();
          }
        };
      });
      root.querySelectorAll<SVGElement>('.xp-live-diagram .step').forEach((b) => {
        b.style.opacity = Number(b.dataset['step']) === step ? '1' : '.16';
      });
    } else {
      root.querySelectorAll<SVGElement>('[tabindex]').forEach((b) => {
        b.removeAttribute('tabindex');
        b.removeAttribute('role');
      });
    }
    document.documentElement.dataset['variant'] = variant;
    document.documentElement.dataset['audience'] = audience;
  }
  function scope() {
    return `<p class="xp-intro">These options change <b>how many views you export</b>. In both, every nested box in each chosen view is open.</p><div class="xp-scope-grid">
    <article class="xp-option"><div class="xp-option-heading"><span class="xp-letter">1</span><div><h2>Current view, fully expanded</h2><p>One view becomes one complete diagram.</p></div></div><div class="xp-paper xp-single"><div class="xp-mini-title">Big picture <span>1 exported diagram</span></div><div class="xp-thumbnail">${drawing()}</div><div class="xp-mini-legend">① Write the model　② Check its meaning<br>③ Build the picture　④ Explore the diagram</div></div><p class="xp-option-note">The parent containers stay visible. Their children and deeper internals appear inside them. The other views are not added.</p><button class="xp-primary" data-open="B">See the complete static example →</button></article>
    <article class="xp-option"><div class="xp-option-heading"><span class="xp-letter">2</span><div><h2>Every view in a document</h2><p>Several diagrams become a document you read in order.</p></div></div><div class="xp-book"><div class="xp-paper xp-book-page"><div class="xp-mini-title">Page 1 · Big picture</div><div class="xp-thumbnail">${drawing()}</div><div class="xp-mini-legend">Numbered main flow + all explanations</div></div><div class="xp-paper xp-book-page"><div class="xp-mini-title">Page 2 · Inside Aerie</div><div class="xp-thumbnail">${drawing('inside')}</div><div class="xp-mini-legend">Another named view + its context</div></div></div><p class="xp-option-note">Each view gets its own section. This adds coverage, not more expansion. In this sample the two fully expanded views share the same elements, so they can repeat information.</p><div class="xp-neutral-note">Useful for a reference pack; longer than a single diagram.</div></article></div>
    <div class="xp-bottom-note"><b>Two separate choices:</b> one view or many views · static or interactive. Either scope can use plain or technical wording.</div>`;
  }
  function staticPage() {
    return `<p class="xp-intro">A Confluence-style page containing <b>one static export</b>. The diagram and every stage explanation are inside the same white boundary.</p><div class="xp-wiki"><div class="xp-wiki-bar">Team knowledge <span>/</span> Architecture <span>/</span> Diagram <b>Static image concept</b></div><article class="xp-document">${pageHeader('Big picture, fully expanded', 'Create a diagram · all nested elements visible · all four stages included')}<div class="xp-export-content"><div class="xp-full-diagram">${drawing()}</div><aside class="xp-all-explanations"><div class="xp-eyebrow">FOLLOW THE NUMBERS</div>${legend()}<div class="xp-caption-note">These explanations are included in the export itself. Nothing needs a hover or a click to be read.</div></aside></div><footer class="xp-export-footer">Big picture · ${audience === 'exec' ? 'Plain' : 'Technical'} · Fully expanded</footer></article></div><div class="xp-bottom-note"><b>What the reader does:</b> reads the entire diagram and its explanations. PNG is the portable inline-image candidate; a PDF could provide a document alternative.</div>`;
  }
  function interactivePage() {
    const selected = data().steps[step - 1]!;
    return `<p class="xp-intro">An <b>interactive embed concept</b>. Try the numbered buttons or click a number on the diagram. This demonstrates the experience, not a working Confluence integration.</p><div class="xp-wiki"><div class="xp-wiki-bar">Team knowledge <span>/</span> Architecture <span>/</span> Diagram <b>Interactive embed concept</b></div><article class="xp-document">${pageHeader('Explore how a diagram is created', 'Every nested box is open. Select a stage to highlight its path.')}<div class="xp-export-content"><div class="xp-full-diagram xp-live-diagram">${drawing()}</div><aside class="xp-live-panel"><div class="xp-eyebrow">CHOOSE A STAGE</div><div class="xp-stage-buttons">${data()
      .steps.map(
        (s) =>
          `<button data-select-step="${s.number}" aria-pressed="${step === s.number}">${s.number}</button>`,
      )
      .join(
        '',
      )}</div><div class="xp-current-step"><span class="xp-number">${step}</span><h3>${selected.sentence}</h3><p>${selected.about ?? selected.caption}</p></div><div class="xp-live-actions"><button data-select-step="${Math.max(1, step - 1)}" ${step === 1 ? 'disabled' : ''}>← Back</button><button data-select-step="${Math.min(4, step + 1)}" ${step === 4 ? 'disabled' : ''}>Next →</button></div><div class="xp-caption-note">This version reveals one explanation at a time. A reader needs an active viewer, rather than just an image attachment.</div></aside></div></article></div><div class="xp-bottom-note"><b>What the reader does:</b> follows a flow step by step. Hosting, embed permissions and access would need a separate decision.</div>`;
  }
  function switchTo(value: string) {
    variant = value;
    const url = new URL(location.href);
    url.searchParams.set('variant', value);
    history.replaceState(null, '', url);
    render();
    window.scrollTo(0, 0);
  }
  function cycle(delta: number) {
    const keys = ['A', 'B', 'C'];
    switchTo(keys[(keys.indexOf(variant) + delta + 3) % 3]!);
  }
  window.addEventListener('keydown', (event) => {
    if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      cycle(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  render();
}
