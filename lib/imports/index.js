'use strict';

const graphql = require('graphql');
const { createProxyResolvers, transformResolvers } = require('../resolvers');

const debug = require('debug')('graphql-component:imports');

const parseExcludes = function (exclude) {
  const excludes = [];

  if (exclude && exclude.length > 0) {
    excludes.push(...exclude.map((filter) => filter.split('.')));
  }

  return excludes;
}

const check = function (operation, fieldName, excludes) {
  return excludes.map(([root, name]) => {
    if (root === '*') {
      return true;
    }
    return operation === root && (name === '' || name === '*' || name === fieldName);
  }).some(check => check);
};

const filterTypes  = function (types, excludes) {
  if (!excludes || excludes.length < 1) {
    return types;
  }
  
  for (const doc of types) {
    const { definitions } = doc;
    // iterate through the document's definitions and apply exclusions to applicable definitions.
    // if the definition has no fields after exclusions are applied, remove the definition from the document
    // we are iterating through the definitions backwards so that when we remove a definition the
    // inner for loop's index calculation stays in sync
    for (let i = definitions.length - 1; i >= 0; --i) {
      const def = definitions[i]
      if (def.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(def.name.value) > -1) {
        def.fields = def.fields.filter((field) => {
          if (check(def.name.value, field.name.value, excludes)) {
            debug(`excluding ${def.name.value}.${field.name.value} from import`);
            return false;
          }
          return true;
        });
        // all of the fields of this definition were removed, so remove the definition from the document
        if (def.fields.length === 0) {
          definitions.splice(i, 1);
        }
      }
    }
  }

  return types;
};

const namespaceDirectives = function (rootDirectives, id, document) {
  const namespaceEach = function (list) {
    for (const definition of list) {
      if (definition.kind === 'DirectiveDefinition' || definition.kind === 'Directive') {
        if (rootDirectives[definition.name.value]) {
          const name = `${definition.name.value}_${id}`;
          debug(`namespacing imported ${definition.name.value} directive as ${name}`);
          definition.name.value = name;
        }
      }
      if (definition.directives) {
        namespaceEach(definition.directives);
      }
      if (definition.fields) {
        namespaceEach(definition.fields);
      }
    }
  };
  
  namespaceEach(document.definitions);

  return document;
};

const buildDependencyTree = function (root) {
  const mergedTypes = [];
  const mergedResolvers = [];

  const visited = new Set();
  const queue = [...root.imports]; 

  const rootDirectives = root.directives;

  while (queue.length > 0) {
    const current = queue.shift();

    const { component, exclude } = current;

    if (visited.has(component.id)) {
      continue;
    }

    const excludes = parseExcludes(exclude);

    const types = filterTypes(component.types.map((type) => {
      return namespaceDirectives(rootDirectives, `${component.name}_${component.id}`, graphql.parse(type))
    }), excludes);

    mergedTypes.push(...types);

    const resolvers = createProxyResolvers(component, transformResolvers(component.resolvers, excludes));

    mergedResolvers.push(resolvers);

    visited.add(component.id);
    queue.push(...component.imports);
  }

  return { mergedTypes, mergedResolvers };
};

module.exports = { buildDependencyTree, filterTypes, namespaceDirectives };