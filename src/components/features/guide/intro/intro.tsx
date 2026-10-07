// How it works: the page title and the one-paragraph summary of the tool.

export function Intro() {
  return (
    <header className="mb-12">
      <h1 className="font-serif text-[36px] leading-tight font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
        You describe a requirement or a bug you saw; Claude interrogates it one question at a time until it is clear,
        then writes it as an Epic, Feature, PBI, Task or Bug in your Template. You edit the result like a document, ask
        Claude to rework any part, and copy it into Azure DevOps. Claude writes the copy — you stay the editor.
      </p>
    </header>
  )
}
