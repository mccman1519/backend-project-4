install:
	npm ci
page-loader:
	node bin/page-loader.js
publish:
	npm publish --dry-run
lint:
	npx eslint .
test:
	DEBUG=nock.* NODE_OPTIONS=--experimental-vm-modules npx jest
test-coverage:
	NODE_OPTIONS=--experimental-vm-modules npx jest --coverage