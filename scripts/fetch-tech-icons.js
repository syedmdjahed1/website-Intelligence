const fs = require("fs");
const path = require("path");
const https = require("https");

const outDir = path.join("assets", "tech-icons");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "WebsiteIntelligence/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode !== 200) reject(new Error(`${url} -> ${res.statusCode}`));
          else resolve(buf);
        });
      })
      .on("error", reject);
  });
}

const retries = {
  nuxt: ["nuxt", "nuxtdotjs"],
  cloudfront: ["amazonaws", "amazonwebservices", "amazonecs"],
  "microsoft-clarity": ["microsoftazure", "windows"],
  "open-graph": ["facebook", "meta"],
  "schema-jsonld": ["json"],
  onetrust: ["cookiecutter"],
};

const customs = {
  onetrust:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00563F"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>',
  "open-graph":
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2"><path d="M12 2C6.5 2 2 6.5 2 12c0 4.8 3.4 8.8 7.9 9.8v-6.9H7.4V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.5V12h2.8l-.4 2.9h-2.4v6.9C18.6 20.8 22 16.8 22 12c0-5.5-4.5-10-10-10z"/></svg>',
  "schema-jsonld":
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#990000"><path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3.5 5.5L5.8 12l2.7 3.5h2.2L7.8 12l2.9-3.5H8.5zm7 0h-2.2L16.2 12l-2.9 3.5h2.2L18.2 12 15.5 8.5z"/></svg>',
  "microsoft-clarity":
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00A4EF"><path d="M3 5.5A2.5 2.5 0 015.5 3h5A2.5 2.5 0 0113 5.5v5A2.5 2.5 0 0110.5 13h-5A2.5 2.5 0 013 10.5v-5zm8 8A2.5 2.5 0 0113.5 11h5A2.5 2.5 0 0121 13.5v5A2.5 2.5 0 0118.5 21h-5A2.5 2.5 0 0111 18.5v-5z"/></svg>',
  cloudfront:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF9900"><path d="M6.5 18c-2.5 0-4.5-2-4.5-4.5S4 9 6.5 9c.4-2.5 2.6-4.5 5.2-4.5 2.3 0 4.3 1.5 5 3.6.4-.2.9-.3 1.3-.3 1.9 0 3.5 1.6 3.5 3.5S19.9 15 18 15H6.5z"/></svg>',
  nuxt:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00DC82"><path d="M13.404 3.996L22 19.002H4.694l1.994-3.466h8.722L9.404 3.996h4zM8.11 15.536L3 19.002h7.216l-2.106-3.466z"/></svg>',
};

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));

  for (const [id, slugs] of Object.entries(retries)) {
    if (manifest[id]) continue;
    for (const slug of slugs) {
      try {
        const buf = await get(`https://cdn.simpleicons.org/${slug}`);
        const file = `${id}.svg`;
        fs.writeFileSync(path.join(outDir, file), buf);
        manifest[id] = file;
        console.log("OK", id, slug);
        break;
      } catch {
        console.log("fail", id, slug);
      }
    }
  }

  for (const [id, svg] of Object.entries(customs)) {
    if (!manifest[id]) {
      fs.writeFileSync(path.join(outDir, `${id}.svg`), svg);
      manifest[id] = `${id}.svg`;
      console.log("CUSTOM", id);
    }
  }

  if (manifest.wordpress) {
    fs.copyFileSync(path.join(outDir, manifest.wordpress), path.join(outDir, "wp-theme.svg"));
    fs.copyFileSync(path.join(outDir, manifest.wordpress), path.join(outDir, "wp-plugin.svg"));
    manifest["wp-theme"] = "wp-theme.svg";
    manifest["wp-plugin"] = "wp-plugin.svg";
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("total", Object.keys(manifest).length);
})();
