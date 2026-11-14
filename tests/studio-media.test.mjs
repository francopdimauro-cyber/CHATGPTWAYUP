import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const media=file('src/studio-media.js');
const client=file('public/studio-media.js');
const studio=file('public/studio.js');
const worker=file('src/worker.js');
const build=file('scripts/build.mjs');
const styles=file('public/studio-media.css');
const output=file('dist/worker.js');

test('media route is private and only serves safe raster formats',()=>{
 assert.match(worker,/ctx\.access\.getIdentity\(\)/);
 assert.ok(worker.indexOf('ctx.access.getIdentity()')<worker.indexOf('return handleStudioMedia(request,env,url)'));
 assert.match(media,/STUDIO_MEDIA_TYPES=new Set\(\['image\/jpeg','image\/png','image\/webp'\]\)/);
 assert.match(media,/studioMediaCheckType/);
 assert.match(media,/STUDIO_MEDIA_MAX=5\*1024\*1024/);
 assert.match(media,/request\.headers\.get\('origin'\)!==url\.origin/);
 assert.doesNotMatch(media,/image\/svg\+xml/);
});
test('exact 10 images daily with D1 atomic quota and explicit Cloudflare binding checks',()=>{
 assert.match(media,/STUDIO_MEDIA_DAILY_AI=10/);
 assert.match(media,/STUDIO_MEDIA_DAILY_AI\)\.first\(\)/);
 assert.match(media,/ON CONFLICT\(day\) DO UPDATE SET used=used\+1 WHERE used < \?/);
 assert.match(media,/if\(!env\.AI\|\|!env\.USAGE_DB\)/);
 assert.match(media,/if\(!env\.STUDIO_ASSETS\)/);
 assert.match(media,/STUDIO_MEDIA_MODEL='@cf\/black-forest-labs\/flux-1-schnell'/);
 assert.match(client,/10 im.genes diarias/);
 assert.match(file('migrations/0003_studio_media.sql'),/CREATE TABLE IF NOT EXISTS studio_image_quota/);
});
test('Studio supports upload, media library, AI images, crop and portable export',()=>{
 assert.match(client,/wcMediaGallery/);
 assert.match(client,/wcMediaFile/);
 assert.match(client,/wcMediaRunAI/);
 assert.match(client,/portableHTML/);
 assert.match(client,/warmPreview/);
 assert.match(studio,/wcMediaPick/);
 assert.match(studio,/wcImageStyle/);
 assert.match(studio,/wcFit/);
 assert.match(studio,/wcPosition/);
 assert.match(studio,/window\.WebCreatorMedia\?\.portableHTML/);
 assert.match(studio,/window\.WebCreatorMedia\?\.warmPreview/);
 assert.match(styles,/@media\(max-width:710px\)/);
 assert.doesNotThrow(()=>new vm.Script(media,{filename:'studio-media-server.js'}));
 assert.doesNotThrow(()=>new vm.Script(client,{filename:'studio-media-client.js'}));
});
test('media assets, UI and original agent are bundled into the Worker',()=>{
 assert.match(build,/studio-media\.js/);
 assert.match(build,/studio-media\.css/);
 assert.match(build,/src\/studio-media\.js/);
 assert.match(output,/handleStudioMedia/);
 assert.match(output,/wcMediaGallery/);
 assert.match(output,/WebCreatorMedia/);
 assert.match(output,/STUDIO_MEDIA_DAILY_AI=10/);
 assert.match(output,/OPENROUTER_API_KEY/);
 assert.match(output,/nvidia\/nemotron-3-ultra-550b-a55b:free/);
});
