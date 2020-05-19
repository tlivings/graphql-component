'use strict';

const debug = require('debug')('graphql-component:resolver');
const { GraphQLScalarType, Kind, execute } = require('graphql');
const deepSet = require('lodash.set');

const memoize = function (parentType, fieldName, resolve) {
  const _cache = new WeakMap();

  return function (_, args, context, info) {
    const key = `${info.path.key}_${JSON.stringify(args)}`;

    debug(`executing ${parentType}.${fieldName}`);

    let cached = _cache.get(context);

    if (cached && cached[key]) {
      debug(`return cached result of memoized ${parentType}.${fieldName}`);
      return cached[key];
    }

    if (!cached) {
      cached = {};
    }

    const result = resolve(_, args, context, info);

    cached[key] = result;

    _cache.set(context, cached);

    debug(`cached ${parentType}.${fieldName}`);

    return result;
  };
};

const transformResolvers = function (resolvers, excludes) {
  if (!excludes || excludes.length < 1) {
    return resolvers;
  }

  let filteredResolvers = Object.assign({}, resolvers);

  for (const [root, name] of excludes) {
    if (root === '*') {
      filteredResolvers = {};
      break;
    }
    if (!name || name === '' || name === '*') {
      delete filteredResolvers[root];
      continue;
    }
    delete filteredResolvers[root][name];
  }

  return filteredResolvers;
};

const wrapResolvers = function (bind, resolvers = {}) {
  const wrapped = {};

  for (const [name, value] of Object.entries(resolvers)) {
    if (value instanceof GraphQLScalarType) {
      wrapped[name] = value;
      continue;
    }
    if (!wrapped[name]) {
      wrapped[name] = {};
    }

    for (const [resolverName, func] of Object.entries(value)) {
      if (wrapped[name][resolverName]) {
        continue;
      }
      if (['Query', 'Mutation', 'Subscription'].indexOf(name) > -1) {
        debug(`memoized ${name}.${resolverName}`);
        wrapped[name][resolverName] = memoize(name, resolverName, func.bind(bind));
        continue;
      }
      // bind if the value mapped to a resolverName is a function
      // otherwise dont to support internal enum value remapping
      wrapped[name][resolverName] = typeof func === 'function' ? func.bind(bind) : func;
    }

  }

  return wrapped;
};

const buildPathFromInfo = function (info) {
  const path = [];
  let current = info.path;

  do {
    path.unshift(current.key);
    current = current.prev;
  }
  while (current !== undefined);

  return path;
};

const getSelectionSetForPath = function (fieldPath, selectionSet) {
  const getSelection = function (name, selections) {
    for (const selection of selections) {
      if (selection.name.value === name || selection.alias.value === name) {
        return selection;
      }
    }
  };

  let path = fieldPath.shift();
  let current = getSelection(path, selectionSet.selections);

  while (fieldPath.length > 0) {
    path = fieldPath.shift();
    current = current && getSelection(path, current.selectionSet.selections);
  }

  return current;
};

const createSubOperationForField = function (fieldPath, info) {
  const operation = info.operation;
  const fragments = info.fragments;

  const definitions = [];

  if (fragments) {
    for (const [, fragmentDefinition] of Object.entries(fragments)) {
      definitions.push(fragmentDefinition);
    }
  }

  //TODO: filter out fields not available on component.schema
  const selections = getSelectionSetForPath([...fieldPath], operation.selectionSet);

  definitions.push({
    kind: Kind.OPERATION_DEFINITION,
    operation: operation.operation,
    variableDefinitions: operation.variableDefinitions,
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [
        selections
      ]
    }
  });

  return {
    kind: Kind.DOCUMENT,
    definitions
  };
};

const delegateToComponent = async function (component, { subPath, contextValue, info }) {
  const rootPath = buildPathFromInfo(info);
  const fieldPath = subPath !== undefined ? [...rootPath, ...subPath.split('.')] : rootPath;

  const { rootValue, variableValues } = info;

  const document = createSubOperationForField(fieldPath, info);

  const { data = {}, errors = [] } = await execute({ document, schema: component.schema, rootValue, contextValue, variableValues });
  
  if (errors.length > 0) {
    for (const error of errors) {
      deepSet(data, error.path, error);
    }
  }

  let result = {};

  //do not count current field resolver in path since that will exist in data result
  deepSet(result, rootPath.length > 1 ? rootPath.slice(0, rootPath.length - 1) : rootPath, data);

  while (fieldPath.length > 0) {
    let path = fieldPath.shift();
    result = result[path];
  }
  
  return result;
};

const createProxyResolver = function (component, root, fieldName) {
  const proxyResolver = async function (_, args, contextValue, info) {
    debug(`delegating ${root}.${fieldName} to ${component.name}`);
    
    const result = await delegateToComponent(component, { contextValue, info});
    
    return result[info.path.key];
  };

  proxyResolver.__isProxy = true;

  return proxyResolver;
};

const createProxyResolvers = function (component, resolvers) {
  const proxyResolvers = {};

  const iterateRootTypeResolvers = function* () {
    for (const name of Object.keys(resolvers)) {
      if (['Query', 'Mutation', 'Subscription'].indexOf(name) > -1) {
        yield [name, resolvers[name]];
      }
    }
  };

  for (const [root, fieldResolvers] of iterateRootTypeResolvers()) {
    if (proxyResolvers[root] === undefined) {
      proxyResolvers[root] = {};
    }
    for (const [field, resolver] of Object.entries(fieldResolvers)) {
      if (resolver.__isProxy === true) {
        proxyResolvers[root][field] = resolver;
        continue;
      }
      proxyResolvers[root][field] = createProxyResolver(component, root, field);
    }
  }

  return proxyResolvers;
};

module.exports = { memoize, transformResolvers, wrapResolvers, createProxyResolvers, createProxyResolver, delegateToComponent };
