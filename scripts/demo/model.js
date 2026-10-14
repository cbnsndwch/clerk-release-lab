export const ASSETS = [
  {
    id: "starter-rack",
    name: "Starter Rack · plan in 3D",
    file: "starter-rack.gif",
    credit: "Synthetic sample animation; no customer project data",
    source: "scripts/generate-assets.py",
    bytes: 0,
  },
  {
    id: "compute-shelf",
    name: "Compute Shelf · sample compute shelf",
    file: "compute-shelf.gif",
    credit: "Synthetic sample animation; no customer project data",
    source: "scripts/generate-assets.py",
    bytes: 0,
  },
];

export const BLOCKS = {
  heading: { label: "Heading", icon: "T", text: "Built for your next idea." },
  text: {
    label: "Paragraph",
    icon: "¶",
    text: "Hi {{firstName}}, your {{projectName}} project is ready for its next step.",
  },
  image: {
    label: "Project GIF",
    icon: "▧",
    asset: "starter-rack",
    alt: "Starter Rack assembling in Example Workshop",
    caption: "Plan it in 3D. Before you build it.",
  },
  button: {
    label: "Button",
    icon: "↗",
    text: "Open your project",
    url: "https://workshop.example.com",
    align: "left",
  },
  stats: {
    label: "Project stats",
    icon: "▥",
    values: "6U|Rack height\n12|Components\n34|Printed parts",
  },
  divider: { label: "Divider", icon: "—" },
  spacer: { label: "Spacer", icon: "↕", height: 24 },
};

export function newBlock(type) {
  return { ...BLOCKS[type], type, id: crypto.randomUUID() };
}

export function template(which = "ready") {
  const doc = {
    template: which,
    name: "Project ready",
    subject: "Your {{projectName}} design is ready",
    preheader: "The plan is ready. Time to make it real.",
    accent: "#d6b169",
    theme: "dark",
    firstName: "Alex",
    projectName: "Starter Rack",
    footer:
      "Measure twice, rack once.\nA sample notification from the Example Workshop email studio.",
    blocks: [],
  };
  if (which === "community") {
    Object.assign(doc, {
      name: "Shared build",
      subject: "{{firstName}}, take a look at this community build",
      preheader: "A fictional project, ready to explore.",
      projectName: "Compute Shelf",
    });
    doc.blocks = [
      { type: "heading", text: "A build worth sharing." },
      {
        type: "text",
        text: "Hi {{firstName}}, here’s {{projectName}}: an fictional compute shelf. Open the template, explore the layout, and make it yours.",
      },
      {
        type: "image",
        asset: "compute-shelf",
        alt: "The Compute Shelf cluster assembling shelf by shelf",
        caption: "A sample compute shelf.",
      },
      { type: "stats", values: "8|Compute modules\n1|Wire shelf\n∞|Possibilities" },
      {
        type: "button",
        text: "Explore the build",
        url: "https://workshop.example.com",
        align: "center",
      },
    ];
  } else if (which === "parts") {
    Object.assign(doc, {
      name: "Parts ready",
      subject: "Your {{projectName}} parts list is ready",
      preheader: "From plan to parts. Your next step is in the workshop.",
      theme: "light",
    });
    doc.blocks = [
      { type: "heading", text: "From plan to parts." },
      {
        type: "text",
        text: "Hi {{firstName}}, your {{projectName}} sample build has a parts list. Review the dimensions before you buy, drill, or print.",
      },
      { type: "stats", values: "34|Printed parts\n6U|Rack height\n1|Build plan" },
      {
        type: "image",
        asset: "starter-rack",
        alt: "Starter Rack project assembling in Example Workshop",
        caption: "Everything in its place.",
      },
      {
        type: "button",
        text: "Review your parts",
        url: "https://workshop.example.com",
        align: "left",
      },
      { type: "divider" },
      {
        type: "text",
        text: "These are sample project values for the email demo; they are not a fabrication approval.",
      },
    ];
  } else {
    doc.blocks = [
      { type: "heading", text: "Your next build starts here." },
      {
        type: "text",
        text: "Hi {{firstName}}, your {{projectName}} sample design is ready to explore. Plan the space, check the fit, and get one step closer to the workbench.",
      },
      {
        type: "image",
        asset: "starter-rack",
        alt: "Starter Rack project assembling in Example Workshop",
        caption: "Plan your rack before you build it.",
      },
      { type: "stats", values: "6U|Rack height\n12|Components\n34|Printed parts" },
      {
        type: "button",
        text: "Open your project",
        url: "https://workshop.example.com",
        align: "left",
      },
    ];
  }
  doc.blocks = doc.blocks.map((block) => ({ ...block, id: crypto.randomUUID() }));
  return doc;
}

export function personalize(text, doc) {
  return String(text ?? "")
    .replaceAll("{{firstName}}", doc.firstName || "builder")
    .replaceAll("{{projectName}}", doc.projectName || "rack");
}

// A small, HTML-free inline format shared by the editor and email renderer.
export function inlineNodes(text, depth = 0) {
  text = String(text ?? "");
  if (depth > 16) {
    return [text];
  }
  const nodes = [];
  const markers = [
    ["**", "strong"],
    ["__", "u"],
    ["~~", "s"],
    ["*", "em"],
  ];
  let plain = "";
  for (let i = 0; i < text.length;) {
    const match = markers.find(
      ([mark]) => text.startsWith(mark, i) && text.indexOf(mark, i + mark.length) > i + mark.length,
    );
    if (!match) {
      plain += text[i++];
      continue;
    }
    if (plain) {
      nodes.push(plain);
      plain = "";
    }
    const [mark, tag] = match;
    const end = text.indexOf(mark, i + mark.length);
    nodes.push({ tag, children: inlineNodes(text.slice(i + mark.length, end), depth + 1) });
    i = end + mark.length;
  }
  if (plain) {
    nodes.push(plain);
  }
  return nodes;
}

export function formatSelection(text, start, end, marker) {
  if (start === end) {
    return { text, start, end };
  }
  if (
    text.slice(start - marker.length, start) === marker &&
    text.slice(end, end + marker.length) === marker
  ) {
    return {
      text:
        text.slice(0, start - marker.length) +
        text.slice(start, end) +
        text.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }
  return {
    text: text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end),
    start: start + marker.length,
    end: end + marker.length,
  };
}

export function validateDocument(doc) {
  if (!doc || !Array.isArray(doc.blocks) || doc.blocks.length > 40 || doc.blocks.length < 1) {
    throw new Error("Use between 1 and 40 blocks.");
  }
  for (const field of ["subject", "preheader", "firstName", "projectName", "footer"]) {
    if (typeof doc[field] !== "string" || doc[field].length > (field === "footer" ? 2000 : 998)) {
      throw new Error(`Invalid ${field}.`);
    }
  }
  if (!doc.subject.trim()) {
    throw new Error("Add an email subject.");
  }
  if (!/^#[a-f\d]{6}$/i.test(doc.accent)) {
    throw new Error("Choose a valid brand color.");
  }
  if (!["dark", "light"].includes(doc.theme)) {
    throw new Error("Choose a valid email theme.");
  }
  for (const block of doc.blocks) {
    if (!BLOCKS[block.type]) {
      throw new Error("Unknown content block.");
    }
    if (
      block.align !== undefined &&
      !["left", "center", "right", "justify"].includes(block.align)
    ) {
      throw new Error("Choose left, center, right or justify alignment.");
    }
    for (const key of ["text", "caption", "alt", "values"]) {
      if (
        block[key] !== undefined &&
        (typeof block[key] !== "string" || block[key].length > 5000)
      ) {
        throw new Error(`Block ${key} is too long.`);
      }
    }
    if (block.type === "image" && !ASSETS.some((asset) => asset.id === block.asset)) {
      throw new Error("Select a project GIF.");
    }
    if (block.type === "button") {
      const url = new URL(block.url);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Buttons need a public HTTPS link.");
      }
    }
    if (
      block.type === "spacer" &&
      (!Number.isFinite(Number(block.height)) ||
        Number(block.height) < 8 ||
        Number(block.height) > 100)
    ) {
      throw new Error("Spacer height must be 8–100 pixels.");
    }
  }
  return structuredClone(doc);
}
