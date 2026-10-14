const SDK_NOTE =
    'This endpoint is not exposed by the current public SDK. This example calls Clerk directly from your backend.';
export const LANGUAGES = [
    {
        id: 'typescript',
        name: 'TypeScript',
        badge: 'Native SDK',
        install: 'npm install @clerk/backend@3.23.2',
        source: 'https://github.com/clerk/javascript/blob/main/packages/backend/src/api/endpoints/EmailApi.ts'
    },
    {
        id: 'nextjs',
        name: 'Next.js',
        badge: 'Native SDK',
        install: 'npm install @clerk/nextjs',
        source: 'https://clerk.com/docs/reference/backend/overview'
    },
    {
        id: 'react-router',
        name: 'React Router',
        badge: 'Native SDK',
        install: 'npm install @clerk/react-router',
        source: 'https://clerk.com/docs/reference/backend/overview'
    },
    {
        id: 'python',
        name: 'Python',
        badge: 'HTTP fallback',
        install: 'Python 3 · standard library',
        note: SDK_NOTE,
        source: 'https://github.com/clerk/clerk-sdk-python'
    },
    {
        id: 'go',
        name: 'Go',
        badge: 'HTTP fallback',
        install: 'Go · standard library',
        note: SDK_NOTE,
        source: 'https://github.com/clerk/clerk-sdk-go/tree/v2'
    },
    {
        id: 'ruby',
        name: 'Ruby',
        badge: 'HTTP fallback',
        install: 'Ruby · standard library',
        note: SDK_NOTE,
        source: 'https://github.com/clerk/clerk-sdk-ruby'
    },
    {
        id: 'java',
        name: 'Java',
        badge: 'HTTP fallback',
        install: 'Java 11+ · standard library',
        note: SDK_NOTE,
        source: 'https://github.com/clerk/clerk-sdk-java'
    },
    {
        id: 'php',
        name: 'PHP',
        badge: 'HTTP fallback',
        install: 'PHP with cURL extension',
        note: SDK_NOTE,
        source: 'https://github.com/clerk/clerk-sdk-php'
    },
    {
        id: 'csharp',
        name: 'C#',
        badge: 'HTTP fallback',
        install: '.NET 8+ · standard library',
        note: SDK_NOTE,
        source: 'https://github.com/clerk/clerk-sdk-csharp'
    },
    {
        id: 'curl',
        name: 'cURL',
        badge: 'Direct API',
        install: 'cURL · Bash / zsh',
        source: 'https://gist.github.com/jescalan/941a4fe995204d269ce8dc1ec3078bb1'
    },
    {
        id: 'fetch',
        name: 'Fetch',
        badge: 'Direct API',
        install: 'Node.js 22+',
        source: 'https://gist.github.com/jescalan/941a4fe995204d269ce8dc1ec3078bb1'
    },
    {
        id: 'powershell',
        name: 'PowerShell',
        badge: 'Direct API',
        install: 'PowerShell 7+',
        source: 'https://gist.github.com/jescalan/941a4fe995204d269ce8dc1ec3078bb1'
    },
    {
        id: 'frontend',
        name: 'Client SDKs',
        badge: 'Server boundary',
        install:
            'React / JS / Expo / iOS / Android / Flutter / Chrome Extension',
        source: 'https://clerk.com/docs'
    },
    {
        id: 'react-email',
        name: 'React Email',
        badge: 'Template source',
        install: 'npm install react-email@6.11.1 react react-dom',
        source: 'https://react.email/docs/utilities/render'
    },
    {
        id: 'json',
        name: 'Request JSON',
        badge: 'Live payload',
        install: 'Download message.json, then run any example',
        source: 'https://gist.github.com/jescalan/941a4fe995204d269ce8dc1ec3078bb1'
    }
];

export function snippet(id, key = 'rack_demo_replace_with_unique_key') {
    const jsKey = JSON.stringify(key);
    const commonJs = `import { readFile } from 'node:fs/promises';\n\n// Download message.json from the composer.\nconst message = JSON.parse(await readFile('message.json', 'utf8'));\nconst { reply_to, to, ...content } = message;\nconst payload = {\n  ...content,\n  to: to.user_id ? { userId: to.user_id } : to,\n  ...(reply_to ? { replyTo: reply_to } : {}),\n};\n`;
    if (id === 'typescript') {
        return `import { createClerkClient } from '@clerk/backend';\n${commonJs}\nconst clerk = createClerkClient({\n  secretKey: process.env.CLERK_SECRET_KEY,\n});\nconst email = await clerk.emails.create(payload, {\n  idempotencyKey: ${jsKey},\n});\nconsole.log(email.id, email.status);\n`;
    }
    if (id === 'nextjs') {
        return `// Run on the server, e.g. a protected route handler.\nimport { clerkClient } from '@clerk/nextjs/server';\n${commonJs}\nconst clerk = await clerkClient();\nconst email = await clerk.emails.create(payload, {\n  idempotencyKey: ${jsKey},\n});\nconsole.log(email.id, email.status);\n`;
    }
    if (id === 'react-router') {
        return `// Run in a protected server action, never a browser component.\nimport { createClerkClient } from '@clerk/react-router/server';\n${commonJs}\nconst clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });\nconst email = await clerk.emails.create(payload, { idempotencyKey: ${jsKey} });\nconsole.log(email.id, email.status);\n`;
    }
    if (id === 'curl') {
        return `# Download message.json first. Keep the secret in your environment.\ncurl --request POST 'https://api.clerk.com/v1/email' \\\n  --header "Authorization: Bearer $CLERK_SECRET_KEY" \\\n  --header 'Content-Type: application/json' \\\n  --header 'Idempotency-Key: ${key}' \\\n  --data-binary @message.json\n`;
    }
    if (id === 'fetch') {
        return `import { readFile } from 'node:fs/promises';\n\nconst response = await fetch('https://api.clerk.com/v1/email', {\n  method: 'POST',\n  headers: {\n    Authorization: \`Bearer \${process.env.CLERK_SECRET_KEY}\`,\n    'Content-Type': 'application/json',\n    'Idempotency-Key': ${jsKey},\n  },\n  body: await readFile('message.json', 'utf8'),\n});\nconst email = await response.json();\nif (!response.ok) throw new Error(JSON.stringify(email));\nconsole.log(email.id, email.status);\n`;
    }
    if (id === 'python') {
        return `# ${SDK_NOTE}\nimport os, json, urllib.request\n\nwith open('message.json', 'rb') as file:\n    body = file.read()\nrequest = urllib.request.Request(\n    'https://api.clerk.com/v1/email', data=body, method='POST',\n    headers={\n        'Authorization': 'Bearer ' + os.environ['CLERK_SECRET_KEY'],\n        'Content-Type': 'application/json',\n        'User-Agent': 'ClerkReleaseLab/2.0',\n        'Idempotency-Key': '${key}',\n    },\n)\nwith urllib.request.urlopen(request, timeout=20) as response:\n    email = json.load(response)\n    print(email['id'], email['status'])\n`;
    }
    if (id === 'go') {
        return `// ${SDK_NOTE}\npackage main\n\nimport ("bytes"; "fmt"; "io"; "net/http"; "os"; "time")\n\nfunc main() {\n  body, err := os.ReadFile("message.json"); if err != nil { panic(err) }\n  req, err := http.NewRequest("POST", "https://api.clerk.com/v1/email", bytes.NewReader(body))\n  if err != nil { panic(err) }\n  req.Header.Set("Authorization", "Bearer " + os.Getenv("CLERK_SECRET_KEY"))\n  req.Header.Set("Content-Type", "application/json")\n  req.Header.Set("User-Agent", "ClerkReleaseLab/2.0")\n  req.Header.Set("Idempotency-Key", "${key}")\n  client := &http.Client{Timeout: 20 * time.Second}\n  res, err := client.Do(req); if err != nil { panic(err) }; defer res.Body.Close()\n  result, err := io.ReadAll(res.Body); if err != nil { panic(err) }\n  if res.StatusCode >= 400 { panic(string(result)) }\n  fmt.Println(string(result))\n}\n`;
    }
    if (id === 'ruby') {
        return `# ${SDK_NOTE}\nrequire 'net/http'\nrequire 'json'\n\nuri = URI('https://api.clerk.com/v1/email')\nrequest = Net::HTTP::Post.new(uri)\nrequest['Authorization'] = "Bearer #{ENV.fetch('CLERK_SECRET_KEY')}"\nrequest['Content-Type'] = 'application/json'\nrequest['User-Agent'] = 'ClerkReleaseLab/2.0'\nrequest['Idempotency-Key'] = '${key}'\nrequest.body = File.read('message.json')\nresponse = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 20) { |http| http.request(request) }\nraise response.body unless response.is_a?(Net::HTTPSuccess)\nputs JSON.parse(response.body)\n`;
    }
    if (id === 'java') {
        return `// ${SDK_NOTE}\nimport java.net.URI;\nimport java.net.http.*;\nimport java.nio.file.*;\nimport java.time.Duration;\n\nclass SendEmail {\n  public static void main(String[] args) throws Exception {\n    var request = HttpRequest.newBuilder(URI.create("https://api.clerk.com/v1/email"))\n      .timeout(Duration.ofSeconds(20))\n      .header("Authorization", "Bearer " + System.getenv("CLERK_SECRET_KEY"))\n      .header("Content-Type", "application/json")\n      .header("User-Agent", "ClerkReleaseLab/2.0")\n      .header("Idempotency-Key", "${key}")\n      .POST(HttpRequest.BodyPublishers.ofString(Files.readString(Path.of("message.json"))))\n      .build();\n    var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());\n    if (response.statusCode() >= 400) throw new RuntimeException(response.body());\n    System.out.println(response.body());\n  }\n}\n`;
    }
    if (id === 'php') {
        return `<?php\n// ${SDK_NOTE}\n$ch = curl_init('https://api.clerk.com/v1/email');\ncurl_setopt_array($ch, [\n    CURLOPT_POST => true,\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_TIMEOUT => 20,\n    CURLOPT_USERAGENT => 'ClerkReleaseLab/2.0',\n    CURLOPT_HTTPHEADER => [\n        'Authorization: Bearer ' . getenv('CLERK_SECRET_KEY'),\n        'Content-Type: application/json',\n        'Idempotency-Key: ${key}',\n    ],\n    CURLOPT_POSTFIELDS => file_get_contents('message.json'),\n]);\n$result = curl_exec($ch);\nif ($result === false) throw new RuntimeException(curl_error($ch));\n$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);\ncurl_close($ch);\nif ($status >= 400) throw new RuntimeException($result);\necho $result;\n`;
    }
    if (id === 'csharp') {
        return `// ${SDK_NOTE}\nusing System.Net.Http;\nusing System.Text;\n\nusing var client = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };\nusing var request = new HttpRequestMessage(HttpMethod.Post, "https://api.clerk.com/v1/email");\nrequest.Headers.Add("Authorization", "Bearer " + Environment.GetEnvironmentVariable("CLERK_SECRET_KEY"));\nrequest.Headers.Add("User-Agent", "ClerkReleaseLab/2.0");\nrequest.Headers.Add("Idempotency-Key", "${key}");\nrequest.Content = new StringContent(await File.ReadAllTextAsync("message.json"), Encoding.UTF8, "application/json");\nusing var response = await client.SendAsync(request);\nvar body = await response.Content.ReadAsStringAsync();\nif (!response.IsSuccessStatusCode) throw new Exception(body);\nConsole.WriteLine(body);\n`;
    }
    if (id === 'powershell') {
        return `$headers = @{\n  Authorization = "Bearer $env:CLERK_SECRET_KEY"\n  'Idempotency-Key' = '${key}'\n}\nInvoke-RestMethod -Method Post \\\n  -Uri 'https://api.clerk.com/v1/email' \\\n  -Headers $headers -ContentType 'application/json' \\\n  -Body (Get-Content -Raw message.json)\n`.replaceAll(
            '\\\n',
            '`\n'
        );
    }
    if (id === 'frontend') {
        return `// React / JS / Expo / Chrome Extension: call YOUR authenticated backend.\n// iOS, Android and Flutter follow the same boundary with their HTTP clients.\n// Never put a Clerk secret key into a browser or mobile bundle.\n\nconst response = await fetch('/api/send-project-email', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: \`Bearer \${await getToken()}\`,\n  },\n  body: JSON.stringify({ projectId: 'your_project_id' }),\n});\n\n// On the backend: verify Clerk authentication and project ownership,\n// derive the recipient and content server-side, then use the TypeScript\n// SDK or direct HTTP example. This route name is illustrative.\n\n// Other server JS frameworks (Express, Fastify, Hono, Astro, Nuxt,\n// Remix, TanStack Start, Elysia) can use @clerk/backend in server code.\n`;
    }
    return '';
}
