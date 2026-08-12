import * as React from 'react';
import styled from 'styled-components';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import { Field } from '@strapi/design-system';

marked.setOptions({ gfm: true });

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
turndownService.use(gfm);

// Tiptap always wraps a table cell's content in a <p>. turndown-plugin-gfm's cell rule
// wraps that content in `| ... |` as-is, so the default paragraph rule's blank-line padding
// would put each cell's text on its own line and break the single-line pipe-row syntax GFM
// tables require. Collapse a cell's paragraph(s) onto one line, joining multiple with <br>.
turndownService.addRule('tableCellContent', {
  filter: node => node.nodeName === 'P' && ['TD', 'TH'].includes(node.parentNode?.nodeName),
  replacement: (content, node) => (node.nextSibling ? `${content}<br>` : content),
});

// Tiptap's Table extension always renders a <colgroup> right before <tbody> (for column
// width hints). turndown-plugin-gfm's header-row detection only recognizes a first row as
// a header if <tbody> has no preceding sibling (or an empty <thead>) - the colgroup breaks
// that check, so every table would otherwise fall back to being kept as raw HTML.
const TABLE_COLGROUP_PATTERN = /<colgroup>[\s\S]*?<\/colgroup>/gi;
function stripTableColgroups(html) {
  return html.replace(TABLE_COLGROUP_PATTERN, '');
}

const EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
  Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
];

// Google Docs wraps external links in a "https://www.google.com/url?q=<real-url>&..."
// redirector. Unwrap it so the saved markdown links straight to the real target.
function unwrapGoogleRedirectLinks(doc) {
  doc.querySelectorAll('a[href*="google.com/url"]').forEach(anchor => {
    try {
      const href = anchor.getAttribute('href');
      const url = new URL(href, 'https://www.google.com');
      const real = url.searchParams.get('q');
      if (real) {
        anchor.setAttribute('href', real);
      }
    } catch {
      // Leave the href untouched if it isn't a parseable URL.
    }
  });
}

// Google Docs "Heading" paragraph styles don't survive copy/paste as semantic
// <h1>/<h2> tags - they arrive as a <p> wrapping a single bold, oversized <span>.
// Detect that shape (by font-size/weight) and promote it to a real heading so it
// round-trips to markdown `#`/`##` instead of being flattened to a bold paragraph.
function promoteGoogleDocsHeadings(doc) {
  doc.querySelectorAll('p').forEach(paragraph => {
    const text = paragraph.textContent?.trim();
    if (!text) return;

    const spans = Array.from(paragraph.querySelectorAll('span'));
    if (spans.length !== 1 || spans[0].textContent?.trim() !== text) return;

    const style = spans[0].getAttribute('style') || '';
    const sizeMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)pt/);
    const isBold = /font-weight:\s*(700|bold)/.test(style);
    if (!sizeMatch || !isBold) return;

    const size = parseFloat(sizeMatch[1]);
    let level = null;
    if (size >= 18) level = 1;
    else if (size >= 15) level = 2;
    else if (size >= 13) level = 3;
    if (!level) return;

    const heading = doc.createElement(`h${level}`);
    heading.textContent = text;
    paragraph.replaceWith(heading);
  });
}

// Word and Google Docs never emit semantic <th> cells for table headers - both use plain
// <td> for every cell, including the header row. turndown-plugin-gfm only converts a table
// to markdown pipe-table syntax when every cell in the first row is a real <th>; otherwise
// it keeps the whole table as raw HTML. Promote the first row's cells to <th> so pasted
// tables convert to clean markdown regardless of source.
function promoteTableHeaderRow(doc) {
  doc.querySelectorAll('table').forEach(table => {
    const firstRow = table.rows[0];
    if (!firstRow) return;

    Array.from(firstRow.cells).forEach(cell => {
      if (cell.tagName === 'TH') return;

      const th = doc.createElement('th');
      Array.from(cell.attributes).forEach(({ name, value }) => th.setAttribute(name, value));
      th.innerHTML = cell.innerHTML;
      cell.replaceWith(th);
    });
  });
}

const GOOGLE_DOCS_MARKER = /id="docs-internal-guid-/;
const TABLE_TAG_PATTERN = /<table[\s>]/i;

function transformPastedHtml(html) {
  const isGoogleDocs = GOOGLE_DOCS_MARKER.test(html);
  const hasTable = TABLE_TAG_PATTERN.test(html);
  if (!isGoogleDocs && !hasTable) {
    return html;
  }

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  if (isGoogleDocs) {
    unwrapGoogleRedirectLinks(parsed);
    promoteGoogleDocsHeadings(parsed);
  }
  if (hasTable) {
    promoteTableHeaderRow(parsed);
  }
  return parsed.body.innerHTML;
}

const EditorShell = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.neutral0};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200};
`;

const ToolbarButton = styled.button`
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  border-radius: 4px;
  border: 1px solid transparent;
  background: ${({ $active, theme }) => ($active ? theme.colors.primary100 : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.primary600 : theme.colors.neutral800)};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.neutral150};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ContentArea = styled.div`
  padding: 12px 16px;
  min-height: 220px;
  cursor: text;

  .ProseMirror {
    outline: none;
    min-height: 200px;
  }

  .ProseMirror h1,
  .ProseMirror h2,
  .ProseMirror h3,
  .ProseMirror h4,
  .ProseMirror h5,
  .ProseMirror h6 {
    font-weight: 700;
    line-height: 1.3;
    margin: 0.6em 0 0.3em;
  }

  .ProseMirror h1 {
    font-size: 2em;
  }

  .ProseMirror h2 {
    font-size: 1.6em;
  }

  .ProseMirror h3 {
    font-size: 1.3em;
  }

  .ProseMirror h4 {
    font-size: 1.15em;
  }

  .ProseMirror h5 {
    font-size: 1em;
  }

  .ProseMirror h6 {
    font-size: 0.9em;
  }

  .ProseMirror p {
    margin: 0 0 0.6em;
  }

  .ProseMirror ul,
  .ProseMirror ol {
    padding-left: 1.5em;
    margin: 0 0 0.6em;
  }

  .ProseMirror ul {
    list-style: disc;
  }

  .ProseMirror ol {
    list-style: decimal;
  }

  .ProseMirror ul ul {
    list-style: circle;
  }

  .ProseMirror ul ul ul {
    list-style: square;
  }

  .ProseMirror li {
    margin: 0.2em 0;
  }

  .ProseMirror li p {
    margin: 0;
  }

  .ProseMirror table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.6em 0;
  }

  .ProseMirror td,
  .ProseMirror th {
    border: 1px solid ${({ theme }) => theme.colors.neutral200};
    padding: 6px 8px;
  }

  .ProseMirror th {
    background: ${({ theme }) => theme.colors.neutral100};
  }

  .ProseMirror a {
    color: ${({ theme }) => theme.colors.primary600};
  }

  .ProseMirror blockquote {
    border-left: 3px solid ${({ theme }) => theme.colors.neutral200};
    padding-left: 12px;
    color: ${({ theme }) => theme.colors.neutral600};
  }
`;

export const MarkdownEditorInput = React.forwardRef(
  ({ name, value, onChange, disabled, label, hint, error, required, labelAction }, forwardedRef) => {
    const onChangeRef = React.useRef(onChange);
    const lastEmittedRef = React.useRef(value);

    React.useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const editor = useEditor(
      {
        extensions: EXTENSIONS,
        content: marked.parse(value || ''),
        editable: !disabled,
        editorProps: {
          transformPastedHTML: transformPastedHtml,
        },
        onUpdate: ({ editor: currentEditor }) => {
          const html = stripTableColgroups(currentEditor.getHTML());
          const markdown = turndownService.turndown(html).trim();
          lastEmittedRef.current = markdown;
          onChangeRef.current(name, markdown);
        },
      },
      []
    );

    React.useImperativeHandle(forwardedRef, () => ({
      focus: () => editor?.commands.focus(),
    }));

    React.useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    React.useEffect(() => {
      if (!editor) return;
      if (value === lastEmittedRef.current) return;

      lastEmittedRef.current = value;
      editor.commands.setContent(marked.parse(value || ''), false);
    }, [value, editor]);

    const setLink = React.useCallback(() => {
      if (!editor) return;

      const previousUrl = editor.getAttributes('link').href;
      const url = window.prompt('Link URL', previousUrl || 'https://');
      if (url === null) return;

      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }

      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) {
      return null;
    }

    return (
      <Field.Root name={name} hint={hint} error={error} required={required}>
        <Field.Label action={labelAction}>{label}</Field.Label>
        <EditorShell>
          <Toolbar>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              H1
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              H3
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              Bold
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              Italic
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              • List
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              1. List
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              Quote
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              $active={editor.isActive('link')}
              onClick={setLink}
            >
              Link
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              Table
            </ToolbarButton>
            {editor.isActive('table') && (
              <>
                <ToolbarButton
                  type="button"
                  disabled={disabled}
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                >
                  + Row
                </ToolbarButton>
                <ToolbarButton
                  type="button"
                  disabled={disabled}
                  onClick={() => editor.chain().focus().deleteRow().run()}
                >
                  - Row
                </ToolbarButton>
                <ToolbarButton
                  type="button"
                  disabled={disabled}
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                >
                  + Col
                </ToolbarButton>
                <ToolbarButton
                  type="button"
                  disabled={disabled}
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                >
                  - Col
                </ToolbarButton>
                <ToolbarButton
                  type="button"
                  disabled={disabled}
                  onClick={() => editor.chain().focus().deleteTable().run()}
                >
                  Delete Table
                </ToolbarButton>
              </>
            )}
            <ToolbarButton
              type="button"
              disabled={disabled}
              onClick={() => editor.chain().focus().undo().run()}
            >
              Undo
            </ToolbarButton>
            <ToolbarButton
              type="button"
              disabled={disabled}
              onClick={() => editor.chain().focus().redo().run()}
            >
              Redo
            </ToolbarButton>
          </Toolbar>
          <ContentArea onClick={() => editor.chain().focus().run()}>
            <EditorContent editor={editor} />
          </ContentArea>
        </EditorShell>
        <Field.Hint />
        <Field.Error />
      </Field.Root>
    );
  }
);

export default MarkdownEditorInput;
