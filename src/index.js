import { Router } from 'itty-router';
import { createCors } from 'itty-cors'

const { preflight, corsify } = createCors({
  methods: ['GET', 'PATCH', 'POST', 'OPTIONS'],
  origins: [
		'https://translate.project-bricks.com',
		'http://localhost:3000',
		'http://localhost:8880',
	],
})

const apiError = (status, message) => new Response(message, { status });

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
	constructor(brickList) {
		this.brickList = brickList;
	}

	element(element) {
		const classes = element.getAttribute('class').split(' ');
		const blockName = classes[0];

		element.setAttribute('brick', blockName);
		element.setAttribute('class', classes.slice(1).join(' '));
		element.tagName = `aem-${blockName}`;

		if(!this.brickList.includes(element.tagName)) {
			this.brickList.push(element.tagName);
			console.log('tagName', element.tagName)
		}

		if(element.getAttribute('class') === '') {
			element.removeAttribute('class')
		}
	}
}

class SectionRewriter {
	constructor() {
	}

	element(element) {
		const classList = element.getAttribute('class')
		element.setTagName('section')
		const updatedClassList = classList.split(' ').filter(className => className !== 'section').join(' ')
		element.setAttribute('class', updatedClassList)
	}
}

class BricksMetaTagger {
	constructor(brickList) {
		this.brickList = brickList;
	}

	element(element) {
		console.log('BricksMetaTagger', this.brickList)
		element.append(`<meta name="aem:brick-list" content="${this.brickList.join(',')}" />`)
	}
}

class BricksMetaReducer {
	constructor(brickList) {
		this.brickList = brickList;
	}

	end(end) {
		console.log(this.brickList)
		end.append(`<!-- brickList=${this.brickList.join(',')} -->`, { html: true })
	}
}

function checkSourceURL(u) {
	const allowedHosts = ['bricks.albertodicagno.com', 'aem.live', 'www.aem.live', 'main--maidenform--hlxsites.hlx.page', 'main--maidenform--hlxsites.hlx.live'];
	const uu = new URL(u);
	return allowedHosts.includes(uu.host);
}

// now let's create a router (note the lack of "new")
const router = Router();

router.all('*', preflight);

router.get('/api/v1/translate', async (request) => {
	const url = new URL(request.url);
	const sourceUrl = url.searchParams.get('source');

	if (!sourceUrl) {
		return new Response('Bad request: Missing `source` query param', { status: 400 });
	}
	if (!checkSourceURL(sourceUrl)) {
		return new Response('Forbidden: Source domain not allowed', { status: 403 });
	}

	const brickList = ['aem-root', 'aem-header', 'aem-footer'];

	const rewriter = new HTMLRewriter()
		// .on('header', new FragmentRenderer(sourceUrl, 'new-nav'))
		// .on('footer', new FragmentRenderer(sourceUrl, 'footer'))
		.on('div > div[class]', new BlockRewriter(brickList))
		.on('div.section', new SectionRewriter())
		.onDocument(new BricksMetaReducer(brickList));

	const res = await fetch(sourceUrl);
	const sourceContentType = res.headers.get('Content-Type');

	if (sourceContentType.startsWith('text/html')) {
		return rewriter.transform(res);
	}

	return res;
});

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }));

export default {
	fetch: (...args) => router
		.handle(...args)
		.catch(err => apiError(500, err.stack))
		.then(corsify) // cors should be applied to error responses as well
};
