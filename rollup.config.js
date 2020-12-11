import svelte from 'rollup-plugin-svelte';
import { terser } from 'rollup-plugin-terser';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

const production = !process.env.ROLLUP_WATCH;

let files = ['index', 'test']
export default files.map((name, index) => ({
	input: `src/${name}.js`,
	output: {
		file: `electron/public/${name}.js`,
		format: 'iife',
		name: 'app',
		sourcemap: false
	},
	plugins: [
		resolve({
			browser: true,
			//dedupe: importee => importee === 'svelte' || importee.startsWith('svelte/')
		}),
		commonjs(),
		svelte({
			dev: !production,
			css: css => {
				css.write(`electron/public/${name}.css`);
			}
		}),
		production && terser()
	],
	watch: {
		clearScreen: false
	},
}))
