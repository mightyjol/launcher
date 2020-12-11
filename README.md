# PLEASE READ

this repo is a tweak of 
https://github.com/matt3224/electrosapp.git

In order for this electron app to be functionnal when packaged (windows), i had to monkey-patch this file from sapper:
node_modules/sapper/runtime/server.mjs

```js
import fs from 'fs';
import path from 'path';
- import { dev, build_dir, src_dir, manifest } from './internal/manifest-server';
+ import { dev, src_dir, manifest } from './internal/manifest-server';
import { writable } from 'svelte/store.mjs';
import Stream from 'stream';
import http from 'http';
import Url from 'url';
import https from 'https';
import zlib from 'zlib';
import App from './internal/App.svelte';

+ import { build_dir as build_dir_local } from './internal/manifest-server';
+ let build_dir = path.resolve(__dirname, '../../../' , build_dir_local);

//...
```

If you find a better solution to avoid errors when packaging the app, please tell me :p