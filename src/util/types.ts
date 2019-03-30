
import gql from 'graphql-tag';
import debuglog from 'debug';
import { IGraphQLComponent } from '../typedefs';
import { DocumentNode, DefinitionNode } from 'graphql';

const debug = debuglog('graphql-component:types');

const iterateObjectTypes = function *(definitions: ReadonlyArray<DefinitionNode>): Iterable<any> {
  for (const definition of definitions) {
    if (definition.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(definition.name.value) > -1) {
      yield definition;
    }
  }
};

export const check = function (operation: string, fieldName: string, excludes: string[][]) {
  for (const filter in excludes) {
    const [root, name] = filter;

    if (root === '*') {
      return true;
    }
    return operation === root && (name === '' || name === '*' || name === fieldName);
  }
}

export const exclude = function (types: DocumentNode[], excludes?: string[][]) {
  if (!excludes || excludes.length < 1) {
    return types;
  }

  for (const doc of types) {
    for (const def of iterateObjectTypes(doc.definitions)) {
      def.fields = def.fields.filter((field) => {
        if (!check(def.name.value, field.name.value, excludes)) {
          debug(`excluding ${def.name.value}.${field.name.value} from import`);
          return false;
        }
        return true;
      });
    }
  }

  return types;
}

export const getImportedTypes = function (component: IGraphQLComponent, excludes?: string[][]) {
  const types = component.types.map((type) => gql`${type}`);
  const importedTypes = component.importedTypes;
  return exclude([...types, ...importedTypes], excludes);
};
