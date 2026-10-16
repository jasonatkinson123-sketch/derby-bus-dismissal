import {defineConfig} from 'vite';
import vinext from 'vinext';
import {cloudflare} from '@cloudflare/vite-plugin';

// Standalone Worker deployment. No ChatGPT Sites hosting dependencies.
export default defineConfig({
  plugins:[
    vinext(),
    cloudflare({viteEnvironment:{name:'rsc',childEnvironments:['ssr']}})
  ]
});
