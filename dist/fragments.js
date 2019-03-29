"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterateObjectTypes = function* (definitions) {
    for (const definition of definitions) {
        if (definition.kind === 'ObjectTypeDefinition' && ['Query', 'Mutation', 'Subscription'].indexOf(definition.name.value) === -1) {
            yield definition;
        }
    }
};
exports.buildFragments = function (document) {
    const tree = {};
    const fragments = [];
    for (const { name, fields } of iterateObjectTypes(document.definitions)) {
        tree[name.value] = fields;
    }
    for (const [root, fieldDefs] of Object.entries(tree)) {
        const fields = [];
        for (const { name, type } of fieldDefs) {
            let current = type;
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
exports.default = { buildFragments: exports.buildFragments };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJhZ21lbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2ZyYWdtZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBLE1BQU0sa0JBQWtCLEdBQUcsUUFBUyxDQUFDLEVBQUMsV0FBMEM7SUFDOUUsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUU7UUFDcEMsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLHNCQUFzQixJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUM3SCxNQUFNLFVBQVUsQ0FBQztTQUNsQjtLQUNGO0FBQ0gsQ0FBQyxDQUFDO0FBRVcsUUFBQSxjQUFjLEdBQUcsVUFBVSxRQUFzQjtJQUM1RCxNQUFNLElBQUksR0FBeUQsRUFBRSxDQUFDO0lBQ3RFLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztJQUVyQixLQUFLLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksa0JBQWtCLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFFO1FBQ3ZFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDO0tBQzNCO0lBRUQsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDcEQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1FBRTVCLEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxTQUFTLEVBQUU7WUFDdEMsSUFBSSxPQUFPLEdBQVEsSUFBSSxDQUFDO1lBRXhCLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUU7Z0JBQzVCLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO2FBQ3JCO1lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssWUFBWSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7Z0JBQzdELFNBQVM7YUFDVjtZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ3pCO1FBRUQsU0FBUyxDQUFDLElBQUksQ0FBQyxlQUFlLElBQUksT0FBTyxJQUFJLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDM0U7SUFFRCxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDLENBQUM7QUFFRixrQkFBZSxFQUFFLGNBQWMsRUFBZCxzQkFBYyxFQUFFLENBQUMifQ==