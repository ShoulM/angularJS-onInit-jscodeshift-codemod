export default function transformer(file, api) {
    const j = api.jscodeshift;
    const ngLifeCycleHooks = ['$onChanges', '$doCheck', '$onDestroy', '$postLink'];

    j.registerMethods({
      	//returns true if controller has a $onInit life cycle hook
        doesControllerHaveOnInitHook: function() {
          	let functionExpressions = this.find(j.FunctionExpression);
          	let arrowFunctionExpressions = this.find(j.ArrowFunctionExpression);
          	let allFunctionExpressions = j(functionExpressions.paths().concat(arrowFunctionExpressions.paths()));
            return allFunctionExpressions
                .closest(j.AssignmentExpression)
                .filter((path) => path.node.left.property.name === "$onInit").length
        },
      	//finds all nodes belonging to angularjs life cycle hooks (e.g $onDestroy)
        findNgLifeCycleHookFunctions: function() {
            return this.find(j.MemberExpression, (node) => ngLifeCycleHooks.indexOf(node.property.name) > -1)
                .closest(j.ExpressionStatement);
        },
      	//finds all nodes that are variable declarations of this closure (e.g var vm = this;)
        findThisClosureVariableDeclerations: function(controllerFunctionPath) {
            return this.find(j.VariableDeclarator, (node) => node.init.type === j.ThisExpression.name)
                .filter((path) => path.parent.parent.parent.node === controllerFunctionPath.node)
                .closest(j.VariableDeclaration);
        }
    });

    const root = j(file.source);

    //finds controllers defined as part of component
    let componentInlineControllers = root
        .find(j.CallExpression, (node) => node.callee.object && node.callee.object.name === 'app' &&
            node.callee.property.name === 'component')
        .find(j.ObjectExpression)
        .find(j.FunctionExpression)
        .filter((path) => {
            let propertyParentNode;
            if (path.parent.node.type === j.Property.name){
                propertyParentNode = path.parent.node;
            }
            else if (path.parent.parent.node.type === j.Property.name){
                propertyParentNode = path.parent.parent.node;
            }
            else{
                return false;
            }
            return propertyParentNode.key.name === 'controller';
        });
  	

    //find all stand alone controllers
    let controllers = root
        .find(j.CallExpression)
        .find(j.FunctionExpression)
        .filter((path) => {
            let callExpressionParentNode;
            if (path.parent.parent.node.type === j.CallExpression.name) {
                callExpressionParentNode = path.parent.parent.node;
            }
            else if (path.parent.node.type === j.CallExpression.name) {
                callExpressionParentNode = path.parent.node;
            }
            else {
                return false;
            }
            return callExpressionParentNode.callee.object && callExpressionParentNode.callee.object.name === "app" &&
                callExpressionParentNode.callee.property.name === "controller"
        });

    let allControllers = j(controllers.paths().concat(componentInlineControllers.paths()));

    allControllers
        .forEach((controllerFunctionPath) => {
            if (j(controllerFunctionPath).doesControllerHaveOnInitHook()) {
                return;
            }
            let thisClosureDeclerators = j(controllerFunctionPath).findThisClosureVariableDeclerations(controllerFunctionPath);
            //find all existing life cycle functions so that they can be excluded from the $onInit function scope
            let lifeCycleFunctions = j(controllerFunctionPath).findNgLifeCycleHookFunctions();
            let onInitFunction = j.template.expression`this.$onInit = function(){${controllerFunctionPath.node.body}}`;
            onInitFunction = j.expressionStatement(onInitFunction);
            let newBlock = j.blockStatement([thisClosureDeclerators.nodes(), onInitFunction, lifeCycleFunctions.nodes()].flat());
            j(controllerFunctionPath).replaceWith(j.functionExpression(null, controllerFunctionPath.node.params, newBlock));
            //remove existing life cycle functions so that we don't have duplicates
            lifeCycleFunctions.remove();
            thisClosureDeclerators.remove();
        });

    return root.toSource();
}
