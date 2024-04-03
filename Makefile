install:
	npm ci
page-loader:
	DEBUG=axios node bin/page-loader.js
publish:
	npm publish --dry-run
lint:
	npx eslint .
test:
	NODE_OPTIONS=--experimental-vm-modules npx jest
test-coverage:
	NODE_OPTIONS=--experimental-vm-modules npx jest --coverage