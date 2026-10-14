import React from 'react';
import {
    Html,
    Head,
    Preview,
    Body,
    Container,
    Section,
    Heading,
    Text,
    Img,
    Button,
    Hr,
    Row,
    Column,
    render,
    toPlainText
} from 'react-email';

import { ASSETS, personalize, inlineNodes, validateDocument } from './model.ts';
import type { EmailDocument, InlineNode } from './types.ts';

const h = React.createElement;

function richText(text: unknown, doc: EmailDocument) {
    function nodes(items: InlineNode[]): React.ReactNode[] {
        return items.map((item, key) =>
            typeof item === 'string'
                ? personalize(item, doc)
                : h(item.tag, { key }, nodes(item.children))
        );
    }
    return nodes(inlineNodes(text));
}

export function WorkshopEmail({
    document: doc,
    assetBase
}: {
    document: EmailDocument;
    assetBase: string;
}) {
    const dark = doc.theme === 'dark';
    const background = dark ? '#0c0e11' : '#edefee';
    const surface = dark ? '#14171b' : '#ffffff';
    const color = dark ? '#e7eaec' : '#181b1d';
    const muted = dark ? '#98a2a8' : '#5d686b';
    const brass = dark ? doc.accent : '#8d6a1c';
    const blocks = doc.blocks.map(block => {
        const text = personalize(block.text, doc);
        const key = block.id;
        if (block.type === 'heading') {
            return h(
                Heading,
                {
                    key,
                    style: {
                        color,
                        fontSize: 34,
                        lineHeight: '39px',
                        letterSpacing: '-1px',
                        margin: '24px 0 14px',
                        textAlign: block.align || 'left'
                    }
                },
                richText(block.text, doc)
            );
        }
        if (block.type === 'text') {
            return h(
                Text,
                {
                    key,
                    style: {
                        color: muted,
                        fontSize: 15,
                        lineHeight: '25px',
                        whiteSpace: 'pre-line',
                        margin: '16px 0',
                        textAlign: block.align || 'left'
                    }
                },
                richText(block.text, doc)
            );
        }
        if (block.type === 'image') {
            const asset = ASSETS.find(item => item.id === block.asset);
            return h(
                Section,
                { key, style: { margin: '24px 0' } },
                h(Img, {
                    src: `${assetBase}/${asset!.file}`,
                    alt: personalize(block.alt, doc),
                    width: 536,
                    style: { width: '100%', height: 'auto', borderRadius: 8 }
                }),
                h(
                    Text,
                    {
                        style: {
                            color: muted,
                            fontSize: 12,
                            lineHeight: '19px',
                            margin: '10px 0 0'
                        }
                    },
                    personalize(block.caption, doc)
                ),
                asset!.id === 'compute-shelf'
                    ? h(
                          Text,
                          {
                              style: {
                                  color: muted,
                                  fontSize: 11,
                                  lineHeight: '17px',
                                  margin: '4px 0 0'
                              }
                          },
                          asset!.credit
                      )
                    : null
            );
        }
        if (block.type === 'button') {
            return h(
                Section,
                {
                    key,
                    style: {
                        margin: '26px 0',
                        textAlign: block.align === 'center' ? 'center' : 'left'
                    }
                },
                h(
                    Button,
                    {
                        href: block.url,
                        style: {
                            backgroundColor: brass,
                            color: dark ? '#0c0e11' : '#ffffff',
                            borderRadius: 6,
                            padding: '15px 24px',
                            fontSize: 14,
                            fontWeight: 700,
                            textDecoration: 'none'
                        }
                    },
                    `${text} →`
                )
            );
        }
        if (block.type === 'divider') {
            return h(Hr, {
                key,
                style: {
                    borderColor: dark ? '#2c3238' : '#d2d6d5',
                    margin: '24px 0'
                }
            });
        }
        if (block.type === 'spacer') {
            return h(
                Section,
                { key, style: { height: Number(block.height) } },
                '\u00a0'
            );
        }
        if (block.type === 'stats') {
            return h(
                Section,
                {
                    key,
                    style: {
                        backgroundColor: dark ? '#1c2025' : '#f1f3f2',
                        borderRadius: 8,
                        padding: '18px 16px',
                        margin: '24px 0'
                    }
                },
                h(
                    Row,
                    { children: [] },
                    ...String(block.values)
                        .split('\n')
                        .slice(0, 3)
                        .map((line, index) => {
                            const [value, label] = line.split('|');
                            return h(
                                Column,
                                {
                                    key: index,
                                    style: {
                                        width: '33%',
                                        verticalAlign: 'top'
                                    }
                                },
                                h(
                                    Text,
                                    {
                                        style: {
                                            fontSize: 26,
                                            fontWeight: 700,
                                            color: brass,
                                            margin: '0 0 4px'
                                        }
                                    },
                                    personalize(value, doc)
                                ),
                                h(
                                    Text,
                                    {
                                        style: {
                                            fontSize: 11,
                                            color: muted,
                                            margin: 0
                                        }
                                    },
                                    personalize(label, doc)
                                )
                            );
                        })
                )
            );
        }
        return null;
    });
    return h(
        Html,
        { lang: 'en' },
        h(Head),
        h(Preview, { children: personalize(doc.preheader, doc) }),
        h(
            Body,
            {
                style: {
                    backgroundColor: background,
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    margin: 0,
                    padding: '32px 12px'
                }
            },
            h(
                Container,
                {
                    style: {
                        maxWidth: 600,
                        margin: '0 auto',
                        backgroundColor: surface,
                        border: `1px solid ${dark ? '#2c3238' : '#d2d6d5'}`,
                        borderRadius: 12
                    }
                },
                h(
                    Section,
                    { style: { padding: '30px 32px' } },
                    h(
                        Text,
                        {
                            style: {
                                color: brass,
                                fontSize: 13,
                                fontWeight: 700,
                                letterSpacing: 3,
                                margin: '0 0 12px'
                            }
                        },
                        '▥  EXAMPLE WORKSHOP'
                    ),
                    ...blocks,
                    h(Hr, {
                        style: {
                            borderColor: dark ? '#2c3238' : '#d2d6d5',
                            margin: '30px 0 18px'
                        }
                    }),
                    h(
                        Text,
                        {
                            style: {
                                color: muted,
                                fontSize: 11,
                                lineHeight: '19px',
                                whiteSpace: 'pre-line',
                                margin: 0
                            }
                        },
                        personalize(doc.footer, doc)
                    ),
                    h(
                        Text,
                        {
                            style: {
                                color: brass,
                                fontSize: 11,
                                margin: '8px 0 0'
                            }
                        },
                        'workshop.example.com'
                    )
                )
            )
        )
    );
}

export async function renderDocument(
    document: EmailDocument,
    assetBase: string
) {
    const doc = validateDocument(document);
    const html = await render(h(WorkshopEmail, { document: doc, assetBase }));
    const text = toPlainText(html);
    const bytes = Buffer.byteLength(html + text, 'utf8');
    if (bytes > 50000) {
        throw new Error(
            'Rendered HTML and text exceed Clerk’s 50,000-byte limit. Remove some blocks.'
        );
    }
    const source = `// Exported from Example Workshop Email Studio. Install react-email@6.11.1, react and react-dom.\nimport React from 'react';\nimport { Html, Head, Preview, Body, Container, Section, Heading, Text, Img, Button, Hr, Row, Column, render, toPlainText } from 'react-email';\n\nconst h = React.createElement;\nconst ASSETS = ${JSON.stringify(ASSETS, null, 2)};\n${personalize.toString()}\n${inlineNodes.toString()}\n${richText.toString()}\n\nexport ${WorkshopEmail.toString()}\n\nconst document = ${JSON.stringify(doc, null, 2)};\nconst assetBase = ${JSON.stringify(assetBase)};\nexport const html = await render(h(WorkshopEmail, { document, assetBase }));\nexport const text = toPlainText(html);\n`;
    return {
        html,
        text,
        bytes,
        subject: personalize(doc.subject, doc),
        document: doc,
        source
    };
}
