
import gql from 'graphql-tag';

import debuglog from 'debug';
import { IGraphQLComponent } from './interface.types';

const debug = debuglog('graphql-component:types');

export const check = function (operation, fieldName, excludes) {
  for (const [root, name] in excludes) {
    if (root === '*') {
      return true;
    }
    return operation === root && (name === '' || name === '*' || name === fieldName);
  }
}

export const exclude = function (types, excludes) {
  if (!excludes || excludes.length < 1) {
    return types;
  }

  for (const doc of types) {
    for (const def of doc.definitions) {
      if (def.kind !== 'ObjectTypeDefinition') {
        continue;
      }
      if (['Query', 'Mutation', 'Subscription'].indexOf(def.name.value) > -1) {
        def.fields = def.fields.filter((field) => {
          if (!check(def.name.value, field.name.value, excludes)) {
            debug(`excluding ${def.name.value}.${field.name.value} from import`);
            return false;
          }
          return true;
        });
      }
    }
  }

  return types;
}

export const getImportedTypes = function (component: IGraphQLComponent, excludes?: string[]) {
  const types = component._types.map((type) => gql`${type}`);
  const importedTypes = component._importedTypes;
  return exclude([...types, ...importedTypes], excludes);
};

export default { exclude, check, getImportedTypes };
