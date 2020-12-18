(function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\Title.svelte generated by Svelte v3.31.0 */

    const file = "src\\components\\Title.svelte";

    function create_fragment(ctx) {
    	let header;
    	let div5;
    	let div0;
    	let span;
    	let t1;
    	let div4;
    	let div1;
    	let img0;
    	let t2;
    	let div2;
    	let img1;
    	let t3;
    	let div3;
    	let img2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			header = element("header");
    			div5 = element("div");
    			div0 = element("div");
    			span = element("span");
    			span.textContent = "Flying Butter Studio";
    			t1 = space();
    			div4 = element("div");
    			div1 = element("div");
    			img0 = element("img");
    			t2 = space();
    			div2 = element("div");
    			img1 = element("img");
    			t3 = space();
    			div3 = element("div");
    			img2 = element("img");
    			attr_dev(span, "class", "svelte-1rkf7ba");
    			add_location(span, file, 3, 12, 127);
    			attr_dev(div0, "id", "window-title");
    			attr_dev(div0, "class", "svelte-1rkf7ba");
    			add_location(div0, file, 2, 8, 90);
    			attr_dev(img0, "class", "icon");
    			attr_dev(img0, "alt", "minimize");
    			attr_dev(img0, "srcset", "icons/min-w-10.png 1x, icons/min-w-12.png 1.25x, icons/min-w-15.png 1.5x, icons/min-w-15.png 1.75x, icons/min-w-20.png 2x, icons/min-w-20.png 2.25x, icons/min-w-24.png 2.5x, icons/min-w-30.png 3x, icons/min-w-30.png 3.5x");
    			attr_dev(img0, "draggable", "false");
    			add_location(img0, file, 7, 16, 321);
    			attr_dev(div1, "class", "button svelte-1rkf7ba");
    			attr_dev(div1, "id", "min-button");
    			add_location(div1, file, 6, 12, 226);
    			attr_dev(img1, "class", "icon");
    			attr_dev(img1, "alt", "maximize");
    			attr_dev(img1, "srcset", "icons/max-w-10.png 1x, icons/max-w-12.png 1.25x, icons/max-w-15.png 1.5x, icons/max-w-15.png 1.75x, icons/max-w-20.png 2x, icons/max-w-20.png 2.25x, icons/max-w-24.png 2.5x, icons/max-w-30.png 3x, icons/max-w-30.png 3.5x");
    			attr_dev(img1, "draggable", "false");
    			add_location(img1, file, 11, 16, 735);
    			attr_dev(div2, "class", "button svelte-1rkf7ba");
    			attr_dev(div2, "id", "max-button");
    			add_location(div2, file, 10, 12, 640);
    			attr_dev(img2, "class", "icon svelte-1rkf7ba");
    			attr_dev(img2, "alt", "close");
    			attr_dev(img2, "srcset", "icons/close-w-10.png 1x, icons/close-w-12.png 1.25x, icons/close-w-15.png 1.5x, icons/close-w-15.png 1.75x, icons/close-w-20.png 2x, icons/close-w-20.png 2.25x, icons/close-w-24.png 2.5x, icons/close-w-30.png 3x, icons/close-w-30.png 3.5x");
    			attr_dev(img2, "draggable", "false");
    			add_location(img2, file, 15, 16, 1148);
    			attr_dev(div3, "class", "button svelte-1rkf7ba");
    			attr_dev(div3, "id", "close-button");
    			add_location(div3, file, 14, 12, 1054);
    			attr_dev(div4, "id", "window-controls");
    			attr_dev(div4, "class", "svelte-1rkf7ba");
    			add_location(div4, file, 5, 8, 186);
    			attr_dev(div5, "id", "drag-region");
    			attr_dev(div5, "class", "svelte-1rkf7ba");
    			add_location(div5, file, 1, 4, 58);
    			attr_dev(header, "class", "container text-gray-400 bg-nero-700 svelte-1rkf7ba");
    			add_location(header, file, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div5);
    			append_dev(div5, div0);
    			append_dev(div0, span);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, img0);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			append_dev(div2, img1);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, img2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", /*click_handler*/ ctx[0], false, false, false),
    					listen_dev(div2, "click", /*click_handler_1*/ ctx[1], false, false, false),
    					listen_dev(div3, "click", /*click_handler_2*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Title", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Title> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => window.frame.minimize();
    	const click_handler_1 = () => window.frame.maximize();
    	const click_handler_2 = () => window.frame.close();
    	return [click_handler, click_handler_1, click_handler_2];
    }

    class Title extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Title",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src\index.svelte generated by Svelte v3.31.0 */

    const { console: console_1 } = globals;
    const file$1 = "src\\index.svelte";

    function create_fragment$1(ctx) {
    	let title;
    	let t0;
    	let main;
    	let h1;
    	let current;
    	title = new Title({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(title.$$.fragment);
    			t0 = space();
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "MAJ graphique";
    			attr_dev(h1, "class", "text-center font-bold text-2xl uppercase");
    			add_location(h1, file$1, 169, 4, 6187);
    			attr_dev(main, "class", "container w-screen flex justify-center items-center text-gray-300 bg-nero-600 svelte-1qxak3v");
    			add_location(main, file$1, 168, 0, 6089);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(title, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(title.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(title.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(title, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function cancel() {
    	window.games.cancel();
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Src", slots, []);
    	let launcher = { updateFound: false, downloading: false };

    	let games = {
    		witch_craft: {
    			checkingUpdate: false,
    			wantsToLaunch: false,
    			needsUpdate: undefined,
    			installing: false,
    			updating: false,
    			cleanup: false,
    			downloading: false,
    			progress: 0,
    			...window.games.getDataForGame("witch_craft")
    		}
    	};

    	console.log(window.games.getDataForGame("witch_craft"));

    	if (games.witch_craft.installed) ; //window.games.needsUpdate('witch_craft')

    	window.api.receive("fromMain", data => {
    		if (data.event === "install") {
    			if (data.step === "start") {
    				console.log("preparing installation");
    				console.log(games[data.game]);

    				if (games[data.game].installed) {
    					games[data.game].updating = true;
    					console.log("game installed");
    				} else {
    					games[data.game].installing = true;
    					console.log("game not installed");
    				}

    				games[data.game].progress = 0;
    			}

    			if (data.step === "download") {
    				console.log("downloading " + data.progress + "%");
    				games[data.game].progress = data.progress;
    			}

    			if (data.step === "installation-start") {
    				console.log("starting installation");
    				if (games[data.game].installed) games[data.game].updating = false; else games[data.game].installing = false;
    				games[data.game].cleanup = true;
    			}

    			if (data.step === "installation") {
    				console.log("installing " + data.progress + "%");
    			}

    			if (data.step === "complete") {
    				console.log("installation complete");
    				games[data.game].installed = true;
    				games[data.game].cleanup = false;
    				games[data.game].needsUpdate = false;
    				games[data.game].version = window.games.getDataForGame(data.game).version;
    				if (games[data.game].installed) games[data.game].updating = false; else games[data.game].installing = false;
    				if (games[data.game].wantsToLaunch) window.games.launch(data.game);
    			}
    		}

    		if (data.event === "update-launcher") {
    			if (data.step === "start") {
    				console.log("preparing launcher update");
    			}

    			if (data.step === "found") {
    				console.log("launcher update found");
    				launcher.updateFound = true;
    			}

    			if (data.step === "not-found") console.log("launcher update not found");
    			if (data.step === "download") console.log("downloading launcher update " + data.progress + "%");

    			if (data.step === "complete") {
    				console.log("launcher update complete");
    			}

    			launcher = { ...launcher };
    		}

    		if (data.event === "update") {
    			if (data.step === "uptodate") {
    				games[data.game].updating = false;
    				games[data.game].needsUpdate = false;
    				if (games[data.game].wantsToLaunch) window.games.launch(data.game);
    			}

    			if (data.step === "start") {
    				console.log("preparing update for: " + data.game);
    				games[data.game].updating = true;
    				games[data.game].progress = 0;
    			}

    			if (data.step === "download") {
    				console.log("downloading update " + data.progress + "% for: " + data.game);
    				games[data.game].progress = data.progress;
    			}

    			if (data.step === "installation-start") {
    				games[data.game].cleanup = true;
    			}

    			if (data.step === "complete") {
    				console.log("update complete for: " + data.game);
    				games[data.game].updating = false;
    				games[data.game].cleanup = false;
    				games[data.game].needsUpdate = false;
    				if (games[data.game].wantsToLaunch) window.games.launch(data.game);
    			}
    		}

    		if (data.event === "log") console.log(data.message);
    		games = { ...games };
    	});

    	function install(game) {
    		window.games.install(game);
    		games[game].installing = true;
    		games = { ...games };
    	}

    	function launch(game) {
    		games[game].wantsToLaunch = true;
    		games = { ...games };

    		if (games[game].needsUpdate === undefined) {
    			console.log("checking for update");
    			games[game].updating = true;
    			games = { ...games };
    			return window.games.needsUpdate(game, games[game].version);
    		} else {
    			window.games.launch("witch_craft");
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Src> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Title,
    		launcher,
    		games,
    		cancel,
    		install,
    		launch
    	});

    	$$self.$inject_state = $$props => {
    		if ("launcher" in $$props) launcher = $$props.launcher;
    		if ("games" in $$props) games = $$props.games;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [];
    }

    class Src extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Src",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new Src({
    	target: document.body
    });

}());
