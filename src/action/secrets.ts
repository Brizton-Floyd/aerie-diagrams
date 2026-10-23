// The Action's tokens (DRIFT-606): each is masked in the job's log in every form it is used in, and
// redacted from anything the Action prints or throws, so neither the token nor the header built
// from it can reach the log, the summary or a message.

/** The value of the HTTP header git sends with a token, as `actions/checkout` builds it. */
export function tokenHeader(token: string): string {
  return `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
}

/** Every form of the tokens that could be printed: each as given and in its header's base64. */
export function secretForms(...tokens: readonly string[]): string[] {
  const forms = tokens
    .filter((token) => token !== '')
    .flatMap((token) => [token, tokenHeader(token).slice('AUTHORIZATION: basic '.length)]);
  return [...new Set(forms)];
}

/** The workflow commands that mask each form in the job's log (what `core.setSecret` writes). */
export function maskCommands(...tokens: readonly string[]): string[] {
  return secretForms(...tokens).map((form) => `::add-mask::${form}`);
}

/** Text with every form of the tokens replaced by `***`. */
export function redact(text: string, forms: readonly string[]): string {
  // The longest first, so a token inside another form never leaves part of that form behind.
  return [...forms]
    .sort((a, b) => b.length - a.length)
    .reduce((out, form) => out.split(form).join('***'), text);
}
