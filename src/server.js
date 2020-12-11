import express from 'express';
import uuidv4 from 'uuid/v4';
//import helmet from 'helmet';
import sirv from 'sirv';
import bodyParser from 'body-parser';
import * as sapper from '@sapper/server';

const { PORT, NODE_ENV } = process.env;
const dev = NODE_ENV === 'development';

const server = express(); // You can also use Express

if(dev) server.use(sirv('static', {dev}))

server.use((req, res, next) => {
	res.locals.nonce = uuidv4();
	next();
});

/*server.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: [
				"'self'",
				"blob:",
				(req, res) =>`'nonce-${res.locals.nonce}'`
			],
			connectSrc: [
				"'self'",
				"*.googleapis.com",
				(req, res) => { return dev ? "localhost:10000" : "" }
			],
			styleSrc: [
				"'self'",
				"'unsafe-inline'"
			],
			imgSrc: [
				"'self'",
			]
		}
	}
}))*/

server.use(
	//compression({ threshold: 0 }),
	bodyParser.json(),
	sapper.middleware({
		session: (req, res) => {
			return {}
		}
	})
);

if(dev){
	// only listen when started in dev
	server.listen(PORT, err => {
	    if (err) console.log('error', err);
	});
}

export { server };
