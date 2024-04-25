install:
	npm ci
page-loader-debug:
	DEBUG=axios,page-loader page-loader $(ARGS)
publish:
	npm publish --dry-run
lint:
	npx eslint .
test:
	NODE_OPTIONS=--experimental-vm-modules npx jest
test-debug:
	DEBUG=axios,nock.* NODE_OPTIONS=--experimental-vm-modules npx jest
test-coverage:
	NODE_OPTIONS=--experimental-vm-modules npx jest --coverage