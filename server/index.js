export default {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) {
      return new Response("Site assets are unavailable", { status: 503 });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    const url = new URL(request.url);
    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  },
};
