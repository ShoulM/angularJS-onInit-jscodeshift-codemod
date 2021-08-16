# angularJS-onInit-jscodeshift-codemod
jscodeshift codemod that wraps controller logic in $onInit lifecycle hook. Useful for upgrading to angularJS 1.7+ where bindings are only available in $onInit hook.
## How to use?
Requires Node.js version 11 or above.

Get jscodeshift from [npm][]:

```
$ npm install -g jscodeshift
```

This will install the runner as `jscodeshift`.

Download transform.js and place it in a folder with your custom.js file.

Open command line in the folder and run:

```
$ jscodeshift ./custom.js
```
The custom.js file will be overidden with the transformed code.
