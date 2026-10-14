import {
    GripVertical,
    Plus,
    Undo2,
    Redo2,
    Copy,
    Trash2,
    ArrowUp,
    ArrowDown,
    Monitor,
    Smartphone,
    Code2,
    Send,
    Download,
    Check,
    X,
    Settings2,
    Layers,
    FileCode2,
    RotateCcw,
    ExternalLink
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { AuthLab } from './auth-lab.tsx';
import {
    ASSETS,
    BLOCKS,
    newBlock,
    personalize,
    template,
    inlineNodes,
    formatSelection
} from './model.ts';
import type { renderDocument } from './render.ts';
import { LANGUAGES, snippet } from './snippets.ts';
import { StartHere } from './start-here.tsx';
import type {
    Alignment,
    Attachment,
    Block,
    BlockType,
    EmailDocument,
    InlineNode,
    StudioState
} from './types.ts';
import { asError } from './types.ts';

const token = document.querySelector<HTMLMetaElement>(
    'meta[name="demo-token"]'
)!.content;
const storageKey = 'clerk-release-lab-email-studio-v2';
function readDraft(): EmailDocument {
    try {
        const doc = JSON.parse(localStorage.getItem(storageKey) || 'null');
        return doc?.blocks?.length ? doc : template();
    } catch {
        return template();
    }
}
function download(name: string, content: BlobPart, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type FieldProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement> &
        React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'value' | 'onChange'
> & {
    label: string;
    value?: string | number;
    multiline?: boolean;
    onChange: (value: string) => void;
};
function Field({
    label,
    value,
    onChange,
    multiline = false,
    ...props
}: FieldProps) {
    const Tag = multiline ? 'textarea' : 'input';
    return (
        <label className="field">
            <span>{label}</span>
            <Tag
                value={value ?? ''}
                onChange={event => onChange(event.target.value)}
                {...props}
            />
        </label>
    );
}
function IconButton({
    label,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
    return (
        <button
            className="icon-button"
            aria-label={label}
            title={label}
            {...props}
        >
            {children}
        </button>
    );
}

function RichContent({ text, doc }: { text: unknown; doc: EmailDocument }) {
    function nodes(items: InlineNode[]): React.ReactNode[] {
        return items.map((item, key) =>
            typeof item === 'string'
                ? personalize(item, doc)
                : React.createElement(item.tag, { key }, nodes(item.children))
        );
    }
    return nodes(inlineNodes(text));
}

function TextEditor({
    block,
    onChange
}: {
    block: Block;
    onChange: (values: Partial<Block>) => void;
}) {
    const input = useRef<HTMLTextAreaElement>(null);
    const [hint, setHint] = useState(
        'Select words below, then choose a format. Click again to remove it.'
    );
    function format(marker: string) {
        const field = input.current!;
        if (field.selectionStart === field.selectionEnd) {
            setHint('Select the words you want to format first.');
            field.focus();
            return;
        }
        const next = formatSelection(
            block.text || '',
            field.selectionStart,
            field.selectionEnd,
            marker
        );
        onChange({ text: next.text });
        setHint(
            'Formatting applied. See the email preview; undo is available in the toolbar.'
        );
        requestAnimationFrame(() => {
            field.focus();
            field.setSelectionRange(next.start, next.end);
        });
    }
    return (
        <div className="paragraph-editor">
            <div
                className="text-format-toolbar"
                role="group"
                aria-label="Text formatting"
            >
                {(
                    [
                        ['Bold', '**', <b key="b">B</b>],
                        ['Italic', '*', <i key="i">I</i>],
                        ['Underline', '__', <u key="u">U</u>],
                        ['Strikethrough', '~~', <s key="s">S</s>]
                    ] as [string, string, React.ReactNode][]
                ).map(([label, marker, icon]) => (
                    <button
                        key={label}
                        type="button"
                        aria-label={label}
                        title={label}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => format(marker)}
                    >
                        {icon}
                    </button>
                ))}
            </div>
            <label className="field">
                <span>Content</span>
                <textarea
                    ref={input}
                    value={block.text || ''}
                    rows={block.type === 'text' ? 7 : 3}
                    onChange={event => onChange({ text: event.target.value })}
                    onKeyDown={event => {
                        const marker = (
                            { b: '**', i: '*', u: '__' } as Record<
                                string,
                                string
                            >
                        )[event.key.toLowerCase()];
                        if ((event.ctrlKey || event.metaKey) && marker) {
                            event.preventDefault();
                            format(marker);
                        }
                    }}
                />
            </label>
            <p className="help" role="status">
                {hint} Markers stay editable: **bold**, *italic*, __underline__,
                ~~strike~~.
            </p>
            <label className="field">
                <span>Alignment</span>
                <select
                    value={block.align || 'left'}
                    onChange={event =>
                        onChange({ align: event.target.value as Alignment })
                    }
                >
                    {['left', 'center', 'right', 'justify'].map(align => (
                        <option key={align} value={align}>
                            {align[0].toUpperCase() + align.slice(1)}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}
function Mark() {
    return (
        <svg
            width="24"
            height="28"
            viewBox="0 0 24 28"
            fill="none"
            aria-hidden="true"
        >
            <rect
                x="2"
                y="1"
                width="20"
                height="26"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            {[7, 14, 21].map(y => (
                <g key={y}>
                    <path
                        d={`M6 ${y}h12`}
                        stroke="currentColor"
                        strokeWidth="1.5"
                    />
                    <circle cx="6" cy={y - 2.5} r=".7" fill="currentColor" />
                </g>
            ))}
        </svg>
    );
}

function BlockContent({ block, doc }: { block: Block; doc: EmailDocument }) {
    const text = personalize(block.text, doc);
    if (block.type === 'heading') {
        return (
            <h1
                className="email-heading"
                style={{ textAlign: block.align || 'left' }}
            >
                <RichContent text={block.text} doc={doc} />
            </h1>
        );
    }
    if (block.type === 'text') {
        return (
            <p
                className="email-text"
                style={{ textAlign: block.align || 'left' }}
            >
                <RichContent text={block.text} doc={doc} />
            </p>
        );
    }
    if (block.type === 'image') {
        const asset = ASSETS.find(item => item.id === block.asset) || ASSETS[0];
        return (
            <figure className="email-image">
                <img
                    src={`/assets/${asset.file}`}
                    alt={personalize(block.alt, doc)}
                    draggable="false"
                />
                <figcaption>
                    {personalize(block.caption, doc)}
                    {asset.id === 'compute-shelf' && (
                        <small>{asset.credit}</small>
                    )}
                </figcaption>
            </figure>
        );
    }
    if (block.type === 'button') {
        return (
            <div
                className={`email-button-row ${block.align === 'center' ? 'center' : ''}`}
            >
                <span className="email-button">
                    {text} <span>↗</span>
                </span>
            </div>
        );
    }
    if (block.type === 'divider') {
        return <hr className="email-divider" />;
    }
    if (block.type === 'spacer') {
        return (
            <div
                className="email-spacer"
                style={{ height: Number(block.height) }}
            >
                Spacer · {block.height}px
            </div>
        );
    }
    if (block.type === 'stats') {
        return (
            <div className="email-stats">
                {String(block.values)
                    .split('\n')
                    .slice(0, 3)
                    .map((line, index) => {
                        const [value, label] = line.split('|');
                        return (
                            <div key={index}>
                                <strong>{personalize(value, doc)}</strong>
                                <small>{personalize(label, doc)}</small>
                            </div>
                        );
                    })}
            </div>
        );
    }
    return null;
}

function App({ onSetup }: { onSetup: () => void }) {
    const [history, setHistory] = useState<{
        past: EmailDocument[];
        present: EmailDocument;
        future: EmailDocument[];
    }>({
        past: [],
        present: readDraft(),
        future: []
    });
    const doc = history.present;
    const [selected, setSelected] = useState<string | null>(null);
    const [leftTab, setLeftTab] = useState('blocks');
    const [mode, setMode] = useState('design');
    const [viewport, setViewport] = useState('desktop');
    const [language, setLanguage] = useState('typescript');
    const [codeOpen, setCodeOpen] = useState(true);
    const [rendered, setRendered] = useState<Awaited<
        ReturnType<typeof renderDocument>
    > | null>(null);
    const [renderBusy, setRendering] = useState(true);
    const rendering =
        renderBusy ||
        !rendered ||
        JSON.stringify(rendered.document) !== JSON.stringify(doc);
    const [server, setServer] = useState<StudioState | null>(null);
    const [notice, setNotice] = useState('Loading studio…');
    const [error, setError] = useState(false);
    const [showSend, setShowSend] = useState(false);
    const [busy, setBusy] = useState(false);
    const [to, setTo] = useState('');
    const [toMode, setToMode] = useState('address');
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [replyTo, setReplyTo] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [transport, setTransport] = useState('api');
    const [keyNonce, setKeyNonce] = useState(0);
    const messageSignature = JSON.stringify({
        doc,
        to,
        toMode,
        cc,
        bcc,
        replyTo,
        attachments,
        keyNonce
    });
    const key = useMemo(() => {
        // Include a draft fingerprint for debugging and a UUID for collision-free send identity.
        let hash = 2166136261;
        for (const character of messageSignature) {
            hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
        }
        return `rack_demo_${(hash >>> 0).toString(16)}_${crypto.randomUUID()}`;
    }, [messageSignature]);
    const [copied, setCopied] = useState(false);
    const [dropAt, setDropAt] = useState<number | null>(null);
    const renderSequence = useRef(0);
    const dragging = useRef<{ type?: BlockType; id?: string } | null>(null);
    const attachmentSequence = useRef(0);
    const selectedBlock = doc.blocks.find(block => block.id === selected);

    function tell(message: string, bad = false) {
        setNotice(message);
        setError(bad);
    }
    function change(
        next: EmailDocument | ((doc: EmailDocument) => EmailDocument)
    ) {
        setHistory(previous => ({
            past: [...previous.past, previous.present].slice(-60),
            present: typeof next === 'function' ? next(previous.present) : next,
            future: []
        }));
    }
    function updateDoc(values: Partial<EmailDocument>) {
        change(current => ({ ...current, ...values }));
    }
    function updateBlock(values: Partial<Block>) {
        change(current => ({
            ...current,
            blocks: current.blocks.map(block =>
                block.id === selected ? { ...block, ...values } : block
            )
        }));
    }
    function undo() {
        setHistory(current =>
            current.past.length
                ? {
                      past: current.past.slice(0, -1),
                      present: current.past.at(-1)!,
                      future: [current.present, ...current.future]
                  }
                : current
        );
    }
    function redo() {
        setHistory(current =>
            current.future.length
                ? {
                      past: [...current.past, current.present],
                      present: current.future[0],
                      future: current.future.slice(1)
                  }
                : current
        );
    }
    function addBlock(type: BlockType, index = doc.blocks.length) {
        if (doc.blocks.length >= 40) {
            tell('This demo supports up to 40 blocks.', true);
            return;
        }
        const block = newBlock(type);
        change(current => ({
            ...current,
            blocks: [
                ...current.blocks.slice(0, index),
                block,
                ...current.blocks.slice(index)
            ]
        }));
        setSelected(block.id);
        setLeftTab('properties');
    }
    function moveBlock(id: string, index: number) {
        change(current => {
            const old = current.blocks.findIndex(block => block.id === id);
            const blocks = [...current.blocks];
            const [block] = blocks.splice(old, 1);
            blocks.splice(
                Math.max(0, Math.min(index, blocks.length)),
                0,
                block
            );
            return { ...current, blocks };
        });
    }
    function removeBlock(id: string) {
        if (doc.blocks.length === 1) {
            tell('Keep at least one content block.', true);
            return;
        }
        change(current => ({
            ...current,
            blocks: current.blocks.filter(block => block.id !== id)
        }));
        if (selected === id) {
            setSelected(null);
        }
    }
    function duplicateBlock(id: string) {
        if (doc.blocks.length >= 40) {
            return;
        }
        const index = doc.blocks.findIndex(block => block.id === id);
        const block = { ...doc.blocks[index], id: crypto.randomUUID() };
        change(current => ({
            ...current,
            blocks: [
                ...current.blocks.slice(0, index + 1),
                block,
                ...current.blocks.slice(index + 1)
            ]
        }));
        setSelected(block.id);
    }
    function drag(
        event: React.DragEvent,
        data: { type?: BlockType; id?: string }
    ) {
        dragging.current = data;
        event.dataTransfer.effectAllowed = data.type ? 'copy' : 'move';
        event.dataTransfer.setData(
            'application/x-rack-block',
            JSON.stringify(data)
        );
    }
    function drop(event: React.DragEvent, index: number) {
        event.preventDefault();
        event.stopPropagation();
        const data = dragging.current;
        dragging.current = null;
        setDropAt(null);
        if (!data) {
            return;
        }
        if (data.type) {
            addBlock(data.type, index);
        } else {
            const old = doc.blocks.findIndex(block => block.id === data.id);
            moveBlock(data.id!, old < index ? index - 1 : index);
        }
    }
    async function api(action: string, body: unknown = {}) {
        const response = await fetch(`/api/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Demo-Token': token
            },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }
        return result;
    }
    async function refresh() {
        const response = await fetch('/api/state');
        if (!response.ok) {
            throw new Error(
                'Demo unavailable. Keep pnpm start running, then refresh the page.'
            );
        }
        const data = await response.json();
        setServer(data);
        return data;
    }
    useEffect(() => {
        const timer = setTimeout(
            () =>
                refresh()
                    .then(() => {
                        tell(
                            'Draft saved in this browser. Preview and exports are ready; live sending is optional.'
                        );
                    })
                    .catch(err => tell(err.message, true)),
            0
        );
        return () => clearTimeout(timer);
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(doc));
        } catch {
            queueMicrotask(() =>
                tell(
                    'Browser storage is full; export your draft to save it.',
                    true
                )
            );
        }
    }, [doc]);
    useEffect(() => {
        const sequence = ++renderSequence.current;
        const timer = setTimeout(() => {
            setRendering(true);
            api('render', { document: doc })
                .then(value => {
                    if (sequence === renderSequence.current) {
                        setRendered(value);
                        setRendering(false);
                    }
                })
                .catch(err => {
                    if (sequence === renderSequence.current) {
                        setRendering(false);
                        setRendered(null);
                        tell(err.message, true);
                    }
                });
        }, 220);
        return () => clearTimeout(timer);
    }, [doc, server?.assetBase]);
    useEffect(() => {
        function handle(event: KeyboardEvent) {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === 'z' &&
                !['INPUT', 'TEXTAREA'].includes(
                    (event.target as HTMLElement).tagName
                )
            ) {
                event.preventDefault();
                if (event.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }
        }
        window.addEventListener('keydown', handle);
        return () => window.removeEventListener('keydown', handle);
    }, []);
    useEffect(() => {
        if (server?.assetBase) {
            return;
        }
        const timer = setInterval(() => refresh().catch(() => {}), 3000);
        return () => clearInterval(timer);
    }, [server?.assetBase]);

    function recipients(value: string) {
        return value
            .split(',')
            .map(part => part.trim())
            .filter(Boolean);
    }
    const envelope = {
        to:
            toMode === 'user'
                ? { user_id: to || 'user_REPLACE_ME' }
                : { address: to || 'you@example.com' },
        from: {
            address: `demo@${server?.domain || 'example.com'}`,
            name: 'Example Workshop'
        },
        ...(replyTo ? { reply_to: { address: replyTo } } : {}),
        ...(cc ? { cc: recipients(cc) } : {}),
        ...(bcc ? { bcc: recipients(bcc) } : {}),
        subject: rendered?.subject || personalize(doc.subject, doc),
        html: rendered?.html || '',
        text: rendered?.text || '',
        ...(attachments.length ? { attachments } : {})
    };
    const activeLanguage =
        LANGUAGES.find(item => item.id === language) || LANGUAGES[0];
    const code =
        language === 'json'
            ? JSON.stringify(envelope, null, 2)
            : language === 'react-email'
              ? rendered?.source || 'Rendering template…'
              : snippet(language, key);

    async function send(action: string) {
        setBusy(true);
        try {
            const result = await api(action, {
                recipient: to.trim(),
                recipientMode: toMode,
                document: doc,
                cc: recipients(cc),
                bcc: recipients(bcc),
                replyTo: replyTo.trim(),
                attachments,
                transport,
                key
            });
            await refresh();

            if (action === 'reset') {
                setKeyNonce(value => value + 1);
                tell(
                    'New send prepared. Edit the draft or send it again with a new key.'
                );
            } else if (result.http === 409 && action === 'conflict') {
                tell(
                    '409 Conflict. A key cannot represent two different messages.'
                );
            } else if (result.ok) {
                tell(
                    `${result.id || 'Email'} · ${result.status || 'stored'} · via ${result.transport || transport}. Inbox arrival confirms delivery.`
                );
                if (action === 'send') {
                    setShowSend(false);
                }
            } else {
                tell(
                    `HTTP ${result.http || 'unknown'} · ${(result.errorCodes || []).join(', ') || 'see the response log'}`,
                    true
                );
            }
        } catch (caught) {
            const err = asError(caught);
            tell(err.message, true);
            await refresh().catch(() => {});
        } finally {
            setBusy(false);
        }
    }
    async function files(event: React.ChangeEvent<HTMLInputElement>) {
        const sequence = ++attachmentSequence.current;
        const chosen = [...(event.target.files || [])];
        if (
            chosen.length > 10 ||
            chosen.reduce((sum, file) => sum + file.size, 0) > 1048576
        ) {
            tell('Use up to 10 attachments, 1 MiB total.', true);
            event.target.value = '';
            return;
        }
        const values = await Promise.all(
            chosen.map(
                file =>
                    new Promise<Attachment>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onerror = reject;
                        reader.onload = () =>
                            resolve({
                                filename: file.name,
                                content:
                                    typeof reader.result === 'string'
                                        ? reader.result.split(',')[1]
                                        : ''
                            });
                        reader.readAsDataURL(file);
                    })
            )
        );
        if (sequence === attachmentSequence.current) {
            setAttachments(values);
        }
    }

    return (
        <div className="studio">
            <header className="app-header">
                <a
                    className="wordmark"
                    href="https://workshop.example.com"
                    target="_blank"
                    rel="noreferrer"
                >
                    <Mark />
                    <span>
                        EXAMPLE WORKSHOP<small>EMAIL STUDIO</small>
                    </span>
                </a>
                <div className="header-divider" />
                <span className="header-caption">
                    Measure twice. Send once.
                </span>
                <div className="header-right">
                    <span className="live-pill">
                        <i />
                        {server?.emailEnabled
                            ? 'Clerk email enabled'
                            : 'Local preview · no sending'}
                    </span>
                    <span className="hack-night">community demo</span>
                    <button
                        className="primary"

                        title={
                            server?.emailEnabled
                                ? 'Send a test email'
                                : 'Set CLERK_EMAIL_SECRET_KEY in .env.local to enable sending'
                        }
                        onClick={() =>
                            server?.emailEnabled ? setShowSend(true) : onSetup()
                        }
                    >
                        <Send size={15} />
                        {server?.emailEnabled
                            ? 'Send test'
                            : 'Enable live sending'}
                    </button>
                </div>
            </header>
            <div className="workspace-bar">
                <div>
                    <span className="crumb">
                        Workspace / Transactional email /
                    </span>
                    <strong>{doc.name}</strong>
                    <span className="saved">
                        <Check size={12} /> Saved locally
                    </span>
                </div>
                <div className="toolbar">
                    <IconButton
                        label="Undo"
                        onClick={undo}
                        disabled={!history.past.length}
                    >
                        <Undo2 size={16} />
                    </IconButton>
                    <IconButton
                        label="Redo"
                        onClick={redo}
                        disabled={!history.future.length}
                    >
                        <Redo2 size={16} />
                    </IconButton>
                    <span className="toolbar-divider" />
                    <button
                        className={codeOpen ? 'subtle active' : 'subtle'}
                        onClick={() => setCodeOpen(!codeOpen)}
                    >
                        <Code2 size={15} />
                        Code
                    </button>
                    <button
                        className="subtle"
                        onClick={() =>
                            download(
                                'clerk-release-lab-draft.json',
                                JSON.stringify(doc, null, 2),
                                'application/json'
                            )
                        }
                    >
                        <Download size={15} />
                        Export draft
                    </button>
                </div>
            </div>
            <main className={`workspace ${codeOpen ? 'with-code' : ''}`}>
                <aside className="sidebar">
                    <div className="sidebar-scroll">
                        <div className="section-label">
                            START WITH A TEMPLATE <span>03</span>
                        </div>
                        <div className="templates">
                            {[
                                [
                                    'ready',
                                    'Project ready',
                                    'The plan is ready. Make it real.',
                                    'starter-rack'
                                ],
                                [
                                    'community',
                                    'Shared build',
                                    'A community build worth opening.',
                                    'compute-shelf'
                                ],
                                [
                                    'parts',
                                    'Parts ready',
                                    'From your plan to the workbench.',
                                    'starter-rack'
                                ]
                            ].map(([id, name, description, asset]) => (
                                <button
                                    key={id}
                                    className={`template-card ${doc.template === id ? 'chosen' : ''}`}
                                    onClick={() => {
                                        change(template(id));
                                        setSelected(null);
                                        tell(
                                            `${name} template loaded. Undo restores your previous draft.`
                                        );
                                    }}
                                >
                                    <img src={`/assets/${asset}.gif`} alt="" />
                                    <span>
                                        <strong>{name}</strong>
                                        <small>{description}</small>
                                    </span>
                                    {doc.template === id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                        <div className="side-tabs">
                            {(
                                [
                                    ['blocks', Layers, 'Blocks'],
                                    ['properties', Settings2, 'Properties'],
                                    ['settings', Settings2, 'Email']
                                ] as const
                            ).map(([id, Icon, name]) => (
                                <button
                                    key={id}
                                    className={leftTab === id ? 'selected' : ''}
                                    onClick={() => setLeftTab(id)}
                                >
                                    <Icon size={14} />
                                    {name}
                                </button>
                            ))}
                        </div>
                        {leftTab === 'blocks' && (
                            <>
                                <div className="section-label">
                                    CONTENT BLOCKS <span>DRAG OR CLICK</span>
                                </div>
                                <div className="block-palette">
                                    {Object.entries(BLOCKS).map(
                                        ([type, block]) => (
                                            <button
                                                key={type}
                                                draggable
                                                onDragStart={event =>
                                                    drag(event, {
                                                        type: type as BlockType
                                                    })
                                                }
                                                onDragEnd={() => {
                                                    dragging.current = null;
                                                    setDropAt(null);
                                                }}
                                                onClick={() =>
                                                    addBlock(type as BlockType)
                                                }
                                            >
                                                <b>{block.icon}</b>
                                                <span>{block.label}</span>
                                                <Plus size={13} />
                                            </button>
                                        )
                                    )}
                                </div>
                                <div className="section-label layer-title">
                                    LAYERS <span>{doc.blocks.length}/40</span>
                                </div>
                                <div className="layers">
                                    {doc.blocks.map((block, index) => (
                                        <button
                                            key={block.id}
                                            className={
                                                selected === block.id
                                                    ? 'selected'
                                                    : ''
                                            }
                                            onClick={() => {
                                                setSelected(block.id);
                                                setLeftTab('properties');
                                            }}
                                        >
                                            <span className="mono">
                                                {String(index + 1).padStart(
                                                    2,
                                                    '0'
                                                )}
                                            </span>
                                            <span>
                                                {BLOCKS[block.type]?.label}
                                            </span>
                                            <small>
                                                {block.text?.slice(0, 17) ||
                                                    block.asset ||
                                                    ''}
                                            </small>
                                        </button>
                                    ))}
                                </div>
                                <div className="side-note">
                                    <GripVertical size={16} />
                                    <p>
                                        Drag blocks into the canvas. Use the
                                        handle to reorder. Arrow buttons work
                                        with a keyboard.
                                    </p>
                                </div>
                            </>
                        )}
                        {leftTab === 'properties' && (
                            <>
                                <div className="section-label">
                                    {selectedBlock
                                        ? `${BLOCKS[selectedBlock.type].label.toUpperCase()} SETTINGS`
                                        : 'SELECT A BLOCK'}
                                </div>
                                {!selectedBlock ? (
                                    <p className="empty-note">
                                        Select any block in the email to edit
                                        its content, image, or link.
                                    </p>
                                ) : (
                                    <div className="property-form">
                                        {['heading', 'text'].includes(
                                            selectedBlock.type
                                        ) && (
                                            <TextEditor
                                                key={selectedBlock.id}
                                                block={selectedBlock}
                                                onChange={updateBlock}
                                            />
                                        )}
                                        {selectedBlock.type === 'button' && (
                                            <Field
                                                label="Content"
                                                value={selectedBlock.text}
                                                onChange={text =>
                                                    updateBlock({ text })
                                                }
                                                multiline={
                                                    selectedBlock.type !==
                                                    'button'
                                                }
                                                rows={3}
                                            />
                                        )}
                                        {selectedBlock.type === 'image' && (
                                            <>
                                                <label className="field">
                                                    <span>
                                                        Project animation
                                                    </span>
                                                    <select
                                                        value={
                                                            selectedBlock.asset
                                                        }
                                                        onChange={event =>
                                                            updateBlock({
                                                                asset: event
                                                                    .target
                                                                    .value as Alignment
                                                            })
                                                        }
                                                    >
                                                        {ASSETS.map(asset => (
                                                            <option
                                                                key={asset.id}
                                                                value={asset.id}
                                                            >
                                                                {asset.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <Field
                                                    label="Alt text"
                                                    value={selectedBlock.alt}
                                                    onChange={alt =>
                                                        updateBlock({ alt })
                                                    }
                                                />
                                                <Field
                                                    label="Caption"
                                                    value={
                                                        selectedBlock.caption
                                                    }
                                                    onChange={caption =>
                                                        updateBlock({ caption })
                                                    }
                                                />
                                                <div className="asset-credit">
                                                    {
                                                        ASSETS.find(
                                                            asset =>
                                                                asset.id ===
                                                                selectedBlock.asset
                                                        )?.credit
                                                    }
                                                    <small>
                                                        Synthetic example
                                                        animation · 640 × 360 ·
                                                        animated GIF
                                                    </small>
                                                </div>
                                            </>
                                        )}
                                        {selectedBlock.type === 'button' && (
                                            <>
                                                <Field
                                                    label="Destination URL"
                                                    type="url"
                                                    value={selectedBlock.url}
                                                    onChange={url =>
                                                        updateBlock({ url })
                                                    }
                                                />
                                                <label className="field">
                                                    <span>Alignment</span>
                                                    <select
                                                        value={
                                                            selectedBlock.align ||
                                                            'left'
                                                        }
                                                        onChange={event =>
                                                            updateBlock({
                                                                align: event
                                                                    .target
                                                                    .value as Alignment
                                                            })
                                                        }
                                                    >
                                                        <option value="left">
                                                            Left
                                                        </option>
                                                        <option value="center">
                                                            Center
                                                        </option>
                                                    </select>
                                                </label>
                                            </>
                                        )}
                                        {selectedBlock.type === 'stats' && (
                                            <>
                                                <Field
                                                    label="One value|label per line (up to 3)"
                                                    value={selectedBlock.values}
                                                    onChange={values =>
                                                        updateBlock({ values })
                                                    }
                                                    multiline
                                                    rows={5}
                                                />
                                                <p className="help">
                                                    Example: 6U|Rack height.
                                                    These are editable sample
                                                    values.
                                                </p>
                                            </>
                                        )}
                                        {selectedBlock.type === 'spacer' && (
                                            <Field
                                                label="Height (8–100 px)"
                                                type="number"
                                                min="8"
                                                max="100"
                                                value={selectedBlock.height}
                                                onChange={height =>
                                                    updateBlock({
                                                        height: Number(height)
                                                    })
                                                }
                                            />
                                        )}
                                        {selectedBlock.type === 'divider' && (
                                            <p className="help">
                                                A subtle divider using Example
                                                Workshop’s border color.
                                            </p>
                                        )}
                                        <div className="property-actions">
                                            <button
                                                onClick={() =>
                                                    duplicateBlock(
                                                        selectedBlock.id
                                                    )
                                                }
                                            >
                                                <Copy size={13} />
                                                Duplicate
                                            </button>
                                            <button
                                                onClick={() =>
                                                    removeBlock(
                                                        selectedBlock.id
                                                    )
                                                }
                                            >
                                                <Trash2 size={13} />
                                                Remove
                                            </button>
                                        </div>
                                        <p className="help">
                                            Personalize text with{' '}
                                            {'{{firstName}}'} and{' '}
                                            {'{{projectName}}'}. Set values in
                                            Email.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                        {leftTab === 'settings' && (
                            <div className="property-form">
                                <Field
                                    label="Draft name"
                                    value={doc.name}
                                    onChange={name => updateDoc({ name })}
                                />
                                <Field
                                    label="Subject"
                                    value={doc.subject}
                                    onChange={subject => updateDoc({ subject })}
                                />
                                <Field
                                    label="Preview text"
                                    value={doc.preheader}
                                    onChange={preheader =>
                                        updateDoc({ preheader })
                                    }
                                    multiline
                                    rows={2}
                                />
                                <div className="section-label">SAMPLE DATA</div>
                                <Field
                                    label="First name"
                                    value={doc.firstName}
                                    onChange={firstName =>
                                        updateDoc({ firstName })
                                    }
                                />
                                <Field
                                    label="Project name"
                                    value={doc.projectName}
                                    onChange={projectName =>
                                        updateDoc({ projectName })
                                    }
                                />
                                <div className="section-label">BRAND</div>
                                <label className="field color-field">
                                    <span>Brass accent (dark template)</span>
                                    <input
                                        type="color"
                                        value={doc.accent}
                                        onChange={event =>
                                            updateDoc({
                                                accent: event.target.value
                                            })
                                        }
                                    />
                                    <code>{doc.accent}</code>
                                </label>
                                <label className="field">
                                    <span>Email appearance</span>
                                    <select
                                        value={doc.theme}
                                        onChange={event =>
                                            updateDoc({
                                                theme: event.target
                                                    .value as EmailDocument['theme']
                                            })
                                        }
                                    >
                                        <option value="dark">
                                            Charcoal & brass
                                        </option>
                                        <option value="light">
                                            Paper & brass
                                        </option>
                                    </select>
                                </label>
                                <Field
                                    label="Footer"
                                    value={doc.footer}
                                    onChange={footer => updateDoc({ footer })}
                                    multiline
                                    rows={4}
                                />
                                <label className="import-button">
                                    <Download size={14} />
                                    Import draft
                                    <input
                                        type="file"
                                        accept="application/json,.json"
                                        onChange={async event => {
                                            try {
                                                const file =
                                                    event.target.files?.[0];
                                                if (!file) {
                                                    return;
                                                }
                                                if (file.size > 100000) {
                                                    throw new Error(
                                                        'Draft file is too large.'
                                                    );
                                                }
                                                const value = JSON.parse(
                                                    await file.text()
                                                );
                                                await api('render', {
                                                    document: value
                                                });
                                                change(value);
                                                setSelected(null);
                                                tell('Draft imported.');
                                            } catch (caught) {
                                                const err = asError(caught);
                                                tell(err.message, true);
                                            }
                                            event.target.value = '';
                                        }}
                                    />
                                </label>
                            </div>
                        )}
                    </div>
                    <div className="sidebar-footer">
                        <span className="dot" />
                        React Email 6.11.1 <span>→ Clerk</span>
                    </div>
                </aside>
                <section className="canvas-panel" aria-label="Email canvas">
                    <div className="canvas-toolbar">
                        <div className="segmented">
                            {[
                                ['design', 'Design'],
                                ['preview', 'Rendered'],
                                ['text', 'Plain text']
                            ].map(([id, name]) => (
                                <button
                                    key={id}
                                    className={mode === id ? 'selected' : ''}
                                    onClick={() => setMode(id)}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                        <div className="device-toggle">
                            <IconButton
                                label="Desktop preview"
                                className={
                                    viewport === 'desktop'
                                        ? 'icon-button selected'
                                        : 'icon-button'
                                }
                                onClick={() => setViewport('desktop')}
                            >
                                <Monitor size={16} />
                            </IconButton>
                            <IconButton
                                label="Mobile preview"
                                className={
                                    viewport === 'mobile'
                                        ? 'icon-button selected'
                                        : 'icon-button'
                                }
                                onClick={() => setViewport('mobile')}
                            >
                                <Smartphone size={16} />
                            </IconButton>
                        </div>
                    </div>
                    <div className="canvas-scroll">
                        <div className={`email-stage ${viewport}`}>
                            <div className="inbox-chrome">
                                <div className="avatar">
                                    <Mark />
                                </div>
                                <div>
                                    <strong>Example Workshop</strong>
                                    <span>
                                        demo@{server?.domain || 'example.com'}
                                    </span>
                                </div>
                                <small>To: {to || 'your demo inbox'}</small>
                                <div className="inbox-subject">
                                    {personalize(doc.subject, doc)}
                                    <p>{personalize(doc.preheader, doc)}</p>
                                </div>
                            </div>
                            {mode === 'design' && (
                                <div
                                    className={`email-design ${doc.theme}`}
                                    style={
                                        {
                                            '--email-accent':
                                                doc.theme === 'light'
                                                    ? '#8d6a1c'
                                                    : doc.accent
                                        } as React.CSSProperties
                                    }
                                >
                                    <div className="email-brand">
                                        <Mark />
                                        EXAMPLE WORKSHOP
                                    </div>
                                    {doc.blocks.map((block, index) => (
                                        <React.Fragment key={block.id}>
                                            <div
                                                className={`drop-zone ${dropAt === index ? 'over' : ''}`}
                                                onDragOver={event => {
                                                    event.preventDefault();
                                                    setDropAt(index);
                                                }}
                                                onDrop={event =>
                                                    drop(event, index)
                                                }
                                            >
                                                <span>Drop block here</span>
                                            </div>
                                            <div
                                                className={`editable-block ${selected === block.id ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelected(block.id);
                                                    setLeftTab('properties');
                                                }}
                                                onDragOver={event => {
                                                    event.preventDefault();
                                                    setDropAt(index);
                                                }}
                                                onDrop={event =>
                                                    drop(event, index)
                                                }
                                                tabIndex={0}
                                                onKeyDown={event => {
                                                    if (event.key === 'Enter') {
                                                        setSelected(block.id);
                                                        setLeftTab(
                                                            'properties'
                                                        );
                                                    }
                                                }}
                                                aria-label={`Edit ${BLOCKS[block.type]?.label} block ${index + 1}`}
                                            >
                                                <div className="block-tools">
                                                    <button
                                                        className="drag-handle"
                                                        draggable
                                                        onDragStart={event =>
                                                            drag(event, {
                                                                id: block.id
                                                            })
                                                        }
                                                        onDragEnd={() => {
                                                            dragging.current =
                                                                null;
                                                            setDropAt(null);
                                                        }}
                                                        aria-label={`Drag block ${index + 1}`}
                                                    >
                                                        <GripVertical
                                                            size={14}
                                                        />
                                                    </button>
                                                    <span>
                                                        {
                                                            BLOCKS[block.type]
                                                                ?.label
                                                        }
                                                    </span>
                                                    <IconButton
                                                        label={`Move block ${index + 1} up`}
                                                        disabled={index === 0}
                                                        onClick={event => {
                                                            event.stopPropagation();
                                                            moveBlock(
                                                                block.id,
                                                                index - 1
                                                            );
                                                        }}
                                                    >
                                                        <ArrowUp size={13} />
                                                    </IconButton>
                                                    <IconButton
                                                        label={`Move block ${index + 1} down`}
                                                        disabled={
                                                            index ===
                                                            doc.blocks.length -
                                                                1
                                                        }
                                                        onClick={event => {
                                                            event.stopPropagation();
                                                            moveBlock(
                                                                block.id,
                                                                index + 1
                                                            );
                                                        }}
                                                    >
                                                        <ArrowDown size={13} />
                                                    </IconButton>
                                                    <IconButton
                                                        label={`Duplicate block ${index + 1}`}
                                                        onClick={event => {
                                                            event.stopPropagation();
                                                            duplicateBlock(
                                                                block.id
                                                            );
                                                        }}
                                                    >
                                                        <Copy size={13} />
                                                    </IconButton>
                                                    <IconButton
                                                        label={`Remove block ${index + 1}`}
                                                        onClick={event => {
                                                            event.stopPropagation();
                                                            removeBlock(
                                                                block.id
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </IconButton>
                                                </div>
                                                <BlockContent
                                                    block={block}
                                                    doc={doc}
                                                />
                                            </div>
                                        </React.Fragment>
                                    ))}
                                    <div
                                        className={`drop-zone final ${dropAt === doc.blocks.length ? 'over' : ''}`}
                                        onDragOver={event => {
                                            event.preventDefault();
                                            setDropAt(doc.blocks.length);
                                        }}
                                        onDrop={event =>
                                            drop(event, doc.blocks.length)
                                        }
                                    >
                                        <Plus size={14} />
                                        <span>Drag a block here to add it</span>
                                    </div>
                                    <div className="email-footer">
                                        {personalize(doc.footer, doc)}
                                        <span>workshop.example.com</span>
                                    </div>
                                </div>
                            )}
                            {mode === 'preview' && (
                                <iframe
                                    title="Actual rendered React Email HTML"
                                    sandbox=""
                                    srcDoc={
                                        rendered?.html || '<p>Rendering…</p>'
                                    }
                                    className="render-frame"
                                />
                            )}
                            {mode === 'text' && (
                                <pre className="text-preview">
                                    {rendered?.text || 'Rendering…'}
                                </pre>
                            )}
                        </div>
                        <div className="canvas-caption">
                            {mode === 'design'
                                ? 'Click any block to edit · drag its handle to reorder'
                                : 'Rendered on the server with React Email · same HTML used for sending'}
                            <span>
                                {rendering
                                    ? 'Rendering…'
                                    : `${rendered?.bytes?.toLocaleString() || 0} / 50,000 bytes`}
                            </span>
                        </div>
                    </div>
                    <div
                        className={`notice ${error ? 'error' : ''}`}
                        role="status"
                        aria-live="polite"
                    >
                        <span className="dot" />
                        {notice}
                    </div>
                </section>
                {codeOpen && (
                    <aside className="code-panel">
                        <div className="code-heading">
                            <div>
                                <FileCode2 size={16} />
                                <strong>Under the hood</strong>
                            </div>
                            <span className="small-badge">LIVE</span>
                        </div>
                        <p className="code-intro">
                            One message. Every backend language.
                            <br />
                            Code updates with your draft.
                        </p>
                        <label className="field code-language">
                            <span>Integration</span>
                            <select
                                aria-label="Integration language"
                                value={language}
                                onChange={event =>
                                    setLanguage(event.target.value)
                                }
                            >
                                {LANGUAGES.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} · {item.badge}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="code-meta">
                            <span
                                className={`support-badge ${activeLanguage.badge === 'Native SDK' ? 'native' : ''}`}
                            >
                                {activeLanguage.badge}
                            </span>
                            <a
                                href={activeLanguage.source}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Source <ExternalLink size={11} />
                            </a>
                        </div>
                        {activeLanguage.note && (
                            <p className="sdk-note">{activeLanguage.note}</p>
                        )}
                        <div className="install-line">
                            <code>{activeLanguage.install}</code>
                        </div>
                        <div className="code-actions">
                            <button
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(
                                            code
                                        );
                                        setCopied(true);
                                        setTimeout(
                                            () => setCopied(false),
                                            1600
                                        );
                                    } catch {
                                        tell(
                                            'Clipboard unavailable. Select the code to copy it.',
                                            true
                                        );
                                    }
                                }}
                            >
                                {copied ? (
                                    <Check size={13} />
                                ) : (
                                    <Copy size={13} />
                                )}{' '}
                                {copied ? 'Copied' : 'Copy code'}
                            </button>
                            <button
                                disabled={!rendered || rendering}
                                onClick={() =>
                                    download(
                                        'message.json',
                                        JSON.stringify(envelope, null, 2),
                                        'application/json'
                                    )
                                }
                            >
                                <Download size={13} />
                                message.json
                            </button>
                        </div>
                        <pre className="code-view">
                            <code>{code}</code>
                        </pre>
                        <div className="code-export">
                            <button
                                disabled={!rendered || rendering}
                                onClick={() =>
                                    download(
                                        'clerk-release-lab-email.html',
                                        rendered!.html,
                                        'text/html'
                                    )
                                }
                            >
                                <Download size={13} />
                                HTML
                            </button>
                            <button
                                disabled={!rendered || rendering}
                                onClick={() =>
                                    download(
                                        'clerk-release-lab-email.txt',
                                        rendered!.text
                                    )
                                }
                            >
                                <Download size={13} />
                                Text
                            </button>
                            <button
                                disabled={!rendered || rendering}
                                onClick={() =>
                                    download(
                                        'clerk-release-lab-email.mjs',
                                        rendered!.source,
                                        'text/javascript'
                                    )
                                }
                            >
                                <Code2 size={13} />
                                React Email
                            </button>
                        </div>
                        <div className="delivery-panel">
                            <div className="section-label">
                                DELIVERY LAB{' '}
                                <span>
                                    {server?.state
                                        ? `${server.state.attempts.length} REQUESTS`
                                        : 'READY'}
                                </span>
                            </div>
                            <label className="field">
                                <span>Execute using</span>
                                <select
                                    value={transport}
                                    onChange={event =>
                                        setTransport(event.target.value)
                                    }
                                >
                                    <option value="api">
                                        Direct API · POST /v1/email
                                    </option>
                                    <option value="sdk">
                                        @clerk/backend · emails.create()
                                    </option>
                                </select>
                            </label>
                            <div className="delivery-buttons">
                                <button
                                    disabled={busy || !server?.state}
                                    onClick={() => send('retry')}
                                >
                                    <RotateCcw size={12} />
                                    Retry identical
                                </button>
                                <button
                                    disabled={
                                        busy ||
                                        !server?.state?.attempts.some(
                                            attempt => attempt.id
                                        )
                                    }
                                    onClick={() => send('conflict')}
                                >
                                    Test 409
                                </button>
                                <button
                                    disabled={
                                        busy ||
                                        !server?.state?.attempts.some(
                                            attempt => attempt.id
                                        )
                                    }
                                    onClick={() => send('status')}
                                >
                                    Refresh status
                                </button>
                                <button
                                    disabled={busy || !server?.state}
                                    onClick={() => send('reset')}
                                >
                                    New send
                                </button>
                            </div>
                            <pre className="response-view">
                                {server?.state
                                    ? JSON.stringify(
                                          server.state.attempts,
                                          null,
                                          2
                                      )
                                    : 'No email sent.\nSend a test to inspect the real response.'}
                            </pre>
                            {server?.state && (
                                <p className="help">
                                    Retry uses the frozen sent message, even
                                    after draft edits. Key:{' '}
                                    <code>{server.state.key}</code>
                                </p>
                            )}
                            <p className="help">
                                “Accepted” means provider handoff. Check your
                                inbox for arrival.
                            </p>
                        </div>
                    </aside>
                )}
            </main>
            <footer className="app-footer">
                <span>
                    EXAMPLE WORKSHOP <span className="slash">/</span> React
                    Email → HTML + text → Clerk
                </span>
                <span>
                    {server?.assetBase?.startsWith('https://')
                        ? 'HTTPS GIF URLs configured'
                        : 'GIFs available in local preview'}{' '}
                    <i
                        className={`dot ${server?.assetBase ? '' : 'waiting'}`}
                    />
                </span>
            </footer>
            {showSend && (
                <div
                    className="modal-backdrop"
                    onClick={event => {
                        if (event.target === event.currentTarget && !busy) {
                            setShowSend(false);
                        }
                    }}
                >
                    <section
                        className="send-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="send-title"
                    >
                        <div className="modal-title">
                            <div>
                                <span className="section-label">
                                    REAL EMAIL · PRODUCTION INSTANCE
                                </span>
                                <h2 id="send-title">Send it to your inbox.</h2>
                            </div>
                            <IconButton
                                label="Close send dialog"
                                onClick={() => setShowSend(false)}
                                disabled={busy}
                            >
                                <X size={19} />
                            </IconButton>
                        </div>
                        <form
                            onSubmit={event => {
                                event.preventDefault();
                                void send('send');
                            }}
                        >
                            <div className="recipient-mode">
                                <button
                                    type="button"
                                    className={
                                        toMode === 'address' ? 'selected' : ''
                                    }
                                    onClick={() => setToMode('address')}
                                >
                                    Email address
                                </button>
                                <button
                                    type="button"
                                    className={
                                        toMode === 'user' ? 'selected' : ''
                                    }
                                    onClick={() => setToMode('user')}
                                >
                                    Clerk user ID
                                </button>
                            </div>
                            <Field
                                label={
                                    toMode === 'user'
                                        ? 'Recipient user ID'
                                        : 'Recipient email address'
                                }
                                value={to}
                                type={toMode === 'user' ? 'text' : 'email'}
                                required
                                placeholder={
                                    toMode === 'user'
                                        ? 'user_…'
                                        : 'you@example.com'
                                }
                                onChange={setTo}
                            />
                            <div className="send-summary">
                                <span>
                                    FROM{' '}
                                    <strong>
                                        Example Workshop &lt;demo@
                                        {server?.domain}&gt;
                                    </strong>
                                </span>
                                <span>
                                    SUBJECT{' '}
                                    <strong>
                                        {personalize(doc.subject, doc)}
                                    </strong>
                                </span>
                                <span>
                                    TRANSPORT{' '}
                                    <strong>
                                        {transport === 'sdk'
                                            ? '@clerk/backend SDK'
                                            : 'Direct Clerk API'}
                                    </strong>
                                </span>
                            </div>
                            <details>
                                <summary>
                                    CC, BCC, reply-to & attachments
                                </summary>
                                <Field
                                    label="CC (comma-separated)"
                                    value={cc}
                                    onChange={setCc}
                                />
                                <Field
                                    label="BCC (comma-separated)"
                                    value={bcc}
                                    onChange={setBcc}
                                />
                                <Field
                                    label="Reply-to email"
                                    type="email"
                                    value={replyTo}
                                    onChange={setReplyTo}
                                />
                                <label className="field">
                                    <span>
                                        Attachments · up to 10 / 1 MiB total
                                    </span>
                                    <input
                                        type="file"
                                        multiple
                                        onChange={files}
                                    />
                                </label>
                                <small>
                                    {attachments
                                        .map(file => file.filename)
                                        .join(', ')}
                                </small>
                            </details>
                            <p className="help">
                                Sample project content. This sends a real email
                                from the enabled Example Workshop instance.
                                Animated images load from a temporary public
                                HTTPS asset URL while this studio runs.
                            </p>
                            {server?.state && (
                                <div className="send-warning">
                                    A previous send is saved. Use Retry in the
                                    Delivery Lab, or{' '}
                                    <button
                                        type="button"
                                        onClick={() => send('reset')}
                                        disabled={busy}
                                    >
                                        prepare a new send
                                    </button>
                                    .
                                </div>
                            )}
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowSend(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="primary"
                                    type="submit"
                                    disabled={
                                        busy ||
                                        rendering ||
                                        !rendered ||
                                        Boolean(server?.state) ||
                                        !server?.assetBase
                                    }
                                >
                                    {busy ? (
                                        'Sending…'
                                    ) : (
                                        <>
                                            <Send size={14} />
                                            Send test email
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}

function DemoShell() {
    useEffect(() => {
        document.title = 'Example Workshop · Clerk Release Lab';
    }, []);
    const [view, setView] = useState(
        ['start', 'email', 'device', 'mcp'].includes(location.hash.slice(1))
            ? location.hash.slice(1)
            : 'start'
    );
    function choose(next: string) {
        setView(next);
        window.history.replaceState(null, '', `#${next}`);
    }
    return (
        <div className="demo-shell">
            <nav className="demo-switch" aria-label="Demo navigation">
                <span>EXAMPLE WORKSHOP / CLERK RELEASE LAB</span>
                {[
                    ['start', '→', 'Start here'],
                    ['email', '01', 'Email studio'],
                    ['device', '02', 'Device login'],
                    ['mcp', '03', 'MCP & CIMD']
                ].map(([id, number, name]) => (
                    <button
                        key={id}
                        className={view === id ? 'selected' : ''}
                        onClick={() => choose(id)}
                    >
                        <b>{number}</b>
                        {name}
                    </button>
                ))}
            </nav>
            <div className="demo-surface" hidden={view !== 'email'}>
                <App onSetup={() => choose('start')} />
            </div>
            {view === 'start' && <StartHere choose={choose} />}
            {['device', 'mcp'].includes(view) && (
                <AuthLab view={view} onSetup={() => choose('start')} />
            )}
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<DemoShell />);
