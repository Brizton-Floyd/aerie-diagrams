// Disposable export comparison: three views on the existing route, ?export-prototype&variant=A|B|C.
import assets from './export-prototype.assets.json';
import './export-prototype.css';

export function showExportPrototype(root: HTMLElement) {
  let variant = new URLSearchParams(location.search).get('variant') || 'B';
  let audience: 'exec' | 'engineer' =
    new URLSearchParams(location.search).get('audience') === 'engineer' ? 'engineer' : 'exec';
  let includeReference = true;
  let step = 1;
  const titles: Record<string, string> = {
    A: 'Compare export scope',
    B: 'Static document',
    C: 'Interactive flow',
    D: 'Component reference',
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
    <main>${variant === 'A' ? scope() : variant === 'B' ? staticPage() : variant === 'D' ? referencePage() : interactivePage()}</main>
    <nav class="xp-switcher" aria-label="Prototype variants"><button data-cycle="-1" aria-label="Previous prototype">←</button>${Object.entries(
      titles,
    )
      .map(
        ([key, value]) =>
          `<button data-variant="${key}" aria-current="${variant === key ? 'page' : 'false'}">${key} · ${value}</button>`,
      )
      .join('')}<button data-cycle="1" aria-label="Next prototype">→</button></nav>`;
    root
      .querySelector<HTMLInputElement>('#xp-include-reference')
      ?.addEventListener('change', (event) => {
        includeReference = (event.target as HTMLInputElement).checked;
        render();
      });
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
  function referencePage() {
    const selected = data();
    const lists = (items: string[]) =>
      items.length
        ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`
        : '<p class="xp-muted">None in this view.</p>';
    const details = selected.steps
      .map(
        (stage) =>
          `<section class="xp-stage-detail"><div class="xp-stage-detail-head"><span class="xp-number">${stage.number}</span><div><div class="xp-eyebrow">STAGE ${stage.number} · DETAILED STEPS ${stage.from === stage.to ? stage.from : `${stage.from}-${stage.to}`}</div><h3>${stage.sentence}</h3><p>${stage.about ?? stage.caption}</p></div></div><ol class="xp-detailed-list">${selected.detailedSteps
            .filter((s) => s.number >= stage.from && s.number <= stage.to)
            .map(
              (s) =>
                `<li><span>Step ${s.number}</span><div><h4>${s.sentence}</h4><p>${s.about ?? s.caption}</p></div></li>`,
            )
            .join('')}</ol></section>`,
      )
      .join('');
    const componentCard = (component: (typeof selected.components)[number]) =>
      `<article class="xp-reference-card"><div class="xp-reference-card-title"><h4>${component.name}</h4>${component.tagline ? `<span>${component.tagline}</span>` : ''}</div><p>${component.about ?? component.tagline ?? 'No additional description is documented.'}</p>${component.technicalNote ? `<div class="xp-technical-note"><h5>Implementation responsibilities</h5><p>${component.technicalNote}</p></div>` : ''}${component.children.length ? `<div class="xp-reference-children"><b>Contains</b> ${component.children.join(' · ')}</div>` : ''}<div class="xp-connections"><div><h5>Incoming connections</h5>${lists(component.incoming)}</div><div><h5>Outgoing connections</h5>${lists(component.outgoing)}</div></div></article>`;
    const modelTools = selected.components.filter((c) =>
      ['meaning', 'lines', 'semantics'].includes(c.id),
    );
    const builder = selected.components.filter((c) =>
      ['picture', 'layout', 'renderer', 'viewer'].includes(c.id),
    );
    const other = selected.components.filter(
      (c) =>
        !['meaning', 'lines', 'semantics', 'picture', 'layout', 'renderer', 'viewer'].includes(
          c.id,
        ),
    );
    const reference = `<section id="xp-reference" class="xp-reference-section"><div class="xp-section-title"><span>03</span><div><div class="xp-eyebrow">OPTIONAL COMPONENT REFERENCE</div><h2>Architecture, component by component</h2><p>Descriptions and connections, grouped by their parent component.</p></div></div><div class="xp-reference-group" id="xp-reference-model-tools"><div class="xp-reference-group-head"><span class="xp-parent-label">PARENT / ${selected.components.find((c) => c.id === 'aerie')?.name}</span><h3>${selected.components.find((c) => c.id === 'meaning')?.name}</h3><p>Model checking and interpretation</p></div>${modelTools.map(componentCard).join('')}</div><div class="xp-reference-group" id="xp-reference-diagram-builder"><div class="xp-reference-group-head"><span class="xp-parent-label">PARENT / ${selected.components.find((c) => c.id === 'aerie')?.name}</span><h3>${selected.components.find((c) => c.id === 'picture')?.name}</h3><p>From resolved model to an interactive drawing</p></div>${audience === 'engineer' ? `<aside class="xp-rationale"><div class="xp-eyebrow">DOCUMENTED ARCHITECTURE DECISION</div><h4>Reserve space for every audience</h4><p>Audience wording and nesting depth are separate controls. Space is reserved for the longest wording at every audience level so that changing the reader's wording does not move the diagram.</p><h5>Why this decision was made</h5><p>Mixed audiences need one shared picture they can each read at their own level. Keeping the geometry stable lets them discuss the same elements while the wording changes.</p><div class="xp-source-note">Source: docs/decisions/0002-audience-levels.md · prototype reference content</div></aside>` : ''}${builder.map(componentCard).join('')}</div><div class="xp-reference-group"><div class="xp-reference-group-head"><span class="xp-parent-label">SYSTEM AND PARTICIPANTS</span><h3>Model editing and readers</h3></div>${other.map(componentCard).join('')}</div></section>`;
    return `<p class="xp-intro">A static document for an architecture review. The optional reference keeps full descriptions and connections after the flow explanation.</p><div class="xp-reference-controls"><label><input id="xp-include-reference" type="checkbox" ${includeReference ? 'checked' : ''}> Include component reference</label><span>Preview content: ${includeReference ? 'diagram + 4 stages + 8 detailed steps + component reference' : 'diagram + 4 stages + 8 detailed steps'}</span></div><p class="xp-source-disclosure">Prototype example: diagram and flow text come from the sample model. Extra technical notes and the decision example are authored from this repository's documentation; this does not imply automatic discovery of rationale.</p><div class="xp-wiki"><div class="xp-wiki-bar">Team knowledge <span>/</span> Architecture <span>/</span> Diagram <b>Static reference concept</b></div><article class="xp-document xp-reference-document">${pageHeader('Big picture, fully expanded', 'Selected scenario: Create a diagram · all nested elements visible')}<nav class="xp-document-contents"><a href="#xp-architecture">01 Expanded architecture</a><a href="#xp-scenario">02 Scenario detail</a>${includeReference ? '<a href="#xp-reference">03 Component reference</a>' : ''}</nav><section id="xp-architecture"><div class="xp-section-title"><span>01</span><div><h2>Expanded architecture</h2><p>The numbered stages follow one selected scenario.</p></div></div><div class="xp-export-content"><div class="xp-full-diagram">${drawing()}</div><aside class="xp-all-explanations"><div class="xp-eyebrow">STAGES AT A GLANCE</div>${legend()}</aside></div></section><section id="xp-scenario"><div class="xp-section-title"><span>02</span><div><div class="xp-eyebrow">SELECTED SCENARIO / CREATE A DIAGRAM</div><h2>Stages and detailed steps</h2><p>How one model becomes an interactive picture, at a glance and step by step.</p></div></div><div class="xp-stage-detail-grid">${details}</div></section>${includeReference ? reference : ''}<footer class="xp-export-footer">Big picture · ${audience === 'exec' ? 'Plain' : 'Technical'} · Fully expanded · Create a diagram</footer></article></div>`;
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
    const keys = ['A', 'B', 'C', 'D'];
    switchTo(keys[(keys.indexOf(variant) + delta + 4) % 4]!);
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
