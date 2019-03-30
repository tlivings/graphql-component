
import { DocumentNode, FieldDefinitionNode, DefinitionNode } from 'graphql';

const iterateObjectTypes = function *(definitions: ReadonlyArray<DefinitionNode>): Iterable<any> {
  for (const definition of definitions) {
    if (definition.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(definition.name.value) === -1) {
      yield definition;
    }
  }
};

export const buildFragments = function (document: DocumentNode) {
  const tree: { [k: string] : ReadonlyArray<FieldDefinitionNode> } = {};
  const fragments = [];

  for (const { name, fields } of iterateObjectTypes(document.definitions)) {
    tree[name.value] = fields;
  }

  for (const [root, fieldDefs] of Object.entries(tree)) {
    const fields: string[] = [];

    for (const { name, type } of fieldDefs) {
      let current: any = type;

      if (type.kind === 'ListType') {
        current = type.type;
      }

      if (current.name && tree[current.name.value]) {
        fields.push(`${name.value} { ...All${current.name.value} }`);
        continue;
      }
      fields.push(name.value);
    }

    fragments.push(`fragment All${root} on ${root} { ${fields.join(', ')} }`);
  }

  return fragments;
};