/**
 * Resolves local brand icons for known technology IDs.
 * Icons live in assets/tech-icons/ (bundled Simple Icons / custom SVGs).
 */

const ICON_FILES = {
  react: "react.svg",
  vue: "vue.svg",
  angular: "angular.svg",
  jquery: "jquery.svg",
  bootstrap: "bootstrap.svg",
  tailwind: "tailwind.svg",
  nextjs: "nextjs.svg",
  nuxt: "nuxt.svg",
  svelte: "svelte.svg",
  "font-awesome": "font-awesome.svg",
  wordpress: "wordpress.svg",
  shopify: "shopify.svg",
  woocommerce: "woocommerce.svg",
  laravel: "laravel.svg",
  php: "php.svg",
  nodejs: "nodejs.svg",
  cloudflare: "cloudflare.svg",
  akamai: "akamai.svg",
  fastly: "fastly.svg",
  cloudfront: "cloudfront.svg",
  jsdelivr: "jsdelivr.svg",
  unpkg: "unpkg.svg",
  "google-analytics": "google-analytics.svg",
  "google-tag-manager": "google-tag-manager.svg",
  "meta-pixel": "meta-pixel.svg",
  "microsoft-clarity": "microsoft-clarity.svg",
  hotjar: "hotjar.svg",
  "tiktok-pixel": "tiktok-pixel.svg",
  "open-graph": "open-graph.svg",
  "twitter-cards": "twitter-cards.svg",
  "schema-jsonld": "schema-jsonld.svg",
  webpack: "webpack.svg",
  "google-adsense": "google-adsense.svg",
  onetrust: "onetrust.svg",
  hsts: "hsts.svg",
  http2: "http2.svg",
  "wp-theme": "wp-theme.svg",
  "wp-plugin": "wp-plugin.svg",
};

/**
 * @param {string} techId
 * @returns {string | null} chrome-extension URL or null
 */
export function getTechIconUrl(techId) {
  if (!techId) return null;

  let file = ICON_FILES[techId];
  if (!file && techId.startsWith("wp-theme-")) file = ICON_FILES["wp-theme"];
  if (!file && techId.startsWith("wp-plugin-")) file = ICON_FILES["wp-plugin"];
  if (!file) return null;

  try {
    return chrome.runtime.getURL(`assets/tech-icons/${file}`);
  } catch {
    return null;
  }
}
