class FragmentRenderer {
	constructor(sourceURLString, pageId) {
		this.sourceURL = new URL(sourceURLString);
		this.pageId = pageId;
	}

	async element(element) {
		const headerContents = await (await fetch(`${this.sourceURL.origin}/${this.pageId}.plain.html`)).text();
		element.setInnerContent(headerContents, {html: true});
	}
}

class BlockRewriter {
	constructor() {
	}

	element(element) {
		const classes = element.getAttribute('class').split(' ');
		const blockName = classes[0];

		element.setAttribute('brick', blockName);
    element.setAttribute('class', classes.slice(1).join(' '));
    element.tagName = `aem-${blockName}`;

		if(element.getAttribute('class') === '') {
			element.removeAttribute('class')
		}
	}
}

function checkSourceURL(u) {
	const allowedHosts = ['bricks.albertodicagno.com', 'aem.live', 'www.aem.live']
	const uu = new URL(u);
	return allowedHosts.includes(uu.host);
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const sourceUrl = url.searchParams.get('source'); // get a query param value (?redirectUrl=...)

		if (!sourceUrl) {
			return new Response('Bad request: Missing `source` query param', { status: 400 });
		}
		if (!checkSourceURL(sourceUrl)) {
			return new Response('Forbidden: Source domain not allowed', { status: 403 });
		}

		const rewriter = new HTMLRewriter()
			.on('header', new FragmentRenderer(sourceUrl, 'new-nav'))
			.on('footer', new FragmentRenderer(sourceUrl, 'footer'))
			.on('div > div[class]', new BlockRewriter());
		const res = await fetch(sourceUrl);
		const sourceContentType = res.headers.get('Content-Type');

		// If the response is HTML, it can be transformed with
		// HTMLRewriter -- otherwise, it should pass through
		if (sourceContentType.startsWith('text/html')) {
			return rewriter.transform(res);
		}
		return res;
	}
};
