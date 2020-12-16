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
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
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

    /* src\index.svelte generated by Svelte v3.31.0 */

    const { console: console_1 } = globals;
    const file = "src\\index.svelte";

    // (137:0) {#if launcher.updateFound}
    function create_if_block_7(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "a launcher update is downloading";
    			add_location(p, file, 137, 4, 5048);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(137:0) {#if launcher.updateFound}",
    		ctx
    	});

    	return block;
    }

    // (166:4) {:else}
    function create_else_block_3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Lancer THE jeu";
    			add_location(button, file, 166, 8, 5976);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(166:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (164:43) 
    function create_if_block_6(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "cleaning up";
    			add_location(p, file, 164, 8, 5935);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(164:43) ",
    		ctx
    	});

    	return block;
    }

    // (157:4) {#if games['witch_craft'].updating}
    function create_if_block_4(ctx) {
    	let if_block_anchor;

    	function select_block_type_3(ctx, dirty) {
    		if (/*games*/ ctx[1]["witch_craft"].progress === 0) return create_if_block_5;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(157:4) {#if games['witch_craft'].updating}",
    		ctx
    	});

    	return block;
    }

    // (143:0) {#if !games['witch_craft'].installed}
    function create_if_block(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*games*/ ctx[1]["witch_craft"].installing) return create_if_block_1;
    		if (/*games*/ ctx[1]["witch_craft"].cleanup) return create_if_block_3;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(143:0) {#if !games['witch_craft'].installed}",
    		ctx
    	});

    	return block;
    }

    // (160:8) {:else}
    function create_else_block_2(ctx) {
    	let p0;
    	let t1;
    	let p1;
    	let t2_value = /*games*/ ctx[1]["witch_craft"].progress + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			p0.textContent = "mise à jour en cours";
    			t1 = space();
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = text("%");
    			add_location(p0, file, 160, 12, 5785);
    			add_location(p1, file, 161, 12, 5826);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t2);
    			append_dev(p1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*games*/ 2 && t2_value !== (t2_value = /*games*/ ctx[1]["witch_craft"].progress + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(160:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (158:8) {#if games['witch_craft'].progress === 0}
    function create_if_block_5(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "checking for update";
    			add_location(p, file, 158, 12, 5728);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(158:8) {#if games['witch_craft'].progress === 0}",
    		ctx
    	});

    	return block;
    }

    // (153:4) {:else}
    function create_else_block_1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "installer le jeu";
    			add_location(button, file, 153, 8, 5528);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(153:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (151:43) 
    function create_if_block_3(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "cleaning up";
    			add_location(p, file, 151, 8, 5487);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(151:43) ",
    		ctx
    	});

    	return block;
    }

    // (144:4) {#if games['witch_craft'].installing}
    function create_if_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type_2(ctx, dirty) {
    		if (/*games*/ ctx[1]["witch_craft"].progress === 0) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(144:4) {#if games['witch_craft'].installing}",
    		ctx
    	});

    	return block;
    }

    // (147:8) {:else}
    function create_else_block(ctx) {
    	let p0;
    	let t1;
    	let p1;
    	let t2_value = /*games*/ ctx[1]["witch_craft"].progress + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			p0.textContent = "installation en cours";
    			t1 = space();
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = text("%");
    			add_location(p0, file, 147, 12, 5336);
    			add_location(p1, file, 148, 12, 5378);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t2);
    			append_dev(p1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*games*/ 2 && t2_value !== (t2_value = /*games*/ ctx[1]["witch_craft"].progress + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(147:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (145:8) {#if games['witch_craft'].progress === 0}
    function create_if_block_2(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "preparing installation";
    			add_location(p, file, 145, 12, 5276);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(145:8) {#if games['witch_craft'].progress === 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let t0;
    	let p;
    	let t2;
    	let if_block1_anchor;
    	let if_block0 = /*launcher*/ ctx[0].updateFound && create_if_block_7(ctx);

    	function select_block_type(ctx, dirty) {
    		if (!/*games*/ ctx[1]["witch_craft"].installed) return create_if_block;
    		if (/*games*/ ctx[1]["witch_craft"].updating) return create_if_block_4;
    		if (/*games*/ ctx[1]["witch_craft"].cleanup) return create_if_block_6;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			p = element("p");
    			p.textContent = "witchcraft - 50e essai";
    			t2 = space();
    			if_block1.c();
    			if_block1_anchor = empty();
    			add_location(p, file, 140, 0, 5098);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t2, anchor);
    			if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*launcher*/ ctx[0].updateFound) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_7(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t2);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
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

    function cancel() {
    	window.games.cancel();
    }

    function instance($$self, $$props, $$invalidate) {
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
    					$$invalidate(1, games[data.game].updating = true, games);
    					console.log("game installed");
    				} else {
    					$$invalidate(1, games[data.game].installing = true, games);
    					console.log("game not installed");
    				}

    				$$invalidate(1, games[data.game].progress = 0, games);
    			}

    			if (data.step === "download") {
    				console.log("downloading " + data.progress + "%");
    				$$invalidate(1, games[data.game].progress = data.progress, games);
    			}

    			if (data.step === "installation-start") {
    				console.log("starting installation");
    				if (games[data.game].installed) $$invalidate(1, games[data.game].updating = false, games); else $$invalidate(1, games[data.game].installing = false, games);
    				$$invalidate(1, games[data.game].cleanup = true, games);
    			}

    			if (data.step === "installation") {
    				console.log("installing " + data.progress + "%");
    			}

    			if (data.step === "complete") {
    				console.log("installation complete");
    				$$invalidate(1, games[data.game].installed = true, games);
    				$$invalidate(1, games[data.game].cleanup = false, games);
    				$$invalidate(1, games[data.game].needsUpdate = false, games);
    				$$invalidate(1, games[data.game].version = window.games.getDataForGame(data.game).version, games);
    				if (games[data.game].installed) $$invalidate(1, games[data.game].updating = false, games); else $$invalidate(1, games[data.game].installing = false, games);
    				if (games[data.game].wantsToLaunch) window.games.launch(data.game);
    			}
    		}

    		if (data.event === "update-launcher") {
    			if (data.step === "start") {
    				console.log("preparing launcher update");
    			}

    			if (data.step === "found") {
    				console.log("launcher update found");
    				$$invalidate(0, launcher.updateFound = true, launcher);
    			}

    			if (data.step === "not-found") console.log("launcher update not found");
    			if (data.step === "download") console.log("downloading launcher update " + data.progress + "%");

    			if (data.step === "complete") {
    				console.log("launcher update complete");
    			}

    			$$invalidate(0, launcher = { ...launcher });
    		}

    		if (data.event === "update") {
    			if (data.step === "uptodate") {
    				$$invalidate(1, games[data.game].updating = false, games);
    				$$invalidate(1, games[data.game].needsUpdate = false, games);
    				if (games[data.game].wantsToLaunch) window.games.launch(data.game);
    			}

    			if (data.step === "start") {
    				console.log("preparing update for: " + data.game);
    				$$invalidate(1, games[data.game].updating = true, games);
    				$$invalidate(1, games[data.game].progress = 0, games);
    			}

    			if (data.step === "download") {
    				console.log("downloading update " + data.progress + "% for: " + data.game);
    				$$invalidate(1, games[data.game].progress = data.progress, games);
    			}

    			if (data.step === "installation-start") {
    				$$invalidate(1, games[data.game].cleanup = true, games);
    			}

    			if (data.step === "complete") {
    				console.log("update complete for: " + data.game);
    				$$invalidate(1, games[data.game].updating = false, games);
    				$$invalidate(1, games[data.game].cleanup = false, games);
    				$$invalidate(1, games[data.game].needsUpdate = false, games);
    				if (games[data.game].wantsToLaunch) window.games.launch(data.game);
    			}
    		}

    		$$invalidate(1, games = { ...games });
    	});

    	function install(game) {
    		window.games.install(game);
    		$$invalidate(1, games[game].installing = true, games);
    		$$invalidate(1, games = { ...games });
    	}

    	function launch(game) {
    		$$invalidate(1, games[game].wantsToLaunch = true, games);
    		$$invalidate(1, games = { ...games });

    		if (games[game].needsUpdate === undefined) {
    			console.log("checking for update");
    			$$invalidate(1, games[game].updating = true, games);
    			$$invalidate(1, games = { ...games });
    			return window.games.needsUpdate(game, games[game].version);
    		} else {
    			window.games.launch("witch_craft");
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Src> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => install("witch_craft");
    	const click_handler_1 = () => launch("witch_craft");
    	$$self.$capture_state = () => ({ launcher, games, cancel, install, launch });

    	$$self.$inject_state = $$props => {
    		if ("launcher" in $$props) $$invalidate(0, launcher = $$props.launcher);
    		if ("games" in $$props) $$invalidate(1, games = $$props.games);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [launcher, games, install, launch, click_handler, click_handler_1];
    }

    class Src extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Src",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new Src({
    	target: document.body
    });

}());
